import { create } from 'zustand'
import type { FileEntry, MinecraftProjectInfo } from '../../shared/types'

interface ProjectState {
  projectPath: string | null
  projectTree: FileEntry | null
  mcInfo: MinecraftProjectInfo | null
  isLoading: boolean
  error: string | null

  setProject: (projectPath: string, tree: FileEntry, mcInfo: MinecraftProjectInfo | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  closeProject: () => void
  refreshTree: () => Promise<void>
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projectPath: null,
  projectTree: null,
  mcInfo: null,
  isLoading: false,
  error: null,

  setProject: (projectPath, tree, mcInfo) => {
    set({ projectPath, projectTree: tree, mcInfo, error: null, isLoading: false })

    // Auto-start indexer when project is opened (non-blocking)
    if (window.mas?.indexerStart) {
      window.mas.indexerStart(projectPath).catch(() => { /* silent fail */ })
    }
  },

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),

  closeProject: () => set({
    projectPath: null,
    projectTree: null,
    mcInfo: null,
    error: null,
  }),

  refreshTree: async () => {
    const { projectPath } = get()
    if (!projectPath) return
    set({ isLoading: true })
    try {
      const result = await window.mas.openProject()
      if (result.success && result.data) {
        set({
          projectTree: result.data.tree,
          mcInfo: result.data.mcInfo,
          isLoading: false,
        })
      }
    } catch {
      set({ isLoading: false })
    }
  },
}))
