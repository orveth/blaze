# Kanban Board

A simple kanban board with FastAPI backend and vanilla JS frontend.

## Quick Start

```bash
# Enter dev shell
nix develop

# Run the server
uvicorn backend.main:app --host 127.0.0.1 --port 8080

# With auto-reload for development
uvicorn backend.main:app --host 127.0.0.1 --port 8080 --reload
```

Open http://localhost:8080 in your browser.

The API token is printed on startup and saved to `data/.token`.

## Structure

```
kanban/
├── backend/
│   ├── main.py      # FastAPI app, routes, static file serving
│   ├── models.py    # Pydantic models (Card, Column, Priority)
│   ├── storage.py   # Thread-safe JSON file storage
│   ├── auth.py      # Token-based authentication
│   └── utils.py     # Helpers (ID generation, datetime)
├── frontend/
│   ├── index.html   # Main page
│   ├── app.js       # Board logic, drag-drop, API calls
│   └── style.css    # Styling
├── data/
│   ├── board.json   # Card storage
│   └── .token       # API token (gitignored)
├── flake.nix        # Nix dev environment
└── README.md
```

## Features

- **Drag-and-drop** card management
- **5 columns:** Backlog → Todo → In Progress → Review → Done
- **Priority levels:** Low (🟢) → Medium (🟡) → High (🟠) → Urgent (🔴)
- **Due dates** with overdue indicators
- **Simple token auth** (printed on startup)
- **JSON file persistence** with thread-safe locking
- Toast notifications for feedback

## API

All endpoints (except `/health` and auth) require `Authorization: Bearer <token>` header.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/api/auth` | Login (returns token) |
| GET | `/api/board` | Full board state |
| GET | `/api/board/stats` | Statistics |
| GET | `/api/cards` | List cards |
| POST | `/api/cards` | Create card |
| PUT | `/api/cards/{id}` | Update card |
| PATCH | `/api/cards/{id}/move` | Move to column |
| DELETE | `/api/cards/{id}` | Delete card |

## Roadmap

- [ ] NixOS module for deployment
- [ ] OpenClaw integration for autonomous task management
- [ ] WebSocket for real-time updates
