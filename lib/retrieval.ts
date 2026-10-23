import { CodingErrorRecord, RetrievedEvidence, Language } from './types';
import { normalizeQuery } from './validation';

const DEFAULT_TOP_K = 3;
const DEFAULT_SIMILARITY_THRESHOLD = 0.05;

/**
 * Tokenize text into lowercase tokens.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(t => t.length > 0);
}

/**
 * Compute TF-IDF vectors for documents and query, then compute cosine similarity.
 * Uses the standard smoothed IDF formula: idf = ln(1 + N / df)
 */
function computeTfIdf(
  documents: string[],
  query: string
): { docVectors: number[][]; queryVector: number[]; features: string[] } {
  const docTokens = documents.map(doc => tokenize(doc));
  const queryTokens = tokenize(query);

  // Build vocabulary from all documents and query
  const vocabulary = new Set<string>();
  for (const tokens of docTokens) {
    for (const token of tokens) vocabulary.add(token);
  }
  for (const token of queryTokens) vocabulary.add(token);

  const features = Array.from(vocabulary).sort();
  const vocabIndex = new Map<string, number>();
  features.forEach((f, i) => vocabIndex.set(f, i));

  const N = documents.length;

  // Compute document frequency (how many docs contain each term)
  const docFreq = new Array(features.length).fill(0);
  for (const tokens of docTokens) {
    const uniqueTokens = new Set(tokens);
    for (const token of uniqueTokens) {
      const idx = vocabIndex.get(token);
      if (idx !== undefined) docFreq[idx]++;
    }
  }

  // Compute IDF using smoothed formula: idf = ln(1 + N / df)
  const idfValues = docFreq.map(df => Math.log(1 + N / Math.max(df, 1)));

  // Compute document TF-IDF vectors
  const docVectors: number[][] = docTokens.map(tokens => {
    const tf = new Array(features.length).fill(0);
    const termCounts: Record<string, number> = {};
    for (const token of tokens) {
      termCounts[token] = (termCounts[token] || 0) + 1;
    }
    for (let i = 0; i < features.length; i++) {
      const token = features[i];
      const count = termCounts[token] || 0;
      tf[i] = count / Math.max(tokens.length, 1);
    }
    return tf.map((val, i) => val * idfValues[i]);
  });

  // Compute query TF-IDF vector
  const queryTermCounts: Record<string, number> = {};
  for (const token of queryTokens) {
    queryTermCounts[token] = (queryTermCounts[token] || 0) + 1;
  }
  const queryTf = new Array(features.length).fill(0);
  for (let i = 0; i < features.length; i++) {
    const token = features[i];
    const count = queryTermCounts[token] || 0;
    queryTf[i] = count / Math.max(queryTokens.length, 1);
  }
  const queryVector = queryTf.map((val, i) => val * idfValues[i]);

  return { docVectors, queryVector, features };
}

/**
 * Compute cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Retrieve the top-k most relevant records for a given query.
 * Uses TF-IDF vectorization and cosine similarity ranking.
 *
 * @param query - User search query
 * @param language - Optional language filter (e.g., 'python', 'java', 'all')
 * @param records - Knowledge base records
 * @param topK - Number of results to return (default: 3)
 * @param threshold - Minimum similarity score (default: 0.05)
 */
export function retrieveEvidence(
  query: string,
  language?: Language,
  records?: CodingErrorRecord[],
  topK: number = DEFAULT_TOP_K,
  threshold: number = DEFAULT_SIMILARITY_THRESHOLD
): RetrievedEvidence[] {
  if (!records || records.length === 0) {
    return [];
  }

  if (!query || query.trim().length === 0) {
    return [];
  }

  const normalizedQuery = normalizeQuery(query);

  // Filter by language
  let filteredRecords = records;
  if (language && language !== 'all') {
    filteredRecords = records.filter(r => r.language === language);
  }

  if (filteredRecords.length === 0) {
    return [];
  }

  // Build TF-IDF vectors
  const documents = filteredRecords.map(r => r.searchable_text);
  const { docVectors, queryVector } = computeTfIdf(documents, normalizedQuery);

  // Compute cosine similarities
  const similarities: { record: CodingErrorRecord; score: number }[] = [];
  for (let i = 0; i < filteredRecords.length; i++) {
    const score = cosineSimilarity(queryVector, docVectors[i]);
    if (score >= threshold) {
      similarities.push({ record: filteredRecords[i], score });
    }
  }

  // Sort by score descending, then by ID for determinism
  similarities.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.record.id.localeCompare(b.record.id);
  });

  // Return top-k results with rank
  return similarities
    .slice(0, topK)
    .map((item, index) => ({
      record: item.record,
      score: item.score,
      rank: index + 1,
    }));
}

/**
 * Handle empty queries - return a default set of representative records.
 */
export function handleEmptyQuery(records: CodingErrorRecord[]): RetrievedEvidence[] {
  if (!records || records.length === 0) {
    return [];
  }
  return records.slice(0, 3).map((record, i) => ({
    record,
    score: 0.5,
    rank: i + 1,
  }));
}

/**
 * Handle queries with no meaningful matches - return empty array.
 */
export function handleNoMatches(): RetrievedEvidence[] {
  return [];
}
