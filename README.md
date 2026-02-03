# Kanban Board

A simple kanban board with FastAPI backend and vanilla JS frontend.

## Quick Start

### Development

```bash
# Enter dev shell
nix develop

# Run the server
uvicorn backend.main:app --host 127.0.0.1 --port 8080

# With auto-reload for development
uvicorn backend.main:app --host 127.0.0.1 --port 8080 --reload
```

### Run Directly (no install)

```bash
# Run from GitHub
nix run github:orveth/kanban

# With custom port
KANBAN_PORT=3000 nix run github:orveth/kanban
```

Open http://localhost:8080 in your browser.

The API token is printed on startup and saved to `data/.token`.

## NixOS Deployment

Add to your flake inputs:

```nix
{
  inputs.kanban.url = "github:orveth/kanban";
}
```

Import the module and configure:

```nix
{ inputs, ... }:
{
  imports = [ inputs.kanban.nixosModules.default ];

  services.kanban = {
    enable = true;
    port = 8080;
    host = "127.0.0.1";  # localhost only by default
    # dataDir = "/var/lib/kanban";  # default
    # passwordFile = "/run/secrets/kanban-password";  # optional, generates random if null
    # openFirewall = false;  # set true to expose port
  };
}
```

### Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `enable` | `false` | Enable the service |
| `port` | `8080` | Port to listen on |
| `host` | `"127.0.0.1"` | Bind address (use `0.0.0.0` for all interfaces) |
| `dataDir` | `"/var/lib/kanban"` | Data directory |
| `passwordFile` | `null` | Path to token file (generates random if null) |
| `openFirewall` | `false` | Open firewall port |
| `user` | `"kanban"` | Service user |
| `group` | `"kanban"` | Service group |

### With sops-nix or agenix

```nix
services.kanban = {
  enable = true;
  passwordFile = config.sops.secrets.kanban-token.path;
};
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `KANBAN_DATA_DIR` | `"data"` | Directory for board.json |
| `KANBAN_API_TOKEN` | (generated) | API token (or use file) |
| `KANBAN_TOKEN_FILE` | `"$DATA_DIR/.token"` | Path to token file |
| `KANBAN_HOST` | `"127.0.0.1"` | Bind address (used by wrapper) |
| `KANBAN_PORT` | `"8080"` | Port (used by wrapper) |

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
├── flake.nix        # Nix package + module
├── module.nix       # NixOS service module
└── README.md
```

## Features

- **Drag-and-drop** card management
- **5 columns:** Backlog → Todo → In Progress → Review → Done
- **Priority levels:** Low (🟢) → Medium (🟡) → High (🟠) → Urgent (🔴)
- **Due dates** with overdue indicators
- **Simple token auth** (printed on startup)
- **JSON file persistence** with thread-safe locking
- **Systemd hardening** (NixOS deployment)
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

- [x] NixOS module for deployment
- [ ] OpenClaw integration for autonomous task management
- [ ] WebSocket for real-time updates

## License

MIT
