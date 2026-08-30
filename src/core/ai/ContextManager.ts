import type { ChatMessage, ProjectIndex, FileIndexEntry } from '../../shared/types'
import { TokenEstimator } from './TokenEstimator'
import * as fs from 'fs'

export interface ContextOptions {
  maxTokens?: number
  includeProjectSummary?: boolean
}

/**
 * Builds and manages context for AI prompts.
 * Designed for token efficiency: prioritizes index summaries over raw code.
 */
export class ContextManager {
  /**
   * Prepares the final array of messages to send to the AI.
   * Injects system prompt and project context.
   */
  static buildPrompt(
    history: ChatMessage[],
    index: ProjectIndex | null,
    options: ContextOptions = {}
  ): ChatMessage[] {
    const maxTokens = options.maxTokens ?? 8000 // default conservative limit
    const messages: ChatMessage[] = []

    // 1. Build System Message (Base Instructions + Context)
    let systemContent = `You are Antigravity, a powerful agentic AI coding assistant designed by Google Deepmind for Minecraft AI Studio.
You are pair programming with a user to solve their Minecraft Bedrock add-on tasks.
Be concise. Provide clear code.

`
    let systemTokens = TokenEstimator.estimate(systemContent)

    // Add project context if available
    if (index && options.includeProjectSummary !== false) {
      const projectContext = this.buildProjectSummary(index)
      const projectTokens = TokenEstimator.estimate(projectContext)
      
      // If project summary fits within 30% of our max budget, include it
      if (projectTokens < maxTokens * 0.3) {
        systemContent += projectContext
        systemTokens += projectTokens
      } else {
        // Truncate it if it's too large
        const truncated = TokenEstimator.truncate(projectContext, Math.floor(maxTokens * 0.3))
        systemContent += truncated
        systemTokens += TokenEstimator.estimate(truncated)
      }
    }

    messages.push({
      id: 'system',
      role: 'system',
      content: systemContent,
      timestamp: Date.now(),
    })

    // 2. Add history (working backwards to fit remaining tokens)
    const remainingTokens = maxTokens - systemTokens - 1000 // leave 1000 for generation
    let currentTokens = 0
    const historyToInclude: ChatMessage[] = []

    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i]
      const msgTokens = TokenEstimator.estimate(msg.content)
      
      if (currentTokens + msgTokens > remainingTokens && historyToInclude.length > 0) {
        // We've hit the limit, stop adding older messages
        break
      }
      
      historyToInclude.unshift(msg)
      currentTokens += msgTokens
    }

    messages.push(...historyToInclude)
    return messages
  }

  /**
   * Generates a token-efficient summary of the project using the Phase 2 index.
   */
  private static buildProjectSummary(index: ProjectIndex): string {
    let summary = `[PROJECT CONTEXT]\n`
    summary += `Path: ${index.projectPath}\n`
    summary += `Total Files: ${index.fileCount}\n\n`

    // Add high-level identifiers (entities, items) to give the AI context of what exists
    if (index.identifiers) {
      const ents = index.identifiers.entities
      if (ents.length > 0) {
        summary += `Entities (${ents.length}): ${ents.slice(0, 10).join(', ')}${ents.length > 10 ? '...' : ''}\n`
      }
      const items = index.identifiers.items
      if (items.length > 0) {
        summary += `Items (${items.length}): ${items.slice(0, 10).join(', ')}${items.length > 10 ? '...' : ''}\n`
      }
    }

    summary += `\n[FILE STRUCTURE SUMMARY]\n`
    
    // Group files by directory to make it token-efficient
    const dirs: Record<string, string[]> = {}
    for (const [filePath, entry] of Object.entries(index.files)) {
      // Skip binary/unimportant files from summary to save tokens
      if (entry.language === 'binary' || entry.summary.type === 'other') continue

      const relative = filePath.replace(index.projectPath, '').replace(/^[\/\\]/, '')
      const parts = relative.split(/[\/\\]/)
      const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '/'
      const file = parts[parts.length - 1]

      if (!dirs[dir]) dirs[dir] = []
      dirs[dir].push(file)
    }

    for (const [dir, files] of Object.entries(dirs)) {
      summary += `${dir}/\n  ${files.join(', ')}\n`
    }

    return summary
  }
}
