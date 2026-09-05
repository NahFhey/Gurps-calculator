# CONTINUATION: asset store part B

A previous run of the spec in `DISPATCH-asset-sync.md` (repo root) was killed mid-task. Its
partial work is in the working tree, uncommitted: `git status` shows `server/src/db.ts`,
`server/src/index.ts`, `server/src/routes.ts`, `shared/protocol.ts`, `src/net/ConnectionManager.ts`
modified and `src/net/assetSync.ts` new. Nothing has been tested yet.

Do this:
1. Read `DISPATCH-asset-sync.md` in full. It is the authoritative spec; every rule in it applies
   (no commits, no npm install, no `as any`/`@ts-ignore`, `import type`).
2. Run `git diff` and read `src/net/assetSync.ts` to see what exists. Keep what matches the spec;
   fix what does not. Do not rewrite working code for style.
3. Finish the remaining deliverables. As of the kill, B1–B4 were drafted and B5 (wire-in:
   ConnectionDialog host push + join pull with progress line, SyncProvider hydrate → pull → hand
   over, ImageLayersDialog upload-on-add while hosting) had not been started. The previous run
   noted: "no downstream consumer of `onServerStateUpdate` exists, so the provider can hydrate the
   JSON, pull missing assets, then pass a `CampaignState` to that callback" — that is acceptable;
   update the prop type accordingly.
4. Write the tests listed under Definition of done in the spec, run them and the existing suites
   named there, run both tsc commands, fix failures.
5. Finish with the one-paragraph summary the spec asks for, plus one sentence listing anything
   from the partial work you replaced and why.
