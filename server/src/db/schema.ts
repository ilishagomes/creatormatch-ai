/**
 * Database schema. SQLite has no array type, so lists (tags, platforms,
 * sources) are stored as JSON text and parsed in the repository layer.
 */
/** Bump this whenever a table's columns change. */
export const SCHEMA_VERSION = 4;

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS creators (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  name                 TEXT NOT NULL,
  handle               TEXT NOT NULL,
  primary_platform     TEXT NOT NULL,
  profile_url          TEXT NOT NULL,
  niche                TEXT NOT NULL,               -- main content category
  tags                 TEXT NOT NULL DEFAULT '[]',  -- JSON array: specific niche tags
  description          TEXT,                        -- null = not verified
  audience_metrics     TEXT NOT NULL DEFAULT '[]',  -- JSON array of {label, value, asOf, sourceUrl}
  verified_audience    TEXT,                        -- JSON {ageMin, ageMax, asOf, sourceUrl}; null = unknown
  source_urls          TEXT NOT NULL DEFAULT '[]',  -- JSON array of URLs
  date_verified        TEXT NOT NULL,
  verification_status  TEXT NOT NULL,               -- 'verified' | 'needs_manual_verification'
  verification_note    TEXT,
  considerations       TEXT,                        -- evidence-backed conflicts / limitations
  owned_brands         TEXT NOT NULL DEFAULT '[]',  -- JSON array of {name, keywords, sourceUrl}
  UNIQUE (primary_platform, handle)
);

CREATE TABLE IF NOT EXISTS campaigns (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  brand_name       TEXT NOT NULL,
  product          TEXT NOT NULL,
  industry         TEXT NOT NULL,
  description      TEXT NOT NULL,
  target_audience  TEXT NOT NULL,
  age_min          INTEGER NOT NULL,
  age_max          INTEGER NOT NULL,
  platforms        TEXT NOT NULL,                    -- JSON array
  budget           REAL NOT NULL,
  currency         TEXT NOT NULL,
  goal             TEXT NOT NULL,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS outreach_drafts (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id      INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  creator_id       INTEGER NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  subject          TEXT NOT NULL,
  body             TEXT NOT NULL,
  personalization_note TEXT,
  ai_generated     INTEGER NOT NULL DEFAULT 1,       -- 1 = came from Claude
  ai_model         TEXT,                             -- which model wrote the first draft
  reviewed         INTEGER NOT NULL DEFAULT 0,       -- human review checkbox
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
`;
