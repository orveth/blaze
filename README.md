# Kanban Board

A simple kanban board with FastAPI backend and vanilla JS frontend.

## Quick Start

```bash
# Enter dev shell
nix develop

# Run the server
uvicorn backend.main:app --reload
```

Open http://localhost:8000 in your browser.

## Structure

```
kanban/
├── backend/      # FastAPI API
├── frontend/     # Vanilla JS/CSS/HTML
├── flake.nix     # Nix dev environment
└── README.md
```

## Features (Planned)

- Drag-and-drop card management
- 5 columns: Backlog → Todo → In Progress → Review → Done
- Priority levels with color coding
- Due dates with overdue indicators
- Simple token auth
- JSON file persistence
- NixOS module for deployment
- OpenClaw integration for autonomous task management
