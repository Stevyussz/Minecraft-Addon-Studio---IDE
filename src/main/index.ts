import { app, BrowserWindow, ipcMain, dialog, nativeTheme } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { IPC, type IPCResponse, type AppSettings } from '../shared/types'
import { detectMinecraftProject, getProjectTree, listDirectory, detectLanguage } from '../core/minecraft/detector'
import { ProjectIndexer } from '../core/indexer/ProjectIndexer'
import { ProjectSearch } from '../core/search/ProjectSearch'
import { OpenAIClient } from '../core/ai/OpenAIClient'
import { ContextManager } from '../core/ai/ContextManager'
import type { ChatMessage, AppSettings as AppSettingsType } from '../shared/types'

// node-pty is a native module - lazy-require to avoid issues
let pty: typeof import('node-pty') | null = null
try {
  pty = require('node-pty')
} catch {
  console.warn('[MAS] node-pty not available, terminal will be limited')
}

// Store reference to keep it in scope
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let electronStore: any = null

/** Track active PTY processes: id -> IPty */
const ptyProcesses = new Map<string, ReturnType<NonNullable<typeof pty>['spawn']>>()
let ptyIdCounter = 0

/** Phase 2: Project indexer (one per project session) */
let activeIndexer: ProjectIndexer | null = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let currentIndex: any = null

// ─────────────────────────────────────────────────────────────
// Settings helpers
// ─────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: AppSettings = {
  general: {
    theme: 'dark',
    autosave: true,
    autosaveInterval: 3000,
    fontSize: 14,
    tabSize: 2,
    wordWrap: false,
  },
  ai: {
    provider: 'openai-compatible',
    baseUrl: 'http://localhost:20128/v1',
    apiKey: '',
    defaultModel: '',
    maxIterations: 5,
    autonomyLevel: 'balanced',
  },
  minecraft: {
    preferredVersion: 'latest',
    projectDetection: true,
    validationEnabled: true,
  },
  terminal: {
    shell: process.platform === 'win32' ? 'powershell.exe' : (process.env.SHELL ?? '/bin/bash'),
  },
}

async function getStore() {
  if (!electronStore) {
    const Store = (await import('electron-store')).default
    electronStore = new Store<AppSettings>({ defaults: DEFAULT_SETTINGS })
  }
  return electronStore
}

// ─────────────────────────────────────────────────────────────
// IPC handlers — file system
// ─────────────────────────────────────────────────────────────

function registerIPCHandlers(win: BrowserWindow) {
  /** Show folder picker dialog, return file tree */
  ipcMain.handle(IPC.WIN_SHOW_OPEN_DIALOG, async () => {
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: 'Open Minecraft Project',
    })
    if (result.canceled || !result.filePaths[0]) {
      return { success: false } as IPCResponse
    }
    const projectPath = result.filePaths[0]
    const tree = getProjectTree(projectPath)
    const mcInfo = detectMinecraftProject(projectPath)
    return { success: true, data: { projectPath, tree, mcInfo } } as IPCResponse
  })

  /** Read a single file's content */
  ipcMain.handle(IPC.FS_READ_FILE, async (_, filePath: string): Promise<IPCResponse<string>> => {
    try {
      const safe = validateProjectPath(filePath)
      if (!safe) return { success: false, error: 'Invalid path' }
      const content = fs.readFileSync(filePath, 'utf-8')
      return { success: true, data: content }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  /** Write a file */
  ipcMain.handle(IPC.FS_WRITE_FILE, async (_, filePath: string, content: string): Promise<IPCResponse> => {
    try {
      const safe = validateProjectPath(filePath)
      if (!safe) return { success: false, error: 'Invalid path' }
      fs.writeFileSync(filePath, content, 'utf-8')
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  /** List a directory shallowly (for lazy expand) */
  ipcMain.handle(IPC.FS_LIST_DIR, async (_, dirPath: string): Promise<IPCResponse> => {
    try {
      const entries = listDirectory(dirPath)
      return { success: true, data: entries }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  /** Detect Minecraft project */
  ipcMain.handle(IPC.MC_DETECT_PROJECT, async (_, projectPath: string): Promise<IPCResponse> => {
    try {
      const info = detectMinecraftProject(projectPath)
      return { success: true, data: info }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // ─────────────────────────────────────────────────────────────
  // Settings
  // ─────────────────────────────────────────────────────────────

  ipcMain.handle(IPC.SETTINGS_GET, async (): Promise<IPCResponse<AppSettings>> => {
    const store = await getStore()
    return { success: true, data: store.store as AppSettings }
  })

  ipcMain.handle(IPC.SETTINGS_SET, async (_, settings: Partial<AppSettings>): Promise<IPCResponse> => {
    const store = await getStore()
    Object.assign(store.store, settings)
    return { success: true }
  })

  // ─────────────────────────────────────────────────────────────
  // Terminal / PTY
  // ─────────────────────────────────────────────────────────────

  ipcMain.handle(IPC.PTY_CREATE, async (_, cwd: string, shell: string): Promise<IPCResponse<string>> => {
    if (!pty) return { success: false, error: 'node-pty not available' }

    const id = String(++ptyIdCounter)
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: fs.existsSync(cwd) ? cwd : app.getPath('home'),
      env: { ...process.env as Record<string, string> },
    })

    ptyProcess.onData(data => {
      win.webContents.send(IPC.PTY_DATA, id, data)
    })

    ptyProcess.onExit(() => {
      ptyProcesses.delete(id)
    })

    ptyProcesses.set(id, ptyProcess)
    return { success: true, data: id }
  })

  ipcMain.on(IPC.PTY_INPUT, (_, id: string, data: string) => {
    ptyProcesses.get(id)?.write(data)
  })

  ipcMain.on(IPC.PTY_RESIZE, (_, id: string, cols: number, rows: number) => {
    ptyProcesses.get(id)?.resize(cols, rows)
  })

  ipcMain.handle(IPC.PTY_KILL, async (_, id: string): Promise<IPCResponse> => {
    const proc = ptyProcesses.get(id)
    if (proc) {
      proc.kill()
      ptyProcesses.delete(id)
    }
    return { success: true }
  })

  // ─────────────────────────────────────────────────────────────
  // Phase 2 — Indexer
  // ─────────────────────────────────────────────────────────────

  /** Start full project index (non-blocking) */
  ipcMain.handle(IPC.INDEXER_START, async (_, projectPath: string): Promise<IPCResponse> => {
    try {
      // Cancel any running indexer
      if (activeIndexer) activeIndexer.cancel()

      const cacheDir = path.join(app.getPath('userData'), 'index')
      activeIndexer = new ProjectIndexer(cacheDir, projectPath)

      // Run indexer asynchronously — progress/complete sent via IPC events
      activeIndexer.indexProject(projectPath, (progress) => {
        win.webContents.send(IPC.INDEXER_PROGRESS, progress)
      }).then(index => {
        currentIndex = index
        win.webContents.send(IPC.INDEXER_COMPLETE, index)
      }).catch(err => {
        console.error('[Indexer] Error:', err)
        win.webContents.send(IPC.INDEXER_COMPLETE, null)
      })

      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  /** Get the current cached index */
  ipcMain.handle(IPC.INDEXER_GET, async (): Promise<IPCResponse> => {
    return { success: true, data: currentIndex }
  })

  /** Cancel indexing */
  ipcMain.handle(IPC.INDEXER_CANCEL, async (): Promise<IPCResponse> => {
    activeIndexer?.cancel()
    return { success: true }
  })

  /** Re-index a single file (triggered by file-watch or manual save) */
  ipcMain.handle(IPC.INDEXER_FILE_CHANGED, async (_, filePath: string): Promise<IPCResponse> => {
    if (!activeIndexer) return { success: false, error: 'No active indexer' }
    try {
      const { entry, diagnostics } = activeIndexer.reindexFile(filePath)
      if (currentIndex) {
        currentIndex.files[filePath] = entry
        currentIndex.diagnostics = currentIndex.diagnostics
          .filter((d: { file: string }) => d.file !== filePath)
          .concat(diagnostics)
      }
      win.webContents.send(IPC.INDEXER_COMPLETE, currentIndex)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // ─────────────────────────────────────────────────────────────
  // Phase 2 — Search
  // ─────────────────────────────────────────────────────────────

  ipcMain.handle(IPC.SEARCH_QUERY, async (_, query: string, projectPath: string): Promise<IPCResponse> => {
    try {
      const results = ProjectSearch.search(query, projectPath, currentIndex ?? undefined)
      return { success: true, data: results }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // ─────────────────────────────────────────────────────────────
  // Phase 3 — AI Chat
  // ─────────────────────────────────────────────────────────────

  let activeChatController: AbortController | null = null

  ipcMain.handle(IPC.AI_CHAT_REQUEST, async (_, history: ChatMessage[]): Promise<IPCResponse> => {
    try {
      if (activeChatController) {
        activeChatController.abort()
      }
      activeChatController = new AbortController()

      const store = await getStore()
      const aiSettings = (store.store as AppSettingsType).ai

      const client = new OpenAIClient(aiSettings)
      const messages = ContextManager.buildPrompt(history, currentIndex, { maxTokens: 8000 })

      // Start streaming (non-blocking)
      client.streamChat({ messages }, {
        signal: activeChatController.signal,
        onData: (chunk) => {
          win.webContents.send(IPC.AI_CHAT_STREAM_DATA, chunk)
        },
        onComplete: () => {
          win.webContents.send(IPC.AI_CHAT_STREAM_END)
          activeChatController = null
        },
        onError: (err) => {
          win.webContents.send(IPC.AI_CHAT_STREAM_ERROR, err.message)
          activeChatController = null
        }
      }).catch(err => {
        if (err.name !== 'AbortError') {
          win.webContents.send(IPC.AI_CHAT_STREAM_ERROR, String(err))
        }
      })

      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message || String(err) }
    }
  })

  ipcMain.handle(IPC.AI_CHAT_CANCEL, async (): Promise<IPCResponse> => {
    if (activeChatController) {
      activeChatController.abort()
      activeChatController = null
    }
    return { success: true }
  })
}

// ─────────────────────────────────────────────────────────────
// Security: prevent path traversal
// ─────────────────────────────────────────────────────────────

function validateProjectPath(filePath: string): boolean {
  // Basic sanity: must be absolute, must not contain null bytes
  return (
    path.isAbsolute(filePath) &&
    !filePath.includes('\0') &&
    !filePath.includes('..') // conservative
  )
}

// ─────────────────────────────────────────────────────────────
// Window creation
// ─────────────────────────────────────────────────────────────

function createWindow(): BrowserWindow {
  nativeTheme.themeSource = 'dark'

  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Minecraft AI Studio',
    backgroundColor: '#0d1117',
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // needed for preload with require
      webSecurity: true,
    },
  })

  // Load renderer
  const devUrl = process.env['VITE_DEV_SERVER_URL']
  if (devUrl) {
    win.loadURL(devUrl)
    win.webContents.openDevTools({ mode: 'detach' })
  } else if (process.env['NODE_ENV'] === 'development' || !app.isPackaged) {
    // vite-plugin-electron may not set VITE_DEV_SERVER_URL in all versions
    // Try default Vite port
    win.loadURL('http://localhost:5173').catch(() => {
      win.loadFile(path.join(__dirname, '../../dist/index.html'))
    })
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  return win
}

// ─────────────────────────────────────────────────────────────
// App lifecycle
// ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  const win = createWindow()
  registerIPCHandlers(win)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  // Kill all pty processes
  for (const proc of ptyProcesses.values()) {
    try { proc.kill() } catch { /* ignore */ }
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
