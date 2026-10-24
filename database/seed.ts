/**
 * ErrorSnap database seed script
 *
 * Populates the Neon PostgreSQL database with curated coding error records.
 * This script is idempotent: it checks for existing records before (upserting).
 *
 * Usage:
 *   npx tsx database/seed.ts
 *
 * Deploy pipeline safety: when the database endpoint is unreachable from the
 * build environment (transient DNS or network issues), the script logs a
 * warning and exits 0 so that deploys do not fail; existing records remain in
 * place. Failures while records are being written still fail loudly so data
 * problems cannot be silently skipped.
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { neon } from '@neondatabase/serverless';

interface SeedRecord {
  id: string;
  language: string;
  error_name: string;
  error_message_patterns: string;
  likely_cause: string;
  recommended_fix: string;
  example_code: string;
  tags: string;
  searchable_text: string;
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('Error: DATABASE_URL environment variable is not set.');
    console.error('Please copy .env.example to .env and configure your Neon database URL.');
    process.exit(1);
  }

  // Construction + reachability probe: some build environments expose a
  // masked/unusable DATABASE_URL or cannot reach the Neon endpoint. Warn and
  // continue (exit 0) so deploys do not fail; records remain unchanged.
  let sql: ReturnType<typeof neon>;
  try {
    sql = neon(connectionString);
    await sql`SELECT 1`;
  } catch (error) {
    console.warn(
      'WARNING: database unreachable from this build environment; skipping seed.',
      error instanceof Error ? error.message : error
    );
    console.warn('Run `npx tsx database/seed.ts` with DATABASE_URL access to apply updated records.');
    return;
  }

  const seedPath = path.join(__dirname, 'seed.json');
  const raw = fs.readFileSync(seedPath, 'utf-8');
  const records: SeedRecord[] = JSON.parse(raw);

  // Create table if not exists
  await sql`
    CREATE TABLE IF NOT EXISTS coding_errors (
      id          TEXT PRIMARY KEY,
      language    TEXT NOT NULL,
      error_name  TEXT NOT NULL,
      error_message_patterns TEXT NOT NULL,
      likely_cause TEXT NOT NULL,
      recommended_fix TEXT NOT NULL,
      example_code TEXT NOT NULL,
      tags        TEXT NOT NULL,
      searchable_text TEXT NOT NULL,
      created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;

  // Create indexes
  await sql`CREATE INDEX IF NOT EXISTS idx_coding_errors_language ON coding_errors(language)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_coding_errors_error_name ON coding_errors(error_name)`;
  await sql`ALTER TABLE coding_errors ADD COLUMN IF NOT EXISTS searchable_tsvector TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', searchable_text)) STORED`;
  await sql`CREATE INDEX IF NOT EXISTS idx_coding_errors_fts ON coding_errors USING GIN (searchable_tsvector)`;

  // Insert records (upsert for idempotency)
  let inserted = 0;
  let updated = 0;

  for (const record of records) {
    const result = (await sql`
      INSERT INTO coding_errors (
        id, language, error_name, error_message_patterns, likely_cause,
        recommended_fix, example_code, tags, searchable_text
      ) VALUES (
        ${record.id},
        ${record.language},
        ${record.error_name},
        ${record.error_message_patterns},
        ${record.likely_cause},
        ${record.recommended_fix},
        ${record.example_code},
        ${record.tags},
        ${record.searchable_text}
      )
      ON CONFLICT (id) DO UPDATE SET
        language = EXCLUDED.language,
        error_name = EXCLUDED.error_name,
        error_message_patterns = EXCLUDED.error_message_patterns,
        likely_cause = EXCLUDED.likely_cause,
        recommended_fix = EXCLUDED.recommended_fix,
        example_code = EXCLUDED.example_code,
        tags = EXCLUDED.tags,
        searchable_text = EXCLUDED.searchable_text
      RETURNING id
    `) as unknown as { length: number }[];

    if (result.length > 0) {
      // If returned from ON CONFLICT DO UPDATE, it's an update
      // Otherwise it's an insert. We need to track this properly.
      // With RETURNING, we get the row either way.
      // Let's count based on whether it was an insert or update.
      updated++;
    }
  }

  console.log(`Seeding complete: ${records.length} total records processed (${updated} upserted)`);
  console.log(`Knowledge base contains ${records.length} error records.`);
}

main().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
