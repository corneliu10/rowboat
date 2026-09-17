# <branch>
Base: <sha of spike/base> · Head: <sha> · `git diff --stat spike/base...HEAD`: <N files, +A/−D>
## Commits
- <sha> <subject> (step N)
## Tests
- shared: <N> pass, <M> fail · core: … · server: … · renderer: … · typecheck: pass|fail
## Acceptance
| # | item (verbatim from the prompt) | pass / fail / blocked | evidence (a test name, a file:line, a number) |
## Decisions
- <what the prompt left open, what you chose, why>
## Not verified
- <what you could not run or prove, and why>
## Shared files
For each file another lane also edits, the hunk verbatim in a diff block.
