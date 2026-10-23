/**
 * test-validation.ts — Tests for input validation
 */

import { describe, it, expect } from 'vitest';
import { validateSolveRequest, normalizeQuery, isLanguageSelected } from '@/lib/validation';

describe('validation', () => {
  describe('validateSolveRequest', () => {
    it('should accept a valid request with all fields', () => {
      const input = { query: 'ModuleNotFoundError: No module named requests', language: 'python' };
      const result = validateSolveRequest(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query).toBe('ModuleNotFoundError: No module named requests');
        expect(result.data.language).toBe('python');
      }
    });

    it('should accept a request without language (default to all)', () => {
      const input = { query: 'TypeError: x is not a function' };
      const result = validateSolveRequest(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.language).toBe('all');
      }
    });

    it('should reject an empty query', () => {
      const input = { query: '', language: 'python' };
      const result = validateSolveRequest(input);
      expect(result.success).toBe(false);
    });

    it('should reject a query exceeding 2000 characters', () => {
      const longQuery = 'x'.repeat(2001);
      const input = { query: longQuery, language: 'python' };
      const result = validateSolveRequest(input);
      expect(result.success).toBe(false);
    });

    it('should reject an invalid language value', () => {
      const input = { query: 'some error', language: 'ruby' };
      const result = validateSolveRequest(input);
      expect(result.success).toBe(false);
    });

    it('should reject a missing query field', () => {
      const input = { language: 'python' };
      const result = validateSolveRequest(input);
      expect(result.success).toBe(false);
    });

    it('should accept an image data URL screenshot', () => {
      const result = validateSolveRequest({
        query: 'Error shown in screenshot',
        screenshot: 'data:image/png;base64,aGVsbG8=',
      });
      expect(result.success).toBe(true);
    });

    it('should reject a non-image screenshot URL', () => {
      const result = validateSolveRequest({
        query: 'Error shown in screenshot',
        screenshot: 'data:text/plain;base64,aGVsbG8=',
      });
      expect(result.success).toBe(false);
    });

    it('should handle non-object input', () => {
      const result = validateSolveRequest('just a string');
      expect(result.success).toBe(false);
    });

    it('should handle null input', () => {
      const result = validateSolveRequest(null);
      expect(result.success).toBe(false);
    });

    it('should handle undefined input', () => {
      const result = validateSolveRequest(undefined);
      expect(result.success).toBe(false);
    });
  });

  describe('normalizeQuery', () => {
    it('should trim whitespace', () => {
      expect(normalizeQuery('  hello  ')).toBe('hello');
    });

    it('should collapse multiple spaces', () => {
      expect(normalizeQuery('hello   world  test')).toBe('hello world test');
    });

    it('should handle empty string', () => {
      expect(normalizeQuery('')).toBe('');
    });

    it('should handle string with only whitespace', () => {
      expect(normalizeQuery('   ')).toBe('');
    });
  });

  describe('isLanguageSelected', () => {
    it('should return true for a specific language', () => {
      expect(isLanguageSelected('python')).toBe(true);
    });

    it('should return false for "all"', () => {
      expect(isLanguageSelected('all')).toBe(false);
    });
  });
});
