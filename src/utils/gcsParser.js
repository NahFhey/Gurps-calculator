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

  // Extract character name - GCS format: "Name: Character Name (points)"
  const nameLine = lines.find(line => line.toLowerCase().startsWith('name:'));
  if (nameLine) {
    // Extract name between "Name:" and optional parentheses
    const nameMatch = nameLine.match(/Name:\s*(.+?)(?:\s*\(\d+\))?$/i);
    if (nameMatch) {
      result.data.name = nameMatch[1].trim();
    }
  } else {
    result.issues.push('Name not found');
  }

  // Extract Primary Attributes - GCS format: "Primary Attributes: ST 14 [0]; DX 13 [0]; IQ 10 [0]; HT 9 [0];"
  const primaryLine = lines.find(line => line.toLowerCase().includes('primary attributes:'));
  if (primaryLine) {
    const stMatch = primaryLine.match(/ST\s+(\d+)/i);
    const dxMatch = primaryLine.match(/DX\s+(\d+)/i);
    const iqMatch = primaryLine.match(/IQ\s+(\d+)/i);
    const htMatch = primaryLine.match(/HT\s+(\d+)/i);

    if (stMatch) result.data.st = parseInt(stMatch[1]);
    else result.issues.push('ST not found, using default (10)');

    if (dxMatch) result.data.dx = parseInt(dxMatch[1]);
    else result.issues.push('DX not found, using default (10)');

    if (iqMatch) result.data.iq = parseInt(iqMatch[1]);
    else result.issues.push('IQ not found, using default (10)');

    if (htMatch) result.data.ht = parseInt(htMatch[1]);
    else result.issues.push('HT not found, using default (10)');
  } else {
    result.issues.push('Primary Attributes line not found, using defaults');
  }

  // Extract Secondary Attributes - GCS format: "Secondary Attributes: ... Basic Speed 5.5 [0]; Basic Move 5 [0];"
  const secondaryLine = lines.find(line => line.toLowerCase().includes('secondary attributes:'));
  if (secondaryLine) {
    const speedMatch = secondaryLine.match(/Basic Speed\s+([\d.]+)/i);
    const moveMatch = secondaryLine.match(/Basic Move\s+(\d+)/i);

    if (speedMatch) {
      result.data.basicSpeed = parseFloat(speedMatch[1]);
    } else {
      result.data.basicSpeed = (result.data.dx + result.data.ht) / 4;
      result.issues.push('Basic Speed not found, calculated from DX+HT');
    }

    if (moveMatch) {
      result.data.basicMove = parseInt(moveMatch[1]);
    } else {
      result.data.basicMove = Math.floor(result.data.basicSpeed);
      result.issues.push('Basic Move not found, calculated from Basic Speed');
    }
  } else {
    result.data.basicSpeed = (result.data.dx + result.data.ht) / 4;
    result.data.basicMove = Math.floor(result.data.basicSpeed);
    result.issues.push('Secondary Attributes line not found, calculated defaults');
  }

  // Extract Point Pools - GCS format: "Point Pools: FP 11 / 11 [0]; HP 14 / 14 [0];"
  const poolsLine = lines.find(line => line.toLowerCase().includes('point pools:'));
  if (poolsLine) {
    // HP format: "HP 14 / 14 [0]" - we want the max (second number)
    const hpMatch = poolsLine.match(/HP\s+\d+\s*\/\s*(\d+)/i);
    if (hpMatch) {
      result.data.hp = parseInt(hpMatch[1]);
      result.data.currentHP = result.data.hp;
    } else {
      result.data.hp = result.data.ht;
      result.data.currentHP = result.data.ht;
      result.issues.push('HP not found, using HT');
    }

    // FP format: "FP 11 / 11 [0]" - we want the max (second number)
    const fpMatch = poolsLine.match(/FP\s+\d+\s*\/\s*(\d+)/i);
    if (fpMatch) {
      result.data.fp = parseInt(fpMatch[1]);
      result.data.currentFP = result.data.fp;
    } else {
      result.data.fp = result.data.ht;
      result.data.currentFP = result.data.ht;
      result.issues.push('FP not found, using HT');
    }
  } else {
    result.data.hp = result.data.ht;
    result.data.currentHP = result.data.ht;
    result.data.fp = result.data.ht;
    result.data.currentFP = result.data.ht;
    result.issues.push('Point Pools line not found, using HT for HP/FP');
  }

  // Calculate Dodge (not usually in GCS export)
  result.data.dodge = Math.floor(result.data.basicSpeed) + 3;
  result.issues.push('Dodge calculated from Basic Speed');

  // Parry and Block are weapon/shield dependent, can't extract from this format
  result.issues.push('Parry using default (8) - weapon dependent');
  result.issues.push('Block using default (8) - shield dependent');

  // DR could be in equipment or advantages, too complex to parse reliably
  result.issues.push('DR using default (0) - check equipment/advantages manually');

  // Determine confidence level
  const criticalIssues = result.issues.filter(i =>
    i.includes('not found') && !i.includes('calculated') && !i.includes('default (8)') && !i.includes('default (0)')
  );

  if (criticalIssues.length === 0) {
    result.confidence = 'high';
  } else if (criticalIssues.length <= 2) {
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
 * Helper function to extract a stat value from GCS semicolon-separated format
 * Note: This is a legacy function, kept for potential future use with alternate formats
 *
 * @param {Array<string>} lines - Array of text lines
 * @param {Array<string>} labels - Possible labels for this stat
 * @returns {number|null} Extracted value or null if not found
 */
export function extractStat(lines, labels) {
  for (const label of labels) {
    for (const line of lines) {
      // GCS semicolon format: "Label value [cost];"
      const gcsPattern = new RegExp(`${label}[:\\s]+([\\d.]+)(?:\\s*\\[|;)`, 'i');
      const gcsMatch = line.match(gcsPattern);
      if (gcsMatch) {
        return parseFloat(gcsMatch[1]);
      }

      // Legacy patterns for other formats
      const pattern1 = new RegExp(`^${label}[:\\s]+([\\d.]+)`, 'i');
      const match1 = line.match(pattern1);
      if (match1) {
        return parseFloat(match1[1]);
      }

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
