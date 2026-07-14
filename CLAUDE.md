# Claude Code Instructions

Read `docs/agent-playbook.md` before making changes.

Work directly in this project folder by default. Do not create worktrees, duplicate project copies, or switch branches unless the user explicitly asks for that in the current task.

Keep the core independent of host applications, use only `data-viewer-*` for its DOM contract, and run `npm test` before reporting completion.
