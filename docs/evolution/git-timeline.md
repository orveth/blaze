# Blaze Git Timeline

A chronological record of development activity.

## Day 5 - February 3, 2026

**PRs Merged:**
- PR #20: Display created_at and updated_at timestamps in card modal
- PR #9: Improve UI readability with better contrast
- PR #10: WebSocket Phase 2 - Broadcast card changes
- PR #12: Card archiving functionality
- PR #15: Make individual columns scrollable instead of full page
- PR #16: Improve mobile UX with horizontal scrolling and zoom fixes
- PR #18: Add cache busting for static assets

**Total commits:** 42 commits on February 3rd

**Key features shipped:**
- Timestamp display in card modals
- WebSocket broadcasting for real-time updates
- Archive functionality with UI
- Mobile UX improvements
- Column-level scrolling
- Better UI contrast and readability
- Cache busting for static assets

**Open PRs:**
- PR #17: Add logo/icon design options (DALL-E generated)
- PR #21: Remove table output, JSON only (CLI refactor)

**Notes:**
- High productivity day with 7 PRs merged
- Focus on polish and UX improvements
- WebSocket Phase 2 completed
- Mobile experience significantly improved

---

## Day 6 - February 5, 2026

**PRs Merged:**
- PR #26: Planning feature MVP (backend + CLI)
- PR #27: Clean up header for mobile
- PR #28: Display card timestamps in single row
- PR #29: Remove empty state text from columns
- PR #30: Add plan archiving functionality

**Total commits:** 26 commits on February 5th

**Key features shipped:**
- Planning system (multi-file plans, draft→ready→approved workflow)
- Plan archiving functionality
- Header cleanup for mobile (icon-only add button, hamburger menu)
- Timestamp layout improvements (inline instead of stacked)
- Empty state removal from columns

**Notes:**
- Major feature: Planning system went production
- 20 plans migrated from scattered markdown files to Blaze
- Continued mobile UX polish
- CLI gained plan management commands

---

## Day 7 - February 6, 2026

**PRs Merged:**
- PR #31: CLI exclude archived cards by default
- PR #32: Add agent workflow (backend + frontend)
- PR #33: Add natural language interface

**Total commits:** 15 commits on February 6th

**Key features shipped:**
- Agent workflow system (status tracking, progress logging, acceptance criteria)
- Natural language interface (conversational task management via AI button)
- CLI improvements (archived card filtering)
- Security fixes for NL interface (token logging, CORS, error handling)

**Notes:**
- Two major features merged: Agent Workflow + NL Interface
- Agent workflow enables real-time visibility into long-running tasks
- NL interface adds conversational layer on top of Blaze
- Code review feedback addressed (security hardening)

---

## Day 8 - February 7, 2026

**PRs Merged:**
- PR #34: Fix command palette blocking touch events
- PR #35: UI improvements (form state, modal position, stats, due date)

**Total commits:** 5 commits on February 7th

**Key features shipped:**
- Command palette touch event fix (mobile usability)
- Form dirty state tracking (acceptance criteria)
- Modal positioning improvements
- Stats modal cleanup
- Due date display in card modal

**Open PRs:**
- PR #17: Add logo/icon design options (DALL-E generated)

**Notes:**
- Focus on polish and bug fixes
- Mobile touch issues resolved
- Form state tracking prevents accidental navigation
- Velocity measurement completed (35 PRs in 5 days, 28min median merge time)
