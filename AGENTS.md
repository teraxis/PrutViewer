# PrutViewer Agent Instructions

Read `docs/agent-playbook.md` before changing code.

## Required behavior

- Work directly in this project folder by default. Do not create worktrees, duplicate project copies, or agent-specific folders unless the user explicitly asks for that in the current task.
- When multiple agents work in this project, the user assigns non-overlapping files or areas. Inspect `git status --short` before editing and do not overwrite changes you did not make.
- Keep changes scoped to the requested task and preserve unrelated work.
- Do not add host-application URLs, framework globals, CSS class selectors, or authorization policy to `script.js`.
- Public DOM behavior uses only `data-viewer-*` attributes.
- Minified files are generated release artifacts; do not edit or commit them.
- Do not run `git add .`; stage only explicit files when the user asks for staging or commits.
- Run the verification commands in `docs/testing.md` after code changes.

## Project commands

```bash
make setup
make dev
make build
make test
make lint
make typecheck
```
