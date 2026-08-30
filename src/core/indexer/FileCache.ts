import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import type { FileIndexEntry } from '../../shared/types'

/**
 * Hash-based file cache for incremental indexing.
 *
 * Cache is stored as a flat JSON file in userData.
 * A file is considered unchanged if its mtime AND hash match the cache.
 *
 * Strategy:
 *   1. Check mtime first (cheap)
 *   2. If mtime changed, compute hash (slightly more expensive but fast)
 *   3. If hash unchanged despite mtime change → skip re-parse (safe bet for editors with touch)
 */
export class FileCache {
  private cacheDir: string
  private cacheFile: string
  private entries: Map<string, FileIndexEntry>
  private dirty = false

  constructor(cacheDir: string, projectPath: string) {
    this.cacheDir = cacheDir
    // Use a hash of the project path as the cache filename
    const projectHash = crypto
      .createHash('sha1')
      .update(projectPath)
      .digest('hex')
      .slice(0, 12)
    this.cacheFile = path.join(cacheDir, `index-${projectHash}.json`)
    this.entries = new Map()
    this.load()
  }

  /** Load cache from disk (silent fail) */
  private load(): void {
    try {
      if (!fs.existsSync(this.cacheFile)) return
      const raw = fs.readFileSync(this.cacheFile, 'utf-8')
      const obj = JSON.parse(raw) as Record<string, FileIndexEntry>
      for (const [k, v] of Object.entries(obj)) {
        this.entries.set(k, v)
      }
    } catch {
      // Corrupt or missing cache — start fresh
      this.entries.clear()
    }
  }

  /** Save cache to disk (async, fire-and-forget) */
  save(): void {
    if (!this.dirty) return
    try {
      fs.mkdirSync(this.cacheDir, { recursive: true })
      const obj: Record<string, FileIndexEntry> = {}
      for (const [k, v] of this.entries) {
        obj[k] = v
      }
      fs.writeFileSync(this.cacheFile, JSON.stringify(obj), 'utf-8')
      this.dirty = false
    } catch {
      // Non-critical — just skip
    }
  }

  /** Check if a file needs re-indexing. Returns true if CHANGED. */
  isChanged(filePath: string): boolean {
    const cached = this.entries.get(filePath)
    if (!cached) return true // not in cache → must index

    try {
      const stat = fs.statSync(filePath)
      if (stat.mtimeMs === cached.mtime) return false // mtime unchanged → skip (fast path)

      // mtime changed → check hash
      const hash = this.hashFile(filePath)
      return hash !== cached.hash
    } catch {
      return true // file may have been deleted → mark as changed
    }
  }

  /** Get cached entry */
  get(filePath: string): FileIndexEntry | undefined {
    return this.entries.get(filePath)
  }

  /** Store an entry */
  set(entry: FileIndexEntry): void {
    this.entries.set(entry.path, entry)
    this.dirty = true
  }

  /** Remove an entry (file deleted) */
  delete(filePath: string): void {
    if (this.entries.delete(filePath)) {
      this.dirty = true
    }
  }

  /** Invalidate all entries for a project (full re-index) */
  clear(): void {
    this.entries.clear()
    this.dirty = true
  }

  /** Get all cached entries */
  getAll(): FileIndexEntry[] {
    return Array.from(this.entries.values())
  }

  /** Get size */
  get size(): number {
    return this.entries.size
  }

  /** Compute SHA-1 hash of file content */
  hashFile(filePath: string): string {
    try {
      const content = fs.readFileSync(filePath)
      return crypto.createHash('sha1').update(content).digest('hex')
    } catch {
      return ''
    }
  }

  /** Compute hash of a string */
  static hashContent(content: string): string {
    return crypto.createHash('sha1').update(content, 'utf-8').digest('hex')
  }
}
