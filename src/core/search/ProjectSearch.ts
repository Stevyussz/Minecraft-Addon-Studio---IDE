import * as fs from 'fs'
import * as path from 'path'
import type { SearchResult, ProjectIndex } from '../../shared/types'

const MAX_RESULTS = 50
const MAX_SEARCH_FILE_SIZE = 256 * 1024 // 256KB
const CONTEXT_CHARS = 80 // chars of context around match

/**
 * Simple full-text project search.
 *
 * Design: no indexing needed — grep-style line-by-line scan.
 * Fast enough for projects up to ~500 files.
 * Results capped at MAX_RESULTS to keep IPC payload small.
 */
export class ProjectSearch {
  /**
   * Search for a query string across all project files.
   * Uses the index to know which files to search (skips binary files).
   * If no index is provided, falls back to filesystem scan.
   */
  static search(query: string, projectPath: string, index?: ProjectIndex): SearchResult[] {
    if (!query || query.trim().length < 2) return []

    const results: SearchResult[] = []
    const normalizedQuery = query.toLowerCase()
    const isCaseSensitive = query !== query.toLowerCase() // heuristic: if mixed case, treat as case-sensitive

    // Get searchable files
    const files: string[] = index
      ? Object.keys(index.files).filter(f => {
          const entry = index.files[f]
          return entry && entry.language !== 'binary' && entry.size < MAX_SEARCH_FILE_SIZE
        })
      : gatherSearchableFiles(projectPath)

    for (const filePath of files) {
      if (results.length >= MAX_RESULTS) break

      try {
        const content = fs.readFileSync(filePath, 'utf-8')
        const lines = content.split('\n')

        for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
          if (results.length >= MAX_RESULTS) break

          const line = lines[lineIdx]
          const searchIn = isCaseSensitive ? line : line.toLowerCase()
          const searchFor = isCaseSensitive ? query : normalizedQuery

          let col = searchIn.indexOf(searchFor)
          while (col !== -1 && results.length < MAX_RESULTS) {
            results.push({
              file: filePath,
              line: lineIdx + 1,
              column: col + 1,
              preview: truncateContext(line, col, query.length, CONTEXT_CHARS),
              matchStart: Math.max(0, col - Math.floor((CONTEXT_CHARS - query.length) / 2)),
              matchLength: query.length,
            })
            col = searchIn.indexOf(searchFor, col + 1)
          }
        }
      } catch { /* skip unreadable files */ }
    }

    return results
  }

  /**
   * Search only file names (instant — no file reads).
   */
  static searchFileNames(query: string, index: ProjectIndex): SearchResult[] {
    const results: SearchResult[] = []
    const q = query.toLowerCase()

    for (const filePath of Object.keys(index.files)) {
      if (results.length >= MAX_RESULTS) break
      const name = path.basename(filePath).toLowerCase()
      const col = name.indexOf(q)
      if (col !== -1) {
        results.push({
          file: filePath,
          line: 0,
          column: col + 1,
          preview: path.basename(filePath),
          matchStart: col,
          matchLength: query.length,
        })
      }
    }

    return results
  }

  /**
   * Search identifiers in the registry (instant — in-memory).
   */
  static searchIdentifiers(query: string, index: ProjectIndex): string[] {
    const q = query.toLowerCase()
    const all = [
      ...index.identifiers.entities,
      ...index.identifiers.items,
      ...index.identifiers.blocks,
      ...index.identifiers.animations,
    ]
    return all.filter(id => id.toLowerCase().includes(q)).slice(0, MAX_RESULTS)
  }
}

// ── Helpers ────────────────────────────────────────────────

function truncateContext(line: string, matchCol: number, matchLen: number, maxLen: number): string {
  const half = Math.floor((maxLen - matchLen) / 2)
  const start = Math.max(0, matchCol - half)
  const end = Math.min(line.length, matchCol + matchLen + half)
  let preview = line.slice(start, end).trimEnd()
  if (start > 0) preview = '…' + preview
  if (end < line.length) preview = preview + '…'
  return preview
}

function gatherSearchableFiles(dir: string): string[] {
  const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build'])
  const BINARY_EXTS = new Set(['.png', '.jpg', '.ogg', '.wav', '.bin', '.tga'])
  const results: string[] = []

  function walk(d: string) {
    try {
      const entries = fs.readdirSync(d, { withFileTypes: true })
      for (const e of entries) {
        if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue
        const full = path.join(d, e.name)
        if (e.isDirectory()) {
          walk(full)
        } else if (e.isFile()) {
          const ext = path.extname(e.name).toLowerCase()
          if (!BINARY_EXTS.has(ext)) results.push(full)
        }
      }
    } catch { /* skip */ }
  }

  walk(dir)
  return results
}
