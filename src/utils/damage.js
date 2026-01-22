/**
 * Damage calculation utilities for Combat Runner Phase 3
 * Handles damage expression parsing, rolling, and DR application
 */

import { parseDiceExpression, roll } from './dice';

/**
 * Parse a damage expression
 * Supports formats: XdY, XdY+Z, XdY-Z, constant numbers
 * Also supports "sw" and "thr" as placeholders (to be calculated externally)
 *
 * @param {string} expression - Damage expression like "2d+1", "1d6-1", "sw+2", "5"
 * @returns {{parseable: boolean, expression: string, needsLookup: boolean, lookupType?: string}}
 */
export function parseDamageExpression(expression) {
  if (!expression || typeof expression !== 'string') {
    return { parseable: false, expression: '', needsLookup: false };
  }

  const trimmed = expression.trim().toLowerCase();

  // Check for swing/thrust damage (needs ST lookup)
  if (trimmed.includes('sw') || trimmed.includes('thr')) {
    const lookupType = trimmed.includes('sw') ? 'swing' : 'thrust';
    return {
      parseable: true,
      expression: trimmed,
      needsLookup: true,
      lookupType
    };
  }

  // Try parsing as dice expression
  const parsed = parseDiceExpression(trimmed);

  return {
    parseable: parsed.valid,
    expression: trimmed,
    needsLookup: false
  };
}

/**
 * Roll damage from an expression
 * Returns roll result with individual dice and total
 *
 * @param {string} expression - Damage expression like "2d+1"
 * @returns {{valid: boolean, expression: string, dice: number[], modifier: number, total: number, error?: string}}
 */
export function rollDamage(expression) {
  return roll(expression);
}

/**
 * Apply DR to damage
 * GURPS basic DR: penetrating = max(0, damage - DR)
 * No wound multipliers or damage type effects in Phase 3
 *
 * @param {number} damage - Rolled damage amount
 * @param {number} dr - Damage Resistance value (general DR only)
 * @returns {{raw: number, dr: number, penetrating: number}}
 */
export function applyDR(damage, dr = 0) {
  if (typeof damage !== 'number' || typeof dr !== 'number') {
    throw new Error('applyDR requires numeric damage and dr values');
  }

  const penetrating = Math.max(0, damage - dr);

  return {
    raw: damage,
    dr,
    penetrating
  };
}

/**
 * Calculate swing damage from ST
 * GURPS Basic Set swing damage table
 *
 * @param {number} st - Strength value
 * @returns {string} Damage expression like "1d-1"
 */
export function getSwingDamage(st) {
  if (st <= 8) return '1d-2';
  if (st === 9) return '1d-1';
  if (st <= 12) return '1d';
  if (st <= 14) return '1d+1';
  if (st <= 16) return '1d+2';
  if (st <= 20) return '2d';
  if (st <= 24) return '2d+1';
  if (st <= 28) return '2d+2';
  if (st <= 40) return '3d';
  if (st <= 44) return '3d+1';
  if (st <= 48) return '3d+2';
  if (st <= 60) return '4d';
  if (st <= 64) return '4d+1';
  if (st <= 68) return '4d+2';
  if (st <= 80) return '5d';
  return '6d'; // ST 81+
}

/**
 * Calculate thrust damage from ST
 * GURPS Basic Set thrust damage table
 *
 * @param {number} st - Strength value
 * @returns {string} Damage expression like "1d-2"
 */
export function getThrustDamage(st) {
  if (st <= 10) return '1d-2';
  if (st <= 12) return '1d-1';
  if (st <= 14) return '1d';
  if (st <= 20) return '1d+1';
  if (st <= 24) return '1d+2';
  if (st <= 28) return '2d';
  if (st <= 40) return '2d+1';
  if (st <= 44) return '2d+2';
  if (st <= 48) return '3d';
  if (st <= 60) return '3d+1';
  if (st <= 64) return '3d+2';
  if (st <= 68) return '4d';
  if (st <= 80) return '4d+1';
  return '5d'; // ST 81+
}

/**
 * Resolve damage expression with ST lookup if needed
 * Converts "sw+2" or "thr-1" into concrete dice expressions
 *
 * @param {string} expression - Damage expression possibly with sw/thr
 * @param {number} st - Character's ST value
 * @returns {{expression: string, resolved: string, valid: boolean}}
 */
export function resolveDamageExpression(expression, st = 10) {
  const parsed = parseDamageExpression(expression);

  if (!parsed.parseable) {
    return { expression, resolved: expression, valid: false };
  }

  if (!parsed.needsLookup) {
    return { expression, resolved: expression, valid: true };
  }

  // Extract modifier from sw/thr expression
  const match = expression.match(/(sw|thr)([+-]\d+)?/i);
  if (!match) {
    return { expression, resolved: expression, valid: false };
  }

  const baseType = match[1].toLowerCase();
  const modifier = match[2] ? parseInt(match[2]) : 0;

  // Get base damage for ST
  const baseDamage = baseType === 'sw' ? getSwingDamage(st) : getThrustDamage(st);

  // Apply modifier to base damage
  let resolved = baseDamage;
  if (modifier !== 0) {
    // Parse base damage and add modifier
    const baseParsed = parseDiceExpression(baseDamage);
    if (baseParsed.valid) {
      const newModifier = baseParsed.modifier + modifier;
      if (newModifier === 0) {
        resolved = `${baseParsed.count}d${baseParsed.sides === 6 ? '' : baseParsed.sides}`;
      } else {
        resolved = `${baseParsed.count}d${baseParsed.sides === 6 ? '' : baseParsed.sides}${newModifier > 0 ? '+' : ''}${newModifier}`;
      }
    }
  }

  return { expression, resolved, valid: true };
}
