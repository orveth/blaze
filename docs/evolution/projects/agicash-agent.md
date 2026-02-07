# AGI.Cash Dedicated Agent

**Status:** Designed, not yet implemented  
**Date:** February 2026  
**Context:** OpenClaw multi-agent architecture exploration

---

## Motivation

**Problem:** The main Orveth agent is generalist — context-switching between multiple projects (Blaze, njalla-cli, OpenClaw, AGI.Cash) dilutes focus and makes it hard to build deep expertise in any single codebase.

**Goal:** Create a dedicated agent for AGI.Cash development that:
- Lives exclusively in that codebase
- Learns patterns and anti-patterns specific to the project
- Builds cumulative knowledge through MEMORY.md
- Operates with strict quality gates (planning, self-review, approval)
- Reports progress via heartbeats without manual prompting

**Outcome:** Faster iteration on AGI.Cash features with fewer mistakes and better adherence to project standards.

---

## Architecture

### Multi-Agent Pattern (OpenClaw)

OpenClaw supports multiple agent instances, each with:
- **Dedicated workspace** — separate SOUL.md, AGENTS.md, MEMORY.md, TOOLS.md
- **Isolated sessions** — agent only sees messages routed to it
- **Independent heartbeat** — runs on its own schedule
- **Model selection** — can use different models per agent

**Example config:**
```json5
{
  agents: {
    list: [
      {
        id: "main",
        name: "Orveth",
        workspace: "~/.openclaw/workspace",
        model: "anthropic/claude-opus-4-5"
      },
      {
        id: "agicash",
        name: "AGI.Cash Dev",
        workspace: "~/.openclaw/workspace-agicash",
        model: "anthropic/claude-sonnet-4-5",
        heartbeat: {
          every: "20m",
          activeHours: { start: "08:00", end: "22:00", timezone: "America/Los_Angeles" },
          target: "discord",
          to: "user:1094040844102799410"
        }
      }
    ]
  },
  bindings: [
    { agentId: "main", match: { channel: "heartbeat" } },
    // Route AGI.Cash guild to dedicated agent:
    // { agentId: "agicash", match: { channel: "discord", guildId: "<guild-id>" } }
  ]
}
```

**Key insight:** Bindings route messages to specific agents. Unrouted messages still go to main agent.

---

## Workspace Files

The AGI.Cash agent workspace mirrors the main agent's structure but specializes:

### SOUL.md
- **Identity:** "AGI.Cash Developer" — builds production TypeScript for a Bitcoin/Lightning wallet
- **Stack mastery:** React Router v7, TanStack Query, Zustand, Tailwind, shadcn/ui, Supabase, Cashu, Spark
- **Patterns enforced:** Money class, TanStack Query for data, kebab-case files, <200 line components
- **Communication style:** Brief, technical, show code not intentions

**Contrast with Orveth:** Orveth is a generalist engineer across Nix/systems/CLI/web. AGI.Cash agent is a focused TypeScript dev.

### AGENTS.md
- **Startup:** Read SOUL.md, MEMORY.md, check open PRs
- **Memory:** Track patterns learned, feedback received, architectural decisions
- **Heartbeat:** Check PRs, CI status, review feedback, report to gudnuf
- **Code changes:** Always use worktrees, never merge PRs, ask before tests/migrations
- **Guardrails:** Run `fix:all` before commits, never push to master/alpha

**Contrast with Orveth:** No Blaze integration (AGI.Cash agent focuses purely on one project). Stricter guardrails (no merging, ask before tests).

### USER.md
- **Name:** gudnuf
- **Role:** AGI.Cash team lead / reviewer
- **Workflow:** Assigns tasks, reviews/merges PRs, final say on architecture

**Contrast with Orveth:** More hierarchical (gudnuf as team lead, not peer collaborator).

### TOOLS.md
- **Project location:** ~/agicash, worktrees in ~/workspace/agicash-worktree-*
- **Commands:** `bun run dev`, `bun run fix:all`, `bun test` (ask first)
- **Git workflow:** Worktree setup, PR creation, cleanup after merge
- **Key files:** CLAUDE.md (patterns), GUIDELINES.md (architecture)

**Contrast with Orveth:** No infrastructure tools (no turtle, no Nix rebuilds). Pure dev workflow.

### MEMORY.md
- **Codebase patterns** — e.g., "TanStack Query handles all data fetching"
- **Feedback received** — track code review corrections to avoid repeating mistakes
- **Architectural decisions** — document why things are the way they are
- **Anti-patterns encountered** — things I've been corrected on

**Key innovation:** Cumulative learning. Each PR review teaches the agent. Next PR avoids previous mistakes.

### HEARTBEAT.md
- **Check open PRs** — `gh pr list --author @me --state open`
- **For each PR:** Check CI status, check for comments
- **If PR merged:** Clean up worktrees, update MEMORY.md with lessons
- **Report to gudnuf** if: PR merged, CI failed, new feedback, blockers
- **Otherwise:** `HEARTBEAT_OK`

**Contrast with Orveth:** No Blaze checks, no task management. Pure PR-focused heartbeat.

---

## Iterative Workflow

See [workflow-patterns.md](../workflow-patterns.md) for full details. Summary:

### Three Phases

1. **Planning (Iterative)**
   - Draft plan in `plans/active/<task>.md`
   - Forced self-critique loops (min 2 iterations)
   - Request approval from gudnuf
   - **STOP** — do not proceed without explicit "approved"

2. **Implementation (Step-by-Step)**
   - Create worktree
   - For each change: STATE → DO → VERIFY → DOCUMENT
   - Checkpoint if scope creep or unexpected complexity
   - Update plan status as you go

3. **Review & Submit**
   - Self-review checklist (fix:all, manual test, diff review)
   - Open PR with clear description
   - Notify gudnuf

### Quality Gates

| Gate | Criteria |
|------|----------|
| Plan → Approval | Min 2 self-review iterations, explicit human approval |
| Approval → Implementation | Worktree created, plan status updated |
| Each Step → Next Step | Verification passed, documented in plan |
| Implementation → PR | Self-review checklist complete, manual test done |
| PR → Merge | CI passes, gudnuf approves (never self-merge) |

**Why this matters:** Prevents rushed work, documents reasoning, enables handoff, reduces rework.

---

## Onboarding Plan

The agent's first session will:
1. **Setup environment** — clone repo, install deps, verify dev server runs
2. **Deep dive** — read CLAUDE.md, GUIDELINES.md, explore codebase structure
3. **Wait for assignment** — gudnuf assigns first task via Discord or GitHub

**Success criteria:**
- Follow standards strictly (CLAUDE.md, GUIDELINES.md)
- Self-review rigorously (catch issues before PR)
- Respond to feedback (iterate on code review)
- Communicate clearly (Discord for questions, GitHub for technical discussion)
- Track work transparently (Blaze updates from main agent for gudnuf's visibility)

**Learning from past mistakes:**
- Don't guess implementation details — verify by reading source
- Don't create new patterns — follow established conventions
- Don't skip CI — `fix:all` must pass before commit
- Don't merge PRs — always wait for gudnuf's approval

---

## Key Innovations

1. **Dedicated workspace** — Agent lives exclusively in AGI.Cash codebase, no context-switching
2. **Cumulative learning via MEMORY.md** — Track patterns, feedback, decisions; improve over time
3. **Forced iteration in planning** — Min 2 self-critique loops prevent rushed work
4. **Quality gates** — Hard checkpoints prevent phase advancement without meeting criteria
5. **Plan files as artifacts** — Documented reasoning, reviewable before code changes
6. **Heartbeat-driven progress** — Reports status automatically every 20 minutes during work hours

---

## Benefits

**For gudnuf:**
- Focused agent learns AGI.Cash patterns deeply
- Fewer mistakes from code review feedback (cumulative learning)
- Better PRs (iterative planning + self-review gates)
- Predictable progress updates (heartbeat reports)

**For the agent:**
- Clear identity (TypeScript dev, not generalist)
- Simplified context (one project, not four)
- Structured workflow (planning → approval → implementation)
- Learning loop (MEMORY.md captures mistakes and corrections)

**For the codebase:**
- Higher quality contributions (forced iteration + quality gates)
- Better documentation (plan files explain reasoning)
- Faster iteration (no context-switching tax)

---

## Drawbacks

**Setup cost:**
- Creating workspace files takes time
- Onboarding the agent requires initial guidance

**Workflow friction:**
- Planning phase adds upfront cost
- Approval checkpoint can block progress if gudnuf unavailable
- Not suitable for trivial changes or emergencies

**Coordination overhead:**
- Two agents (main Orveth + AGI.Cash agent) requires routing config
- Task assignment must specify which agent

---

## Implementation Status

**Not yet implemented.** This document captures the design. Next steps:

1. **Add agent to openclaw.json** — Configure workspace, heartbeat, model
2. **Create workspace files** — SOUL.md, AGENTS.md, MEMORY.md, TOOLS.md, HEARTBEAT.md
3. **Set up bindings** — Route AGI.Cash Discord guild/DMs to dedicated agent
4. **First assignment** — gudnuf assigns a task, agent follows onboarding plan
5. **Iterate on workflow** — Adjust AGENTS.md based on what works/doesn't

---

## Related Patterns

- [Iterative Agent Workflow](../workflow-patterns.md#iterative-agent-workflow) — The planning/implementation/review process
- [Git Timeline](../git-timeline.md) — Tracks development activity over time

---

## Learnings to Incorporate

As the agent runs, update this document with:
- What worked well in practice
- What needed adjustment
- Mistakes made and how MEMORY.md evolved
- Metrics (PR quality, feedback volume, iteration speed)

---

**Summary:** Dedicated AGI.Cash agent designed for focused, high-quality contributions with cumulative learning and structured workflow. Ready to implement when gudnuf approves.
