/**
 * test-regression.ts — End-to-end regression tests for the diagnosed production
 * failure and the patterns around it. External services (Neon, OpenRouter) are
 * mocked; retrieval cases use the real seed data.
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { retrieveEvidence } from '@/lib/retrieval';
import { detectLanguage, validateSolveRequest } from '@/lib/validation';
import { solve, generateAnswer, isGenerationConfigured } from '@/lib/generation';
import { getDb, DatabaseError } from '@/lib/db';
import { CodingErrorRecord } from '@/lib/types';

const seedPath = path.join(__dirname, '..', 'database', 'seed.json');
const records: CodingErrorRecord[] = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));

const THRESHOLD = 0.15;

const UNTERMINATED_STRING_ERROR = [
  'ERROR!',
  'Traceback (most recent call last):',
  '  File "<main.py>", line 4',
  '    print("What does the Visualize button do?)',
  '          ^',
  'SyntaxError: unterminated string literal (detected at line 4)',
].join('\n');

describe('regression: retrieval from the real knowledge base', () => {
  it('retrieves supporting evidence for the exact unterminated-string traceback', () => {
    const language = detectLanguage(UNTERMINATED_STRING_ERROR);
    expect(language).toBe('python');

    const evidence = retrieveEvidence(UNTERMINATED_STRING_ERROR, language, records, 3, THRESHOLD);
    expect(evidence.length).toBeGreaterThan(0);
    expect(evidence[0].record.id).toBe('py-011'); // UnterminatedStringLiteral
    expect(evidence[0].score).toBeGreaterThanOrEqual(THRESHOLD);
  });

  it('retrieves evidence for a missing closing parenthesis', () => {
    const evidence = retrieveEvidence(
      "SyntaxError: '(' was never closed",
      'python',
      records,
      3,
      THRESHOLD
    );
    const top3 = evidence.map(e => e.record.id);
    expect(top3).toContain('py-013');
  });

  it('retrieves evidence for IndentationError', () => {
    const evidence = retrieveEvidence(
      'IndentationError: unexpected indent',
      'python',
      records,
      3,
      THRESHOLD
    );
    expect(evidence.length).toBeGreaterThan(0);
    expect(evidence[0].record.id).toBe('py-012');
  });

  it('retrieves evidence for ModuleNotFoundError', () => {
    const evidence = retrieveEvidence(
      "ModuleNotFoundError: No module named 'pandas'",
      'python',
      records,
      3,
      THRESHOLD
    );
    expect(evidence[0].record.id).toBe('py-001');
  });

  it('retrieves evidence for a Java NullPointerException traceback', () => {
    const query =
      'Exception in thread "main" java.lang.NullPointerException: Cannot invoke "String.length()" because "s" is null';
    const language = detectLanguage(query);
    expect(language).toBe('java');
    const evidence = retrieveEvidence(query, language, records, 3, THRESHOLD);
    expect(evidence[0].record.id).toBe('java-001');
  });

  it('retrieves evidence for a JavaScript ReferenceError', () => {
    const language = detectLanguage('Uncaught ReferenceError: displayData is not defined');
    expect(language).toBe('javascript');
    const evidence = retrieveEvidence(
      'Uncaught ReferenceError: displayData is not defined',
      language,
      records,
      3,
      THRESHOLD
    );
    expect(evidence[0].record.id).toBe('js-001');
  });

  it('returns no evidence for an unrelated query (honest no-match)', () => {
    const evidence = retrieveEvidence('my toaster is not working', 'all', records, 3, THRESHOLD);
    expect(evidence).toEqual([]);
  });
});

describe('regression: request validation', () => {
  it('rejects empty input', () => {
    const result = validateSolveRequest({ query: '' });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid screenshot data URL', () => {
    const result = validateSolveRequest({
      query: 'some error',
      screenshot: 'not-a-data-url',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an oversized screenshot', () => {
    // 8 MB of base64 exceeds the 7 MB schema limit.
    const result = validateSolveRequest({
      query: 'some error',
      screenshot: `data:image/png;base64,${'A'.repeat(8 * 1024 * 1024)}`,
    });
    expect(result.success).toBe(false);
  });

  it('accepts a valid screenshot data URL', () => {
    const result = validateSolveRequest({
      query: 'some error',
      screenshot: 'data:image/png;base64,iVBORw0KGgo=',
    });
    expect(result.success).toBe(true);
  });
});

describe('regression: solve pipeline degraded modes', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('reports error status when DATABASE_URL is missing', async () => {
    delete process.env.DATABASE_URL;
    const result = await solve({ query: 'test error', language: 'python' });
    expect(result.status).toBe('error');
  });

  it('reports error status when the database call fails', async () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@host/db';
    const failingDb = vi.fn().mockRejectedValue(new Error('connection refused'));
    const result = await solve(
      { query: 'test error', language: 'python' },
      failingDb as unknown as ReturnType<typeof getDb>
    );
    expect(result.status).toBe('error');
  });

  it('falls back to retrieval-only when credentials are missing', async () => {
    delete process.env.OPENROUTER_API_KEY;
    expect(isGenerationConfigured()).toBe(false);

    const evidence = retrieveEvidence("ModuleNotFoundError: No module named 'pandas'", 'python', records, 3, THRESHOLD);
    const result = await generateAnswer(evidence, { query: "ModuleNotFoundError: No module named 'pandas'", language: 'python' });
    expect(result.status).toBe('generation_unavailable');
    expect(result.mode).toBe('retrieval_only');
    expect(result.likelyCause).toBeDefined();
    expect(result.screenshotAnalyzed).toBe(false);
  });

  it('falls back to retrieval-only when the generation provider fails', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-v1-fake-key-for-testing';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const evidence = retrieveEvidence("ModuleNotFoundError: No module named 'pandas'", 'python', records, 3, THRESHOLD);
    const result = await generateAnswer(evidence, { query: "ModuleNotFoundError: No module named 'pandas'", language: 'python' });
    expect(result.status).toBe('generation_unavailable');
    expect(result.mode).toBe('retrieval_only');
  });

  it('labels the screenshot as NOT analyzed when no vision model is configured', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-v1-fake-key-for-testing';
    delete process.env.OPENROUTER_VISION_MODEL;

    const evidence = retrieveEvidence(
      UNTERMINATED_STRING_ERROR,
      'python',
      records,
      3,
      THRESHOLD
    );
    const request = {
      query: UNTERMINATED_STRING_ERROR,
      language: 'python' as const,
      screenshot: 'data:image/png;base64,iVBORw0KGgo=',
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Likely Cause: x\nRecommended Fix: y' } }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await generateAnswer(evidence, request);

    expect(result.screenshotProvided).toBe(true);
    expect(result.screenshotAnalyzed).toBe(false);
    // The image must never be sent to a non-vision model.
    const calledWithImage = fetchMock.mock.calls.some((call: unknown[]) =>
      JSON.stringify(call[1] ?? {}).includes('image_url')
    );
    expect(calledWithImage).toBe(false);
  });

  it('sends the screenshot to the provider only when a vision model is configured', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-v1-fake-key-for-testing';
    process.env.OPENROUTER_VISION_MODEL = 'vision-model';

    const evidence = retrieveEvidence(UNTERMINATED_STRING_ERROR, 'python', records, 3, THRESHOLD);
    const request = {
      query: UNTERMINATED_STRING_ERROR,
      language: 'python' as const,
      screenshot: 'data:image/png;base64,iVBORw0KGgo=',
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Likely Cause: x\nRecommended Fix: y' } }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await generateAnswer(evidence, request);

    expect(result.screenshotAnalyzed).toBe(true);
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body ?? '{}'));
    expect(body.model).toBe('vision-model');
    expect(Array.isArray(body.messages[1].content)).toBe(true);
  });

  it('only cites record IDs that were actually retrieved', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-v1-fake-key-for-testing';

    const evidence = retrieveEvidence("ModuleNotFoundError: No module named 'pandas'", 'python', records, 3, THRESHOLD);
    const retrievedIds = evidence.map(e => e.record.id);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content:
                  'Likely Cause: x\nRecommended Fix: y\nSupporting Evidence: Based on records: fabricated-id-999',
              },
            },
          ],
        }),
      })
    );

    const result = await generateAnswer(evidence, {
      query: "ModuleNotFoundError: No module named 'pandas'",
      language: 'python',
    });

    // recordIds come only from retrieved evidence; fabrications are never added.
    expect(result.recordIds.every(id => retrievedIds.includes(id))).toBe(true);
    expect(result.recordIds).not.toContain('fabricated-id-999');
  });
});

describe('regression: database error type', () => {
  it('surfaces DatabaseError for missing configuration', () => {
    const original = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      expect(() => getDb()).toThrow(DatabaseError);
    } finally {
      if (original) process.env.DATABASE_URL = original;
    }
  });
});
