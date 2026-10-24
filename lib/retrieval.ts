import { CodingErrorRecord, RetrievedEvidence, Language } from './types';
import { normalizeQuery } from './validation';

const DEFAULT_TOP_K = 3;
const DEFAULT_SIMILARITY_THRESHOLD = 0.05;

/**
 * Boilerplate patterns that carry no retrieval signal. Error messages pasted
 * from consoles typically arrive with traceback frames, file/line references
 * and caret pointer lines. These are removed from the query before vectorizing
 * so that the salient error tokens are not diluted.
 */
const TRACEBACK_FRAME = /^\s*File\s+(?:<|"|').*(?:>|"|'),\s*line\s+\d+/i;
const TRACEBACK_BANNER = /^\s*(?:Traceback\s*\(most recent call last\)\s*:|.*Error!)\s*$/i;
const CARET_LINE = /^\s*[\^~|+\-_%]+\s*$/;
const REPR_LINE = /^\s*\.{3}\d+\s+(?:message|frame|lines)?\s*truncated.*$/i;

function isBoilerplateLine(line: string): boolean {
  if (!line.trim()) return true;
  if (TRACEBACK_BANNER.test(line)) return true;
  if (TRACEBACK_FRAME.test(line)) return true;
  if (CARET_LINE.test(line)) return true;
  if (REPR_LINE.test(line)) return true;
  return false;
}

/**
 * Clean user pasted error text: drop traceback frames, file/line references,
 * caret lines, and collapse whitespace. Applied to queries only.
 */
function cleanQuery(query: string): string {
  const lines = query.split(/\r?\n/).filter((line) => !isBoilerplateLine(line));
  return lines.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * English stopwords plus console boilerplate terms. Removed from queries only;
 * knowledge-base documents are curated and contain no boilerplate.
 *
 * NOTE: "error" is deliberately NOT a stopword: it is a strong signal because
 * every exception class name ends in "error"/"exception" after camelCase
 * splitting.
 */
const STOPWORDS = new Set([
  'a', 'an', 'the', 'at', 'in', 'on', 'of', 'for', 'to', 'and', 'or', 'but', 'is',
  'are', 'was', 'were', 'be', 'been', 'being', 'this', 'that', 'it', 'its', 'i',
  'my', 'me', 'we', 'our', 'you', 'your', 'help', 'please', 'what', 'when',
  'does', 'do', 'did', 'which', 'how', 'isn', 'isnt', 'can', 'cant',
  'traceback', 'most', 'recent', 'call', 'last', 'detected',
]);

/**
 * Split camelCase / PascalCase boundaries and digit-letter boundaries so that
 * compound exception names tokenize into their parts:
 *   "ModuleNotFoundError" -> module not found error
 *   "IndexError: list index out of range" -> index error list index out of range
 *   "java-003" style ids stay intact in documents (ids are separate fields).
 */
function splitCompound(token: string): string[] {
  const lower = token.toLowerCase();
  const hasBoundaries = /[a-z][A-Z]|\d[a-zA-Z]|[a-zA-Z]\d/.test(token);
  const parts = token
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')
    .replace(/(\d)([a-zA-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  // Keep the original squashed word so all-lowercase queries (which contain no
  // camelCase boundaries and therefore cannot be split) still match.
  if (hasBoundaries && parts.length > 1 && !parts.includes(lower)) {
    parts.push(lower);
  }
  return parts;
}

/**
 * Tokenize text into lowercase tokens, splitting compound words.
 */
function tokenize(text: string, stopwords?: Set<string>): string[] {
  return splitCompound(text)
    .filter(Boolean)
    .filter((t) => !t.match(/^\W+$/))
    .filter((t) => (stopwords ? !stopwords.has(t) : true));
}

/**
 * Attempt to segment a glued-together token (e.g. "modulenotfounderror") into
 * known vocabulary words using greedy longest-prefix matching. Returns the
 * segments when two or more words match, otherwise null. This lets queries
 * typed as lowercase compound names still tokenize into their parts.
 */
function segmentByVocabulary(token: string, vocabulary: Set<string>): string[] | null {
  if (token.length < 6) return null;

  const words: string[] = [];
  let rest = token;

  while (rest.length > 0) {
    let matched = false;
    const maxLen = words.length === 0 ? rest.length - 1 : rest.length;
    for (let len = Math.min(rest.length, 10); len >= 3; len--) {
      if (len > maxLen) continue;
      const prefix = rest.slice(0, len);
      if (vocabulary.has(prefix)) {
        words.push(prefix);
        rest = rest.slice(len);
        matched = true;
        break;
      }
    }
    if (!matched) return null;
  }

  return words.length >= 2 ? words : null;
}

/**
 * Compute TF-IDF vectors for documents and query, then compute cosine similarity.
 * Uses the standard smoothed IDF formula: idf = ln(1 + N / df)
 */
function computeTfIdf(
  documents: string[],
  query: string
): { docVectors: number[][]; queryVector: number[]; features: string[] } {
  const docTokens: string[][] = documents.map(doc => tokenize(doc));

  // Document vocabulary first: it drives query segmentation below.
  const docVocabulary = new Set<string>();
  for (const tokens of docTokens) {
    for (const token of tokens) docVocabulary.add(token);
  }

  // Expand glued lowercase tokens using the document vocabulary.
  const queryTokens = tokenize(query, STOPWORDS).flatMap((token) => {
    if (docVocabulary.has(token)) return [token];
    const segments = segmentByVocabulary(token, docVocabulary);
    return segments || [token];
  });

  // Build vocabulary from all documents and query
  const vocabulary = new Set(docVocabulary);
  for (const token of queryTokens) vocabulary.add(token);

  const features = Array.from(vocabulary).sort();
  const vocabIndex = new Map<string, number>();
  features.forEach((f, i) => vocabIndex.set(f, i));

  const N = documents.length;

  // Compute document frequency (how many docs contain each term)
  const docFreq = new Array<number>(features.length).fill(0);
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
    const tf = new Array<number>(features.length).fill(0);
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
  const queryTf = new Array<number>(features.length).fill(0);
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
 * Uses TF-IDF vectorization and cosine similarity ranking over camelCase-split
 * tokens, with traceback boilerplate and stopwords removed from the query.
 *
 * @param query - User search query (a raw error message or traceback)
 * @param language - Optional language filter ('all' or a Language value)
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

  const cleanedQuery = cleanQuery(query);

  // Filter by language
  let filteredRecords: CodingErrorRecord[] = records;
  if (language && language !== 'all') {
    filteredRecords = records.filter(r => r.language === language);
  }

  if (filteredRecords.length === 0) {
    return [];
  }

  // Build vectors over: error message patterns + tags + curated searchable text
  const documents = filteredRecords.map(
    (r) => `${r.error_message_patterns} ${r.tags} ${r.searchable_text}`
  );
  const { docVectors, queryVector } = computeTfIdf(documents, cleanedQuery);

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

export { normalizeQuery };
