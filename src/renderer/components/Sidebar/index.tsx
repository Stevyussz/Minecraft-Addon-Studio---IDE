import type { ActivityView } from '../../App'
import FileExplorer from './FileExplorer'
import SettingsPanel from './SettingsPanel'
import MinecraftInfo from './MinecraftInfo'
import SearchPanel from './SearchPanel'
import AiChat from './AiChat'
import { useProjectStore } from '../../store/projectStore'
import { useCallback } from 'react'

interface Props {
  activeView: ActivityView
}

const TITLES: Record<ActivityView, string> = {
  explorer: 'Explorer',
  search: 'Search',
  minecraft: 'Minecraft',
  ai: 'Antigravity AI',
  settings: 'Settings',
}

const RefreshIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
)

const CollapseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="15 18 9 12 15 6" />
  </svg>
)

export default function Sidebar({ activeView }: Props) {
  const { projectTree, setProject, setLoading, setError } = useProjectStore()

  const handleRefresh = useCallback(async () => {
    if (!projectTree) return
    setLoading(true)
    const result = await window.mas.openProject()
    if (result.success && result.data) {
      setProject(result.data.projectPath, result.data.tree, result.data.mcInfo)
    } else {
      setError('Failed to refresh')
    }
  }, [projectTree, setProject, setLoading, setError])

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span>{TITLES[activeView]}</span>
        {activeView === 'explorer' && (
          <div className="sidebar-header__actions">
            <button
              className="sidebar-icon-btn"
              title="Refresh"
              onClick={handleRefresh}
              id="btn-refresh-tree"
              aria-label="Refresh file tree"
            >
              <RefreshIcon />
            </button>
          </div>
        )}
        {activeView === 'minecraft' && (
          <div className="sidebar-header__actions">
            <button
              className="sidebar-icon-btn"
              title="Re-detect project"
              onClick={handleRefresh}
              id="btn-redetect-mc"
              aria-label="Re-detect Minecraft project"
            >
              <RefreshIcon />
            </button>
          </div>
        )}
      </div>

      <div className="sidebar-content">
        {activeView === 'explorer' && <FileExplorer />}
        {activeView === 'search' && <SearchPanel />}
        {activeView === 'minecraft' && <MinecraftInfo />}
        {activeView === 'ai' && <AiChat />}
        {activeView === 'settings' && <SettingsPanel />}
      </div>
    </div>
  )
}

