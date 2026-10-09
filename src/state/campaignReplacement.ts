import type { CampaignState } from './campaignReducer';

export type ReplacementRule = 'replace' | 'keep';

/** What a whole-state replacement does with each root key of CampaignState. */
export type ReplacementPolicy = { readonly [K in keyof CampaignState]-?: ReplacementRule };

/**
 * One policy per whole-state replacement. `satisfies` makes a new root key in
 * CampaignState a compile error until every policy decides what to do with it.
 */
export const REPLACEMENT_POLICIES = {
  /** A campaign file or a host's state replaces everything but the local checkpoints. */
  import: {
    ui: 'replace', meta: 'replace', entities: 'replace', legacy: 'replace', mealBuff: 'replace',
    time: 'replace', inventory: 'replace', crafting: 'replace', alchemy: 'replace', gathering: 'replace',
    dayPlanner: 'replace', activities: 'replace', logs: 'replace', checkpoints: 'keep', combat: 'replace',
    locations: 'replace', downtime: 'replace', maps: 'replace',
  },
  /** A checkpoint restore keeps the checkpoint ring; `ui` comes from the snapshot (as before TB2). */
  restore: {
    ui: 'replace', meta: 'replace', entities: 'replace', legacy: 'replace', mealBuff: 'replace',
    time: 'replace', inventory: 'replace', crafting: 'replace', alchemy: 'replace', gathering: 'replace',
    dayPlanner: 'replace', activities: 'replace', logs: 'replace', checkpoints: 'keep', combat: 'replace',
    locations: 'replace', downtime: 'replace', maps: 'replace',
  },
  /** The debug panel's JSON replaces everything, checkpoints included. */
  debug: {
    ui: 'replace', meta: 'replace', entities: 'replace', legacy: 'replace', mealBuff: 'replace',
    time: 'replace', inventory: 'replace', crafting: 'replace', alchemy: 'replace', gathering: 'replace',
    dayPlanner: 'replace', activities: 'replace', logs: 'replace', checkpoints: 'replace', combat: 'replace',
    locations: 'replace', downtime: 'replace', maps: 'replace',
  },
} as const satisfies Record<string, ReplacementPolicy>;

const assignSlice = <K extends keyof CampaignState>(
  target: CampaignState,
  key: K,
  value: CampaignState[K]
): void => {
  target[key] = value;
};

/**
 * Replace each root slice the policy marks 'replace' with `next[key]`, or with
 * `defaults[key]` when `next` lacks it. 'keep' slices are left as they are.
 * `defaults` is a parameter (not built here) so this module needs no runtime
 * import from the reducer.
 */
export const replaceCampaignState = (
  target: CampaignState,
  next: Partial<CampaignState>,
  policy: ReplacementPolicy,
  defaults: CampaignState
): void => {
  for (const key of Object.keys(policy) as (keyof CampaignState)[]) {
    if (policy[key] === 'replace') {
      assignSlice(target, key, next[key] ?? defaults[key]);
    }
  }
};
