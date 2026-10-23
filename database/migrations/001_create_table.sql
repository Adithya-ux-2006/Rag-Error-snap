-- ErrorSnap database migration
-- Creates the coding_errors knowledge base table

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
);

-- Index for fast language + error name lookups
CREATE INDEX IF NOT EXISTS idx_coding_errors_language ON coding_errors(language);
CREATE INDEX IF NOT EXISTS idx_coding_errors_error_name ON coding_errors(error_name);

-- Generated full-text vector for future database-side search. The column must
-- exist before its GIN index is created.
ALTER TABLE coding_errors ADD COLUMN IF NOT EXISTS searchable_tsvector TSVECTOR
    GENERATED ALWAYS AS (to_tsvector('english', searchable_text)) STORED;

CREATE INDEX IF NOT EXISTS idx_coding_errors_fts ON coding_errors USING GIN (searchable_tsvector);
