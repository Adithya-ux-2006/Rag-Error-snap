/**
 * test-retrieval.ts — Tests for the TF-IDF retrieval engine
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { retrieveEvidence, handleEmptyQuery, handleNoMatches } from '@/lib/retrieval';
import { CodingErrorRecord } from '@/lib/types';

// Mock data for testing
const mockRecords: CodingErrorRecord[] = [
  {
    id: 'py-001',
    language: 'python',
    error_name: 'ModuleNotFoundError',
    error_message_patterns: "No module named 'requests'",
    likely_cause: 'The package is not installed or not in the Python path.',
    recommended_fix: 'Run "pip install requests" to install the package.',
    example_code: 'pip install requests\nimport requests',
    tags: 'python,import,package',
    searchable_text: 'ModuleNotFoundError No module named requests import pip install python package',
  },
  {
    id: 'py-003',
    language: 'python',
    error_name: 'NameError',
    error_message_patterns: "name 'x' is not defined",
    likely_cause: 'Variable x is used before being assigned.',
    recommended_fix: 'Define x before using it or check for typos.',
    example_code: 'x = 5\nprint(x)',
    tags: 'python,name,undefined,variable',
    searchable_text: 'NameError name is not defined variable python undefined typo',
  },
  {
    id: 'py-006',
    language: 'python',
    error_name: 'KeyError',
    error_message_patterns: "'username'",
    likely_cause: 'Dictionary key \"username\" does not exist.',
    recommended_fix: 'Check if key exists before access, or use dict.get().',
    example_code: "d.get('username', 'default')",
    tags: 'python,key,dict,dictionary',
    searchable_text: 'KeyError dictionary missing key python not found get default',
  },
  {
    id: 'java-001',
    language: 'java',
    error_name: 'NullPointerException',
    error_message_patterns: 'Cannot invoke method because "obj" is null',
    likely_cause: 'An object reference was null when a method was called on it.',
    recommended_fix: 'Check for null before calling methods, use Optional.',
    example_code: 'if (obj != null) { obj.method(); }',
    tags: 'java,null,pointer',
    searchable_text: 'NullPointerException Java null check optional object',
  },
  {
    id: 'js-004',
    language: 'javascript',
    error_name: 'CannotReadPropertiesOfUndefined',
    error_message_patterns: "Cannot read properties of undefined",
    likely_cause: 'Attempting to access a property on undefined or null.',
    recommended_fix: 'Use optional chaining (?.) or null checks.',
    example_code: 'const value = obj?.property;',
    tags: 'javascript,undefined,null,optional',
    searchable_text: 'Cannot read properties of undefined JavaScript null optional chaining',
  },
];

describe('retrieval', () => {
  describe('retrieveEvidence', () => {
    it('should retrieve the correct record for a known Python error', () => {
      const result = retrieveEvidence(
        'ModuleNotFoundError: No module named requests',
        'python',
        mockRecords,
        3,
        0.01  // Very low threshold for test
      );

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].record.id).toBe('py-001');
      expect(result[0].score).toBeGreaterThan(0);
      expect(result[0].rank).toBe(1);
    });

    it('should filter by language', () => {
      const result = retrieveEvidence(
        'null pointer',
        'java',
        mockRecords,
        3,
        0.01
      );

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].record.language).toBe('java');
      expect(result[0].record.id).toBe('java-001');
    });

    it('should return empty array for no matching records', () => {
      const result = retrieveEvidence(
        'xyznonexistenterror',
        'python',
        mockRecords
      );

      expect(result).toEqual([]);
    });

    it('should return limited number of results (top-k)', () => {
      const result = retrieveEvidence(
        'python',
        'all',
        mockRecords,
        3
      );

      expect(result.length).toBeLessThanOrEqual(3);
    });

    it('should rank results by similarity (most relevant first)', () => {
      const result = retrieveEvidence(
        'name x is not defined',
        'python',
        mockRecords
      );

      expect(result.length).toBeGreaterThan(0);
      // Score should be higher for matching records
      expect(result[0].score).toBeGreaterThan(0);
    });

    it('should handle empty records array', () => {
      const result = retrieveEvidence(
        'some query',
        'python',
        []
      );

      expect(result).toEqual([]);
    });

    it('should include record IDs and ranks', () => {
      const result = retrieveEvidence(
        'name error',
        'python',
        mockRecords
      );

      if (result.length > 0) {
        expect(result[0].record.id).toBeDefined();
        expect(result[0].rank).toBeGreaterThanOrEqual(1);
      }
    });

    it('should provide stable deterministic results', () => {
      const query = 'undefined variable name';

      const result1 = retrieveEvidence(query, 'python', mockRecords);
      const result2 = retrieveEvidence(query, 'python', mockRecords);

      expect(result1.length).toBe(result2.length);
      if (result1.length > 0) {
        expect(result1[0].record.id).toBe(result2[0].record.id);
        expect(result1[0].score).toBeCloseTo(result2[0].score, 6);
      }
    });

    it('should search across all languages when language filter is "all"', () => {
      const result = retrieveEvidence(
        'error',
        'all',
        mockRecords,
        3,
        0.0  // Very low threshold
      );

      expect(result.length).toBeGreaterThan(0);
      const languages = new Set(result.map(e => e.record.language));
      expect(languages.size).toBeGreaterThan(1);
    });

    it('should handle case-insensitive queries', () => {
      const result1 = retrieveEvidence(
        'ModuleNotFoundError',
        'python',
        mockRecords
      );
      const result2 = retrieveEvidence(
        'modulenotfounderror',
        'python',
        mockRecords
      );

      expect(result1[0].record.id).toBe(result2[0].record.id);
    });
  });

  describe('handleEmptyQuery', () => {
    it('should return top records for empty query', () => {
      const result = handleEmptyQuery(mockRecords);

      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThanOrEqual(3);
    });

    it('should return empty array for no records', () => {
      const result = handleEmptyQuery([]);
      expect(result).toEqual([]);
    });
  });

  describe('handleNoMatches', () => {
    it('should return empty array', () => {
      const result = handleNoMatches();
      expect(result).toEqual([]);
    });
  });
});