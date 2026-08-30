import { useProjectStore } from '../../store/projectStore'

export default function MinecraftInfoPanel() {
  const { mcInfo, projectPath } = useProjectStore()

  if (!projectPath || !mcInfo) {
    return (
      <div className="panel-placeholder">
        No Minecraft project open
      </div>
    )
  }

  const typeLabels: Record<string, string> = {
    addon: '🎮 Add-on (BP + RP)',
    behavior_pack: '📦 Behavior Pack',
    resource_pack: '🎨 Resource Pack',
    script_api: '📜 Script API Project',
    unknown: '❓ Unknown',
  }

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Project type badge */}
      <div className={`mc-info-badge ${mcInfo.type}`}>
        <span style={{ fontWeight: 600 }}>{typeLabels[mcInfo.type] ?? mcInfo.type}</span>
      </div>

      {/* BP info */}
      {mcInfo.hasBP && mcInfo.bpManifest && (
        <InfoCard
          title="Behavior Pack"
          name={mcInfo.bpManifest.header.name}
          uuid={mcInfo.bpManifest.header.uuid}
          version={mcInfo.bpManifest.header.version.join('.')}
          path={mcInfo.bpPath ?? ''}
          color="var(--mc-dirt)"
        />
      )}

      {/* RP info */}
      {mcInfo.hasRP && mcInfo.rpManifest && (
        <InfoCard
          title="Resource Pack"
          name={mcInfo.rpManifest.header.name}
          uuid={mcInfo.rpManifest.header.uuid}
          version={mcInfo.rpManifest.header.version.join('.')}
          path={mcInfo.rpPath ?? ''}
          color="var(--text-accent)"
        />
      )}

      {/* Script API */}
      {mcInfo.hasScripts && (
        <div style={{
          padding: '6px 10px',
          borderRadius: 4,
          background: 'rgba(163, 113, 247, 0.08)',
          border: '1px solid #a371f7',
          fontSize: 12,
          color: '#a371f7',
        }}>
          📜 Script API detected
        </div>
      )}
    </div>
  )
}

interface InfoCardProps {
  title: string
  name: string
  uuid: string
  version: string
  path: string
  color: string
}

function InfoCard({ title, name, uuid, version, path, color }: InfoCardProps) {
  const shortPath = path.split('/').slice(-2).join('/')

  return (
    <div style={{
      padding: '8px 10px',
      borderRadius: 4,
      background: 'var(--bg-elevated)',
      border: `1px solid ${color}`,
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {title}
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{name}</div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>v{version}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }} title={uuid}>
        {uuid.slice(0, 8)}…
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }} title={path}>
        …/{shortPath}
      </div>
    </div>
  )
}
