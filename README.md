# Minecraft AI Studio (MAS)

> AI-powered IDE for Minecraft Bedrock Add-on development

**MAS** is a local-first desktop IDE that makes Minecraft Bedrock Add-on development dramatically easier, faster, more accurate, and more automated through an AI coding agent.

## Features (Phase 1)

- 🗂 **File Explorer** — Browse and navigate Minecraft project files
- ✏️ **Monaco Editor** — Professional code editor with JSON schema hints for Bedrock files
- 📑 **Editor Tabs** — Multiple files open simultaneously with dirty indicators
- 🖥️ **Integrated Terminal** — Real PTY-based terminal via node-pty + xterm.js
- 🔍 **Minecraft Project Detection** — Automatically detects BP, RP, Script API projects
- ⚙️ **Settings** — Configure AI provider, base URL, API key, model, and IDE preferences
- 💾 **Auto-save** — Configurable auto-save with Ctrl+S support
- 🎮 **Minecraft Info Panel** — Shows project type, manifest info, UUIDs, pack details

## Stack

| Layer | Technology |
|-------|-----------|
| Desktop Shell | Electron 36 |
| Frontend | React 18 + TypeScript |
| Build | Vite 5 + vite-plugin-electron |
| Editor | Monaco Editor (`@monaco-editor/react`) |
| Terminal | xterm.js + node-pty |
| State | Zustand |
| Styling | Vanilla CSS (VS Code dark theme) |

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm 9+
- Linux (primary target)

### Install
```bash
cd mas
npm install
```

### Development
```bash
npm run electron:dev
```

This starts Vite dev server + Electron simultaneously.

### Type Check
```bash
npm run typecheck
```

### Build (Production)
```bash
npm run electron:build
```

## Project Structure

```
mas/
├── src/
│   ├── main/           # Electron main process (IPC, FS, PTY, settings)
│   ├── preload/        # Secure preload bridge (window.mas API)
│   ├── renderer/       # React UI
│   │   ├── components/ # UI components (ActivityBar, Sidebar, Editor, Panel, StatusBar)
│   │   ├── store/      # Zustand state stores
│   │   ├── styles/     # Global CSS
│   │   └── mock/       # Browser dev mock (no Electron needed for UI dev)
│   ├── core/
│   │   └── minecraft/  # Minecraft project detection + file utilities
│   └── shared/         # Shared TypeScript types + IPC channel names
├── resources/          # App resources (icon etc)
├── tsconfig.json       # Renderer TypeScript config
├── tsconfig.node.json  # Main/preload TypeScript config
└── vite.config.ts      # Vite + Electron build config
```

## AI Provider Configuration

MAS supports any OpenAI-compatible API endpoint (9Router, Ollama, direct OpenAI, Anthropic, etc).

Configure in Settings → AI Provider:
- **Base URL**: `http://localhost:20128/v1` (9Router default)
- **API Key**: Your API key (stored locally, never transmitted to MAS servers)
- **Default Model**: e.g. `gemini-flash`, `claude-sonnet`

## Roadmap

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1 | ✅ Complete | IDE Foundation |
| Phase 2 | 🔜 Next | Project Indexer + Minecraft Analysis |
| Phase 3 | Planned | AI Chat + Context Manager |
| Phase 4 | Planned | AI Coding Agent |
| Phase 5 | Planned | Minecraft Intelligence + Validation |
| Phase 6 | Planned | Auto Debugger |
| Phase 7 | Planned | Build System (.mcaddon) |
| Phase 8 | Planned | Polish + Linux Packaging |

## Security

- Context isolation enabled
- Preload bridge pattern (no raw Node.js in renderer)
- IPC input validation
- API keys stored locally via electron-store
- No cloud backend required
