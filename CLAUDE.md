# GURPS VTT (Gurps-calculator)

Before writing any code here, consult the `vtt-resume` skill — it carries the architectural conventions (Redux-style state with Immer, thin router + view pattern, strict TypeScript).

## Knowledge graph (graphify)

This repo has a graphify knowledge graph at `graphify-out/` (generated output, gitignored, local to a checkout — the clone at `Documents/GitHub/Gurps-calculator` does not have one). If it's missing, build it with `graphify update .` (AST extraction, no API cost).

Rules:
- For codebase questions, run `graphify query "<question>"` from the repo root before grepping or browsing raw source. Use `graphify explain "<symbol>"` for a symbol's full fan-in/fan-out with file:line anchors, and `graphify path "<A>" "<B>"` to trace how two parts connect. All three accept `--graph <path-to>/graphify-out/graph.json` when run from outside the repo root.
- The graph includes the markdown plan/status docs alongside the code, so queries about a subsystem surface the relevant design docs (e.g., migration plans) together with the reducers and components they describe.
- Check freshness before trusting results: compare the build commit in `graphify-out/GRAPH_REPORT.md` ("Graph Freshness" section) against `git rev-parse HEAD`. If they differ, run `graphify update .` first.
- After modifying code, run `graphify update .` to keep the graph current. The `gurps-verify` skill includes this as a step.
- The God Nodes list in `GRAPH_REPORT.md` (`useCampaignStore()`, the campaign reducer, `Character`, ...) is the high-blast-radius watchlist — run `graphify explain` on any of them before modifying them.
- Read `GRAPH_REPORT.md` in full only for broad architecture review; query/path/explain return smaller, scoped output. At 4,600+ nodes and 239 communities, the full report is a lot of context — prefer the scoped commands.
