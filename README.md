# Blaze

A personal task board with FastAPI backend and vanilla JS frontend.

## About the Name

A **blaze** is a mark carved into a tree to guide travelers along a trail — a waypoint showing you're on the right path. Like those trail markers, Blaze helps you mark your progress and find your way through work.

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
nix run github:orveth/blaze

# With custom port
BLAZE_PORT=3000 nix run github:orveth/blaze
```

Open http://localhost:8080 in your browser.

The API token is printed on startup and saved to `data/.token`.

## NixOS Deployment

Add to your flake inputs:

```nix
{
  inputs.blaze.url = "github:orveth/blaze";
}
```

Import the module and configure:

```nix
{ inputs, ... }:
{
  imports = [ inputs.blaze.nixosModules.default ];

  services.blaze = {
    enable = true;
    port = 8080;
    host = "127.0.0.1";  # localhost only by default
    # dataDir = "/var/lib/blaze";  # default
    # passwordFile = "/run/secrets/blaze-password";  # optional, generates random if null
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
| `dataDir` | `"/var/lib/blaze"` | Data directory |
| `passwordFile` | `null` | Path to token file (generates random if null) |
| `openFirewall` | `false` | Open firewall port |
| `user` | `"blaze"` | Service user |
| `group` | `"blaze"` | Service group |

### With sops-nix or agenix

```nix
services.blaze = {
  enable = true;
  passwordFile = config.sops.secrets.blaze-token.path;
};
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BLAZE_DATA_DIR` | `"data"` | Directory for board.json |
| `BLAZE_API_TOKEN` | (generated) | API token (or use file) |
| `BLAZE_TOKEN_FILE` | `"$DATA_DIR/.token"` | Path to token file |
| `BLAZE_HOST` | `"127.0.0.1"` | Bind address (used by wrapper) |
| `BLAZE_PORT` | `"8080"` | Port (used by wrapper) |

## Structure

```
blaze/
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

- **Drag-and-drop** task management
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
- [ ] CLI for agent/automation use ([plan](plans/sprint-cli.md))
- [ ] OpenClaw integration for autonomous task management
- [ ] WebSocket for real-time updates

## License

MIT
