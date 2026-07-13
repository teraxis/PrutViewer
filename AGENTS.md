# PrutViewer Agent Instructions

Read `docs/agent-playbook.md` before changing code.

## Required behavior

- Keep changes scoped to the requested task and preserve unrelated work.
- Do not add host-application URLs, framework globals, CSS class selectors, or authorization policy to `script.js`.
- Public DOM behavior uses only `data-viewer-*` attributes.
- Minified files are generated release artifacts; do not edit or commit them.
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
