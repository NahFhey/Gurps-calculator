/**
 * GCS (GURPS Character Sheet) text import parser
 * Best-effort parsing of GCS text format to extract combat-relevant fields
 * Returns parsed data with confidence level and issue flags
 */

/**
 * Parse GCS text format and extract combat-relevant fields
 * @param {string} text - Raw GCS text content
 * @returns {Object} Parsed data with { data, issues, confidence }
 */
export function parseGCSText(text) {
  const result = {
    data: {
      name: '',
      category: 'player',
      st: 10,
      dx: 10,
      iq: 10,
      ht: 10,
      hp: 10,
      fp: 10,
      mp: 0,
      basicSpeed: 5.0,
      basicMove: 5,
      dodge: 8,
      parry: 8,
      block: 8,
      dr: 0,
      notes: ''
    },
    issues: [],
    confidence: 'high',
    needsReview: false
  };

  if (!text || typeof text !== 'string') {
    result.issues.push('Invalid or empty input');
    result.confidence = 'none';
    result.needsReview = true;
    return result;
  }

  const lines = text.split('\n').map(line => line.trim());

  // Try to extract character name (usually first non-empty line or after "Name:")
  const nameLine = lines.find(line =>
    line.toLowerCase().startsWith('name:') ||
    line.toLowerCase().startsWith('character name:')
  );
  if (nameLine) {
    result.data.name = nameLine.split(':')[1]?.trim() || '';
  } else if (lines.length > 0 && lines[0]) {
    // Fallback: use first non-empty line
    result.data.name = lines[0];
    result.issues.push('Name extracted from first line (uncertain)');
  }

  // Extract attributes (ST, DX, IQ, HT)
  const stMatch = extractStat(lines, ['ST', 'Strength']);
  if (stMatch !== null) {
    result.data.st = stMatch;
  } else {
    result.issues.push('ST not found, using default (10)');
  }

  const dxMatch = extractStat(lines, ['DX', 'Dexterity']);
  if (dxMatch !== null) {
    result.data.dx = dxMatch;
  } else {
    result.issues.push('DX not found, using default (10)');
  }

  const iqMatch = extractStat(lines, ['IQ', 'Intelligence']);
  if (iqMatch !== null) {
    result.data.iq = iqMatch;
  } else {
    result.issues.push('IQ not found, using default (10)');
  }

  const htMatch = extractStat(lines, ['HT', 'Health']);
  if (htMatch !== null) {
    result.data.ht = htMatch;
  } else {
    result.issues.push('HT not found, using default (10)');
  }

  // Extract HP (may be modified from HT)
  const hpMatch = extractStat(lines, ['HP', 'Hit Points', 'Hitpoints']);
  if (hpMatch !== null) {
    result.data.hp = hpMatch;
    result.data.currentHP = hpMatch;
  } else {
    // Default HP = HT
    result.data.hp = result.data.ht;
    result.data.currentHP = result.data.ht;
    result.issues.push('HP not found, using HT');
  }

  // Extract FP (may be modified from HT)
  const fpMatch = extractStat(lines, ['FP', 'Fatigue Points', 'Fatigue']);
  if (fpMatch !== null) {
    result.data.fp = fpMatch;
    result.data.currentFP = fpMatch;
  } else {
    // Default FP = HT
    result.data.fp = result.data.ht;
    result.data.currentFP = result.data.ht;
    result.issues.push('FP not found, using HT');
  }

  // Extract Basic Speed (usually (DX + HT) / 4)
  const speedMatch = extractStat(lines, ['Basic Speed', 'Speed']);
  if (speedMatch !== null) {
    result.data.basicSpeed = speedMatch;
  } else {
    // Calculate default
    result.data.basicSpeed = (result.data.dx + result.data.ht) / 4;
    result.issues.push('Basic Speed not found, calculated from DX+HT');
  }

  // Extract Basic Move (usually floor of Basic Speed)
  const moveMatch = extractStat(lines, ['Basic Move', 'Move']);
  if (moveMatch !== null) {
    result.data.basicMove = moveMatch;
  } else {
    // Calculate default
    result.data.basicMove = Math.floor(result.data.basicSpeed);
    result.issues.push('Basic Move not found, calculated from Basic Speed');
  }

  // Extract Dodge (usually Basic Speed + 3, rounded down)
  const dodgeMatch = extractStat(lines, ['Dodge']);
  if (dodgeMatch !== null) {
    result.data.dodge = dodgeMatch;
  } else {
    result.data.dodge = Math.floor(result.data.basicSpeed) + 3;
    result.issues.push('Dodge not found, calculated from Basic Speed');
  }

  // Extract Parry (complex, context-dependent)
  const parryMatch = extractStat(lines, ['Parry']);
  if (parryMatch !== null) {
    result.data.parry = parryMatch;
  } else {
    result.issues.push('Parry not found, using default (8)');
  }

  // Extract Block (complex, context-dependent)
  const blockMatch = extractStat(lines, ['Block']);
  if (blockMatch !== null) {
    result.data.block = blockMatch;
  } else {
    result.issues.push('Block not found, using default (8)');
  }

  // Extract DR (Damage Resistance)
  const drMatch = extractStat(lines, ['DR', 'Damage Resistance']);
  if (drMatch !== null) {
    result.data.dr = drMatch;
  } else {
    result.issues.push('DR not found, using default (0)');
  }

  // Determine confidence level
  if (result.issues.length === 0) {
    result.confidence = 'high';
  } else if (result.issues.length <= 3) {
    result.confidence = 'medium';
  } else {
    result.confidence = 'low';
    result.needsReview = true;
  }

  // Always flag for review if name is missing
  if (!result.data.name) {
    result.issues.push('Character name missing - review required');
    result.needsReview = true;
    result.confidence = 'low';
  }

  return result;
}

/**
 * Helper function to extract a stat value from text lines
 * Tries multiple label variants and number extraction patterns
 *
 * @param {Array<string>} lines - Array of text lines
 * @param {Array<string>} labels - Possible labels for this stat
 * @returns {number|null} Extracted value or null if not found
 */
function extractStat(lines, labels) {
  for (const label of labels) {
    for (const line of lines) {
      // Pattern 1: "Label: Value" or "Label Value"
      const pattern1 = new RegExp(`^${label}[:\\s]+([\\d.]+)`, 'i');
      const match1 = line.match(pattern1);
      if (match1) {
        return parseFloat(match1[1]);
      }

      // Pattern 2: "Label [Value]" (bracketed)
      const pattern2 = new RegExp(`${label}[:\\s]*\\[([\\d.]+)\\]`, 'i');
      const match2 = line.match(pattern2);
      if (match2) {
        return parseFloat(match2[1]);
      }

      // Pattern 3: "Label (Value)" (parentheses)
      const pattern3 = new RegExp(`${label}[:\\s]*\\(([\\d.]+)\\)`, 'i');
      const match3 = line.match(pattern3);
      if (match3) {
        return parseFloat(match3[1]);
      }

      // Pattern 4: Tab-separated (common in GCS exports)
      const parts = line.split('\t');
      for (let i = 0; i < parts.length - 1; i++) {
        if (parts[i].toLowerCase().includes(label.toLowerCase())) {
          const value = parseFloat(parts[i + 1]);
          if (!isNaN(value)) {
            return value;
          }
        }
      }
    }
  }

  return null;
}

/**
 * Validate a parsed character for combat readiness
 * @param {Object} character - Parsed character data
 * @returns {Array<string>} Array of validation errors (empty if valid)
 */
export function validateCharacter(character) {
  const errors = [];

  if (!character.name || character.name.trim() === '') {
    errors.push('Character must have a name');
  }

  if (character.hp <= 0) {
    errors.push('HP must be greater than 0');
  }

  if (character.basicSpeed <= 0) {
    errors.push('Basic Speed must be greater than 0');
  }

  if (character.dx < 1 || character.dx > 20) {
    errors.push('DX must be between 1 and 20');
  }

  return errors;
}
