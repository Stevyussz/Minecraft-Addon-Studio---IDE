import { useEditorStore } from '../../store/editorStore'

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

export default function EditorTabs() {
  const { tabs, activeTabId, closeTab, setActiveTab, saveFile } = useEditorStore()

  if (tabs.length === 0) return null

  return (
    <div className="editor-tabs" role="tablist" aria-label="Open files">
      {tabs.map(tab => (
        <div
          key={tab.id}
          className={`editor-tab ${activeTabId === tab.id ? 'active' : ''}`}
          role="tab"
          aria-selected={activeTabId === tab.id}
          aria-label={tab.name + (tab.isDirty ? ' (unsaved)' : '')}
          onClick={() => setActiveTab(tab.id)}
          id={`tab-${tab.id}`}
          title={tab.path}
        >
          {tab.isDirty && <span className="editor-tab__dirty" title="Unsaved changes" />}
          <span className="editor-tab__name">{tab.name}</span>
          <button
            className="editor-tab__close"
            onClick={async (e) => {
              e.stopPropagation()
              // Auto-save before closing if dirty
              if (tab.isDirty) {
                await saveFile(tab.id)
              }
              closeTab(tab.id)
            }}
            title="Close tab"
            aria-label={`Close ${tab.name}`}
            id={`btn-close-tab-${tab.id}`}
          >
            <CloseIcon />
          </button>
        </div>
      ))}
    </div>
  )
}
