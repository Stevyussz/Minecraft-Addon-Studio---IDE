import { create } from 'zustand'
import type { EditorTab } from '../../shared/types'

interface EditorState {
  tabs: EditorTab[]
  activeTabId: string | null
  fileContents: Record<string, string> // path -> content cache

  openFile: (path: string, name: string, language: string) => Promise<void>
  closeTab: (id: string) => void
  setActiveTab: (id: string) => void
  updateContent: (tabId: string, content: string) => void
  saveFile: (tabId: string) => Promise<boolean>
  markDirty: (tabId: string, dirty: boolean) => void
}

export const useEditorStore = create<EditorState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  fileContents: {},

  openFile: async (filePath: string, name: string, language: string) => {
    const { tabs, fileContents } = get()

    // Check if already open
    const existing = tabs.find(t => t.path === filePath)
    if (existing) {
      set({ activeTabId: existing.id })
      return
    }

    // Read content
    let content = fileContents[filePath] ?? ''
    if (!content) {
      const result = await window.mas.readFile(filePath)
      if (result.success && result.data !== undefined) {
        content = result.data
      }
    }

    const id = `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const tab: EditorTab = { id, path: filePath, name, language, isDirty: false, content }

    set(state => ({
      tabs: [...state.tabs, tab],
      activeTabId: id,
      fileContents: { ...state.fileContents, [filePath]: content },
    }))
  },

  closeTab: (id: string) => {
    set(state => {
      const idx = state.tabs.findIndex(t => t.id === id)
      const newTabs = state.tabs.filter(t => t.id !== id)
      let newActiveId = state.activeTabId

      if (state.activeTabId === id) {
        // Activate adjacent tab
        if (newTabs.length > 0) {
          const nextIdx = Math.max(0, idx - 1)
          newActiveId = newTabs[nextIdx]?.id ?? null
        } else {
          newActiveId = null
        }
      }
      return { tabs: newTabs, activeTabId: newActiveId }
    })
  },

  setActiveTab: (id: string) => set({ activeTabId: id }),

  updateContent: (tabId: string, content: string) => {
    set(state => {
      const tab = state.tabs.find(t => t.id === tabId)
      if (!tab) return state
      return {
        tabs: state.tabs.map(t => t.id === tabId ? { ...t, content, isDirty: true } : t),
        fileContents: { ...state.fileContents, [tab.path]: content },
      }
    })
  },

  markDirty: (tabId: string, dirty: boolean) => {
    set(state => ({
      tabs: state.tabs.map(t => t.id === tabId ? { ...t, isDirty: dirty } : t),
    }))
  },

  saveFile: async (tabId: string): Promise<boolean> => {
    const { tabs, fileContents } = get()
    const tab = tabs.find(t => t.id === tabId)
    if (!tab) return false

    const content = fileContents[tab.path] ?? tab.content ?? ''
    const result = await window.mas.writeFile(tab.path, content)

    if (result.success) {
      set(state => ({
        tabs: state.tabs.map(t => t.id === tabId ? { ...t, isDirty: false } : t),
      }))
      return true
    }
    return false
  },
}))
