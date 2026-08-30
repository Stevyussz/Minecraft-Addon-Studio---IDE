import { contextBridge, ipcRenderer } from 'electron'
import type { AppSettings, FileEntry, IPCResponse, MinecraftProjectInfo, ProjectIndex, IndexProgress, SearchResult } from '../shared/types'
import { IPC } from '../shared/types'

/**
 * Secure preload bridge.
 * Exposes a typed `window.mas` API to the renderer.
 * No raw Node.js or Electron APIs are exposed.
 */

const masAPI = {
  // ─────────────────────────────────────────────────────────────
  // File system
  // ─────────────────────────────────────────────────────────────

  /** Open folder picker → returns project path + file tree */
  openProject: (): Promise<IPCResponse<{ projectPath: string; tree: FileEntry; mcInfo: MinecraftProjectInfo }>> =>
    ipcRenderer.invoke(IPC.WIN_SHOW_OPEN_DIALOG),

  /** Read a file's text content */
  readFile: (filePath: string): Promise<IPCResponse<string>> =>
    ipcRenderer.invoke(IPC.FS_READ_FILE, filePath),

  /** Write a file */
  writeFile: (filePath: string, content: string): Promise<IPCResponse> =>
    ipcRenderer.invoke(IPC.FS_WRITE_FILE, filePath, content),

  /** List a directory (shallow, for lazy tree expand) */
  listDir: (dirPath: string): Promise<IPCResponse<FileEntry[]>> =>
    ipcRenderer.invoke(IPC.FS_LIST_DIR, dirPath),

  /** Detect Minecraft project at path */
  detectProject: (projectPath: string): Promise<IPCResponse<MinecraftProjectInfo>> =>
    ipcRenderer.invoke(IPC.MC_DETECT_PROJECT, projectPath),

  // ─────────────────────────────────────────────────────────────
  // Settings
  // ─────────────────────────────────────────────────────────────

  getSettings: (): Promise<IPCResponse<AppSettings>> =>
    ipcRenderer.invoke(IPC.SETTINGS_GET),

  setSettings: (settings: Partial<AppSettings>): Promise<IPCResponse> =>
    ipcRenderer.invoke(IPC.SETTINGS_SET, settings),

  // ─────────────────────────────────────────────────────────────
  // Terminal / PTY
  // ─────────────────────────────────────────────────────────────

  /** Create a new PTY session, returns session ID */
  ptyCreate: (cwd: string, shell: string): Promise<IPCResponse<string>> =>
    ipcRenderer.invoke(IPC.PTY_CREATE, cwd, shell),

  /** Send input to a PTY session */
  ptyInput: (id: string, data: string): void =>
    ipcRenderer.send(IPC.PTY_INPUT, id, data),

  /** Resize PTY */
  ptyResize: (id: string, cols: number, rows: number): void =>
    ipcRenderer.send(IPC.PTY_RESIZE, id, cols, rows),

  /** Kill a PTY session */
  ptyKill: (id: string): Promise<IPCResponse> =>
    ipcRenderer.invoke(IPC.PTY_KILL, id),

  /** Subscribe to PTY data events */
  onPtyData: (callback: (id: string, data: string) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, id: string, data: string) => callback(id, data)
    ipcRenderer.on(IPC.PTY_DATA, listener)
    return () => ipcRenderer.removeListener(IPC.PTY_DATA, listener)
  },

  /** Subscribe to file changed events */
  onFileChanged: (callback: (filePath: string) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, filePath: string) => callback(filePath)
    ipcRenderer.on(IPC.FS_FILE_CHANGED, listener)
    return () => ipcRenderer.removeListener(IPC.FS_FILE_CHANGED, listener)
  },

  // ─────────────────────────────────────────────────────────────
  // Phase 2 — Indexer
  // ─────────────────────────────────────────────────────────────

  /** Start indexing a project (fires progress + complete events) */
  indexerStart: (projectPath: string): Promise<IPCResponse> =>
    ipcRenderer.invoke(IPC.INDEXER_START, projectPath),

  /** Get current index state */
  indexerGet: (): Promise<IPCResponse<ProjectIndex>> =>
    ipcRenderer.invoke(IPC.INDEXER_GET),

  /** Cancel any running index operation */
  indexerCancel: (): Promise<IPCResponse> =>
    ipcRenderer.invoke(IPC.INDEXER_CANCEL),

  /** Notify indexer that a file changed (triggers incremental re-index) */
  indexerFileChanged: (filePath: string): Promise<IPCResponse> =>
    ipcRenderer.invoke(IPC.INDEXER_FILE_CHANGED, filePath),

  /** Subscribe to indexer progress events */
  onIndexProgress: (callback: (progress: IndexProgress) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, progress: IndexProgress) => callback(progress)
    ipcRenderer.on(IPC.INDEXER_PROGRESS, listener)
    return () => ipcRenderer.removeListener(IPC.INDEXER_PROGRESS, listener)
  },

  /** Subscribe to indexer completion events */
  onIndexComplete: (callback: (index: ProjectIndex | null) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, index: ProjectIndex | null) => callback(index)
    ipcRenderer.on(IPC.INDEXER_COMPLETE, listener)
    return () => ipcRenderer.removeListener(IPC.INDEXER_COMPLETE, listener)
  },

  // ─────────────────────────────────────────────────────────────
  // Phase 2 — Search
  // ─────────────────────────────────────────────────────────────

  /** Full-text search across project files */
  search: (query: string, projectPath: string): Promise<IPCResponse<SearchResult[]>> =>
    ipcRenderer.invoke(IPC.SEARCH_QUERY, query, projectPath),
}

contextBridge.exposeInMainWorld('mas', masAPI)

// TypeScript declaration for renderer
export type MasAPI = typeof masAPI
