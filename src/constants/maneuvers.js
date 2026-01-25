/**
 * Phase 7: Maneuver Catalog
 * Structured list of supported combat maneuvers with constraints and prompts.
 */

export const ManeuverCatalog = [
  {
    id: 'do_nothing',
    label: 'Do Nothing',
    group: 'Core',
    requires: {},
    forbids: {},
    prompts: {},
    notes: 'Take no action; recover from stun and regain defenses.'
  },
  {
    id: 'move',
    label: 'Move',
    group: 'Core',
    requires: { notUnconscious: true },
    forbids: {},
    prompts: {},
    notes: 'Move up to full Move; no attack.'
  },
  {
    id: 'attack',
    label: 'Attack',
    group: 'Core',
    requires: { notUnconscious: true },
    forbids: { stunned: true },
    prompts: { needsTarget: true, allowsAttackPanel: true },
    notes: 'One attack; normal defense allowed.'
  },
  {
    id: 'all_out_attack_determined',
    label: 'All-Out Attack (Determined)',
    group: 'All-Out Attack',
    requires: { notUnconscious: true },
    forbids: { stunned: true },
    prompts: { needsTarget: true, allowsAttackPanel: true },
    notes: 'One attack at +4; no active defenses.'
  },
  {
    id: 'all_out_attack_strong',
    label: 'All-Out Attack (Strong)',
    group: 'All-Out Attack',
    requires: { notUnconscious: true },
    forbids: { stunned: true },
    prompts: { needsTarget: true, allowsAttackPanel: true },
    notes: 'One attack at +2 damage; no active defenses.'
  },
  {
    id: 'all_out_defense_increased',
    label: 'All-Out Defense (Increased Defense)',
    group: 'All-Out Defense',
    requires: { notUnconscious: true },
    forbids: {},
    prompts: { allowsDefensePanel: true },
    notes: '+2 to one active defense; no attack.'
  },
  {
    id: 'all_out_defense_dodge',
    label: 'All-Out Defense (Dodge)',
    group: 'All-Out Defense',
    requires: { notUnconscious: true },
    forbids: {},
    prompts: { allowsDefensePanel: true },
    notes: 'Dodge twice; no attack.'
  },
  {
    id: 'aim',
    label: 'Aim',
    group: 'Core',
    requires: { notUnconscious: true },
    forbids: { stunned: true },
    prompts: { needsTarget: true, allowsAimPanel: true },
    notes: 'Aim a ranged weapon; bonuses accrue per turn.'
  },
  {
    id: 'evaluate',
    label: 'Evaluate',
    group: 'Core',
    requires: { notUnconscious: true },
    forbids: { stunned: true },
    prompts: { needsTarget: true },
    notes: 'Study opponent for future attacks.'
  },
  {
    id: 'feint',
    label: 'Feint',
    group: 'Core',
    requires: { notUnconscious: true },
    forbids: { stunned: true },
    prompts: { needsTarget: true, allowsAttackPanel: true },
    notes: 'Contest of skills; sets up next attack.'
  },
  {
    id: 'ready',
    label: 'Ready',
    group: 'Core',
    requires: { notUnconscious: true },
    forbids: { stunned: true },
    prompts: {},
    notes: 'Ready or reload an item.'
  },
  {
    id: 'concentrate',
    label: 'Concentrate',
    group: 'Core',
    requires: { notUnconscious: true },
    forbids: { stunned: true },
    prompts: {},
    notes: 'Focus on a mental task or spell.'
  },
  {
    id: 'change_posture',
    label: 'Change Posture',
    group: 'Core',
    requires: { notUnconscious: true },
    forbids: {},
    prompts: {},
    notes: 'Stand up, kneel, or go prone.'
  },
  {
    id: 'wait',
    label: 'Wait',
    group: 'Core',
    requires: { notUnconscious: true },
    forbids: { stunned: true },
    prompts: { allowsWaitPanel: true },
    notes: 'Delay action until trigger occurs.'
  }
];

export const ManeuverIds = ManeuverCatalog.reduce((acc, maneuver) => {
  acc[maneuver.id] = maneuver.id;
  return acc;
}, {});
