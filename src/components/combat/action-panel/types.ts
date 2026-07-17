export interface HitLocation {
  key: string;
  label: string;
}

export interface LocationRoll {
  dice: number[];
  total: number;
}

export type WorkflowType =
  | 'attack'
  | 'defense'
  | 'damage'
  | 'note'
  | 'conditions'
  | 'items'
  | null;
