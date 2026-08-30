// ============================================================
// Shared types between main process and renderer
// ============================================================

/** File system entry in the project tree */
export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  children?: FileEntry[]
  size?: number
  modified?: number
  language?: string
}

/** Open editor tab */
export interface EditorTab {
  id: string
  path: string
  name: string
  language: string
  isDirty: boolean
  content?: string
}

/** Minecraft project type detection result */
export type MinecraftProjectType =
  | 'behavior_pack'
  | 'resource_pack'
  | 'addon'
  | 'script_api'
  | 'unknown'

/** Detected Minecraft project info */
export interface MinecraftProjectInfo {
  type: MinecraftProjectType
  hasBP: boolean
  hasRP: boolean
  hasScripts: boolean
  bpPath?: string
  rpPath?: string
  bpManifest?: MinecraftManifest
  rpManifest?: MinecraftManifest
}

/** Minecraft pack manifest.json structure */
export interface MinecraftManifest {
  format_version: number
  header: {
    name: string
    description?: string
    uuid: string
    version: [number, number, number]
    min_engine_version?: [number, number, number]
  }
  modules?: Array<{
    type: string
    uuid: string
    version: [number, number, number]
    entry?: string
    language?: string
  }>
  dependencies?: Array<{
    uuid: string
    version: [number, number, number]
  }>
}

/** Diagnostic severity */
export type DiagnosticSeverity = 'error' | 'warning' | 'info' | 'hint'

/** A diagnostic entry (problem) */
export interface Diagnostic {
  severity: DiagnosticSeverity
  file: string
  line?: number
  column?: number
  message: string
  code?: string
  source?: string
}

/** App settings stored locally */
export interface AppSettings {
  general: {
    theme: 'dark' | 'light'
    autosave: boolean
    autosaveInterval: number // ms
    fontSize: number
    tabSize: number
    wordWrap: boolean
  }
  ai: {
    provider: string
    baseUrl: string
    apiKey: string
    defaultModel: string
    maxIterations: number
    autonomyLevel: 'conservative' | 'balanced' | 'autonomous'
  }
  minecraft: {
    preferredVersion: string
    projectDetection: boolean
    validationEnabled: boolean
  }
  terminal: {
    shell: string
  }
}

// ============================================================
// Phase 2 — Project Engine types
// ============================================================

/** Compact summary of a file's structure (stored in index cache) */
export interface FileSummary {
  type: 'json' | 'script' | 'manifest' | 'mcfunction' | 'other'
  /** Minecraft identifiers declared in this file */
  identifiers?: string[]
  /** JS/TS exports */
  exports?: string[]
  /** JS/TS imports (module specifiers) */
  imports?: string[]
  /** Other files this file references by path or ID */
  references?: string[]
  /** Human-readable description (e.g. pack name from manifest) */
  description?: string
  /** Components used (entities) */
  components?: string[]
}

/** Per-file index entry */
export interface FileIndexEntry {
  path: string
  /** SHA-1 of file content */
  hash: string
  /** fs.statSync().mtimeMs */
  mtime: number
  language: string
  size: number
  summary: FileSummary
  /** When this entry was indexed */
  parsedAt: number
}

/** Dependency graph edge */
export interface DependencyEdge {
  from: string   // file path
  to: string     // file path or identifier
  type: 'import' | 'reference' | 'entity_use' | 'animation_ref'
}

/** Identifier registry — all known IDs in the project */
export interface IdentifierRegistry {
  entities: string[]
  items: string[]
  blocks: string[]
  animations: string[]
  animationControllers: string[]
  renderControllers: string[]
  particles: string[]
  sounds: string[]
  functions: string[]
}

/** Full project index (serializable to disk) */
export interface ProjectIndex {
  projectPath: string
  indexedAt: number
  fileCount: number
  files: Record<string, FileIndexEntry>
  identifiers: IdentifierRegistry
  dependencies: DependencyEdge[]
  diagnostics: Diagnostic[]
}

/** Indexer progress update sent from main → renderer */
export interface IndexProgress {
  done: number
  total: number
  currentFile: string
  phase: 'scanning' | 'indexing' | 'graphing' | 'validating' | 'complete'
}

/** Search result */
export interface SearchResult {
  file: string
  line: number
  column: number
  preview: string
  matchStart: number
  matchLength: number
}

// ============================================================
// Phase 3 — AI Foundation types
// ============================================================

export type ChatRole = 'system' | 'user' | 'assistant'

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  timestamp: number
  /** Associated file references or tokens used could go here */
  context?: {
    files?: string[]
    tokens?: number
  }
}

export interface ChatCompletionRequest {
  messages: ChatMessage[]
  model?: string
  temperature?: number
  maxTokens?: number
}

/** IPC channels — request/response pairs */
export const IPC = {
  // File system
  FS_OPEN_PROJECT: 'fs:openProject',
  FS_READ_FILE: 'fs:readFile',
  FS_WRITE_FILE: 'fs:writeFile',
  FS_LIST_DIR: 'fs:listDir',
  FS_SAVE_FILE: 'fs:saveFile',
  FS_WATCH_START: 'fs:watchStart',
  FS_WATCH_STOP: 'fs:watchStop',
  FS_FILE_CHANGED: 'fs:fileChanged', // main → renderer

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  // Terminal / PTY
  PTY_CREATE: 'pty:create',
  PTY_INPUT: 'pty:input',
  PTY_RESIZE: 'pty:resize',
  PTY_KILL: 'pty:kill',
  PTY_DATA: 'pty:data', // main → renderer

  // Minecraft
  MC_DETECT_PROJECT: 'mc:detectProject',

  // Window
  WIN_SHOW_OPEN_DIALOG: 'win:showOpenDialog',

  // Phase 2 — Indexer
  INDEXER_START: 'indexer:start',
  INDEXER_PROGRESS: 'indexer:progress',   // main → renderer
  INDEXER_COMPLETE: 'indexer:complete',   // main → renderer
  INDEXER_GET: 'indexer:get',             // get current index
  INDEXER_FILE_CHANGED: 'indexer:fileChanged', // trigger re-index single file
  INDEXER_CANCEL: 'indexer:cancel',

  // Phase 2 — Search
  SEARCH_QUERY: 'search:query',

  // Phase 3 — AI Chat
  AI_CHAT_REQUEST: 'ai:chatRequest',
  AI_CHAT_CANCEL: 'ai:chatCancel',
  AI_CHAT_STREAM_DATA: 'ai:chatStreamData', // main → renderer
  AI_CHAT_STREAM_END: 'ai:chatStreamEnd',   // main → renderer
  AI_CHAT_STREAM_ERROR: 'ai:chatStreamError', // main → renderer
} as const

export type IPCChannel = (typeof IPC)[keyof typeof IPC]

/** IPC response wrapper */
export interface IPCResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

