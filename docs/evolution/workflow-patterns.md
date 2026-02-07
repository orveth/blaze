# Workflow Patterns

Agent workflow patterns discovered and refined through practice.

---

## Iterative Agent Workflow

**Context:** Designed for the AGI.Cash dedicated agent to enforce quality through structured iteration.

**Problem:** Agents often rush from task → implementation without sufficient planning or self-review, leading to scope creep, anti-patterns, and missed edge cases.

**Solution:** A three-phase workflow with forced iteration loops and human checkpoints.

### The Three Phases

```
Planning (iterative) → Human Approval → Implementation (step-by-step) → Review & Submit
```

#### Phase 1: Planning (Iterative)

**Key innovation:** Forced self-critique loops (minimum 2 iterations).

**Process:**
1. Draft initial plan in `plans/active/<task>.md`
2. Self-critique loop (min 2 iterations):
   - Review your own plan as if it's someone else's
   - Ask: "What could go wrong? What's missing? What's overengineered?"
   - List specific weaknesses
   - Revise to address them
   - Document each iteration
3. Completion check:
   - Can you explain this to a junior dev?
   - Does it handle edge cases?
   - Is it the simplest approach?
   - Are success criteria measurable?
4. Request approval and **STOP** — wait for explicit human "approved"

**Why it works:**
- Forces agent to slow down and think critically
- Documents reasoning for future reference
- Creates reviewable artifact before code changes
- Prevents scope creep (plan is fixed once approved)

#### Phase 2: Implementation (Step-by-Step)

**Key innovation:** Explicit verification after each change.

**Process:**
1. Create worktree
2. For each file/change:
   - STATE what you're about to do
   - DO the change
   - VERIFY it worked (compile, tests, manual check)
   - DOCUMENT completion in plan
   - If verification fails → stop, diagnose, update plan if needed
3. Checkpoint triggers (notify human before continuing):
   - Scope creep detected
   - Unexpected complexity
   - Plan needs revision
   - Unsure about a decision

**Why it works:**
- Prevents "implement everything then debug" anti-pattern
- Catches issues immediately when context is fresh
- Allows mid-stream course correction
- Documented progress for later pickup

#### Phase 3: Review & Submit

**Key innovation:** Multi-layer self-review before PR.

**Process:**
1. Self-review checklist (linting, success criteria, no unplanned changes)
2. Manual feature testing (try to break it)
3. Review your own diff (would you approve this?)
4. Update plan status to COMPLETE
5. Open PR with clear description
6. Notify human

**Why it works:**
- Agent reviews own work with fresh eyes
- Manual testing catches UX issues
- PR description is informed by plan documentation
- Human review is faster (quality gate already passed)

### Quality Gates

Hard rules preventing phase advancement:

| Gate | Criteria |
|------|----------|
| Plan → Approval | Min 2 self-review iterations, explicit human approval |
| Approval → Implementation | Worktree created, plan status updated |
| Each Step → Next Step | Verification passed, documented in plan |
| Implementation → PR | Self-review checklist complete, manual test done |
| PR → Merge | CI passes, human approves (never self-merge) |

### Plan File Structure

```markdown
# Plan: <Task Name>

## Status: DRAFT | REVIEW | APPROVED | IN_PROGRESS | COMPLETE

## Problem
<What are we solving?>

## Approach
<How will we solve it?>

## Files to Modify
- [ ] path/to/file.ts — <what changes>

## Risks & Edge Cases
- <Risk 1> → <Mitigation>

## Success Criteria
- [ ] <Measurable outcome 1>
- [ ] <Measurable outcome 2>

## Iteration Log

### Iteration 1 (Draft)
<Initial approach>

### Iteration 2 (Self-Review)
**Critique:** <What I found wrong>
**Revisions:** <What I changed>

### Iteration 3 (Refinement)
**Critique:** <Further issues>
**Revisions:** <Final adjustments>
```

### Notification Templates

**Plan ready:**
```
📋 **Plan Ready: <Task Name>**

**Summary:** <1-2 sentences>
**Key decisions:** <bullets>
**Risks:** <main risk and mitigation>
**Plan:** plans/active/<task>.md

Reply "approved" to proceed.
```

**PR ready:**
```
🔀 **PR Ready: <Title>**

**Changes:** <brief summary>
**Tests:** <manual testing done>
**Link:** <PR URL>
```

**Checkpoint (mid-implementation):**
```
⚠️ **Checkpoint: <Task Name>**

<Why I'm stopping>
<What I need from you>
```

### Benefits

- **Prevents rushed work** — forced iteration slows down planning
- **Documents reasoning** — plans are artifacts, not just mental models
- **Enables handoff** — plan + implementation log = complete context
- **Reduces rework** — human approval checkpoint before code changes
- **Improves PR quality** — self-review before submission
- **Scalable** — pattern works for solo agent or team of agents

### Drawbacks

- **Higher upfront cost** — planning takes longer
- **Friction for small tasks** — overkill for trivial changes
- **Depends on human availability** — approval checkpoint can block progress

### When to Use

**Good fit:**
- Complex features with multiple files/components
- High-risk changes (auth, payments, data migrations)
- Learning new codebase (forces understanding)
- Multi-agent coordination (plan is shared artifact)

**Poor fit:**
- Trivial fixes (typos, formatting)
- Emergency hotfixes (speed trumps process)
- Experimental prototyping (iteration cost too high)

### Implementation Notes

- Agent workspace files (AGENTS.md) enforce the workflow
- Plan templates live in `plans/templates/`
- Active plans live in `plans/active/`
- Completed plans move to `plans/archive/`
- Heartbeat checks for active plans and resumes work

---

## Other Patterns

*(Document additional patterns here as they emerge)*
