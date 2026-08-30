import { create } from 'zustand'
import type { ProjectIndex, IndexProgress } from '../../shared/types'

interface IndexStore {
  index: ProjectIndex | null
  progress: IndexProgress | null
  isIndexing: boolean
  setIndex: (index: ProjectIndex | null) => void
  setProgress: (progress: IndexProgress) => void
  setIndexing: (val: boolean) => void
  reset: () => void
}

export const useIndexStore = create<IndexStore>((set) => ({
  index: null,
  progress: null,
  isIndexing: false,

  setIndex: (index) => set({ index, isIndexing: false, progress: null }),
  setProgress: (progress) => set({ progress, isIndexing: progress.phase !== 'complete' }),
  setIndexing: (val) => set({ isIndexing: val }),
  reset: () => set({ index: null, progress: null, isIndexing: false }),
}))
