/**
 * Browser-only mock of window.mas for development/testing
 * when running outside Electron (e.g. Chromium/Firefox for UI review)
 */

import type { AppSettings, FileEntry, MinecraftProjectInfo, IPCResponse } from '../../shared/types'

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
}

const mockTree: FileEntry = {
  name: 'test-mc-addon',
  path: '/mock/test-mc-addon',
  isDirectory: true,
  children: [
    {
      name: 'BP',
      path: '/mock/test-mc-addon/BP',
      isDirectory: true,
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
  type: 'addon',
  hasBP: true, hasRP: true, hasScripts: true,
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
    console.log('[Mock] writeFile:', filePath)
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
      const listeners = ptyListeners.get(id) ?? []
      for (const l of listeners) {
        l(id, '\x1b[32m[MAS Terminal Mock]\x1b[0m /bin/bash\r\n\r\n')
        l(id, 'user@mas:~/project$ ')
      }
    }, 150)
    return { success: true, data: id }
  },

  ptyInput: (_id, data) => {
    const id = 'mock-pty-1'
    const listeners = ptyListeners.get(id) ?? []
    for (const l of listeners) {
      if (data === '\r') {
        l(id, '\r\nuser@mas:~/project$ ')
      } else if (data === '\x7f') {
        l(id, '\b \b')
      } else {
        l(id, data)
      }
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
