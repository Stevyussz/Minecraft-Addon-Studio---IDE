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
} as const

export type IPCChannel = (typeof IPC)[keyof typeof IPC]

/** IPC response wrapper */
export interface IPCResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}
