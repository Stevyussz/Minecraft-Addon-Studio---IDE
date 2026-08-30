import * as fs from 'fs'
import type { FileSummary } from '../../shared/types'

const MAX_PARSE_SIZE = 256 * 1024 // 256KB for scripts

/**
 * Lightweight JS/TS script parser using regex.
 *
 * Does NOT use a full AST parser (too heavy for background indexing).
 * Extracts:
 *   - import specifiers (especially @minecraft/* modules)
 *   - export names (functions, classes, const)
 *   - Class names
 *   - Script API usage (world, system, etc.)
 *
 * Fast enough for incremental indexing without blocking the event loop.
 */
export class ScriptParser {
  static parseFile(filePath: string): FileSummary {
    try {
      const stat = fs.statSync(filePath)
      if (stat.size > MAX_PARSE_SIZE) {
        return { type: 'script', description: `Large script (${Math.round(stat.size / 1024)}KB)` }
      }
      const content = fs.readFileSync(filePath, 'utf-8')
      return ScriptParser.parseContent(content)
    } catch {
      return { type: 'script' }
    }
  }

  static parseContent(content: string): FileSummary {
    const imports: string[] = []
    const exports: string[] = []

    // ── Import statements ──
    // import { ... } from 'module'
    // import * as x from 'module'
    // import x from 'module'
    const importRegex = /^\s*import\s+(?:[^'"]*\s+from\s+)?['"]([^'"]+)['"]/gm
    let match: RegExpExecArray | null
    while ((match = importRegex.exec(content)) !== null) {
      const mod = match[1]
      if (mod && !imports.includes(mod)) imports.push(mod)
    }

    // Dynamic imports: import('module')
    const dynImportRegex = /import\(['"]([^'"]+)['"]\)/g
    while ((match = dynImportRegex.exec(content)) !== null) {
      const mod = match[1]
      if (mod && !imports.includes(mod)) imports.push(mod)
    }

    // require('module') — for CommonJS
    const requireRegex = /require\(['"]([^'"]+)['"]\)/g
    while ((match = requireRegex.exec(content)) !== null) {
      const mod = match[1]
      if (mod && !imports.includes(mod)) imports.push(mod)
    }

    // ── Export statements ──
    // export function/class/const/let/var name
    const exportNamedRegex = /^\s*export\s+(?:default\s+)?(?:function|class|const|let|var|async\s+function)\s+(\w+)/gm
    while ((match = exportNamedRegex.exec(content)) !== null) {
      if (match[1] && !exports.includes(match[1])) exports.push(match[1])
    }
    // export { name1, name2 }
    const exportBraceRegex = /^\s*export\s+\{([^}]+)\}/gm
    while ((match = exportBraceRegex.exec(content)) !== null) {
      const names = match[1].split(',').map(n => n.trim().split(/\s+as\s+/).pop()?.trim() ?? '').filter(Boolean)
      for (const name of names) {
        if (!exports.includes(name)) exports.push(name)
      }
    }

    // ── Minecraft Script API usage detection ──
    const minecraftImports = imports.filter(i => i.startsWith('@minecraft/'))
    const description = minecraftImports.length > 0
      ? `Script API: ${minecraftImports.join(', ')}`
      : undefined

    return {
      type: 'script',
      imports,
      exports,
      description,
    }
  }
}
