import { neon } from '@neondatabase/serverless';
import { CodingErrorRecord } from './types';

export class DatabaseError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export function getDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new DatabaseError('DATABASE_URL environment variable is not set');
  }
  return neon(connectionString);
}

export async function fetchAllRecords(db?: ReturnType<typeof getDb> | null): Promise<CodingErrorRecord[]> {
  try {
    const sql = db || getDb();
    const result = await sql`
      SELECT id, language, error_name, error_message_patterns, likely_cause, 
             recommended_fix, example_code, tags, searchable_text, created_at
      FROM coding_errors
      ORDER BY id
    `;
    return result as unknown as CodingErrorRecord[];
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError(
      error instanceof Error ? error.message : 'Unknown database error'
    );
  }
}

export async function fetchRecordsByLanguage(
  language: string,
  db?: ReturnType<typeof getDb> | null
): Promise<CodingErrorRecord[]> {
  try {
    const sql = db || getDb();
    const result = await sql`
      SELECT id, language, error_name, error_message_patterns, likely_cause, 
             recommended_fix, example_code, tags, searchable_text, created_at
      FROM coding_errors
      WHERE language = ${language}
      ORDER BY id
    `;
    return result as unknown as CodingErrorRecord[];
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError(
      error instanceof Error ? error.message : 'Unknown database error'
    );
  }
}

export async function checkDatabaseHealth(db?: ReturnType<typeof getDb> | null): Promise<boolean> {
  try {
    const sql = db || getDb();
    await sql`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}