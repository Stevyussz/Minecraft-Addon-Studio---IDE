import { useIndexStore } from '../../store/indexStore'
import { useEditorStore } from '../../store/editorStore'
import type { Diagnostic } from '../../../shared/types'

const SeverityIcon = ({ sev }: { sev: Diagnostic['severity'] }) => {
  if (sev === 'error') return <span style={{ color: 'var(--text-error)', fontWeight: 700, fontSize: 13 }}>✕</span>
  if (sev === 'warning') return <span style={{ color: '#d29922', fontWeight: 700, fontSize: 13 }}>⚠</span>
  if (sev === 'info') return <span style={{ color: '#58a6ff', fontSize: 13 }}>ℹ</span>
  return <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>·</span>
}

export default function Problems() {
  const { index, isIndexing, progress } = useIndexStore()
  const { openFile } = useEditorStore()

  const diagnostics = index?.diagnostics ?? []
  const errors = diagnostics.filter(d => d.severity === 'error')
  const warnings = diagnostics.filter(d => d.severity === 'warning')

  if (isIndexing) {
    return (
      <div className="panel-placeholder" style={{ flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="spinner" />
          <span style={{ fontSize: 12 }}>
            {progress ? `Indexing… ${progress.done}/${progress.total} files (${progress.phase})` : 'Indexing project…'}
          </span>
        </div>
        {progress?.currentFile && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 500 }}>
            {progress.currentFile}
          </div>
        )}
      </div>
    )
  }

  if (!index) {
    return (
      <div className="panel-placeholder">
        Open a Minecraft project to see problems
      </div>
    )
  }

  if (diagnostics.length === 0) {
    return (
      <div className="panel-placeholder" style={{ color: 'var(--text-success)' }}>
        ✓ No problems detected in {index.fileCount} files
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
      {/* Summary bar */}
      <div style={{ display: 'flex', gap: 16, padding: '4px 12px', borderBottom: '1px solid var(--border-color)', fontSize: 12, color: 'var(--text-secondary)', flexShrink: 0 }}>
        <span style={{ color: errors.length > 0 ? 'var(--text-error)' : 'var(--text-secondary)' }}>
          ✕ {errors.length} {errors.length === 1 ? 'Error' : 'Errors'}
        </span>
        <span style={{ color: warnings.length > 0 ? '#d29922' : 'var(--text-secondary)' }}>
          ⚠ {warnings.length} {warnings.length === 1 ? 'Warning' : 'Warnings'}
        </span>
        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>
          {index.fileCount} files indexed
        </span>
      </div>

      {/* Diagnostics list */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {diagnostics.map((d, i) => (
          <DiagnosticRow
            key={`${d.file}-${d.line}-${i}`}
            diagnostic={d}
            onClick={() => {
              const name = d.file.split('/').pop() ?? d.file
              openFile(d.file, name, d.file.endsWith('.json') ? 'json' : 'plaintext')
            }}
          />
        ))}
      </div>
    </div>
  )
}

function DiagnosticRow({ diagnostic: d, onClick }: { diagnostic: Diagnostic; onClick: () => void }) {
  const fileName = d.file.split('/').pop() ?? d.file
  const dir = d.file.split('/').slice(-3, -1).join('/')

  return (
    <div
      className="diagnostic-row"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      title={d.file}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '4px 12px',
        cursor: 'pointer',
        borderBottom: '1px solid transparent',
        fontSize: 12,
        lineHeight: 1.5,
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <span style={{ flexShrink: 0, marginTop: 2 }}>
        <SeverityIcon sev={d.severity} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ color: 'var(--text-primary)' }}>{d.message}</span>
        {d.code && (
          <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: 11 }}>[{d.code}]</span>
        )}
      </span>
      <span style={{ flexShrink: 0, color: 'var(--text-secondary)', fontSize: 11 }}>
        {dir}/{fileName}{d.line ? `:${d.line}` : ''}
      </span>
    </div>
  )
}
