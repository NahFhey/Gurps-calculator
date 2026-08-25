export interface ImportIssue {
  line?: number;
  section?: string;
  message: string;
}

export interface ImportValidationResult {
  ok: boolean;
  errors: ImportIssue[];
  warnings: ImportIssue[];
}

export const MAX_CHARACTER_TEXT_SIZE_BYTES = 1024 * 1024;

export const CHARACTER_TEXT_SECTIONS = [
  'Name',
  'Primary Attributes',
  'Secondary Attributes',
  'Point Pools',
  'Reactions',
  'Conditional Modifiers',
  'Advantages',
  'Perks',
  'Disadvantages',
  'Quirks',
  'Skills',
  'Spells',
  'Equipment',
  'Other Equipment',
  'Notes',
] as const;

export type CharacterTextSection = typeof CHARACTER_TEXT_SECTIONS[number];

const NUMERIC_FIELDS: Partial<Record<CharacterTextSection, ReadonlyArray<{
  label: string;
  pattern: RegExp;
  fallback: number;
}>>> = {
  'Primary Attributes': [
    { label: 'ST', pattern: /\bST\s+\d+\s+\[-?\d+\]/, fallback: 10 },
    { label: 'DX', pattern: /\bDX\s+\d+\s+\[-?\d+\]/, fallback: 10 },
    { label: 'IQ', pattern: /\bIQ\s+\d+\s+\[-?\d+\]/, fallback: 10 },
    { label: 'HT', pattern: /\bHT\s+\d+\s+\[-?\d+\]/, fallback: 10 },
  ],
  'Secondary Attributes': [
    { label: 'Will', pattern: /\bWill\s+[\d.]+\s+\[-?\d+\]/, fallback: 10 },
    { label: 'Fright Check', pattern: /\bFright Check\s+[\d.]+\s+\[-?\d+\]/, fallback: 10 },
    { label: 'Per', pattern: /\bPer\s+[\d.]+\s+\[-?\d+\]/, fallback: 10 },
    { label: 'Vision', pattern: /\bVision\s+[\d.]+\s+\[-?\d+\]/, fallback: 10 },
    { label: 'Hearing', pattern: /\bHearing\s+[\d.]+\s+\[-?\d+\]/, fallback: 10 },
    { label: 'Taste & Smell', pattern: /\bTaste & Smell\s+[\d.]+\s+\[-?\d+\]/, fallback: 10 },
    { label: 'Touch', pattern: /\bTouch\s+[\d.]+\s+\[-?\d+\]/, fallback: 10 },
    { label: 'Basic Speed', pattern: /\bBasic Speed\s+[\d.]+\s+\[-?\d+\]/, fallback: 10 },
    { label: 'Basic Move', pattern: /\bBasic Move\s+[\d.]+\s+\[-?\d+\]/, fallback: 10 },
  ],
  'Point Pools': [
    { label: 'HP', pattern: /\bHP\s+\d+\s*\/\s*\d+\s+\[-?\d+\]/, fallback: 10 },
    { label: 'FP', pattern: /\bFP\s+\d+\s*\/\s*\d+\s+\[-?\d+\]/, fallback: 10 },
  ],
};

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

function splitEntries(content: string): string[] {
  const entries: string[] = [];
  let current = '';
  let parentheses = 0;
  let brackets = 0;

  for (const character of content) {
    if (character === '(') parentheses += 1;
    if (character === ')') parentheses -= 1;
    if (character === '[') brackets += 1;
    if (character === ']') brackets -= 1;
    if (character === ';' && parentheses === 0 && brackets === 0) {
      if (current.trim()) entries.push(current.trim());
      current = '';
    } else {
      current += character;
    }
  }
  if (current.trim()) entries.push(current.trim());
  return entries;
}

function parsedEntryCount(section: CharacterTextSection, content: string): number {
  if (section === 'Name' || section === 'Other Equipment' || section === 'Notes') {
    return content ? 1 : 0;
  }

  if (section === 'Primary Attributes') {
    return Array.from(content.matchAll(/(ST|DX|IQ|HT)\s+\d+\s+\[-?\d+\]/g)).length;
  }
  if (section === 'Secondary Attributes') {
    const names = ['Will', 'Fright Check', 'Per', 'Vision', 'Hearing', 'Taste & Smell', 'Touch', 'Basic Speed', 'Basic Move'];
    return names.filter((name) => new RegExp(`${name}\\s+[\\d.]+\\s+\\[-?\\d+\\]`).test(content)).length;
  }
  if (section === 'Point Pools') {
    return ['HP', 'FP'].filter((name) => new RegExp(`${name}\\s+\\d+\\s*\\/\\s*\\d+\\s+\\[-?\\d+\\]`).test(content)).length;
  }

  const entries = splitEntries(content);
  switch (section) {
    case 'Reactions':
    case 'Conditional Modifiers':
      return entries.filter((entry) => /^[+-]?\d+\s+.+$/.test(entry)).length;
    case 'Advantages':
    case 'Perks':
    case 'Disadvantages':
    case 'Quirks':
      return entries.filter((entry) => /^.+?\s+\[-?\d+\]$/.test(entry)).length;
    case 'Skills':
      return entries.filter((entry) => /^.+?\s+(ST|DX|IQ|HT|Will|Per)[+-]\d+\s+\[\d+\]-\d+$/.test(entry)).length;
    case 'Spells':
      return entries.filter((entry) => /^.+?\s+\d+\(IQ[+-]\d+\)\s+\[\d+\]\s+\[Class:\s*[^;]+;\s*Cost:\s*[^;]+;\s*Maintain:\s*[^;]*;\s*Time:\s*[^;]+;\s*Duration:\s*[^\]]+\]$/.test(entry)).length;
    case 'Equipment':
      return entries.filter((entry) => /^\d+\s+.+?\s+\[\$\d+;\s*[\d.]+\s*lb\]$/.test(entry)).length;
    default:
      return 0;
  }
}

function sectionForLine(line: string): CharacterTextSection | undefined {
  return CHARACTER_TEXT_SECTIONS.find((section) => line.startsWith(`${section}:`));
}

export function getCharacterTextSections(text: string): ReadonlySet<CharacterTextSection> {
  const sections = new Set<CharacterTextSection>();
  for (const rawLine of text.split(/\r?\n/)) {
    const section = sectionForLine(rawLine.trim());
    if (section) sections.add(section);
  }
  return sections;
}

export function getNonEmptyCharacterTextSections(text: string): ReadonlySet<CharacterTextSection> {
  const sections = new Set<CharacterTextSection>();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    const section = sectionForLine(line);
    if (section && line.slice(section.length + 1).trim()) sections.add(section);
  }
  return sections;
}

/** Validate a GCS text export without changing or invoking store state. */
export function validateCharacterText(text: string): ImportValidationResult {
  const errors: ImportIssue[] = [];
  const warnings: ImportIssue[] = [];

  if (!text.trim()) {
    return {
      ok: false,
      errors: [{ message: 'Character import is empty.' }],
      warnings,
    };
  }
  if (byteLength(text) > MAX_CHARACTER_TEXT_SIZE_BYTES) {
    return {
      ok: false,
      errors: [{ message: 'Character import exceeds the 1 MB size limit.' }],
      warnings,
    };
  }

  const presentSections = new Set<CharacterTextSection>();
  const lines = text.split(/\r?\n/);

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) return;

    const section = sectionForLine(line);
    if (!section) {
      const snippet = line.length > 80 ? `${line.slice(0, 77)}...` : line;
      warnings.push({
        line: index + 1,
        message: `Unrecognized line: "${snippet}"`,
      });
      return;
    }

    presentSections.add(section);
    const content = line.slice(section.length + 1).trim();
    if (content && parsedEntryCount(section, content) === 0) {
      errors.push({
        line: index + 1,
        section,
        message: `${section} contains content but no entries could be parsed.`,
      });
    }

    if (section === 'Name' && content && !/\(\d+\)$/.test(content)) {
      warnings.push({
        line: index + 1,
        section,
        message: 'Total points fell back to the default value 0.',
      });
    }

    for (const field of NUMERIC_FIELDS[section] ?? []) {
      if (!field.pattern.test(content)) {
        warnings.push({
          line: index + 1,
          section,
          message: `${field.label} fell back to the default value ${field.fallback}.`,
        });
      }
    }
  });

  if (!presentSections.has('Name')) {
    errors.push({ section: 'Name', message: 'No Name: line was found.' });
  }

  for (const section of CHARACTER_TEXT_SECTIONS) {
    if (section !== 'Name' && !presentSections.has(section)) {
      warnings.push({ section, message: `${section}: section is absent.` });
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}
