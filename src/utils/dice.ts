/**
 * Dice rolling utilities for Combat Runner Phase 2
 * Parses and rolls dice expressions like 3d6, 2d+1, etc.
 */

// ============================================================================
// Types
// ============================================================================

export interface ParsedDiceExpression {
  count: number;
  sides: number;
  modifier: number;
  valid: boolean;
  error?: string;
}

export interface RollResult {
  expression: string;
  dice: number[];
  modifier: number;
  total: number;
  valid: boolean;
  error?: string;
}

export interface RollVsTargetResult extends RollResult {
  target: number;
  margin: number;
  success: boolean;
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Parse a dice expression
 * Supports formats: XdY, XdY+Z, XdY-Z, Xd (defaults to d6), X (constant)
 *
 * @param expression - Dice expression like "3d6", "2d+1", "4d-2", "3d", "5"
 * @returns Parsed dice expression with count, sides, modifier, and validity
 */
export function parseDiceExpression(expression: string): ParsedDiceExpression {
  if (!expression || typeof expression !== 'string') {
    return { count: 0, sides: 0, modifier: 0, valid: false, error: 'Invalid expression' };
  }

  const trimmed = expression.trim().toLowerCase();

  // Handle constant numbers (no dice)
  if (/^[+-]?\d+$/.test(trimmed)) {
    const value = parseInt(trimmed);
    return { count: 0, sides: 0, modifier: value, valid: true };
  }

  // Parse dice expression: XdY+Z or XdY-Z or XdY or Xd
  const diceRegex = /^(\d+)d(\d+)?([+-]\d+)?$/;
  const match = trimmed.match(diceRegex);

  if (!match) {
    return { count: 0, sides: 0, modifier: 0, valid: false, error: 'Invalid dice format' };
  }

  const count = parseInt(match[1]);
  const sides = match[2] ? parseInt(match[2]) : 6; // Default to d6 if not specified
  const modifier = match[3] ? parseInt(match[3]) : 0;

  // Validate ranges
  if (count < 1 || count > 100) {
    return { count: 0, sides: 0, modifier: 0, valid: false, error: 'Dice count must be 1-100' };
  }

  if (sides < 2 || sides > 100) {
    return { count: 0, sides: 0, modifier: 0, valid: false, error: 'Dice sides must be 2-100' };
  }

  return { count, sides, modifier, valid: true };
}

/**
 * Roll a single die
 * @param sides - Number of sides on the die
 * @returns Result (1 to sides)
 */
function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

/**
 * Roll dice based on an expression
 *
 * @param expression - Dice expression like "3d6", "2d+1", "4d6-2"
 * @returns Roll result with dice values, modifier, total, and validity
 */
export function roll(expression: string): RollResult {
  const parsed = parseDiceExpression(expression);

  if (!parsed.valid) {
    return {
      expression,
      dice: [],
      modifier: 0,
      total: 0,
      valid: false,
      error: parsed.error
    };
  }

  // Handle constant-only expressions (no dice)
  if (parsed.count === 0) {
    return {
      expression,
      dice: [],
      modifier: parsed.modifier,
      total: parsed.modifier,
      valid: true
    };
  }

  // Roll dice
  const dice: number[] = [];
  for (let i = 0; i < parsed.count; i++) {
    dice.push(rollDie(parsed.sides));
  }

  const diceSum = dice.reduce((sum, die) => sum + die, 0);
  const total = diceSum + parsed.modifier;

  return {
    expression,
    dice,
    modifier: parsed.modifier,
    total,
    valid: true
  };
}

/**
 * Roll dice vs a target number
 * Returns margin of success/failure
 *
 * @param expression - Dice expression like "3d6"
 * @param target - Target number to beat (roll must be <= target for GURPS)
 * @returns Roll result with target, margin, and success status
 */
export function rollVsTarget(expression: string, target: number): RollVsTargetResult {
  const rollResult = roll(expression);

  if (!rollResult.valid) {
    return {
      ...rollResult,
      target: target || 0,
      margin: 0,
      success: false
    };
  }

  if (typeof target !== 'number') {
    return {
      ...rollResult,
      target: 0,
      margin: 0,
      success: false,
      valid: false,
      error: 'Invalid target number'
    };
  }

  // GURPS success: roll <= target
  // Margin = target - roll (positive = success, negative = failure)
  const margin = target - rollResult.total;
  const success = rollResult.total <= target;

  return {
    ...rollResult,
    target,
    margin,
    success
  };
}

/**
 * Format a roll result for display
 * @param rollResult - Result from roll() or rollVsTarget()
 * @returns Formatted string
 */
export function formatRoll(rollResult: RollResult | RollVsTargetResult): string {
  if (!rollResult.valid) {
    return `Invalid roll: ${rollResult.error}`;
  }

  if (rollResult.dice.length === 0) {
    // Constant only
    return `${rollResult.total}`;
  }

  const diceStr = rollResult.dice.join(', ');
  const modStr = rollResult.modifier !== 0
    ? (rollResult.modifier > 0 ? `+${rollResult.modifier}` : `${rollResult.modifier}`)
    : '';

  // Check if this is a RollVsTargetResult
  if ('target' in rollResult && rollResult.target !== undefined) {
    const marginStr = rollResult.margin >= 0
      ? `+${rollResult.margin}`
      : `${rollResult.margin}`;
    const resultStr = rollResult.success ? 'SUCCESS' : 'FAILURE';
    return `${rollResult.expression}: [${diceStr}]${modStr} = ${rollResult.total} vs ${rollResult.target} [${marginStr}] ${resultStr}`;
  }

  return `${rollResult.expression}: [${diceStr}]${modStr} = ${rollResult.total}`;
}
