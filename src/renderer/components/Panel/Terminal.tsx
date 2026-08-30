import { useEffect, useRef, useState, useCallback } from 'react'
import { useProjectStore } from '../../store/projectStore'

interface Props {
  ptyId: string | null
  setPtyId: (id: string | null) => void
}

// Use any refs since we lazy-import xterm; types don't matter at runtime
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TerminalInstance = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FitAddonInstance = any

export default function Terminal({ ptyId, setPtyId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<TerminalInstance>(null)
  const fitRef = useRef<FitAddonInstance>(null)
  const { projectPath } = useProjectStore()
  const [error, setError] = useState<string | null>(null)

  const initTerminal = useCallback(async () => {
    if (!containerRef.current || termRef.current) return

    try {
      // Lazy import to avoid SSR issues and allow code splitting
      const { Terminal } = await import('@xterm/xterm')
      const { FitAddon } = await import('@xterm/addon-fit')
      const { WebLinksAddon } = await import('@xterm/addon-web-links')
      // @ts-expect-error CSS import
      await import('@xterm/xterm/css/xterm.css')

      const term = new Terminal({
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fontSize: 13,
        lineHeight: 1.4,
        theme: {
          background: '#0a0e14',
          foreground: '#c9d1d9',
          cursor: '#58a6ff',
          cursorAccent: '#0d1117',
          black: '#21262d',
          red: '#f85149',
          green: '#3fb950',
          yellow: '#d29922',
          blue: '#58a6ff',
          magenta: '#bc8cff',
          cyan: '#39c5cf',
          white: '#b1bac4',
          brightBlack: '#6e7681',
          brightRed: '#ff7b72',
          brightGreen: '#56d364',
          brightYellow: '#e3b341',
          brightBlue: '#79c0ff',
          brightMagenta: '#d2a8ff',
          brightCyan: '#56d4dd',
          brightWhite: '#f0f6fc',
        },
        cursorBlink: true,
      })

      const fitAddon = new FitAddon()
      const webLinksAddon = new WebLinksAddon()
      term.loadAddon(fitAddon)
      term.loadAddon(webLinksAddon)
      term.open(containerRef.current)

      termRef.current = term
      fitRef.current = fitAddon

      // Fit after short delay to ensure layout is ready
      setTimeout(() => fitAddon.fit(), 50)

      // Get settings for shell
      const settingsResult = await window.mas.getSettings()
      const shell = settingsResult.data?.terminal.shell ?? '/bin/bash'

      // Create PTY
      const cols = term.cols as number
      const rows = term.rows as number
      const result = await window.mas.ptyCreate(projectPath ?? '', shell)

      if (!result.success || !result.data) {
        term.write('\r\n\x1b[31mFailed to start terminal: ' + (result.error ?? 'unknown error') + '\x1b[0m\r\n')
        setError(result.error ?? 'unknown error')
        return
      }

      const id = result.data
      setPtyId(id)

      // Send terminal input to PTY
      term.onData((data: string) => {
        window.mas.ptyInput(id, data)
      })

      // Resize PTY when terminal resizes
      term.onResize(({ cols, rows }: { cols: number; rows: number }) => {
        window.mas.ptyResize(id, cols, rows)
      })

      // Receive data from PTY
      const unsubscribe = window.mas.onPtyData((receivedId: string, data: string) => {
        if (receivedId === id) {
          term.write(data)
        }
      })

      // Initial resize
      window.mas.ptyResize(id, cols, rows)

      term.write('\x1b[32m[MAS Terminal]\x1b[0m ' + shell + '\r\n\r\n')

      return unsubscribe
    } catch (err) {
      setError(String(err))
      console.error('[Terminal] init error:', err)
    }
  }, [projectPath, setPtyId])

  useEffect(() => {
    let cleanup: (() => void) | undefined

    initTerminal().then(unsub => {
      cleanup = unsub
    })

    return () => {
      cleanup?.()
      if (termRef.current) {
        try { termRef.current.dispose() } catch { /* ignore */ }
        termRef.current = null
      }
    }
  }, []) // Only init once

  // Handle container resize
  useEffect(() => {
    const handleResize = () => {
      if (fitRef.current) {
        try { fitRef.current.fit() } catch { /* ignore */ }
      }
    }

    const observer = new ResizeObserver(handleResize)
    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  if (error) {
    return (
      <div style={{ padding: 16, color: 'var(--text-error)', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div>⚠ Terminal unavailable: {error}</div>
        <div style={{ color: 'var(--text-secondary)' }}>
          This can happen if node-pty native bindings are not built for your Electron version.
          Try: <code style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg-elevated)', padding: '1px 4px', borderRadius: 3 }}>
            npm rebuild node-pty
          </code>
        </div>
      </div>
    )
  }

  return <div ref={containerRef} className="terminal-wrapper" id="terminal-container" style={{ flex: 1, width: '100%', height: '100%' }} />
}
