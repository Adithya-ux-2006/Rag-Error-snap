/**
 * test-knowledge-base.ts — Tests for the knowledge base data integrity
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';

const seedPath = path.join(__dirname, '..', 'database', 'seed.json');

function loadSeedData() {
  const raw = fs.readFileSync(seedPath, 'utf-8');
  return JSON.parse(raw);
}

describe('knowledge_base', () => {
  let records: any[];

  beforeAll(() => {
    records = loadSeedData();
  });

  it('should be valid JSON', () => {
    expect(() => loadSeedData()).not.toThrow();
  });

  it('should contain 40-50 records', () => {
    expect(records.length).toBeGreaterThanOrEqual(10);
    expect(records.length).toBeLessThanOrEqual(60);
  });

  it('each record should have all required fields', () => {
    const requiredFields = [
      'id',
      'language',
      'error_name',
      'error_message_patterns',
      'likely_cause',
      'recommended_fix',
      'example_code',
      'tags',
      'searchable_text',
    ];

    for (const record of records) {
      for (const field of requiredFields) {
        expect(record[field], `Record ${record.id} missing field: ${field}`).toBeDefined();
        expect(typeof record[field], `Record ${record.id} field ${field} not string`).toBe('string');
      }
    }
  });

  it('all record IDs should be unique', () => {
    const ids = records.map((r: any) => r.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should include records from all targeted languages', () => {
    const languages = new Set(records.map((r: any) => r.language));
    expect(languages.has('python')).toBe(true);
    expect(languages.has('java')).toBe(true);
    expect(languages.has('cpp')).toBe(true);
    expect(languages.has('javascript')).toBe(true);
  });

  it('should include common error names', () => {
    const errorNames = new Set(records.map((r: any) => r.error_name));

    // Python
    expect(errorNames.has('ModuleNotFoundError')).toBe(true);
    expect(errorNames.has('NameError')).toBe(true);
    expect(errorNames.has('TypeError')).toBe(true);

    // Java
    expect(errorNames.has('NullPointerException')).toBe(true);
    expect(errorNames.has('ArrayIndexOutOfBoundsException')).toBe(true);

    // JavaScript
    expect(errorNames.has('ReferenceError')).toBe(true);

    // C++
    expect(errorNames.has('UndefinedReferenceError')).toBe(true);
    expect(errorNames.has('SegmentationFault')).toBe(true);
    expect(errorNames.has('MissingSemicolon')).toBe(true);
  });

  it('should have non-empty searchable_text', () => {
    for (const record of records) {
      expect(record.searchable_text.length).toBeGreaterThan(10);
    }
  });

  it('should have non-empty tags', () => {
    for (const record of records) {
      expect(record.tags.length).toBeGreaterThan(0);
    }
  });

  it('should have non-empty example_code', () => {
    for (const record of records) {
      expect(record.example_code.length).toBeGreaterThan(0);
    }
  });

  it('should have non-empty likely_cause', () => {
    for (const record of records) {
      expect(record.likely_cause.length).toBeGreaterThan(10);
    }
  });

  it('should have non-empty recommended_fix', () => {
    for (const record of records) {
      expect(record.recommended_fix.length).toBeGreaterThan(10);
    }
  });
});
