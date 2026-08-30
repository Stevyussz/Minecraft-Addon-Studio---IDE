import type { ActivityView } from '../App'

interface Props {
  activeView: ActivityView
  onViewChange: (view: ActivityView) => void
}

// SVG Icon components (inline, no extra deps)
const IconExplorer = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M3 4a1 1 0 0 1 1-1h5.5l1.5 2H20a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4z" />
  </svg>
)

const IconSearch = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.35-4.35" />
  </svg>
)

const IconMinecraft = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <rect x="3" y="3" width="8" height="8" rx="1" opacity="0.8" />
    <rect x="13" y="3" width="8" height="8" rx="1" opacity="0.6" />
    <rect x="3" y="13" width="8" height="8" rx="1" opacity="0.6" />
    <rect x="13" y="13" width="8" height="8" rx="1" opacity="0.4" />
  </svg>
)

const IconSettings = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
)

const IconAi = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a10 10 0 0 1 10 10c0 5.5-4.5 10-10 10S2 17.5 2 12 6.5 2 12 2Z" />
    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
    <line x1="9" y1="9" x2="9.01" y2="9" />
    <line x1="15" y1="9" x2="15.01" y2="9" />
  </svg>
)

const ACTIVITIES: Array<{ id: ActivityView; icon: React.ReactNode; title: string }> = [
  { id: 'explorer',  icon: <IconExplorer />,  title: 'Explorer (Ctrl+Shift+E)' },
  { id: 'search',    icon: <IconSearch />,    title: 'Search (Ctrl+Shift+F)' },
  { id: 'minecraft', icon: <IconMinecraft />, title: 'Minecraft' },
  { id: 'ai',        icon: <IconAi />,        title: 'Antigravity AI (Ctrl+Shift+A)' },
]

const BOTTOM_ACTIVITIES: Array<{ id: ActivityView; icon: React.ReactNode; title: string }> = [
  { id: 'settings', icon: <IconSettings />, title: 'Settings' },
]

export default function ActivityBar({ activeView, onViewChange }: Props) {
  return (
    <div className="activity-bar">
      <div className="activity-bar__top">
        {ACTIVITIES.map(a => (
          <button
            key={a.id}
            className={`activity-btn ${activeView === a.id ? 'active' : ''}`}
            title={a.title}
            onClick={() => onViewChange(a.id)}
            aria-label={a.title}
            aria-pressed={activeView === a.id}
          >
            {a.icon}
          </button>
        ))}
      </div>

      <div className="activity-bar__bottom">
        {BOTTOM_ACTIVITIES.map(a => (
          <button
            key={a.id}
            className={`activity-btn ${activeView === a.id ? 'active' : ''}`}
            title={a.title}
            onClick={() => onViewChange(a.id)}
            aria-label={a.title}
          >
            {a.icon}
          </button>
        ))}
      </div>
    </div>
  )
}
