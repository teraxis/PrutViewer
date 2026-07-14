# Agent Playbook

This file is the shared policy for all agents working on PrutViewer.

## Invariants

- The public globals are `PrutViewer`, `PrutViewerManager`, and `PrutViewerTransport`.
- The manifest identifier is `prut-viewer/1`.
- The core has no host-application endpoints, globals, template paths, or CSS class selectors.
- Stable DOM behavior is represented only by `data-viewer-*` attributes.
- Authorization decisions remain on the host server; the transport only applies host-supplied request configuration.
- Signed URLs must retain their query string and must not receive the global bearer header.
- Third-party viewers are optional renderers and remain independently versioned.
- Generated minified files are release artifacts and are not committed.

## Working rules

- Inspect the current diff before editing and preserve unrelated changes.
- Work directly in this project folder by default.
- Do not create worktrees, duplicate project copies, agent-specific folders, or switch branches unless the user explicitly asks for that in the current task.
- Multiple agents may work in the same project folder only when the user assigns non-overlapping files or areas.
- Do not run `git add .`; stage only explicit files when staging or committing is requested.
- Never revert, overwrite, or normalize changes made by another agent or the user.
- Do not store credentials, access tokens, signed URLs, or private fixtures.
- Add or update browser tests when changing transport, DOM, lifecycle, renderer, or plugin behavior.
- Run the commands in `docs/testing.md` before reporting completion.

## Completion report

State what changed, what commands ran, what passed, what could not be verified, and whether any external approval remains.
