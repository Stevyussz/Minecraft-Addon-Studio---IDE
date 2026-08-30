import { useState, useCallback, useRef } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { useEditorStore } from '../../store/editorStore'
import { useIndexStore } from '../../store/indexStore'
import type { SearchResult } from '../../../shared/types'

export default function SearchPanel() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const { projectPath } = useProjectStore()
  const { openFile } = useEditorStore()
  const { index } = useIndexStore()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearch = useCallback(async (q: string) => {
    if (!projectPath || q.trim().length < 2) {
      setResults([])
      setSearched(false)
      return
    }

    setIsSearching(true)
    try {
      const result = await window.mas.search(q, projectPath)
      setResults(result.data ?? [])
      setSearched(true)
    } catch {
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }, [projectPath])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value
    setQuery(q)

    // Debounce: wait 400ms after typing stops
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => handleSearch(q), 400)
  }, [handleSearch])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      handleSearch(query)
    }
  }, [query, handleSearch])

  // Group results by file
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.file]) acc[r.file] = []
    acc[r.file].push(r)
    return acc
  }, {})

  const fileCount = Object.keys(grouped).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Search input */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={projectPath ? 'Search in project (min 2 chars)…' : 'Open a project first'}
            disabled={!projectPath}
            id="search-input"
            autoFocus
            style={{ width: '100%', paddingRight: 28 }}
          />
          {isSearching && (
            <span className="spinner" style={{
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
            }} />
          )}
        </div>
        {searched && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            {results.length === 0
              ? 'No results'
              : `${results.length} result${results.length > 1 ? 's' : ''} in ${fileCount} file${fileCount > 1 ? 's' : ''}${results.length === 50 ? ' (capped at 50)' : ''}`}
          </div>
        )}
        {index && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {index.fileCount} files indexed
          </div>
        )}
      </div>

      {/* Results */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {Object.entries(grouped).map(([filePath, fileResults]) => (
          <FileResultGroup
            key={filePath}
            filePath={filePath}
            results={fileResults}
            query={query}
            onOpen={(path, name, lang) => openFile(path, name, lang)}
          />
        ))}
      </div>
    </div>
  )
}

function FileResultGroup({
  filePath, results, query, onOpen,
}: {
  filePath: string
  results: SearchResult[]
  query: string
  onOpen: (path: string, name: string, lang: string) => void
}) {
  const [open, setOpen] = useState(true)
  const parts = filePath.split('/')
  const fileName = parts.pop() ?? filePath
  const dir = parts.slice(-2).join('/')
  const language = filePath.endsWith('.json') ? 'json'
    : filePath.endsWith('.ts') ? 'typescript'
    : filePath.endsWith('.js') ? 'javascript'
    : filePath.endsWith('.md') ? 'markdown'
    : 'plaintext'

  return (
    <div style={{ borderBottom: '1px solid var(--border-color)' }}>
      {/* File header */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', cursor: 'pointer', background: 'var(--bg-elevated)' }}
        onClick={() => setOpen(o => !o)}
      >
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{open ? '▼' : '▶'}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
          {fileName}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>…/{dir}</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-accent)' }}>
          {results.length}
        </span>
      </div>

      {/* Match lines */}
      {open && results.map((r, i) => (
        <div
          key={i}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 12px 2px 24px', cursor: 'pointer', fontSize: 12 }}
          onClick={() => onOpen(filePath, fileName, language)}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <span style={{ flexShrink: 0, color: 'var(--text-muted)', fontSize: 11, minWidth: 28, textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
            {r.line}
          </span>
          <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <HighlightedMatch text={r.preview} query={query} />
          </span>
        </div>
      ))}
    </div>
  )
}

function HighlightedMatch({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <>{text}</>

  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: '#d29922', color: '#0d1117', borderRadius: 2, padding: '0 1px' }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}
