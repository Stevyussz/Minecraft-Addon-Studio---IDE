import * as fs from 'fs'
import type { FileSummary, Diagnostic } from '../../shared/types'

/** Max file size to fully parse (bytes). Larger files get minimal summary. */
const MAX_PARSE_SIZE = 512 * 1024 // 512 KB

/**
 * Minecraft-aware JSON structural parser.
 *
 * Extracts identifiers, components, and references from Bedrock JSON files.
 * Uses JSON.parse (fast native) — no custom parser.
 * Never throws on invalid JSON; returns diagnostics instead.
 */
export class JsonParser {
  /**
   * Parse a JSON file and return its summary + any diagnostics.
   * Non-blocking: caller is responsible for yield (setImmediate) between files.
   */
  static parseFile(filePath: string): { summary: FileSummary; diagnostics: Diagnostic[] } {
    const diagnostics: Diagnostic[] = []

    let content: string
    let size: number
    try {
      const stat = fs.statSync(filePath)
      size = stat.size

      if (size > MAX_PARSE_SIZE) {
        return {
          summary: { type: 'json', description: `Large file (${Math.round(size / 1024)}KB) — summary only` },
          diagnostics: [],
        }
      }
      content = fs.readFileSync(filePath, 'utf-8')
    } catch (err) {
      return {
        summary: { type: 'json' },
        diagnostics: [{
          severity: 'error',
          file: filePath,
          message: `Cannot read file: ${String(err)}`,
          source: 'indexer',
        }],
      }
    }

    // Validate JSON syntax
    let parsed: unknown
    try {
      parsed = JSON.parse(content)
    } catch (err) {
      const jsonErr = err as SyntaxError
      const position = extractErrorPosition(content, jsonErr.message)
      diagnostics.push({
        severity: 'error',
        file: filePath,
        line: position.line,
        column: position.col,
        message: `JSON syntax error: ${jsonErr.message}`,
        code: 'json/syntax',
        source: 'json-validator',
      })
      return { summary: { type: 'json' }, diagnostics }
    }

    // Extract Minecraft-specific structure
    const summary = JsonParser.extractSummary(filePath, parsed)
    return { summary, diagnostics }
  }

  /** Parse content string (already loaded — for re-parse after edit) */
  static parseContent(filePath: string, content: string): { summary: FileSummary; diagnostics: Diagnostic[] } {
    const diagnostics: Diagnostic[] = []

    let parsed: unknown
    try {
      parsed = JSON.parse(content)
    } catch (err) {
      const jsonErr = err as SyntaxError
      const position = extractErrorPosition(content, jsonErr.message)
      diagnostics.push({
        severity: 'error',
        file: filePath,
        line: position.line,
        column: position.col,
        message: `JSON syntax error: ${jsonErr.message}`,
        code: 'json/syntax',
        source: 'json-validator',
      })
      return { summary: { type: 'json' }, diagnostics }
    }

    const summary = JsonParser.extractSummary(filePath, parsed)
    return { summary, diagnostics }
  }

  /** Extract Minecraft-specific identifiers and references from parsed JSON */
  static extractSummary(filePath: string, parsed: unknown): FileSummary {
    if (typeof parsed !== 'object' || parsed === null) {
      return { type: 'json' }
    }

    const obj = parsed as Record<string, unknown>

    // ── manifest.json ──
    if (isManifest(obj)) {
      return {
        type: 'manifest',
        description: safeStr(getDeep(obj, 'header', 'name')) ?? 'Unknown Pack',
        identifiers: [safeStr(getDeep(obj, 'header', 'uuid')) ?? ''],
      }
    }

    // ── Entity definition ──
    if ('minecraft:entity' in obj) {
      const entity = obj['minecraft:entity'] as Record<string, unknown>
      const desc = entity['description'] as Record<string, unknown> | undefined
      const identifier = safeStr(desc?.['identifier'])
      const components = Object.keys((entity['components'] as Record<string, unknown>) ?? {})
      return {
        type: 'json',
        identifiers: identifier ? [identifier] : [],
        components,
        references: extractAnimationRefs(entity),
      }
    }

    // ── Client Entity definition ──
    if ('minecraft:client_entity' in obj) {
      const entity = obj['minecraft:client_entity'] as Record<string, unknown>
      const desc = entity['description'] as Record<string, unknown> | undefined
      const identifier = safeStr(desc?.['identifier'])
      const geometry = Object.values((desc?.['geometry'] as Record<string, unknown>) ?? {}).map(safeStr).filter(Boolean) as string[]
      const textures = Object.values((desc?.['textures'] as Record<string, unknown>) ?? {}).map(safeStr).filter(Boolean) as string[]
      return {
        type: 'json',
        identifiers: identifier ? [identifier] : [],
        references: [...geometry, ...textures],
      }
    }

    // ── Item definition ──
    if ('minecraft:item' in obj) {
      const item = obj['minecraft:item'] as Record<string, unknown>
      const desc = item['description'] as Record<string, unknown> | undefined
      const identifier = safeStr(desc?.['identifier'])
      return {
        type: 'json',
        identifiers: identifier ? [identifier] : [],
      }
    }

    // ── Block definition ──
    if ('minecraft:block' in obj) {
      const block = obj['minecraft:block'] as Record<string, unknown>
      const desc = block['description'] as Record<string, unknown> | undefined
      const identifier = safeStr(desc?.['identifier'])
      return {
        type: 'json',
        identifiers: identifier ? [identifier] : [],
      }
    }

    // ── Animations ──
    if ('animations' in obj && typeof obj['animations'] === 'object') {
      const ids = Object.keys(obj['animations'] as Record<string, unknown>)
      return { type: 'json', identifiers: ids }
    }

    // ── Animation Controllers ──
    if ('animation_controllers' in obj && typeof obj['animation_controllers'] === 'object') {
      const ids = Object.keys(obj['animation_controllers'] as Record<string, unknown>)
      return { type: 'json', identifiers: ids }
    }

    // ── Render Controllers ──
    if ('render_controllers' in obj && typeof obj['render_controllers'] === 'object') {
      const ids = Object.keys(obj['render_controllers'] as Record<string, unknown>)
      return { type: 'json', identifiers: ids }
    }

    // ── Particles ──
    if ('particle_effect' in obj) {
      const effect = obj['particle_effect'] as Record<string, unknown>
      const desc = effect['description'] as Record<string, unknown> | undefined
      const identifier = safeStr(desc?.['identifier'])
      return { type: 'json', identifiers: identifier ? [identifier] : [] }
    }

    // ── Loot tables / recipes — just record type ──
    if ('pools' in obj) return { type: 'json', description: 'Loot table' }
    if ('type' in obj && typeof obj['type'] === 'string' && obj['type'].startsWith('minecraft:')) {
      return { type: 'json', description: `Recipe: ${obj['type']}` }
    }

    return { type: 'json' }
  }
}

// ── Helpers ────────────────────────────────────────────────

function isManifest(obj: Record<string, unknown>): boolean {
  return (
    'format_version' in obj &&
    'header' in obj &&
    typeof obj['header'] === 'object' &&
    obj['header'] !== null &&
    'uuid' in (obj['header'] as Record<string, unknown>)
  )
}

function getDeep(obj: Record<string, unknown>, ...keys: string[]): unknown {
  let cur: unknown = obj
  for (const key of keys) {
    if (typeof cur !== 'object' || cur === null) return undefined
    cur = (cur as Record<string, unknown>)[key]
  }
  return cur
}

function safeStr(val: unknown): string | undefined {
  return typeof val === 'string' ? val : undefined
}

function extractAnimationRefs(entity: Record<string, unknown>): string[] {
  const desc = entity['description'] as Record<string, unknown> | undefined
  if (!desc) return []
  const anims = desc['animations'] as Record<string, string> | undefined
  if (!anims) return []
  return Object.values(anims).filter(v => typeof v === 'string')
}

/**
 * Try to extract line/column from JSON.parse error message.
 * Different engines produce different formats; this is best-effort.
 */
function extractErrorPosition(content: string, message: string): { line: number; col: number } {
  // V8: "Unexpected token ... at position N"
  const posMatch = /position (\d+)/i.exec(message)
  if (posMatch) {
    const pos = parseInt(posMatch[1], 10)
    const before = content.slice(0, pos)
    const line = (before.match(/\n/g) ?? []).length + 1
    const lastNl = before.lastIndexOf('\n')
    const col = lastNl === -1 ? pos : pos - lastNl
    return { line, col }
  }

  // SpiderMonkey / JSC: "... at line N column M"
  const lcMatch = /line (\d+) column (\d+)/i.exec(message)
  if (lcMatch) {
    return { line: parseInt(lcMatch[1], 10), col: parseInt(lcMatch[2], 10) }
  }

  return { line: 1, col: 1 }
}
