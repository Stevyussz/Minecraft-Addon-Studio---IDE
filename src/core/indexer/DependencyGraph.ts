import * as path from 'path'
import type { FileIndexEntry, DependencyEdge } from '../../shared/types'

/**
 * Builds a lightweight dependency/reference graph from indexed files.
 *
 * Graph is built from file summaries — no re-reading of files.
 * Edges represent relationships like:
 *   - script imports another script/module
 *   - entity references animations
 *   - client_entity references geometry/textures
 *
 * Intentionally simple in Phase 2 — Phase 4+ will make this richer.
 */
export class DependencyGraph {
  private edges: DependencyEdge[] = []

  /** Build graph from all indexed entries */
  build(entries: FileIndexEntry[]): DependencyEdge[] {
    this.edges = []

    // Build a map: identifier → file path (for resolving references)
    const identifierToFile = new Map<string, string>()
    for (const entry of entries) {
      for (const id of entry.summary.identifiers ?? []) {
        identifierToFile.set(id, entry.path)
      }
    }

    for (const entry of entries) {
      const { path: filePath, summary } = entry

      // Script imports → edges
      if (summary.type === 'script' && summary.imports) {
        for (const imp of summary.imports) {
          if (imp.startsWith('@minecraft/')) {
            // External module — track but don't resolve to a file
            this.edges.push({ from: filePath, to: imp, type: 'import' })
          } else if (imp.startsWith('.') || imp.startsWith('/')) {
            // Relative import — resolve to file path
            const resolved = resolveRelative(filePath, imp)
            this.edges.push({ from: filePath, to: resolved, type: 'import' })
          }
        }
      }

      // Entity animation references
      if (summary.references) {
        for (const ref of summary.references) {
          // Check if it's a known animation ID
          const refFile = identifierToFile.get(ref)
          if (refFile) {
            this.edges.push({ from: filePath, to: refFile, type: 'animation_ref' })
          } else {
            this.edges.push({ from: filePath, to: ref, type: 'reference' })
          }
        }
      }
    }

    return this.edges
  }

  /** Get all files that depend on a given file */
  getDependents(filePath: string): string[] {
    return this.edges
      .filter(e => e.to === filePath)
      .map(e => e.from)
  }

  /** Get all files that this file depends on */
  getDependencies(filePath: string): string[] {
    return this.edges
      .filter(e => e.from === filePath)
      .map(e => e.to)
  }

  get allEdges(): DependencyEdge[] {
    return this.edges
  }
}

/** Resolve a relative JS import to an absolute path (best-effort) */
function resolveRelative(fromFile: string, importPath: string): string {
  const dir = path.dirname(fromFile)
  let resolved = path.resolve(dir, importPath)

  // Add .js if no extension
  if (!path.extname(resolved)) {
    resolved += '.js'
  }

  return resolved
}
