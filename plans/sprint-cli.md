# Sprint: Blaze CLI

**Goal:** Build a CLI for Blaze that enables efficient task management from the command line, designed for both human and agent (OpenClaw) use.

**Prerequisite for:** OpenClaw integration sprint

---

## Motivation

The web UI works for interactive use, but automation and agent workflows need a CLI:
- Single commands instead of multi-step API calls
- Scriptable with shell pipelines
- JSON output for structured processing
- Natural fit for OpenClaw's exec tool

---

## CLI Design

### Commands

```bash
blaze [global-options] <command> [options]
```

**Global Options:**
- `--url <url>` — API base URL (default: `http://localhost:8080`, env: `BLAZE_URL`)
- `--token <token>` — API token (env: `BLAZE_TOKEN`, or read from `~/.config/blaze/token`)
- `-o, --output <format>` — Output format: `table` (default), `json`, `quiet`

### Card Commands

```bash
# List cards
blaze list                          # All cards, grouped by column
blaze list --column todo            # Filter by column
blaze list --priority high,urgent   # Filter by priority (comma-separated)
blaze list --tag backend            # Filter by tag
blaze list --overdue                # Only overdue cards

# Create card
blaze add "Card title"              # Minimal (defaults: todo, medium priority)
blaze add "Fix bug" \
  --column in_progress \
  --priority high \
  --tag backend,urgent \
  --due 2026-02-10 \
  --desc "Description here"

# View card details
blaze show <card-id>

# Update card
blaze edit <card-id> --title "New title"
blaze edit <card-id> --priority urgent --due 2026-02-05
blaze edit <card-id> --tag +new-tag    # Add tag
blaze edit <card-id> --tag -old-tag    # Remove tag

# Move card
blaze move <card-id> <column>       # Move to column
blaze move <card-id> todo           # Explicit column name
blaze done <card-id>                # Shortcut: move to done

# Delete card
blaze rm <card-id>
blaze rm <card-id> --force          # Skip confirmation
```

### Board Commands

```bash
# Board overview
blaze board                         # Show column counts
blaze stats                         # Detailed statistics

# Health check
blaze ping                          # Check API connectivity
```

### Config Commands

```bash
# Store credentials
blaze config set url http://localhost:8080
blaze config set token <token>
blaze config show                   # Show current config (token masked)
```

---

## Architecture

### Language Choice: **Rust**

Rationale:
- Consistent with njalla-cli (shared patterns, learnings)
- Single static binary — easy to distribute via Nix
- clap for CLI parsing (already familiar)
- reqwest for HTTP client
- Compiles to efficient native code

### Project Structure

```
cli/
├── Cargo.toml
├── src/
│   ├── main.rs           # Entry point, clap CLI definition
│   ├── client.rs         # API client (reqwest wrapper)
│   ├── commands/
│   │   ├── mod.rs
│   │   ├── list.rs       # blaze list
│   │   ├── add.rs        # blaze add
│   │   ├── show.rs       # blaze show
│   │   ├── edit.rs       # blaze edit
│   │   ├── move_card.rs  # blaze move, blaze done
│   │   ├── rm.rs         # blaze rm
│   │   ├── board.rs      # blaze board, blaze stats
│   │   ├── config.rs     # blaze config
│   │   └── ping.rs       # blaze ping
│   ├── config.rs         # Config file handling (~/.config/blaze/)
│   ├── output.rs         # Table/JSON formatters
│   ├── types.rs          # Card, Column, Priority types
│   └── error.rs          # Error types and handling
└── tests/
    └── integration.rs    # End-to-end tests against real API
```

### Config File

Location: `~/.config/blaze/config.toml`

```toml
url = "http://localhost:8080"
# Token stored separately in ~/.config/blaze/token (gitignored pattern)
```

### Output Formats

**Table (default):** Human-readable, colored output
```
ID       TITLE              PRIORITY  DUE       TAGS
abc123   Fix memory leak    🟠 high   Feb 10    backend, urgent
def456   Update docs        🟡 medium -         docs
```

**JSON:** Machine-readable, one object per card
```json
{"id":"abc123","title":"Fix memory leak","priority":"high","column":"todo","due_date":"2026-02-10","tags":["backend","urgent"]}
```

**Quiet:** IDs only (for scripting)
```
abc123
def456
```

---

## Implementation Plan

### Phase 1: Foundation ✅
- [x] Project scaffolding (Cargo.toml, basic structure)
- [x] API client with auth handling
- [x] Config file loading (URL, token)
- [x] Error types and display
- [x] `blaze ping` — verify connectivity

### Phase 2: Read Operations ✅
- [x] `blaze list` with filters (column, priority, tag, overdue)
- [x] `blaze show <id>` — card details
- [x] `blaze board` — column summary
- [x] `blaze stats` — detailed statistics
- [x] Output formatters (table, json, quiet)

### Phase 3: Write Operations
- [ ] `blaze add` — create card
- [ ] `blaze edit` — update card fields
- [ ] `blaze move` / `blaze done` — move between columns
- [ ] `blaze rm` — delete with confirmation

### Phase 4: Polish
- [ ] `blaze config` — credential management
- [ ] Shell completions (bash, zsh, fish)
- [ ] Colored output with `colored` crate
- [ ] Integration tests
- [ ] Nix packaging (add to flake.nix)

---

## Nix Integration

Add CLI to existing `flake.nix`:

```nix
{
  packages = {
    default = blaze-server;
    cli = blaze-cli;
  };
  
  # Optional: combined package with both
  packages.full = pkgs.symlinkJoin {
    name = "blaze-full";
    paths = [ blaze-server blaze-cli ];
  };
}
```

Usage:
```bash
nix run github:orveth/blaze#cli -- list
```

---

## Acceptance Criteria

- [ ] All commands documented above are implemented
- [ ] `--output json` works for all list/show commands
- [ ] Token can be provided via env var, config file, or CLI flag
- [ ] Errors are clear and actionable
- [ ] Nix build produces static binary
- [ ] Integration tests pass against running Blaze server

---

## Future Enhancements (Post-Sprint)

- Bulk operations (`blaze done $(blaze list --column review -o quiet)`)
- Card templates (`blaze add --template bug`)
- Watch mode (`blaze watch --column in_progress`)
- Interactive mode (`blaze -i`)

---

## Notes for OpenClaw Integration

Once this CLI exists, the OpenClaw integration sprint can:
1. Add `blaze` to TOOLS.md with usage patterns
2. Document safe vs. guarded operations (if any)
3. Integrate with heartbeat tasks (check overdue, surface blockers)
4. Enable autonomous task management workflows
