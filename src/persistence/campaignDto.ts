/**
 * The persisted (JSON-safe) form of a runtime type: every `Set<T>` becomes
 * `T[]`, recursively; everything else keeps its shape. Distributive over
 * unions, and arrays stay arrays (the mapped type is homomorphic).
 * `CampaignState` holds no Maps, so only Sets need converting. Primitives
 * (branded ones like `string & {}` included) stay as they are.
 */
export type Persisted<T> = T extends Set<infer U>
  ? Persisted<U>[]
  : T extends string | number | boolean | bigint | symbol | null | undefined
    ? T
    : T extends object
      ? { [K in keyof T]: Persisted<T[K]> }
      : T;
