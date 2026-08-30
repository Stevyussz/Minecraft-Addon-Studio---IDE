import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { useAiStore } from '../../store/aiStore'
import { useProjectStore } from '../../store/projectStore'

export default function AiChat() {
  const { messages, isGenerating, error, sendMessage, cancelGeneration, updateLastMessage, setGenerating, setError, clearChat } = useAiStore()
  const { projectPath } = useProjectStore()
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Wire up IPC streaming listeners
  useEffect(() => {
    const unsubData = window.mas.onAiStreamData((chunk) => {
      updateLastMessage(chunk)
    })
    const unsubEnd = window.mas.onAiStreamEnd(() => {
      setGenerating(false)
    })
    const unsubError = window.mas.onAiStreamError((err) => {
      setError(err)
    })

    return () => {
      unsubData()
      unsubEnd()
      unsubError()
    }
  }, [updateLastMessage, setGenerating, setError])

  const handleSend = () => {
    if (!input.trim() || isGenerating) return
    sendMessage(input.trim())
    setInput('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--bg-default)' }}>
      {/* Header */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>Antigravity AI</span>
        <button onClick={clearChat} className="sidebar-icon-btn" title="Clear Chat" style={{ fontSize: 11 }}>
          Clear
        </button>
      </div>

      {/* Messages Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {messages.filter(m => m.role !== 'system').map((msg) => (
          <div key={msg.id} style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start'
          }}>
            <div style={{
              maxWidth: '85%',
              padding: '8px 12px',
              borderRadius: 6,
              fontSize: 13,
              lineHeight: 1.5,
              backgroundColor: msg.role === 'user' ? 'var(--text-accent)' : 'var(--bg-elevated)',
              color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              <SimpleMarkdown content={msg.content} />
            </div>
            {msg.role === 'assistant' && msg.content === '' && isGenerating && (
              <span className="spinner" style={{ marginTop: 4, width: 12, height: 12 }} />
            )}
          </div>
        ))}
        {error && (
          <div style={{ color: 'var(--text-error)', fontSize: 12, textAlign: 'center', padding: 8, background: 'rgba(248, 81, 73, 0.1)', borderRadius: 4 }}>
            Error: {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div style={{ padding: 12, borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {!projectPath && (
          <div style={{ fontSize: 11, color: '#d29922', textAlign: 'center' }}>
            Warning: No project open. AI will lack project context.
          </div>
        )}
        <div style={{ position: 'relative' }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isGenerating ? "Antigravity is thinking..." : "Ask Antigravity (Shift+Enter for new line)"}
            disabled={isGenerating}
            rows={3}
            style={{
              width: '100%',
              resize: 'none',
              padding: '8px 40px 8px 8px',
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              borderRadius: 4,
              fontFamily: 'inherit',
              fontSize: 13,
            }}
          />
          {isGenerating ? (
            <button 
              onClick={cancelGeneration}
              style={{ position: 'absolute', right: 8, bottom: 8, width: 24, height: 24, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', color: 'var(--text-error)' }}
              title="Stop Generation"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
            </button>
          ) : (
            <button 
              onClick={handleSend}
              disabled={!input.trim()}
              style={{ position: 'absolute', right: 8, bottom: 8, width: 24, height: 24, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', color: input.trim() ? 'var(--text-accent)' : 'var(--text-muted)' }}
              title="Send (Enter)"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/** 
 * Very basic markdown renderer to handle code blocks and inline code.
 * (To avoid adding full markdown parsers in Phase 3 until needed)
 */
function SimpleMarkdown({ content }: { content: string }) {
  if (!content) return null

  // Split by ```
  const blocks = content.split('```')
  
  return (
    <>
      {blocks.map((block, i) => {
        if (i % 2 === 1) {
          // This is a code block
          const lines = block.split('\n')
          const lang = lines[0].trim()
          const code = lines.slice(1).join('\n')
          return (
            <div key={i} style={{ margin: '8px 0', borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
              {lang && <div style={{ background: '#161b22', padding: '2px 8px', fontSize: 11, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>{lang}</div>}
              <pre style={{ margin: 0, padding: 8, background: '#0d1117', overflowX: 'auto' }}>
                <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{code}</code>
              </pre>
            </div>
          )
        }
        
        // This is regular text. Parse inline `code`
        const inlineBlocks = block.split('`')
        return (
          <span key={i}>
            {inlineBlocks.map((ib, j) => {
              if (j % 2 === 1) {
                return <code key={j} style={{ background: 'rgba(110,118,129,0.4)', padding: '0.2em 0.4em', borderRadius: 3, fontFamily: 'var(--font-mono)', fontSize: '0.9em' }}>{ib}</code>
              }
              return <span key={j}>{ib}</span>
            })}
          </span>
        )
      })}
    </>
  )
}
