# Mutation check for the import/visibility phase. Run from the repo root:
#   python3 docs/codex-specs/import-visibility-mutants.py [name-prefix ...]
# Each mutant edits one source file, runs the listed tests, and restores the file.
# CAUGHT   = at least one test failed (a `×` line in the vitest output)
# SURVIVED = the tests passed
# ERROR    = nonzero exit with no failing test (compile/collection error); not a catch
import subprocess, sys, os
ROOT=os.getcwd()  # run from the repo root
os.chdir(ROOT)
P='shared/playerProjection.ts'; E='src/utils/exportImport.ts'; R='server/src/routes.ts'; M='src/components/ManagerTab.tsx'
I='src/utils/campaignImport.ts'; X='src/components/ImportExportPanel.tsx'; L='src/components/GMLockModal.tsx'
UNIT='src/utils/__tests__/playerProjection.test.ts'
WIRE='src/utils/__tests__/exportImport.playerSafe.test.ts'
MGR='src/components/manager/__tests__/ManagerTab.importUnlock.test.tsx'
SRV='server'
PANEL='src/components/__tests__/ImportExportPanel.lockedExport.test.tsx'
mutants = [
 ('M2 failed unlock enables GM', M, """    if (!outcome.ok) {
      setGmLockError(outcome.error);
      return;
    }""", """    if (!outcome.ok) {
      setGmLockError(outcome.error);
      setGmMode(true);
      return;
    }""", [MGR]),
 ('M3 unlock skips merged-state dispatch', M, """    campaignActions.importCampaignState({
      ...outcome.state,
      ui: { ...outcome.state.ui, activeModule: campaignState.ui.activeModule },
    }, 'Before GM unlock');""", "", [MGR]),
 ('B0 lock scoped to the component (cleared on unmount)', M, "  const gmLockData = usePendingGMLock();\n",
  "  const gmLockData = usePendingGMLock();\n  useEffect(() => () => setPendingGMLock(null), []);\n", [MGR]),
 ('PA gm flags kept', P, "    projected.ui.gmModeEnabled = false;\n", "", [UNIT]),
 ('PB checkpoints kept', P, "    projected.checkpoints.entries = [];\n", "", [UNIT]),
 ('PC1 aspects off-by-one', P, ".slice(0, level)", ".slice(0, level + 1)", [UNIT]),
 ('PC2 real aspects despite false profile', P, "const profile = isObj(reagent.falseProfile) ? reagent.falseProfile : reagent;", "const profile = reagent;", [UNIT]),
 ('PC3 reagent notes kept', P, "  delete reagent.notes;\n", "", [UNIT]),
 ('PC4 falseProfile kept', P, "  delete reagent.falseProfile;\n", "", [UNIT]),
 ('PC5 real roles kept', P, "realRoles.filter((role) => PHYSICAL_ROLES.includes(role as string))", "realRoles", [UNIT]),
 ('PC6 showObviousRoles ignored', P, "const obvious = showObviousRoles ? ", "const obvious = true ? ", [UNIT]),
 ('PC7 level-4 fields leak below 4', P, "if (level >= 4 && profile[field] !== undefined) reagent[field] = profile[field];", "if (profile[field] !== undefined) reagent[field] = profile[field];", [UNIT]),
 ('U1 real family/potency kept at level 4', P, "    if (level >= 4 && profile[field] !== undefined) reagent[field] = profile[field];", "    if (level >= 4 && (field === 'effectFamily' || field === 'potency')) continue;\n    if (level >= 4 && profile[field] !== undefined) reagent[field] = profile[field];", [UNIT]),
 ('U1b family/potency never gated', P, "  'effectFamily', 'potency',\n] as const;", "] as const;", [UNIT]),
 ('PD1 formula notes kept', P, "  delete formula.notes;\n", "", [UNIT]),
 ('PD2 batch gmNotes kept', P, "  delete batch.gmNotes;\n", "", [UNIT]),
 ('PD3 hazardEvaluation kept', P, "  delete formula.hazardEvaluation;\n", "", [UNIT]),
 ('PE effect gm notes always kept', P, "if (effect.gmNotesVisible !== true) delete effect.gmNotes;", "", [UNIT]),
 ('PE2 effect gm notes always dropped', P, "if (effect.gmNotesVisible !== true) delete effect.gmNotes;", "delete effect.gmNotes;", [UNIT]),
 ('PF location gmNotes kept', P, "for (const location of objectValues(projected.locations.locations)) delete location.gmNotes;", "", [UNIT]),
 ('PG1 gmOnly logs kept', P, "!(isObj(entry) && entry.visibility === 'gmOnly')", "true", [UNIT]),
 ('PG2 mixed not masked', P, "    if (entry.visibility !== 'mixed') continue;\n", "    continue;\n", [UNIT]),
 ('PG3 mixed meta kept (V2)', P, "    delete entry.meta;\n", "", [UNIT]),
 ('PG4 mixed title kept (V2)', P, "      ...(masked !== undefined ? { maskedMessage: masked } : {}),\n    };", "      ...(masked !== undefined ? { maskedMessage: masked } : {}),\n      ...(payload.title !== undefined ? { title: payload.title } : {}),\n    };", [UNIT]),
 ('PH1 gm markers kept', P, "for (const markerId of hidden) delete map.markersById[markerId];", "", [UNIT]),
 ('PH2 tile markerIds not cleaned', P, "if (Array.isArray(tile.markerIds)) tile.markerIds = tile.markerIds.filter((id) => !hidden.has(id as string));", "", [UNIT]),
 ('PH3 gmOnly layers kept', P, "!(isObj(layer) && layer.gmOnly === true)", "true", [UNIT]),
 ('PH4 hidden tokens kept', P, "if (display.visible === false && !combatTokens.has(`${mapId}|${tokenId}`)) {", "if (false) {", [UNIT]),
 ('PH5 combat exemption removed', P, "if (display.visible === false && !combatTokens.has(`${mapId}|${tokenId}`)) {", "if (display.visible === false) {", [UNIT]),
 ('PH6 player label not applied', P, "if (typeof display.label === 'string') token.label = display.label;", "", [UNIT]),
 ('PH7 GM stamps kept (V1)', P, "  if (maps.stamps !== undefined) maps.stamps = {};\n", "", [UNIT, WIRE]),
 ('PS shape: entities key dropped', P, "  if (isObj(projected.entities)) redactAlchemy(projected.entities, objectValues);\n", "  if (isObj(projected.entities)) { redactAlchemy(projected.entities, objectValues); delete projected.entities.alchemySettings; }\n", [UNIT]),
 ('PI legacy appState not redacted', P, "    redactAlchemy(appState, arrayItems);\n    delete appState.gmNotes;\n", "", [UNIT]),
 ('PX shallow copy mutates input', P, """  const projected = JSON.parse(JSON.stringify(state, (_key, value: unknown) =>
    value instanceof Set ? Array.from(value) : value)) as Json;""", "  const projected = state as unknown as Json;", [UNIT]),
 ('W1 splitState public unprojected', E, "public: projectCampaignForPlayers(serializedState),", "public: { ...serializedState, ui: { ...serializedState.ui, gmModeEnabled: false, gmSessionUnlocked: false, pendingIntent: null } },", [WIRE, MGR]),
 ('W2 locked export collects GM assets', E, "assets: await collectExportAssets(isCampaignState(publicData) ? publicData : state),", "assets: await collectExportAssets(state),", [WIRE]),
 ('S1 only Player projected', R, "if (req.auth?.role !== Role.GM) {", "if (req.auth?.role === Role.Player) {", [SRV]),
 ('S2 unparseable returns raw', R, """        res.status(500).json({ error: 'Campaign state is unreadable' });
        return;""", "", [SRV]),
 ('S3 nobody projected', R, "if (req.auth?.role !== Role.GM) {", "if (false) {", [SRV]),
 ('G1 running combat not reported', P, "  if (isObj(combat.activeSession)) gaps.push('the running combat encounter');\n", "", [PANEL]),
 ('G2 history not reported', P, "if (history.length > 0 || tombstones.length > 0) gaps.push", "if (false) gaps.push", [PANEL]),
 ('G4 tombstones not reported', P, "if (history.length > 0 || tombstones.length > 0) gaps.push", "if (history.length > 0) gaps.push", [UNIT, PANEL]),
 ('V4 export allowed while lock pending', X, "  const exportBlocked = !!gmLockData;\n", "  const exportBlocked = false;\n", [MGR]),
 ('V5 locked import trusts the public half', I, "hydrateCampaignState(projectCampaignForPlayers(publicState))", "hydrateCampaignState(publicState)", [MGR]),
 ('V3 unlock note missing', L, "Changes made since the import are kept in the \"Before GM unlock\" checkpoint.", "", [MGR]),
 ('T1 file input not reset', X, "      input.value = '';\n", "", [MGR]),
 ('T2 failed unlock changes the campaign', M, """      setGmLockError(outcome.error);
      return;""", """      setGmLockError(outcome.error);
      campaignActions.importCampaignState(campaignState, 'Before GM unlock');
      return;""", [MGR]),
 ('T3 unlock checkpoint unlabelled', M, "    }, 'Before GM unlock');", "    });", [MGR]),
 ('G3 panel ignores gaps', 'src/components/ImportExportPanel.tsx', "setImportStatus(gaps.length > 0 ? {", "setImportStatus(false ? {", [PANEL]),
]
only = sys.argv[1:]
for name, path, old, new, tests in mutants:
    if only and not any(name.startswith(o) for o in only): continue
    src = open(path).read()
    if src.count(old) != 1:
        print(f'{name}: PATTERN COUNT {src.count(old)}', flush=True); continue
    open(path,'w').write(src.replace(old,new))
    try:
        if tests == [SRV]:
            r = subprocess.run('cd server && npx vitest run src/__tests__/routes.test.ts', shell=True, capture_output=True, text=True)
        else:
            r = subprocess.run(['npx','vitest','run',*tests], capture_output=True, text=True)
        out = r.stdout + r.stderr
        failed = [l.strip() for l in out.splitlines() if l.strip().startswith('×')]
        verdict = 'CAUGHT' if failed else ('ERROR' if r.returncode != 0 else 'SURVIVED')
        print(f"{name}: {verdict} ({len(failed)} failing){' — ' + failed[0][:90] if failed else ''}", flush=True)
    finally:
        open(path,'w').write(src)
