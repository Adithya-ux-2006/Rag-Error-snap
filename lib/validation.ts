import { z } from 'zod';
import { Language } from './types';

export const solveRequestSchema = z.object({
  query: z.string().min(1, 'Query is required').max(2000, 'Query must be 2000 characters or fewer'),
  language: z.enum(['python', 'java', 'cpp', 'javascript', 'all']).optional().default('all'),
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
