# Project instructions

## Git

- Do not add `Co-Authored-By` trailers (or any other AI attribution) to commit messages or pull request descriptions.
- Do not commit on your own. Leave changes uncommitted in the working tree; the maintainer commits.

## Branches

- For forms rework work (issue 17), edit directly on the checked-out `17-feature-forms-rework` branch; do not use a worktree (the round trip is overhead).
- Keep this to form-related work only; isolate unrelated work as usual.
- Leave the maintainer's other uncommitted files (e.g. `package-lock.json`) alone.

## Contributions

- The repo does not accept unsolicited third-party pull requests; outside contributions go through GitHub issues (bugs, feature requests, translation requests).
- Translators may get a separate, invite-only arrangement; do not present it as a general fork-and-PR workflow.
- When writing contributor-facing docs (CONTRIBUTING.md, issue/PR templates, README), state the issues-only policy explicitly.

## graphify

This project has a knowledge graph at `graphify-out/` (god nodes, community structure, cross-file relationships). It is git-ignored and local to each checkout; build it with `/graphify .` (or `graphify update .` for an AST-only code refresh).

Rules:
- For codebase questions, first run `graphify query "<question>"` when `graphify-out/graph.json` exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than `GRAPH_REPORT.md` or raw grep output.
- If `graphify-out/wiki/index.md` exists, use it for broad navigation instead of raw source browsing.
- Read `graphify-out/GRAPH_REPORT.md` only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- Never commit `graphify-out/`.
