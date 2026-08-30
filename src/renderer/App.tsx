import { useState, useCallback, useEffect } from 'react'
import ActivityBar from './components/ActivityBar'
import Sidebar from './components/Sidebar/index'
import EditorArea from './components/Editor/index'
import BottomPanel from './components/Panel/index'
import StatusBar from './components/StatusBar'
import { useProjectStore } from './store/projectStore'
import { useEditorStore } from './store/editorStore'

export type ActivityView = 'explorer' | 'search' | 'minecraft' | 'settings'
export type PanelTab = 'terminal' | 'problems' | 'output'

export default function App() {
  const [activeView, setActiveView] = useState<ActivityView>('explorer')
  const [activePanelTab, setActivePanelTab] = useState<PanelTab>('terminal')

  const { projectPath, mcInfo } = useProjectStore()
  const { tabs, activeTabId, saveFile } = useEditorStore()

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Ctrl+S — save active file
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault()
        if (activeTabId) {
          await saveFile(activeTabId)
        }
      }
      // Ctrl+` — focus terminal
      if (e.ctrlKey && e.key === '`') {
        e.preventDefault()
        setActivePanelTab('terminal')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeTabId, saveFile])

  const handleActivityChange = useCallback((view: ActivityView) => {
    setActiveView(view)
  }, [])

  return (
    <div className="app-shell">
      <div className="app-workbench">
        {/* Activity Bar — leftmost icon strip */}
        <ActivityBar activeView={activeView} onViewChange={handleActivityChange} />

        {/* Sidebar — context-sensitive panel */}
        <Sidebar activeView={activeView} />

        {/* Main editor + bottom panel column */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {/* Editor area with tabs + Monaco */}
          <EditorArea />

          {/* Bottom panel: terminal, problems, output */}
          <BottomPanel
            activeTab={activePanelTab}
            onTabChange={setActivePanelTab}
            projectPath={projectPath}
          />
        </div>
      </div>

      {/* Status bar at the very bottom */}
      <StatusBar mcInfo={mcInfo} activeTab={tabs.find(t => t.id === activeTabId) ?? null} />
    </div>
  )
}
