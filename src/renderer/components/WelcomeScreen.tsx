import { useCallback } from 'react'
import { useProjectStore } from '../store/projectStore'

const FolderIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M3 4a1 1 0 0 1 1-1h5.5l1.5 2H20a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4z" />
  </svg>
)

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

const MCLogo = () => (
  <svg viewBox="0 0 40 40" fill="currentColor" style={{ width: 40, height: 40 }}>
    <rect x="2" y="2" width="16" height="16" rx="2" opacity="0.9" />
    <rect x="22" y="2" width="16" height="16" rx="2" opacity="0.65" />
    <rect x="2" y="22" width="16" height="16" rx="2" opacity="0.65" />
    <rect x="22" y="22" width="16" height="16" rx="2" opacity="0.4" />
  </svg>
)

export default function WelcomeScreen() {
  const { setProject, setLoading, setError } = useProjectStore()

  const handleOpenProject = useCallback(async () => {
    setLoading(true)
    const result = await window.mas.openProject()
    if (result.success && result.data) {
      setProject(result.data.projectPath, result.data.tree, result.data.mcInfo)
    } else {
      setError('Failed to open project')
    }
  }, [setProject, setLoading, setError])

  return (
    <div className="welcome-screen fade-in">
      <div className="welcome-logo">
        <div className="welcome-logo__icon">
          <MCLogo />
        </div>
        <h1>Minecraft AI Studio</h1>
        <p>AI-powered IDE for Bedrock Add-on development</p>
      </div>

      <div className="welcome-actions">
        <button
          className="welcome-action-btn"
          onClick={handleOpenProject}
          id="btn-open-project-welcome"
        >
          <FolderIcon />
          <span className="welcome-action-btn__label">
            <strong>Open Minecraft Project</strong>
            <small>Select a folder containing your add-on</small>
          </span>
        </button>

        <button
          className="welcome-action-btn"
          id="btn-create-project-welcome"
          style={{ opacity: 0.6, cursor: 'not-allowed' }}
          title="Available in Phase 2"
          disabled
        >
          <PlusIcon />
          <span className="welcome-action-btn__label">
            <strong>Create New Project</strong>
            <small>Scaffold a new Bedrock add-on (Phase 2)</small>
          </span>
        </button>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 360 }}>
        <p>Keyboard shortcuts:</p>
        <p style={{ fontFamily: 'var(--font-mono)', marginTop: 4 }}>
          Ctrl+S — Save &nbsp;|&nbsp; Ctrl+` — Terminal
        </p>
      </div>
    </div>
  )
}
