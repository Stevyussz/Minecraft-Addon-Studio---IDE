import type { EditorTab, MinecraftProjectInfo } from '../../shared/types'
import { useIndexStore } from '../store/indexStore'

interface Props {
  mcInfo: MinecraftProjectInfo | null
  activeTab: EditorTab | null
}

function getStatusClass(mcInfo: MinecraftProjectInfo | null): string {
  if (!mcInfo) return 'status-bar'
  const map: Record<string, string> = {
    addon: 'status-bar status-mc-addon',
    behavior_pack: 'status-bar status-mc-bp',
    resource_pack: 'status-bar status-mc-rp',
    script_api: 'status-bar',
    unknown: 'status-bar',
  }
  return map[mcInfo.type] ?? 'status-bar'
}

function MCTypeLabel({ mcInfo }: { mcInfo: MinecraftProjectInfo }) {
  const labels: Record<string, string> = {
    addon: '🎮 Add-on',
    behavior_pack: '📦 Behavior Pack',
    resource_pack: '🎨 Resource Pack',
    script_api: '📜 Script API',
    unknown: 'Unknown project',
  }
  return <span>{labels[mcInfo.type] ?? mcInfo.type}</span>
}

const GitIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 12, height: 12 }}>
    <path d="M2.6 10.59L8.38 4.8l1.69 1.7c-.24.85.15 1.78.93 2.23v5.54c-.6.34-1 .99-1 1.73a2 2 0 0 0 2 2 2 2 0 0 0 2-2c0-.74-.4-1.39-1-1.73V9.41l2.07 2.09c-.07.15-.07.32-.07.5a2 2 0 0 0 2 2 2 2 0 0 0 2-2 2 2 0 0 0-2-2c-.18 0-.35 0-.5.07L13.93 7.5A2 2 0 0 0 12 5.5a2 2 0 0 0-.5.07L9.81 3.88A1.99 1.99 0 0 0 8 2a2 2 0 0 0-2 2c0 .74.4 1.39 1 1.73v.45L2.6 10.59z" />
  </svg>
)

export default function StatusBar({ mcInfo, activeTab }: Props) {
  const { isIndexing, progress, index } = useIndexStore()

  return (
    <div className={getStatusClass(mcInfo)}>
      {/* Left side */}
      <span className="status-item">
        <GitIcon />
        <span>MAS</span>
      </span>

      {mcInfo && (
        <span className="status-item">
          <MCTypeLabel mcInfo={mcInfo} />
        </span>
      )}

      {/* Indexing progress */}
      {isIndexing && progress && (
        <span className="status-item" style={{ color: '#d29922' }}>
          <span className="spinner" style={{ width: 10, height: 10 }} />
          <span>Indexing {progress.done}/{progress.total}</span>
        </span>
      )}
      {!isIndexing && index && (
        <span className="status-item" style={{ color: 'var(--text-success)', fontSize: 11 }}>
          ✓ {index.fileCount} files
        </span>
      )}

      {/* Spacer */}
      <span className="status-spacer" />

      {/* Right side */}
      {activeTab && (
        <>
          <span className="status-item">{activeTab.language}</span>
          <span className="status-item">{activeTab.name}</span>
        </>
      )}

      <span className="status-item">Minecraft AI Studio v0.1.0</span>
    </div>
  )
}
