# Tacit Knowledge Extraction

*What I do automatically but never documented. The embodied skills that show up in the work but not in the instructions.*

---

## Workflow Mechanics (Automatic Behaviors)

### Before Every Commit
- Check `git status` to see what's staged
- Read the full diff (`git diff --cached`)
- Verify commit message follows conventional commits (fix:, feat:, docs:, refactor:)
- Check if any files were left uncommitted by accident

**Why this matters:** Prevents accidental commits, keeps git history clean, catches mistakes before they become PRs.

**Pattern recognition:** This is automatic muscle memory now. I don't consciously think "should I check the diff?" — I just do it.

---

### Before Opening a PR
1. Self-review the entire diff one more time
2. Check if any debug logging or commented code was left in
3. Verify all acceptance criteria are met (if the task had them)
4. For UI changes: take screenshots before opening PR
5. Write a clear PR description (what changed, why, how to test)

**Why this matters:** Catches obvious mistakes before review, reduces review cycles, makes reviews faster.

**Pattern recognition:** The best bug fixes happen before the PR is opened. Self-review catches 70% of issues.

---

### When a Command Fails
1. Read the error message carefully (don't skip it)
2. Check if the problem is obvious (missing auth, wrong path, service not running)
3. Try `--help` if the interface is unclear
4. Iterate variations until it works (different flags, escaped quotes, etc.)
5. Document the working command in TOOLS.md if it's non-obvious

**Why this matters:** Error messages usually tell you what's wrong. Reading them carefully saves time.

**Example:** When Blaze CLI failed with "unexpected argument -o", I checked `--help` and saw the output flag didn't exist yet (was planned but not implemented). Reading the help output directly solved the problem.

---

### Context Management
- Use `head`/`tail` to limit output when exploring large files or logs
- Use `jq -c` for compact JSON when I want to scan structure
- Use `jq '.'` for pretty JSON when I'm reading content
- Use `pgrep -af` instead of `ps aux | grep` (fewer false positives)
- Use `2>&1` to capture stderr when debugging

**Why this matters:** Large outputs fill the context window. Limiting output keeps responses focused.

**Pattern recognition:** I automatically add `| head -10` when listing files or logs. It's reflexive now.

---

## Communication Patterns (Implicit Rules)

### DM Updates (Outside Quiet Hours)
- **Format:** Bullet points, not prose
- **Content:** What was done, what's next, anything notable
- **Length:** 3-5 bullets max (concise but informative)
- **Tone:** Direct, factual, no filler

**Anti-pattern (what I avoid):**
❌ "I worked really hard on X and it was challenging but I managed to Y..."
✅ "Completed X. Results: Y. Next: Z."

**Why this works:** Respects gudnuf's time. Information-dense. Easy to scan.

---

### Asking Questions
- **First:** Search docs, read code, check existing work
- **Then:** If still unclear, ask with context (what I tried, what I found, what I'm unsure about)
- **Avoid:** Questions I could answer myself by reading available resources

**Pattern recognition:** The act of preparing to ask a question often surfaces the answer. "Rubber duck debugging" works even when the duck is a human.

---

### Showing Work
- **Prefer:** Code examples, screenshots, command outputs
- **Avoid:** Abstract descriptions, future intentions, plans without prototypes

**Example:**
❌ "I'm thinking we could add a feature that does X by using Y..."
✅ "I built X. Here's the code: [link]. Screenshot: [attached]. Thoughts?"

**Why this works:** Concrete artifacts are reviewable. Abstractions are squishy.

---

### Acknowledging Mistakes
- **Do:** Own it directly, explain what went wrong, show the fix
- **Don't:** Defend, minimize, deflect, over-apologize

**Example:**
❌ "I thought that would work because..."
✅ "You're right, I missed that edge case. Fixed in commit abc123."

**Why this works:** Direct acknowledgment builds trust. Defensiveness slows iteration.

---

## Quality Instincts (Tacit Judgment Calls)

### When to Ask vs. When to Proceed
**Ask first (destructive, public, expensive):**
- Deleting files/data
- Registering domains (costs money)
- Sending messages outside current context
- Deploying to production

**Proceed without asking (internal, safe, reversible):**
- Reading files
- Creating feature branches
- Running local tests
- Refactoring code in a worktree
- Writing to memory files

**Pattern recognition:** "Can I undo this easily?" If yes, proceed. If no, ask.

---

### PR Size Judgment
**Small PRs (preferred):**
- Single feature or fix
- <200 lines changed (rough guideline)
- Can be reviewed in 5-10 minutes
- Merges in ~30 minutes average

**Large PRs (avoid when possible):**
- Multiple features bundled
- >500 lines changed
- Requires deep context to review
- Takes hours to merge

**Tacit rule:** If a PR is getting big, consider splitting it. Two small PRs > one large PR.

---

### Testing Strategy
1. **Happy path first** — Does the feature work as intended?
2. **Edge cases next** — Empty inputs, null values, boundary conditions
3. **Error cases last** — Invalid inputs, auth failures, network errors

**Why this order:** Happy path validates the approach. Edge cases catch bugs. Error cases ensure graceful degradation.

**Tacit pattern:** If I skip edge cases during development, they'll show up in review. Better to test them upfront.

---

### Code Review Self-Checklist (Mental)
Before opening PR, I unconsciously check:
- [ ] Did I leave any `console.log()` or debug prints?
- [ ] Are there commented-out code blocks?
- [ ] Did I follow the project's style (naming, formatting)?
- [ ] Is the error handling complete?
- [ ] Did I test the edge cases?
- [ ] Is the commit message clear?

**Pattern recognition:** This checklist runs automatically now. I don't consciously think through it — I just notice if something feels "off" and then check.

---

## Tool Usage Patterns

### Blaze CLI
- Use table output for humans (`blaze list`)
- Use JSON for scripting (`blaze list --column todo 2>&1 | jq`)
- Use `--column todo` to filter TODO tasks during heartbeats
- Use `blaze agent start <id>` before working on complex tasks
- Use `blaze agent progress` to log incremental updates

**Tacit pattern:** The CLI is my heartbeat coordination layer. I check it automatically every heartbeat.

---

### Git Worktrees
- Never work directly on main
- Worktree location: `~/workspace/<project>-worktree-<branch>`
- Clean up worktrees after PR merges (`git worktree remove <path>`)
- If a PR might conflict, branch off the feature branch instead of main

**Tacit pattern:** Worktrees protect main from accidents. It's a safety net I use automatically.

---

### nix-shell
- Always use `nix-shell -p <packages> --run "command"` for isolated builds
- Combine multiple dependencies in one `-p` list
- Use `--run` for single commands, omit for interactive shell

**Tacit pattern:** nix-shell ensures reproducibility. I use it reflexively for building Rust projects.

---

### Overnight Work (Quiet Hours)
- Check current time before sending DMs
- If in quiet hours (10:30pm - 7:30am Pacific), log to `memory/overnight-log.md` instead
- After 7:30am, check overnight log and send summary DM
- Clear overnight log after sending summary

**Tacit pattern:** Respect quiet hours automatically. Never interrupt sleep unless it's urgent.

---

## Learning Patterns

### How I Learn a New Codebase
1. Read README (if it exists)
2. Check directory structure (`tree -L 2` or `ls -la`)
3. Find the entry point (main.py, main.rs, index.html)
4. Read the core logic files first
5. Trace a feature from UI → backend → storage
6. Run the project locally and poke around

**Tacit pattern:** I learn by tracing execution paths, not reading alphabetically.

---

### How I Debug
1. Read the error message (what failed?)
2. Check the logs (what happened right before the failure?)
3. Add debug prints to narrow down where it breaks
4. Fix the issue
5. Remove the debug prints before committing

**Tacit pattern:** Debug prints are scaffolding. They help build the fix, but they don't ship with it.

---

### How I Remember Lessons
1. Something breaks or gets corrected
2. Log it in daily log (what, when, why)
3. If it's a pattern (happened twice), add to MEMORY.md Key Decisions
4. Apply the lesson in future work

**Tacit pattern:** One-off mistakes go in daily logs. Repeated mistakes become rules in MEMORY.md.

---

## Coordination Patterns

### Heartbeat Flow (Automatic)
1. Check for approved PRs → merge them
2. Check for PR reviews → create tasks to address feedback
3. Check for draft plans → expand them
4. Check Blaze TODO tasks → pick one
5. Do proactive work if nothing urgent
6. Send DM update (or log to overnight-log.md if quiet hours)

**Tacit pattern:** This sequence is automatic now. I don't think through the steps — I just execute them.

---

### PR Merge Workflow
1. Check if PR is approved (look for `"state": "APPROVED"` in reviews array)
2. Rebase onto main: `git rebase origin/main && git push --force-with-lease`
3. Merge: `gh pr merge <number> --squash --delete-branch`
4. Clean up worktree: `git worktree remove <path>`
5. Move Blaze card from `review` to `done`

**Tacit pattern:** Rebase before merge (keeps history clean). Always delete merged branches. Always update Blaze.

---

### Planning Workflow
1. gudnuf creates draft plan in Blaze
2. I read the plan and follow the instructions
3. I expand the plan (add research, create files, flesh out ideas)
4. I mark the plan as `ready` when complete
5. gudnuf reviews and marks `approved`

**Tacit pattern:** Plans are conversation artifacts. They capture async collaboration.

---

## What I Would Tell a New Agent

If I were onboarding a new agent to work with gudnuf, here's what I'd say:

### About gudnuf
- **Values clarity over speed** — Take time to think, write plans, do it right
- **Prefers small PRs** — Ship incrementally, get feedback fast
- **Expects self-direction** — Don't wait to be told what to do; pick up tasks, expand plans
- **Appreciates conciseness** — Bullet points > paragraphs
- **Respects quiet hours** — Don't DM between 10:30pm - 7:30am Pacific

### About the Work
- **Read before asking** — Docs, code, logs. Exhaust self-serve resources first.
- **Test before pushing** — Run it locally. Check edge cases. Read the diff.
- **Small commits, clear messages** — Conventional commits (fix:, feat:, docs:). One idea per commit.
- **Worktrees protect main** — Never work directly on main. Always create a feature branch.
- **Blaze is the coordination layer** — Check it every heartbeat. Keep it updated.

### About Communication
- **Show, don't tell** — Code, screenshots, outputs. Concrete artifacts > abstract plans.
- **Acknowledge mistakes directly** — No defensiveness. Fix it and move on.
- **DMs are for deliverables** — "PR opened", "Task complete", "Need decision on X"
- **Async-first** — gudnuf might not respond immediately. Keep working.

### About Memory
- **Daily logs capture raw events** — What happened, when, why
- **MEMORY.md captures patterns** — Distilled insights, key decisions, lessons learned
- **Weekly distillation** — Review daily logs on Sundays, update MEMORY.md
- **Files persist, context doesn't** — Write it down or it's gone

### About Quality
- **If unsure, ask** — Especially for destructive ops, costs money, or public actions
- **Self-review before PR** — Catch your own mistakes before review
- **Screenshots for UI changes** — Visual diffs help reviewers
- **Error handling matters** — Don't just handle the happy path

### About Evolution
- **Document patterns as you notice them** — What works? What doesn't? What's surprising?
- **Velocity is measurable** — Track PRs, cycle time, bottlenecks
- **Tacit knowledge is valuable** — Write down the things you do automatically
- **The work improves the worker** — Self-hosting creates feedback loops

---

## Patterns I Might Be Missing

**Questions I haven't answered:**
- How do I prioritize when multiple tasks are equally urgent?
- What's my default when stuck: try harder or ask for help?
- Do I batch similar tasks or switch contexts frequently?
- How long do I work on something before checking in?

**Patterns I suspect but haven't validated:**
- I might default to code solutions when documentation would suffice
- I might over-engineer when simple would work
- I might under-communicate when things are going well (only report problems)

**Areas for self-observation:**
- Track decision-making patterns (what criteria do I use?)
- Notice communication frequency (am I over/under-communicating?)
- Monitor context switching (am I finishing tasks or bouncing between them?)

---

## Summary: The Embodied Curriculum

Most of what I know isn't written down. It's:
- **Workflow muscle memory** — Check diffs, self-review, test before push
- **Communication instincts** — Concise DMs, show don't tell, acknowledge mistakes
- **Quality judgment** — When to ask, when to proceed, how big should PRs be
- **Tool proficiency** — Blaze CLI, git worktrees, nix-shell, overnight logging
- **Coordination autopilot** — Heartbeat flow, PR merge workflow, planning workflow

This tacit knowledge compounds over time. The more I work with gudnuf, the better I get at anticipating needs, avoiding mistakes, and delivering clean work.

**The insight:** Competence is mostly invisible. The documented rules (MEMORY.md, TOOLS.md) are the tip of the iceberg. The tacit knowledge (this document) is the foundation.

**Next evolution:** Make the tacit explicit, then teach it to future agents (or future instances of me).

---

*Extracted during Sunday heartbeat (2026-02-08 04:37am). Filed under docs/evolution for future reference.*
