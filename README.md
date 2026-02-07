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
- **Archiving:** Hide cards without deleting them (archived cards retain their column and can be unarchived)
- **Agent workflow:** AI-friendly task tracking with acceptance criteria and progress timeline
- **Simple token auth** (printed on startup)
- **JSON file persistence** with thread-safe locking
- **Systemd hardening** (NixOS deployment)
- Toast notifications for feedback

## Agent Workflow

Blaze supports AI agent task management with structured acceptance criteria and progress tracking.

### Card Features

- **Agent Assignable Toggle:** Mark cards that agents can work on
- **Acceptance Criteria:** Checkable list of requirements for completion
- **Progress Timeline:** Chronological log of agent activity
- **Status Tracking:** 
  - 🟢 **Ready** — Agent can pick this up
  - 🔵 **In Progress** — Agent is actively working
  - 🔴 **Blocked** — Waiting for human input (with reason)
  - 🟡 **Needs Review** — Agent finished, needs human approval

### CLI Commands

```bash
# List cards ready for agent work
blaze agent list

# Start working on a card (sets status to in_progress)
blaze agent start <card-id>

# Log progress
blaze agent progress <card-id> "Implemented feature X"

# Toggle acceptance criterion
blaze agent check <card-id> <index>

# Mark blocked with reason
blaze agent block <card-id> "Need API credentials"

# Mark ready for review
blaze agent review <card-id>
```

### UI

- **Card Modal:** Shows agent status, acceptance criteria (with checkboxes), and progress timeline
- **Board Cards:** Display agent badge (🤖) with status indicator
- **Live Updates:** Criterion toggles update via WebSocket immediately

### Use Cases

- **Autonomous task execution:** Agents pick up cards, log progress, mark completion
- **Human-in-the-loop:** Agents can request input by marking tasks blocked
- **Structured requirements:** Acceptance criteria ensure clear task definition
- **Audit trail:** Progress timeline shows agent decision-making process

## API

All endpoints (except `/health` and auth) require `Authorization: Bearer <token>` header.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/api/auth` | Login (returns token) |
| GET | `/api/board` | Full board state |
| GET | `/api/board/stats` | Statistics |
| GET | `/api/cards` | List cards (archived cards excluded by default) |
| POST | `/api/cards` | Create card |
| PUT | `/api/cards/{id}` | Update card |
| PATCH | `/api/cards/{id}/move` | Move to column |
| PATCH | `/api/cards/{id}/archive` | Archive card (hides from UI, preserves column) |
| PATCH | `/api/cards/{id}/unarchive` | Unarchive card |
| POST | `/api/columns/{column}/archive` | Archive all cards in a column |
| DELETE | `/api/cards/{id}` | Delete card |
| **Agent Workflow** |
| GET | `/api/agent/ready` | List cards ready for agent work |
| POST | `/api/cards/{id}/agent-progress` | Add progress entry (`{message}`) |
| PATCH | `/api/cards/{id}/agent-status` | Update status (`{status, blocked_reason?}`) |
| POST | `/api/cards/{id}/criteria/{i}/check` | Toggle criterion (`{checked}`) |

### Archiving Behavior

- **Archived cards are hidden** from the UI by default
- **Column is preserved** — if a card is in TODO when archived, it stays in TODO
- **No automatic deletion** — archived cards remain in storage until explicitly deleted
- Use `GET /api/cards?include_archived=true` to retrieve archived cards

## Roadmap

- [x] NixOS module for deployment
- [ ] CLI for agent/automation use ([plan](plans/sprint-cli.md))
- [ ] OpenClaw integration for autonomous task management
- [ ] WebSocket for real-time updates

## License

MIT
