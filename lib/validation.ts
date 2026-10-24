import { z } from 'zod';
import { Language } from './types';

export const solveRequestSchema = z.object({
  query: z.string().min(1, 'Query is required').max(2000, 'Query must be 2000 characters or fewer'),
  language: z.enum(['auto', 'python', 'java', 'cpp', 'javascript', 'all']).optional().default('all'),
  screenshot: z.string().startsWith('data:image/', 'Screenshot must be an image data URL').max(7_000_000, 'Screenshot is too large').optional(),
});

export type SolveRequestInput = z.infer<typeof solveRequestSchema>;

export interface ValidationSuccess {
  success: true;
  data: SolveRequestInput;
}

export interface ValidationError {
  success: false;
  error: string;
}

export type ValidationResult = ValidationSuccess | ValidationError;

export function validateSolveRequest(body: unknown): ValidationResult {
  const result = solveRequestSchema.safeParse(body);
  if (!result.success) {
    return { success: false, error: result.error.errors[0].message };
  }
  return { success: true, data: result.data };
}

export function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ');
}

export function isLanguageSelected(language: Language): boolean {
  return language !== 'all';
}

/**
 * Language-signature keywords used to auto-detect the programming language
 * from error text. Weighted so the most distinctive signatures win ties.
 * Fellows a conservative fallback of 'all' when nothing matches clearly.
 */
const LANGUAGE_SIGNALS: { language: Exclude<Language, 'auto' | 'all'>; weight: number; keyword: string }[] = [
  // JavaScript / Node / npm
  { language: 'javascript', weight: 3, keyword: 'typeerror' },
  { language: 'javascript', weight: 3, keyword: 'referenceerror' },
  { language: 'javascript', weight: 3, keyword: 'uncaught' },
  { language: 'javascript', weight: 2, keyword: 'cannot read propert' },
  { language: 'javascript', weight: 2, keyword: 'cannot read properties' },
  { language: 'javascript', weight: 2, keyword: 'is not a function' },
  { language: 'javascript', weight: 2, keyword: 'is not defined' },
  { language: 'javascript', weight: 1, keyword: 'node' },
  { language: 'javascript', weight: 1, keyword: 'npm' },
  { language: 'javascript', weight: 1, keyword: '.js' },
  // Python
  { language: 'python', weight: 3, keyword: 'modulenotfounderror' },
  { language: 'python', weight: 3, keyword: 'traceback (most recent call last)' },
  { language: 'python', weight: 3, keyword: 'indentationerror' },
  { language: 'python', weight: 2, keyword: 'importerror' },
  { language: 'python', weight: 2, keyword: 'attributeerror' },
  { language: 'python', weight: 2, keyword: 'keyerror' },
  { language: 'python', weight: 2, keyword: 'nameerror' },
  { language: 'python', weight: 1, keyword: '.py' },
  { language: 'python', weight: 1, keyword: 'pip' },
  // Java
  { language: 'java', weight: 3, keyword: 'nullpointerexception' },
  { language: 'java', weight: 3, keyword: 'exception in thread' },
  { language: 'java', weight: 3, keyword: 'classnotfoundexception' },
  { language: 'java', weight: 2, keyword: 'noclassdeffounderror' },
  { language: 'java', weight: 2, keyword: 'arrayindexoutofboundsexception' },
  { language: 'java', weight: 2, keyword: 'public static void main' },
  { language: 'java', weight: 1, keyword: '.java' },
  { language: 'java', weight: 1, keyword: 'jvm' },
  // C++
  { language: 'cpp', weight: 3, keyword: 'segmentation fault' },
  { language: 'cpp', weight: 3, keyword: 'undefined reference to' },
  { language: 'cpp', weight: 2, keyword: 'core dumped' },
  { language: 'cpp', weight: 2, keyword: 'std::' },
  { language: 'cpp', weight: 2, keyword: 'g++' },
  { language: 'cpp', weight: 2, keyword: '#include' },
  { language: 'cpp', weight: 1, keyword: '.cpp' },
];

/**
 * Infer the programming language from an error message by scoring
 * language-signature keywords in the query. Returns 'all' when no
 * unambiguous signal is found.
 */
export function detectLanguage(query: string): Language {
  if (!query) return 'all';

  const haystack = ' ' + query.toLowerCase().replace(/\s+/g, ' ') + ' ';
  const scores = new Map<Exclude<Language, 'auto' | 'all'>, number>();

  for (const signal of LANGUAGE_SIGNALS) {
    if (haystack.includes(signal.keyword)) {
      scores.set(signal.language, (scores.get(signal.language) || 0) + signal.weight);
    }
  }

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  // Only report a detection when one language clearly wins (no ties).
  if (ranked.length > 0 && (ranked.length === 1 || ranked[0][1] > ranked[1][1])) {
    return ranked[0][0];
  }
  return 'all';
}
