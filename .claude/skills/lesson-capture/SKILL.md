---
name: lesson-capture
description: Turn a correction into a written rule instead of just a memory for this session. Use whenever the user corrects a mistake, says something like "that's wrong", "no, do it like this instead", "you already did this before", or asks you to remember something for next time — even if they don't use the word "rule". Do NOT use for one-off preferences that only apply to the current task ("skip the tests this time") — those aren't corrections of a repeated mistake.
---

# Lesson Capture

A correction that only changes this session's behavior gets forgotten the next time the same
mistake is possible. This skill writes it down somewhere it will actually be loaded again —
the same way an existing `AGENTS.md`/`CLAUDE.md` is loaded every session — rather than relying
on the model to remember.

## Steps

1. **State the correction as one sentence**: what you did, and what should have happened
   instead. Strip anything session-specific (today, this PR, this variable name) — the rule
   has to hold the next time this situation comes up, not just describe this one.
2. **Find where it belongs**, in this order:
   - The current repo has `.ai/` (this project or a project vendoring it) and a
     `local_tail` file configured in `ai-config.toml` (default `ai-config.local.md`) →
     append there. It's loaded into every generated `AGENTS.md` automatically, so this is
     "reviewed before every relevant session" for free — no separate step needed.
   - The current repo has its own `AGENTS.md`/`CLAUDE.md` (no `.ai/`) → append a bullet to
     the section it fits, matching that file's existing voice and structure.
   - Neither exists → ask where the user wants it, rather than picking a spot that won't
     get read again.
   - The correction is a rule/weight override rather than new prose (e.g. "always use tabs
     here", "skip the architecture checklist for this repo") and the project has `.ai/` →
     use the `customize_config` skill to scaffold or edit `ai-project-config.toml` instead
     of writing free text.
3. **Check for an existing rule covering the same ground first** (grep the target file for
   the topic). If one exists, tighten or correct it in place — don't append a second, nearly
   duplicate bullet that can drift out of sync with the first.
4. **Write it as an imperative, generic instruction** in the target file's own style — one
   bullet, no hedging, no narration of the mistake itself ("I incorrectly assumed X" belongs
   in this conversation, not in the rule; the rule is just what to do).
5. **Confirm back to the user**: the exact line written and where, so they can correct the
   correction if you captured the wrong lesson.

## Rules

- Never write into this repo's own `rules/` (`ogen-ai`'s shared fragments) as a silent edit.
  Those ship to every project that consumes this repo — see `CLAUDE.md`'s editing
  conventions. If a correction here is genuinely universal (not specific to one project),
  say so and propose the fragment change for review instead of committing it directly.
- One rule per correction. If the same mistake gets corrected again after this, that's a
  signal the written rule was too narrow, too vague, or in the wrong file — fix the rule
  itself rather than adding a third near-duplicate.
- Don't invent a rule from a single ambiguous nudge. If it's unclear whether this was a
  correction of a repeatable mistake or a one-off preference, ask before writing anything.

## Output

Print the exact text added (or changed) and the file it landed in. If nothing was written
because the target was ambiguous, say what you'd need to know to proceed.
