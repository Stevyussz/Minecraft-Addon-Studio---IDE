import { useState, useCallback } from 'react'
import type { FileEntry } from '../../../shared/types'
import { useProjectStore } from '../../store/projectStore'
import { useEditorStore } from '../../store/editorStore'

// ───── Icon helpers ────────────────────────────────────────────

const ChevronRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="9 18 15 12 9 6" />
  </svg>
)

function FileIcon({ language, isDir }: { language?: string; isDir: boolean }) {
  if (isDir) {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" style={{ color: '#58a6ff', width: 14, height: 14 }}>
        <path d="M3 4a1 1 0 0 1 1-1h5.5l1.5 2H20a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4z" />
      </svg>
    )
  }

  const colors: Record<string, string> = {
    typescript: '#4ec9b0',
    javascript: '#f7c948',
    json: '#ce9178',
    markdown: '#9cdcfe',
    python: '#4ec9b0',
    css: '#569cd6',
    html: '#e34c26',
    shell: '#89d185',
    binary: '#8b949e',
  }

  const color = colors[language ?? 'plaintext'] ?? '#c9d1d9'
  const char = language === 'typescript' ? 'TS'
    : language === 'javascript' ? 'JS'
    : language === 'json' ? '{ }'
    : language === 'markdown' ? 'MD'
    : '≡'

  return (
    <span style={{
      fontSize: '9px',
      fontFamily: 'JetBrains Mono, monospace',
      fontWeight: 700,
      color,
      lineHeight: 1,
      display: 'flex',
      alignItems: 'center',
      width: 14,
      justifyContent: 'center',
    }}>
      {char}
    </span>
  )
}

// ───── TreeNode ────────────────────────────────────────────────

interface TreeNodeProps {
  entry: FileEntry
  depth: number
  selectedPath: string | null
  onSelect: (entry: FileEntry) => void
  onOpenFile: (entry: FileEntry) => void
}

function TreeNode({ entry, depth, selectedPath, onSelect, onOpenFile }: TreeNodeProps) {
  const [isOpen, setIsOpen] = useState(depth === 0 ? true : false)
  const [children, setChildren] = useState<FileEntry[]>(entry.children ?? [])
  const [loaded, setLoaded] = useState(!!entry.children)

  const toggle = useCallback(async () => {
    if (!entry.isDirectory) return
    if (!loaded) {
      // Lazy load children
      const result = await window.mas.listDir(entry.path)
      if (result.success && result.data) {
        setChildren(result.data)
        setLoaded(true)
      }
    }
    setIsOpen(o => !o)
  }, [entry, loaded])

  const handleClick = useCallback(() => {
    onSelect(entry)
    if (entry.isDirectory) {
      toggle()
    } else {
      onOpenFile(entry)
    }
  }, [entry, onSelect, onOpenFile, toggle])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }, [handleClick])

  const isSelected = selectedPath === entry.path

  return (
    <div>
      <div
        className={`file-tree-item ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: depth * 12 + 4 }}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role={entry.isDirectory ? 'treeitem' : 'treeitem'}
        aria-expanded={entry.isDirectory ? isOpen : undefined}
        aria-selected={isSelected}
        tabIndex={0}
        title={entry.path}
      >
        {/* Chevron for dirs */}
        {entry.isDirectory ? (
          <span className={`file-tree-item__chevron ${isOpen ? 'open' : ''}`}>
            <ChevronRight />
          </span>
        ) : (
          <span style={{ width: 16, flexShrink: 0 }} />
        )}

        {/* File/folder icon */}
        <span className="file-tree-item__icon">
          <FileIcon language={entry.language} isDir={entry.isDirectory} />
        </span>

        {/* Name */}
        <span className="file-tree-item__name">{entry.name}</span>
      </div>

      {/* Children */}
      {entry.isDirectory && isOpen && (
        <div role="group">
          {children.map(child => (
            <TreeNode
              key={child.path}
              entry={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
              onOpenFile={onOpenFile}
            />
          ))}
          {children.length === 0 && loaded && (
            <div
              style={{
                paddingLeft: (depth + 1) * 12 + 4,
                fontSize: 11,
                color: 'var(--text-muted)',
                padding: '2px 0 2px ' + ((depth + 1) * 12 + 4) + 'px',
              }}
            >
              (empty)
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ───── FileExplorer ────────────────────────────────────────────

export default function FileExplorer() {
  const { projectTree, isLoading, setProject, setLoading, setError } = useProjectStore()
  const { openFile } = useEditorStore()
  const [selectedPath, setSelectedPath] = useState<string | null>(null)

  const handleOpenProject = useCallback(async () => {
    setLoading(true)
    const result = await window.mas.openProject()
    if (result.success && result.data) {
      setProject(result.data.projectPath, result.data.tree, result.data.mcInfo)
    } else {
      setError('Failed to open project')
    }
  }, [setProject, setLoading, setError])

  const handleSelectEntry = useCallback((entry: FileEntry) => {
    setSelectedPath(entry.path)
  }, [])

  const handleOpenFile = useCallback(async (entry: FileEntry) => {
    if (entry.isDirectory || entry.language === 'binary') return
    await openFile(entry.path, entry.name, entry.language ?? 'plaintext')
  }, [openFile])

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 100, gap: 8, color: 'var(--text-secondary)' }}>
        <span className="spinner" />
        <span style={{ fontSize: 12 }}>Opening project…</span>
      </div>
    )
  }

  if (!projectTree) {
    return (
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          className="welcome-action-btn"
          onClick={handleOpenProject}
          id="btn-open-project-explorer"
          style={{ fontSize: 12, padding: '8px 12px' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ width: 16, height: 16, color: 'var(--text-accent)', flexShrink: 0 }}>
            <path d="M3 4a1 1 0 0 1 1-1h5.5l1.5 2H20a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4z" />
          </svg>
          <span className="welcome-action-btn__label">
            <strong>Open Folder</strong>
            <small>Select a Minecraft project</small>
          </span>
        </button>
      </div>
    )
  }

  return (
    <div className="file-tree" role="tree" aria-label="Project files">
      <TreeNode
        entry={projectTree}
        depth={0}
        selectedPath={selectedPath}
        onSelect={handleSelectEntry}
        onOpenFile={handleOpenFile}
      />
    </div>
  )
}
