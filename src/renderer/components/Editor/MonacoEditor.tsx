import { useEffect, useRef, useState } from 'react'
import MonacoEditorComponent, { type OnMount, type Monaco } from '@monaco-editor/react'
import { useEditorStore } from '../../store/editorStore'

interface Props {
  tabId: string
  filePath: string
  language: string
  initialContent: string
}

// Monaco editor theme matching our dark palette
function configureMonaco(monaco: Monaco) {
  monaco.editor.defineTheme('mas-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6a737d', fontStyle: 'italic' },
      { token: 'string', foreground: 'ce9178' },
      { token: 'keyword', foreground: 'ff7b72' },
      { token: 'number', foreground: '79c0ff' },
    ],
    colors: {
      'editor.background':           '#0d1117',
      'editor.foreground':           '#e6edf3',
      'editorLineNumber.foreground': '#484f58',
      'editorLineNumber.activeForeground': '#8b949e',
      'editor.lineHighlightBackground': '#161b22',
      'editor.selectionBackground': '#1f3553',
      'editor.inactiveSelectionBackground': '#1a2233',
      'editorIndentGuide.background1': '#21262d',
      'editorBracketMatch.background': '#1f3553',
      'editorBracketMatch.border': '#388bfd',
      'editorWidget.background': '#1c2128',
      'editorSuggestWidget.background': '#1c2128',
      'editorSuggestWidget.border': '#30363d',
      'editorSuggestWidget.selectedBackground': '#2d333b',
      'scrollbarSlider.background': '#30363d55',
      'scrollbarSlider.hoverBackground': '#484f5888',
      'scrollbarSlider.activeBackground': '#484f58bb',
    },
  })
}

export default function MonacoEditor({ tabId, filePath, language, initialContent }: Props) {
  const { updateContent, fileContents } = useEditorStore()
  const monacoRef = useRef<Monaco | null>(null)
  const [mounted, setMounted] = useState(false)

  const content = fileContents[filePath] ?? initialContent

  const handleMount: OnMount = (_editor, monaco) => {
    monacoRef.current = monaco
    configureMonaco(monaco)
    monaco.editor.setTheme('mas-dark')
    setMounted(true)
  }

  // Configure JSON schema for Minecraft manifest files
  useEffect(() => {
    if (!mounted || !monacoRef.current) return
    const monaco = monacoRef.current

    if (language === 'json' && filePath.includes('manifest.json')) {
      monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
        validate: true,
        allowComments: false,
        schemas: [
          {
            uri: 'minecraft://manifest',
            fileMatch: ['**/manifest.json'],
            schema: {
              type: 'object',
              required: ['format_version', 'header', 'modules'],
              properties: {
                format_version: { type: 'number' },
                header: {
                  type: 'object',
                  required: ['name', 'uuid', 'version'],
                  properties: {
                    name: { type: 'string' },
                    description: { type: 'string' },
                    uuid: { type: 'string', pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' },
                    version: { type: 'array', items: { type: 'number' }, minItems: 3, maxItems: 3 },
                  },
                },
                modules: { type: 'array' },
              },
            },
          },
        ],
      })
    }
  }, [mounted, language, filePath])

  return (
    <div className="editor-container" id={`editor-${tabId}`}>
      <MonacoEditorComponent
        height="100%"
        language={language === 'mcfunction' ? 'plaintext' : language}
        value={content}
        theme="mas-dark"
        onMount={handleMount}
        onChange={(value) => {
          if (value !== undefined) {
            updateContent(tabId, value)
          }
        }}
        options={{
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontLigatures: true,
          lineNumbers: 'on',
          minimap: { enabled: true, scale: 1 },
          scrollBeyondLastLine: false,
          wordWrap: 'off',
          automaticLayout: true,
          tabSize: 2,
          insertSpaces: true,
          formatOnPaste: true,
          renderLineHighlight: 'line',
          smoothScrolling: true,
          cursorSmoothCaretAnimation: 'on',
          bracketPairColorization: { enabled: true },
          guides: { bracketPairs: true, indentation: true },
          padding: { top: 8, bottom: 8 },
        }}
        loading={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)', gap: 8 }}>
            <span className="spinner" />
            <span>Loading editor…</span>
          </div>
        }
      />
    </div>
  )
}
