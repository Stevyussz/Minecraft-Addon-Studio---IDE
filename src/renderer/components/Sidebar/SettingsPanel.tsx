import { useState, useEffect, useCallback } from 'react'
import type { AppSettings } from '../../../shared/types'

const DEFAULT_SETTINGS: AppSettings = {
  general: { theme: 'dark', autosave: true, autosaveInterval: 3000, fontSize: 14, tabSize: 2, wordWrap: false },
  ai: { provider: 'openai-compatible', baseUrl: 'http://localhost:20128/v1', apiKey: '', defaultModel: '', maxIterations: 5, autonomyLevel: 'balanced' },
  minecraft: { preferredVersion: 'latest', projectDetection: true, validationEnabled: true },
  terminal: { shell: '/bin/bash' },
}

export default function SettingsPanel() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)

  useEffect(() => {
    window.mas.getSettings().then(r => {
      if (r.success && r.data) setSettings(r.data)
    })
  }, [])

  const handleSave = useCallback(async () => {
    await window.mas.setSettings(settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }, [settings])

  const handleTestConnection = useCallback(async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const url = settings.ai.baseUrl.replace(/\/$/, '') + '/models'
      const res = await fetch(url, {
        headers: settings.ai.apiKey ? { Authorization: `Bearer ${settings.ai.apiKey}` } : {},
        signal: AbortSignal.timeout(8000),
      })
      if (res.ok) {
        const data = await res.json() as { data?: unknown[] }
        const count = data.data?.length ?? '?'
        setTestResult({ ok: true, msg: `✓ Connected — ${count} models available` })
      } else {
        setTestResult({ ok: false, msg: `✗ HTTP ${res.status} ${res.statusText}` })
      }
    } catch (err) {
      setTestResult({ ok: false, msg: `✗ ${String(err)}` })
    } finally {
      setTesting(false)
    }
  }, [settings.ai])

  const update = useCallback(<K extends keyof AppSettings>(section: K, key: keyof AppSettings[K], value: unknown) => {
    setSettings(s => ({
      ...s,
      [section]: { ...s[section], [key]: value },
    }))
  }, [])

  return (
    <div className="settings-panel">
      {/* General */}
      <div className="settings-section">
        <h2>General</h2>
        <div className="settings-row">
          <label>Font Size</label>
          <input
            type="number"
            value={settings.general.fontSize}
            min={10} max={24}
            onChange={e => update('general', 'fontSize', parseInt(e.target.value))}
          />
        </div>
        <div className="settings-row">
          <label>Tab Size</label>
          <input
            type="number"
            value={settings.general.tabSize}
            min={2} max={8}
            onChange={e => update('general', 'tabSize', parseInt(e.target.value))}
          />
        </div>
        <div className="settings-row" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            id="autosave"
            checked={settings.general.autosave}
            onChange={e => update('general', 'autosave', e.target.checked)}
          />
          <label htmlFor="autosave">Auto-save</label>
        </div>
        <div className="settings-row" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            id="wordwrap"
            checked={settings.general.wordWrap}
            onChange={e => update('general', 'wordWrap', e.target.checked)}
          />
          <label htmlFor="wordwrap">Word Wrap</label>
        </div>
      </div>

      {/* AI */}
      <div className="settings-section">
        <h2>AI Provider</h2>
        <div className="settings-row">
          <label>Base URL</label>
          <small>OpenAI-compatible endpoint (e.g. 9Router at localhost:20128)</small>
          <input
            type="text"
            value={settings.ai.baseUrl}
            onChange={e => update('ai', 'baseUrl', e.target.value)}
            placeholder="http://localhost:20128/v1"
            id="ai-base-url"
          />
        </div>
        <div className="settings-row">
          <label>API Key</label>
          <small>Stored locally, never sent to MAS servers</small>
          <input
            type="password"
            value={settings.ai.apiKey}
            onChange={e => update('ai', 'apiKey', e.target.value)}
            placeholder="sk-..."
            id="ai-api-key"
            autoComplete="off"
          />
        </div>
        <div className="settings-row">
          <label>Default Model</label>
          <input
            type="text"
            value={settings.ai.defaultModel}
            onChange={e => update('ai', 'defaultModel', e.target.value)}
            placeholder="e.g. gemini-flash, claude-sonnet"
            id="ai-default-model"
          />
        </div>
        <div className="settings-row">
          <label>Max Agent Iterations</label>
          <input
            type="number"
            value={settings.ai.maxIterations}
            min={1} max={20}
            onChange={e => update('ai', 'maxIterations', parseInt(e.target.value))}
          />
        </div>
        <div className="settings-row">
          <label>Autonomy Level</label>
          <select
            value={settings.ai.autonomyLevel}
            onChange={e => update('ai', 'autonomyLevel', e.target.value as AppSettings['ai']['autonomyLevel'])}
            id="ai-autonomy-level"
          >
            <option value="conservative">Conservative — approve every change</option>
            <option value="balanced">Balanced — approve major changes</option>
            <option value="autonomous">Autonomous — auto-apply routine changes</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={handleTestConnection} disabled={testing} id="btn-test-ai-connection">
            {testing ? 'Testing…' : 'Test Connection'}
          </button>
          {testResult && (
            <span style={{ fontSize: 12, color: testResult.ok ? 'var(--text-success)' : 'var(--text-error)' }}>
              {testResult.msg}
            </span>
          )}
        </div>
      </div>

      {/* Minecraft */}
      <div className="settings-section">
        <h2>Minecraft Bedrock</h2>
        <div className="settings-row">
          <label>Preferred Version</label>
          <input
            type="text"
            value={settings.minecraft.preferredVersion}
            onChange={e => update('minecraft', 'preferredVersion', e.target.value)}
            placeholder="latest"
          />
        </div>
        <div className="settings-row" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            id="mc-detection"
            checked={settings.minecraft.projectDetection}
            onChange={e => update('minecraft', 'projectDetection', e.target.checked)}
          />
          <label htmlFor="mc-detection">Auto-detect Minecraft projects</label>
        </div>
        <div className="settings-row" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            id="mc-validation"
            checked={settings.minecraft.validationEnabled}
            onChange={e => update('minecraft', 'validationEnabled', e.target.checked)}
          />
          <label htmlFor="mc-validation">Enable JSON validation</label>
        </div>
      </div>

      {/* Terminal */}
      <div className="settings-section">
        <h2>Terminal</h2>
        <div className="settings-row">
          <label>Shell</label>
          <input
            type="text"
            value={settings.terminal.shell}
            onChange={e => update('terminal', 'shell', e.target.value)}
            placeholder="/bin/bash"
          />
        </div>
      </div>

      {/* Save */}
      <div className="settings-actions">
        <button className="btn btn-primary" onClick={handleSave} id="btn-save-settings">
          {saved ? '✓ Saved' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}
