// Core types for ErrorSnap RAG application
import { SolveRequestInput } from './validation';

export type Language = 'python' | 'java' | 'cpp' | 'javascript' | 'all';

export interface CodingErrorRecord {
  id: string;
  language: string;
  error_name: string;
  error_message_patterns: string;
  likely_cause: string;
  recommended_fix: string;
  example_code: string;
  tags: string;
  searchable_text: string;
  created_at?: string;
}

export interface RetrievedEvidence {
  record: CodingErrorRecord;
  score: number;
  rank: number;
}

export interface SolveRequest {
  query: string;
  language?: Language;
  screenshot?: string;
}

export interface SolveResponse {
  status: 'success' | 'insufficient_evidence' | 'generation_unavailable' | 'error';
  query: string;
  language: Language;
  evidence: RetrievedEvidence[];
  likelyCause?: string;
  recommendedFix?: string;
  exampleCode?: string;
  generatedAnswer?: string;
  recordIds: string[];
  mode: 'rag' | 'retrieval_only' | 'error';
  threshold: number;
  error?: string;
  generationError?: string;
}

// Re-export for convenience
export type { SolveRequestInput } from './validation';
