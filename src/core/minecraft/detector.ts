import * as fs from 'fs'
import * as path from 'path'
import type { FileEntry, MinecraftManifest, MinecraftProjectInfo, MinecraftProjectType } from '../../shared/types'

/** Extensions that are commonly found in Minecraft Bedrock projects */
const MC_EXTENSIONS = new Set(['.json', '.js', '.ts', '.mcfunction', '.lang', '.material', '.molang'])

/**
 * Recursively read a directory into a FileEntry tree.
 * Limits depth to avoid huge trees on first load.
 */
export function readDirectoryTree(dirPath: string, depth = 0, maxDepth = 4): FileEntry {
  const stat = fs.statSync(dirPath)
  const name = path.basename(dirPath)

  if (!stat.isDirectory()) {
    return {
      name,
      path: dirPath,
      isDirectory: false,
      size: stat.size,
      modified: stat.mtimeMs,
      language: detectLanguage(name),
    }
  }

  let children: FileEntry[] = []

  if (depth < maxDepth) {
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true })
      children = entries
        .filter(e => !e.name.startsWith('.') && e.name !== 'node_modules')
        .map(e => readDirectoryTree(path.join(dirPath, e.name), depth + 1, maxDepth))
        .sort((a, b) => {
          // Directories first, then files alphabetically
          if (a.isDirectory && !b.isDirectory) return -1
          if (!a.isDirectory && b.isDirectory) return 1
          return a.name.localeCompare(b.name)
        })
    } catch (_err) {
      children = []
    }
  }

  return {
    name,
    path: dirPath,
    isDirectory: true,
    children,
    modified: stat.mtimeMs,
  }
}

/** Detect Monaco language ID from file extension */
export function detectLanguage(filename: string): string {
  const ext = path.extname(filename).toLowerCase()
  const map: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.json': 'json',
    '.jsonc': 'json',
    '.md': 'markdown',
    '.txt': 'plaintext',
    '.mcfunction': 'mcfunction',
    '.lang': 'plaintext',
    '.css': 'css',
    '.html': 'html',
    '.yml': 'yaml',
    '.yaml': 'yaml',
    '.toml': 'plaintext',
    '.sh': 'shell',
    '.py': 'python',
    '.png': 'binary',
    '.jpg': 'binary',
    '.jpeg': 'binary',
    '.ogg': 'binary',
    '.wav': 'binary',
    '.tga': 'binary',
  }
  return map[ext] ?? 'plaintext'
}

/**
 * Detect whether a directory is a Minecraft Bedrock project.
 * Heuristics:
 *  - Contains manifest.json with header.uuid → single pack
 *  - Contains BP/ or behavior_pack/ subdirectory with manifest → has BP
 *  - Contains RP/ or resource_pack/ subdirectory with manifest → has RP
 *  - Contains scripts/ directory → Script API
 */
export function detectMinecraftProject(rootPath: string): MinecraftProjectInfo {
  const result: MinecraftProjectInfo = {
    type: 'unknown',
    hasBP: false,
    hasRP: false,
    hasScripts: false,
  }

  // Check for direct manifest at root
  const rootManifest = tryReadManifest(path.join(rootPath, 'manifest.json'))

  // Check for BP
  const bpDirs = ['BP', 'behavior_pack', 'behavior_packs', 'BehaviorPack']
  for (const dir of bpDirs) {
    const bpPath = path.join(rootPath, dir)
    if (fs.existsSync(bpPath) && fs.statSync(bpPath).isDirectory()) {
      const manifest = tryReadManifest(path.join(bpPath, 'manifest.json'))
      if (manifest && isBehaviorPack(manifest)) {
        result.hasBP = true
        result.bpPath = bpPath
        result.bpManifest = manifest
        break
      }
    }
  }

  // Check for RP
  const rpDirs = ['RP', 'resource_pack', 'resource_packs', 'ResourcePack']
  for (const dir of rpDirs) {
    const rpPath = path.join(rootPath, dir)
    if (fs.existsSync(rpPath) && fs.statSync(rpPath).isDirectory()) {
      const manifest = tryReadManifest(path.join(rpPath, 'manifest.json'))
      if (manifest && isResourcePack(manifest)) {
        result.hasRP = true
        result.rpPath = rpPath
        result.rpManifest = manifest
        break
      }
    }
  }

  // If root has manifest and no BP/RP subdirs found, classify root itself
  if (!result.hasBP && !result.hasRP && rootManifest) {
    if (isBehaviorPack(rootManifest)) {
      result.hasBP = true
      result.bpPath = rootPath
      result.bpManifest = rootManifest
    } else if (isResourcePack(rootManifest)) {
      result.hasRP = true
      result.rpPath = rootPath
      result.rpManifest = rootManifest
    }
  }

  // Check for scripts
  const scriptsDirs = ['scripts', 'Scripts']
  for (const dir of scriptsDirs) {
    const scriptsPath = path.join(result.bpPath ?? rootPath, dir)
    if (fs.existsSync(scriptsPath)) {
      result.hasScripts = true
      break
    }
  }

  // Classify type
  result.type = classifyProject(result)

  return result
}

function classifyProject(info: MinecraftProjectInfo): MinecraftProjectType {
  if (info.hasBP && info.hasRP) return 'addon'
  if (info.hasBP && info.hasScripts) return 'script_api'
  if (info.hasBP) return 'behavior_pack'
  if (info.hasRP) return 'resource_pack'
  return 'unknown'
}

function tryReadManifest(manifestPath: string): MinecraftManifest | null {
  try {
    if (!fs.existsSync(manifestPath)) return null
    const content = fs.readFileSync(manifestPath, 'utf-8')
    const parsed = JSON.parse(content) as MinecraftManifest
    if (parsed?.header?.uuid) return parsed
    return null
  } catch {
    return null
  }
}

function isBehaviorPack(manifest: MinecraftManifest): boolean {
  if (!manifest.modules) return false
  const types = manifest.modules.map(m => m.type?.toLowerCase() ?? '')
  return types.some(t => ['data', 'script', 'javascript'].includes(t))
}

function isResourcePack(manifest: MinecraftManifest): boolean {
  if (!manifest.modules) return false
  const types = manifest.modules.map(m => m.type?.toLowerCase() ?? '')
  return types.some(t => ['resources'].includes(t))
}

/** Get file tree of the project (public interface used by IPC handler) */
export function getProjectTree(projectPath: string): FileEntry {
  return readDirectoryTree(projectPath, 0, 4)
}

/** List a directory (shallow, for lazy expand) */
export function listDirectory(dirPath: string): FileEntry[] {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    return entries
      .filter(e => !e.name.startsWith('.') && e.name !== 'node_modules')
      .map(e => {
        const fullPath = path.join(dirPath, e.name)
        const stat = fs.statSync(fullPath)
        return {
          name: e.name,
          path: fullPath,
          isDirectory: e.isDirectory(),
          size: e.isFile() ? stat.size : undefined,
          modified: stat.mtimeMs,
          language: e.isFile() ? detectLanguage(e.name) : undefined,
        } satisfies FileEntry
      })
      .sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1
        if (!a.isDirectory && b.isDirectory) return 1
        return a.name.localeCompare(b.name)
      })
  } catch {
    return []
  }
}

/** Alias for detectLanguage — used by the project indexer */
export const getLanguage = detectLanguage

