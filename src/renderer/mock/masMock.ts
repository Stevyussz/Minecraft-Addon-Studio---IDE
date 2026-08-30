/**
 * Browser-only mock of window.mas for development/testing
 * when running outside Electron (e.g. Chromium/Firefox for UI review)
 */

import type {
  AppSettings, FileEntry, MinecraftProjectInfo, IPCResponse,
  ProjectIndex, IndexProgress, SearchResult, IdentifierRegistry,
} from '../../shared/types'

// Inline minimal MasAPI type to avoid circular import
interface MasAPILocal {
  openProject: () => Promise<IPCResponse<{ projectPath: string; tree: FileEntry; mcInfo: MinecraftProjectInfo }>>
  readFile: (filePath: string) => Promise<IPCResponse<string>>
  writeFile: (filePath: string, content: string) => Promise<IPCResponse>
  listDir: (dirPath: string) => Promise<IPCResponse<FileEntry[]>>
  detectProject: (projectPath: string) => Promise<IPCResponse<MinecraftProjectInfo>>
  getSettings: () => Promise<IPCResponse<AppSettings>>
  setSettings: (settings: Partial<AppSettings>) => Promise<IPCResponse>
  ptyCreate: (cwd: string, shell: string) => Promise<IPCResponse<string>>
  ptyInput: (id: string, data: string) => void
  ptyResize: (id: string, cols: number, rows: number) => void
  ptyKill: (id: string) => Promise<IPCResponse>
  onPtyData: (callback: (id: string, data: string) => void) => (() => void)
  onFileChanged: (callback: (filePath: string) => void) => (() => void)
  // Phase 2
  indexerStart: (projectPath: string) => Promise<IPCResponse>
  indexerGet: () => Promise<IPCResponse<ProjectIndex>>
  indexerCancel: () => Promise<IPCResponse>
  indexerFileChanged: (filePath: string) => Promise<IPCResponse>
  onIndexProgress: (callback: (progress: IndexProgress) => void) => (() => void)
  onIndexComplete: (callback: (index: ProjectIndex | null) => void) => (() => void)
  search: (query: string, projectPath: string) => Promise<IPCResponse<SearchResult[]>>
  // Phase 3
  aiChatRequest: (history: import('../../shared/types').ChatMessage[]) => Promise<IPCResponse>
  aiChatCancel: () => Promise<IPCResponse>
  onAiStreamData: (callback: (chunk: string) => void) => (() => void)
  onAiStreamEnd: (callback: () => void) => (() => void)
  onAiStreamError: (callback: (error: string) => void) => (() => void)
}

const mockTree: FileEntry = {
  name: 'test-mc-addon',
  path: '/mock/test-mc-addon',
  isDirectory: true,
  children: [
    {
      name: 'BP', path: '/mock/test-mc-addon/BP', isDirectory: true,
      children: [
        { name: 'manifest.json', path: '/mock/test-mc-addon/BP/manifest.json', isDirectory: false, language: 'json' },
        {
          name: 'scripts', path: '/mock/test-mc-addon/BP/scripts', isDirectory: true,
          children: [
            { name: 'main.js', path: '/mock/test-mc-addon/BP/scripts/main.js', isDirectory: false, language: 'javascript' },
          ],
        },
        {
          name: 'entities', path: '/mock/test-mc-addon/BP/entities', isDirectory: true,
          children: [
            { name: 'test_entity.json', path: '/mock/test-mc-addon/BP/entities/test_entity.json', isDirectory: false, language: 'json' },
          ],
        },
      ],
    },
    {
      name: 'RP', path: '/mock/test-mc-addon/RP', isDirectory: true,
      children: [
        { name: 'manifest.json', path: '/mock/test-mc-addon/RP/manifest.json', isDirectory: false, language: 'json' },
        { name: 'textures', path: '/mock/test-mc-addon/RP/textures', isDirectory: true, children: [] },
      ],
    },
    { name: 'README.md', path: '/mock/test-mc-addon/README.md', isDirectory: false, language: 'markdown' },
  ],
}

const mockMcInfo: MinecraftProjectInfo = {
  type: 'addon', hasBP: true, hasRP: true, hasScripts: true,
  bpPath: '/mock/test-mc-addon/BP', rpPath: '/mock/test-mc-addon/RP',
  bpManifest: {
    format_version: 2,
    header: { name: 'Test Addon BP', uuid: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', version: [1, 0, 0] },
    modules: [{ type: 'data', uuid: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', version: [1, 0, 0] }],
  },
  rpManifest: {
    format_version: 2,
    header: { name: 'Test Addon RP', uuid: 'd4e5f6a7-b8c9-0123-defa-234567890123', version: [1, 0, 0] },
    modules: [{ type: 'resources', uuid: 'e5f6a7b8-c9d0-1234-efab-345678901234', version: [1, 0, 0] }],
  },
}

const defaultSettings: AppSettings = {
  general: { theme: 'dark', autosave: true, autosaveInterval: 3000, fontSize: 14, tabSize: 2, wordWrap: false },
  ai: { provider: 'openai-compatible', baseUrl: 'http://localhost:20128/v1', apiKey: '', defaultModel: '', maxIterations: 5, autonomyLevel: 'balanced' },
  minecraft: { preferredVersion: 'latest', projectDetection: true, validationEnabled: true },
  terminal: { shell: '/bin/bash' },
}

const fileContents: Record<string, string> = {
  '/mock/test-mc-addon/BP/manifest.json': JSON.stringify({
    format_version: 2,
    header: { name: 'Test Addon BP', description: 'A test BP', uuid: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', version: [1, 0, 0] },
    modules: [{ type: 'data', uuid: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', version: [1, 0, 0] }],
  }, null, 2),
  '/mock/test-mc-addon/BP/scripts/main.js': `import { world, system } from "@minecraft/server";\n\n// MAS Test Addon\nsystem.runInterval(() => {\n  const players = world.getPlayers();\n  for (const player of players) {\n    player.onScreenDisplay.setActionBar("§aMAS Running!");\n  }\n}, 40);\n\nconsole.log("[TestAddon] Initialized");`,
  '/mock/test-mc-addon/BP/entities/test_entity.json': JSON.stringify({
    format_version: '1.20.0',
    'minecraft:entity': {
      description: { identifier: 'test:test_entity', is_spawnable: true },
      components: { 'minecraft:health': { value: 20, max: 20 } },
    },
  }, null, 2),
  '/mock/test-mc-addon/RP/manifest.json': JSON.stringify({
    format_version: 2,
    header: { name: 'Test Addon RP', uuid: 'd4e5f6a7-b8c9-0123-defa-234567890123', version: [1, 0, 0] },
    modules: [{ type: 'resources', uuid: 'e5f6a7b8-c9d0-1234-efab-345678901234', version: [1, 0, 0] }],
  }, null, 2),
  '/mock/test-mc-addon/README.md': '# Test Minecraft Addon\n\nThis is a test add-on for MAS Phase 1 testing.\n\n## Structure\n- BP/ Behavior Pack\n- RP/ Resource Pack\n',
}

const ptyListeners = new Map<string, Array<(id: string, data: string) => void>>()
const indexProgressListeners: Array<(p: IndexProgress) => void> = []
const indexCompleteListeners: Array<(i: ProjectIndex | null) => void> = []
const aiStreamDataListeners: Array<(chunk: string) => void> = []
const aiStreamEndListeners: Array<() => void> = []
const aiStreamErrorListeners: Array<(err: string) => void> = []

let mockChatCancel = false

/** Mock project index */
const mockIndex: ProjectIndex = {
  projectPath: '/mock/test-mc-addon',
  indexedAt: Date.now(),
  fileCount: 5,
  files: {
    '/mock/test-mc-addon/BP/manifest.json': { path: '/mock/test-mc-addon/BP/manifest.json', hash: 'abc', mtime: Date.now(), language: 'json', size: 200, summary: { type: 'manifest', description: 'Test Addon BP' }, parsedAt: Date.now() },
    '/mock/test-mc-addon/BP/scripts/main.js': { path: '/mock/test-mc-addon/BP/scripts/main.js', hash: 'def', mtime: Date.now(), language: 'javascript', size: 300, summary: { type: 'script', imports: ['@minecraft/server'], exports: [] }, parsedAt: Date.now() },
    '/mock/test-mc-addon/BP/entities/test_entity.json': { path: '/mock/test-mc-addon/BP/entities/test_entity.json', hash: 'ghi', mtime: Date.now(), language: 'json', size: 150, summary: { type: 'json', identifiers: ['test:test_entity'] }, parsedAt: Date.now() },
    '/mock/test-mc-addon/RP/manifest.json': { path: '/mock/test-mc-addon/RP/manifest.json', hash: 'jkl', mtime: Date.now(), language: 'json', size: 150, summary: { type: 'manifest', description: 'Test Addon RP' }, parsedAt: Date.now() },
    '/mock/test-mc-addon/README.md': { path: '/mock/test-mc-addon/README.md', hash: 'mno', mtime: Date.now(), language: 'markdown', size: 80, summary: { type: 'other' }, parsedAt: Date.now() },
  },
  identifiers: {
    entities: ['test:test_entity'],
    items: [], blocks: [], animations: [], animationControllers: [],
    renderControllers: [], particles: [], sounds: [], functions: [],
  },
  dependencies: [
    { from: '/mock/test-mc-addon/BP/scripts/main.js', to: '@minecraft/server', type: 'import' },
  ],
  diagnostics: [
    { severity: 'warning', file: '/mock/test-mc-addon/BP/manifest.json', message: 'Mock: min_engine_version not specified', code: 'manifest/missing-optional', source: 'manifest-validator' },
  ],
}

export const masMock: MasAPILocal = {
  openProject: async () => {
    await new Promise(r => setTimeout(r, 400))
    return { success: true, data: { projectPath: '/mock/test-mc-addon', tree: mockTree, mcInfo: mockMcInfo } }
  },

  readFile: async (filePath: string) => {
    await new Promise(r => setTimeout(r, 30))
    const content = fileContents[filePath]
    if (content !== undefined) return { success: true, data: content }
    return { success: false, error: `Mock: file not found: ${filePath}` }
  },

  writeFile: async (filePath: string, content: string) => {
    fileContents[filePath] = content
    return { success: true }
  },

  listDir: async (dirPath: string) => {
    const entry = findEntry(mockTree, dirPath)
    if (entry?.isDirectory && entry.children) return { success: true, data: entry.children }
    return { success: true, data: [] }
  },

  detectProject: async () => ({ success: true, data: mockMcInfo }),
  getSettings: async () => ({ success: true, data: defaultSettings }),
  setSettings: async () => ({ success: true }),

  ptyCreate: async (_cwd, _shell) => {
    const id = 'mock-pty-1'
    setTimeout(() => {
      for (const l of ptyListeners.get(id) ?? []) {
        l(id, '\x1b[32m[MAS Terminal Mock]\x1b[0m /bin/bash\r\n\r\n')
        l(id, 'user@mas:~/project$ ')
      }
    }, 150)
    return { success: true, data: id }
  },

  ptyInput: (_id, data) => {
    const id = 'mock-pty-1'
    for (const l of ptyListeners.get(id) ?? []) {
      if (data === '\r') l(id, '\r\nuser@mas:~/project$ ')
      else if (data === '\x7f') l(id, '\b \b')
      else l(id, data)
    }
  },

  ptyResize: () => { /* no-op */ },
  ptyKill: async () => ({ success: true }),

  onPtyData: (callback: (id: string, data: string) => void) => {
    const id = 'mock-pty-1'
    const existing = ptyListeners.get(id) ?? []
    existing.push(callback)
    ptyListeners.set(id, existing)
    return () => {
      const ls = ptyListeners.get(id) ?? []
      const idx = ls.indexOf(callback)
      if (idx !== -1) ls.splice(idx, 1)
    }
  },

  onFileChanged: (_callback: (filePath: string) => void) => () => { /* no-op */ },

  // ── Phase 2: Indexer mock ──────────────────────────────────

  indexerStart: async (_projectPath) => {
    // Simulate indexing with progress events
    setTimeout(() => {
      const steps: IndexProgress[] = [
        { done: 0, total: 5, currentFile: 'Scanning…', phase: 'scanning' },
        { done: 2, total: 5, currentFile: 'BP/manifest.json', phase: 'indexing' },
        { done: 4, total: 5, currentFile: 'RP/manifest.json', phase: 'indexing' },
        { done: 5, total: 5, currentFile: 'Building graph…', phase: 'graphing' },
        { done: 5, total: 5, currentFile: '', phase: 'complete' },
      ]

      let i = 0
      const send = () => {
        if (i >= steps.length) {
          for (const cb of indexCompleteListeners) cb(mockIndex)
          return
        }
        for (const cb of indexProgressListeners) cb(steps[i])
        i++
        setTimeout(send, 300)
      }
      send()
    }, 100)

    return { success: true }
  },

  indexerGet: async () => ({ success: true, data: mockIndex }),
  indexerCancel: async () => ({ success: true }),
  indexerFileChanged: async () => ({ success: true }),

  onIndexProgress: (callback: (p: IndexProgress) => void) => {
    indexProgressListeners.push(callback)
    return () => {
      const idx = indexProgressListeners.indexOf(callback)
      if (idx !== -1) indexProgressListeners.splice(idx, 1)
    }
  },

  onIndexComplete: (callback: (i: ProjectIndex | null) => void) => {
    indexCompleteListeners.push(callback)
    return () => {
      const idx = indexCompleteListeners.indexOf(callback)
      if (idx !== -1) indexCompleteListeners.splice(idx, 1)
    }
  },

  // ── Phase 2: Search mock ──────────────────────────────────

  search: async (query: string) => {
    await new Promise(r => setTimeout(r, 200))
    const results: SearchResult[] = []
    const q = query.toLowerCase()

    for (const [filePath, content] of Object.entries(fileContents)) {
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const col = line.toLowerCase().indexOf(q)
        if (col !== -1 && results.length < 50) {
          results.push({
            file: filePath,
            line: i + 1,
            column: col + 1,
            preview: line.trim().slice(0, 80),
            matchStart: col,
            matchLength: query.length,
          })
        }
      }
    }

    return { success: true, data: results }
  },

  // ── Phase 3: AI Mock ──────────────────────────────────────

  aiChatRequest: async (history) => {
    mockChatCancel = false
    const lastMsg = history[history.length - 1]
    const reply = `Mock AI response to: "${lastMsg?.content}".\n\nHere is some simulated code:\n\`\`\`javascript\nconsole.log("Hello from Mock AI!");\n\`\`\`\n`
    
    // Simulate streaming
    setTimeout(() => {
      let i = 0
      const words = reply.split(' ')
      
      const sendNext = () => {
        if (mockChatCancel) return
        if (i >= words.length) {
          for (const cb of aiStreamEndListeners) cb()
          return
        }
        for (const cb of aiStreamDataListeners) cb(words[i] + ' ')
        i++
        setTimeout(sendNext, 50)
      }
      sendNext()
    }, 500)

    return { success: true }
  },

  aiChatCancel: async () => {
    mockChatCancel = true
    return { success: true }
  },

  onAiStreamData: (callback) => {
    aiStreamDataListeners.push(callback)
    return () => {
      const idx = aiStreamDataListeners.indexOf(callback)
      if (idx !== -1) aiStreamDataListeners.splice(idx, 1)
    }
  },

  onAiStreamEnd: (callback) => {
    aiStreamEndListeners.push(callback)
    return () => {
      const idx = aiStreamEndListeners.indexOf(callback)
      if (idx !== -1) aiStreamEndListeners.splice(idx, 1)
    }
  },

  onAiStreamError: (callback) => {
    aiStreamErrorListeners.push(callback)
    return () => {
      const idx = aiStreamErrorListeners.indexOf(callback)
      if (idx !== -1) aiStreamErrorListeners.splice(idx, 1)
    }
  },
}

function findEntry(root: FileEntry, searchPath: string): FileEntry | null {
  if (root.path === searchPath) return root
  if (root.children) {
    for (const child of root.children) {
      const found = findEntry(child, searchPath)
      if (found) return found
    }
  }
  return null
}
