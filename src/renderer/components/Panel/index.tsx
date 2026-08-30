import { useState } from 'react'
import Terminal from './Terminal'
import type { PanelTab } from '../../App'

interface Props {
  activeTab: PanelTab
  onTabChange: (tab: PanelTab) => void
  projectPath: string | null
}

const TABS: Array<{ id: PanelTab; label: string }> = [
  { id: 'terminal', label: 'Terminal' },
  { id: 'problems', label: 'Problems' },
  { id: 'output', label: 'Output' },
]

export default function BottomPanel({ activeTab, onTabChange, projectPath }: Props) {
  const [ptyId, setPtyId] = useState<string | null>(null)

  return (
    <div className="bottom-panel">
      <div className="panel-tabs" role="tablist" aria-label="Panel tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`panel-tab ${activeTab === tab.id ? 'active' : ''}`}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => onTabChange(tab.id)}
            id={`panel-tab-${tab.id}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="panel-content">
        {/* Terminal: keep mounted so PTY session persists */}
        <div style={{ display: activeTab === 'terminal' ? 'flex' : 'none', height: '100%', width: '100%' }}>
          <Terminal ptyId={ptyId} setPtyId={setPtyId} />
        </div>

        {activeTab === 'problems' && (
          <div className="panel-placeholder">
            No problems detected. JSON validation enabled in Phase 2.
          </div>
        )}

        {activeTab === 'output' && (
          <div className="panel-placeholder">
            Output panel — AI agent activity will appear here in Phase 3.
          </div>
        )}
      </div>
    </div>
  )
}
