import { useCallback } from 'react'
import EditorTabs from './EditorTabs'
import MonacoEditor from './MonacoEditor'
import WelcomeScreen from '../WelcomeScreen'
import { useEditorStore } from '../../store/editorStore'

export default function EditorArea() {
  const { tabs, activeTabId } = useEditorStore()

  const activeTab = tabs.find(t => t.id === activeTabId)

  return (
    <div className="editor-area">
      {/* Tabs bar */}
      <EditorTabs />

      {/* Editor content */}
      {tabs.length === 0 || !activeTab ? (
        <WelcomeScreen />
      ) : (
        /* Render all tabs but only show active one */
        tabs.map(tab => (
          <div
            key={tab.id}
            style={{ flex: 1, display: activeTabId === tab.id ? 'flex' : 'none', overflow: 'hidden', flexDirection: 'column' }}
          >
            <MonacoEditor
              tabId={tab.id}
              filePath={tab.path}
              language={tab.language}
              initialContent={tab.content ?? ''}
            />
          </div>
        ))
      )}
    </div>
  )
}
