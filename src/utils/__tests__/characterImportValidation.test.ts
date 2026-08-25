import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  MAX_CHARACTER_TEXT_SIZE_BYTES,
  getCharacterTextSections,
  validateCharacterText,
} from '../characterImportValidation';

const sample = readFileSync(
  'docs/Archive/Sample Character Sheet.txt',
  'utf8'
);

describe('validateCharacterText errors', () => {
  it('accepts the real archived GCS sample', () => {
    const result = validateCharacterText(sample);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('blocks an empty input', () => {
    const result = validateCharacterText('');
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.message).toMatch(/empty/i);
  });

  it('blocks a whitespace-only input', () => {
    expect(validateCharacterText(' \n\t ').errors[0]?.message).toMatch(/empty/i);
  });

  it('blocks input larger than one megabyte', () => {
    const text = `Name: Oversized (1)\n${'x'.repeat(MAX_CHARACTER_TEXT_SIZE_BYTES)}`;
    const result = validateCharacterText(text);
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.message).toMatch(/1 MB/i);
  });

  it('blocks input with no Name line', () => {
    const result = validateCharacterText('Skills: Acting IQ+0 [1]-12;');
    expect(result.errors).toContainEqual(expect.objectContaining({ section: 'Name' }));
  });

  it('blocks a visibly malformed collection section with its line number', () => {
    const result = validateCharacterText('Name: Broken (10)\nSkills: definitely not a skill');
    expect(result.errors).toContainEqual(expect.objectContaining({
      line: 2,
      section: 'Skills',
    }));
  });

  it('blocks a malformed scalar section that parses no fields', () => {
    const result = validateCharacterText('Name: Broken (10)\nPrimary Attributes: ten-ish');
    expect(result.errors).toContainEqual(expect.objectContaining({ section: 'Primary Attributes' }));
  });

  it('blocks malformed documented equipment content', () => {
    const result = validateCharacterText('Name: Broken (10)\nEquipment: one sword for lots of money');
    expect(result.errors).toContainEqual(expect.objectContaining({ section: 'Equipment' }));
  });

  it('allows an explicitly empty collection section', () => {
    const result = validateCharacterText('Name: Sparse (10)\nSkills:');
    expect(result.errors.some((issue) => issue.section === 'Skills')).toBe(false);
  });
});

describe('validateCharacterText warnings', () => {
  it('reports unrecognized lines with line number and a snippet', () => {
    const result = validateCharacterText('Name: Scout (25)\nThis line is unknown');
    expect(result.warnings).toContainEqual(expect.objectContaining({
      line: 2,
      message: expect.stringContaining('This line is unknown'),
    }));
  });

  it('truncates long unrecognized snippets', () => {
    const result = validateCharacterText(`Name: Scout (25)\n${'z'.repeat(120)}`);
    const warning = result.warnings.find((issue) => issue.line === 2);
    expect(warning?.message).toContain('...');
    expect(warning?.message.length).toBeLessThan(110);
  });

  it('warns when a known section is absent', () => {
    const result = validateCharacterText('Name: Scout (25)');
    expect(result.warnings).toContainEqual(expect.objectContaining({
      section: 'Skills',
      message: expect.stringMatching(/absent/i),
    }));
  });

  it('warns when a primary numeric field falls back', () => {
    const result = validateCharacterText('Name: Scout (25)\nPrimary Attributes: ST 12 [20];');
    expect(result.warnings).toContainEqual(expect.objectContaining({
      section: 'Primary Attributes',
      message: expect.stringMatching(/DX.*default/i),
    }));
  });

  it('warns when a point pool falls back', () => {
    const result = validateCharacterText('Name: Scout (25)\nPoint Pools: HP 12 / 12 [4];');
    expect(result.warnings).toContainEqual(expect.objectContaining({
      section: 'Point Pools',
      message: expect.stringMatching(/FP.*default/i),
    }));
  });

  it('warns when total points fall back to zero', () => {
    const result = validateCharacterText('Name: Scout');
    expect(result.warnings).toContainEqual(expect.objectContaining({
      section: 'Name',
      message: expect.stringMatching(/Total points.*0/i),
    }));
  });

  it('keeps warnings non-blocking', () => {
    const result = validateCharacterText('Name: Scout');
    expect(result.ok).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe('getCharacterTextSections', () => {
  it('returns only labels present in the source', () => {
    const sections = getCharacterTextSections('Name: Scout (25)\n  Skills: Acting IQ+0 [1]-10;');
    expect([...sections]).toEqual(['Name', 'Skills']);
  });
});
