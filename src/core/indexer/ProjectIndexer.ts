import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { FileCache } from './FileCache'
import { JsonParser } from './JsonParser'
import { ScriptParser } from './ScriptParser'
import { DependencyGraph } from './DependencyGraph'
import { IdentifierRegistry as IdentifierRegistryBuilder } from './IdentifierRegistry'
import { JsonValidator } from '../validation/JsonValidator'
import type {
  FileIndexEntry,
  FileSummary,
  ProjectIndex,
  IndexProgress,
  Diagnostic,
  IdentifierRegistry,
} from '../../shared/types'
import { getLanguage } from '../minecraft/detector'

/** Files/dirs to always skip during indexing */
const SKIP_DIRS = new Set(['node_modules', '.git', '.vscode', 'dist', 'build', '.cache', '__pycache__'])
const SKIP_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ogg', '.wav', '.mp4', '.ttf', '.woff', '.woff2', '.bin'])
/** Max file size to index (beyond this: record but don't parse content) */
const MAX_INDEX_SIZE = 512 * 1024 // 512KB
/** Batch size for non-blocking chunked processing */
const BATCH_SIZE = 20

type ProgressCallback = (progress: IndexProgress) => void

/**
 * Main project indexer.
 *
 * Design goals ("GA BERAT"):
 *   - Never blocks the event loop for more than ~5ms at a time
 *   - Uses setImmediate between batches to yield to IPC/UI
 *   - Cache-based incremental: skips unchanged files
 *   - Max 512KB per file to parse
 *   - Runs entirely in Electron main process (not renderer)
 */
export class ProjectIndexer {
  private cache: FileCache
  private cacheDir: string
  private cancelled = false
  private graph = new DependencyGraph()
  private registryBuilder = new IdentifierRegistryBuilder()

  constructor(cacheDir: string, projectPath: string) {
    this.cacheDir = cacheDir
    this.cache = new FileCache(cacheDir, projectPath)
  }

  /** Cancel a running index operation */
  cancel(): void {
    this.cancelled = true
  }

  /**
   * Full index of a project directory.
   * Calls onProgress periodically — caller can send these to renderer via IPC.
   */
  async indexProject(
    projectPath: string,
    onProgress: ProgressCallback,
  ): Promise<ProjectIndex> {
    this.cancelled = false

    // Phase 1: Gather all indexable files (sync, fast)
    onProgress({ done: 0, total: 0, currentFile: 'Scanning files…', phase: 'scanning' })
    const files = gatherFiles(projectPath)
    const total = files.length

    // Phase 2: Parse files in batches (non-blocking)
    const newEntries: FileIndexEntry[] = []
    const diagnostics: Diagnostic[] = []
    let done = 0

    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      if (this.cancelled) break

      const batch = files.slice(i, i + BATCH_SIZE)
      for (const filePath of batch) {
        if (this.cancelled) break

        try {
          const entry = this.indexFile(filePath)
          newEntries.push(entry)

          // Run manifest validation inline
          if (path.basename(filePath) === 'manifest.json' && entry.summary.type === 'manifest') {
            try {
              const content = fs.readFileSync(filePath, 'utf-8')
              const parsed = JSON.parse(content)
              const manDiags = JsonValidator.validateManifest(filePath, parsed)
              diagnostics.push(...manDiags)
            } catch { /* ignore */ }
          }

          // Collect JSON parse diagnostics from JsonParser
          if (entry.language === 'json') {
            const { diagnostics: jsonDiags } = JsonParser.parseFile(filePath)
            for (const d of jsonDiags) {
              if (d.severity === 'error') diagnostics.push(d)
            }
          }
        } catch { /* single file failure should not abort the whole index */ }
      }

      done = Math.min(i + BATCH_SIZE, files.length)
      onProgress({
        done,
        total,
        currentFile: batch[batch.length - 1] ?? '',
        phase: 'indexing',
      })

      // Yield to event loop — this is what keeps MAS "GA BERAT"
      await yieldToEventLoop()
    }

    if (this.cancelled) {
      // Return partial index
      return this.buildIndex(projectPath, newEntries, [], [])
    }

    // Phase 3: Build dependency graph
    onProgress({ done: total, total, currentFile: 'Building dependency graph…', phase: 'graphing' })
    await yieldToEventLoop()
    const edges = this.graph.build(newEntries)

    // Phase 4: Build identifier registry
    onProgress({ done: total, total, currentFile: 'Building identifier registry…', phase: 'validating' })
    await yieldToEventLoop()
    const identifiers = this.registryBuilder.build(newEntries)

    // Save cache to disk
    this.cache.save()

    const index = this.buildIndex(projectPath, newEntries, edges, diagnostics, identifiers)
    onProgress({ done: total, total, currentFile: '', phase: 'complete' })
    return index
  }

  /**
   * Re-index a single file (fast, for file-watch triggered updates).
   * Returns updated entry + any new diagnostics.
   */
  reindexFile(filePath: string): { entry: FileIndexEntry; diagnostics: Diagnostic[] } {
    const entry = this.indexFile(filePath)
    const diagnostics: Diagnostic[] = []

    if (path.basename(filePath) === 'manifest.json') {
      try {
        const content = fs.readFileSync(filePath, 'utf-8')
        const parsed = JSON.parse(content)
        diagnostics.push(...JsonValidator.validateManifest(filePath, parsed))
      } catch { /* ignore */ }
    }

    this.cache.save()
    return { entry, diagnostics }
  }

  /** Get cached index entry for a file */
  getCachedEntry(filePath: string): FileIndexEntry | undefined {
    return this.cache.get(filePath)
  }

  // ──── Private helpers ────────────────────────────────────

  private indexFile(filePath: string): FileIndexEntry {
    const cached = this.cache.get(filePath)

    // Check if we can skip (fast path)
    if (cached && !this.cache.isChanged(filePath)) {
      return cached
    }

    // Actually index the file
    let stat: fs.Stats
    try {
      stat = fs.statSync(filePath)
    } catch {
      // File was deleted between scan and now — return stub
      return makeStubEntry(filePath)
    }

    const hash = this.cache.hashFile(filePath)
    const language = getLanguage(filePath)
    const size = stat.size

    let summary: FileSummary
    if (size > MAX_INDEX_SIZE) {
      summary = { type: language === 'json' ? 'json' : 'other', description: `Large file (${Math.round(size / 1024)}KB)` }
    } else if (language === 'json') {
      const { summary: s } = JsonParser.parseFile(filePath)
      summary = s
    } else if (language === 'javascript' || language === 'typescript') {
      summary = ScriptParser.parseFile(filePath)
    } else {
      summary = { type: 'other' }
    }

    const entry: FileIndexEntry = {
      path: filePath,
      hash,
      mtime: stat.mtimeMs,
      language,
      size,
      summary,
      parsedAt: Date.now(),
    }

    this.cache.set(entry)
    return entry
  }

  private buildIndex(
    projectPath: string,
    entries: FileIndexEntry[],
    edges: ReturnType<DependencyGraph['build']>,
    diagnostics: Diagnostic[],
    identifiers?: IdentifierRegistry,
  ): ProjectIndex {
    const files: Record<string, FileIndexEntry> = {}
    for (const e of entries) files[e.path] = e

    return {
      projectPath,
      indexedAt: Date.now(),
      fileCount: entries.length,
      files,
      identifiers: identifiers ?? emptyRegistry(),
      dependencies: edges,
      diagnostics,
    }
  }
}

// ── Helpers ────────────────────────────────────────────────

/** Yield to event loop between batches — core of non-blocking design */
function yieldToEventLoop(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve))
}

/** Gather all indexable files under projectPath (recursive, skips ignored dirs) */
function gatherFiles(dir: string): string[] {
  const results: string[] = []
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      if (SKIP_DIRS.has(entry.name)) continue

      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        results.push(...gatherFiles(fullPath))
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase()
        if (!SKIP_EXTS.has(ext)) {
          results.push(fullPath)
        }
      }
    }
  } catch { /* permission error on dir */ }
  return results
}

function makeStubEntry(filePath: string): FileIndexEntry {
  return {
    path: filePath,
    hash: '',
    mtime: 0,
    language: getLanguage(filePath),
    size: 0,
    summary: { type: 'other' },
    parsedAt: Date.now(),
  }
}

function emptyRegistry(): IdentifierRegistry {
  return {
    entities: [],
    items: [],
    blocks: [],
    animations: [],
    animationControllers: [],
    renderControllers: [],
    particles: [],
    sounds: [],
    functions: [],
  }
}
