import type { DB } from "../db/database.js";
import type { Creator } from "../types.js";
import type { CreatorSeed } from "../validation/creator.js";

interface CreatorRow {
  id: number;
  name: string;
  handle: string;
  primary_platform: string;
  profile_url: string;
  niche: string;
  tags: string;
  description: string | null;
  audience_metrics: string;
  verified_audience: string | null;
  source_urls: string;
  date_verified: string;
  verification_status: string;
  verification_note: string | null;
  considerations: string | null;
  owned_brands: string;
}

function toCreator(row: CreatorRow): Creator {
  return {
    id: row.id,
    name: row.name,
    handle: row.handle,
    primaryPlatform: row.primary_platform as Creator["primaryPlatform"],
    profileUrl: row.profile_url,
    niche: row.niche as Creator["niche"],
    tags: JSON.parse(row.tags),
    description: row.description,
    audienceMetrics: JSON.parse(row.audience_metrics),
    verifiedAudience: row.verified_audience ? JSON.parse(row.verified_audience) : null,
    sourceUrls: JSON.parse(row.source_urls),
    dateVerified: row.date_verified,
    verificationStatus: row.verification_status as Creator["verificationStatus"],
    verificationNote: row.verification_note,
    considerations: row.considerations,
    ownedBrands: JSON.parse(row.owned_brands),
  };
}

export interface CreatorFilters {
  search?: string;
  niche?: string;
  platform?: string;
}

export function createCreatorRepository(db: DB) {
  return {
    /**
     * Insert a creator, or update it if one with the same platform + handle
     * already exists ("upsert"). Updating in place keeps its id, so saved
     * drafts that point at the creator stay valid when the dataset is re-seeded.
     */
    upsert(c: CreatorSeed): number {
      const params = {
        ...c,
        tags: JSON.stringify(c.tags),
        audienceMetrics: JSON.stringify(c.audienceMetrics),
        verifiedAudience: c.verifiedAudience ? JSON.stringify(c.verifiedAudience) : null,
        sourceUrls: JSON.stringify(c.sourceUrls),
        ownedBrands: JSON.stringify(c.ownedBrands),
      };
      const row = db
        .prepare(
          `INSERT INTO creators
             (name, handle, primary_platform, profile_url, niche, tags, description, audience_metrics, verified_audience,
              source_urls, date_verified, verification_status, verification_note, considerations, owned_brands)
           VALUES
             (@name, @handle, @primaryPlatform, @profileUrl, @niche, @tags, @description, @audienceMetrics, @verifiedAudience,
              @sourceUrls, @dateVerified, @verificationStatus, @verificationNote, @considerations, @ownedBrands)
           ON CONFLICT (primary_platform, handle) DO UPDATE SET
             name = excluded.name, profile_url = excluded.profile_url, niche = excluded.niche,
             tags = excluded.tags, description = excluded.description, audience_metrics = excluded.audience_metrics,
             verified_audience = excluded.verified_audience,
             source_urls = excluded.source_urls, date_verified = excluded.date_verified,
             verification_status = excluded.verification_status, verification_note = excluded.verification_note,
             considerations = excluded.considerations, owned_brands = excluded.owned_brands
           RETURNING id`,
        )
        .get(params) as { id: number };
      return row.id;
    },

    /** Deletes creators whose id is not in `keepIds`. Returns how many were removed. */
    deleteAllExcept(keepIds: number[]): number {
      const placeholders = keepIds.map(() => "?").join(",") || "NULL";
      return db.prepare(`DELETE FROM creators WHERE id NOT IN (${placeholders})`).run(...keepIds).changes;
    },

    findById(id: number): Creator | null {
      const row = db.prepare("SELECT * FROM creators WHERE id = ?").get(id) as CreatorRow | undefined;
      return row ? toCreator(row) : null;
    },

    /** Builds the WHERE clause only from filters that were actually provided. */
    findAll(filters: CreatorFilters = {}): Creator[] {
      const where: string[] = [];
      const params: Record<string, string> = {};
      if (filters.niche) {
        where.push("niche = @niche");
        params.niche = filters.niche;
      }
      if (filters.platform) {
        where.push("primary_platform = @platform");
        params.platform = filters.platform;
      }
      if (filters.search) {
        where.push("(name LIKE @search OR handle LIKE @search OR tags LIKE @search OR description LIKE @search)");
        params.search = `%${filters.search}%`;
      }
      const sql = `SELECT * FROM creators ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY name`;
      return (db.prepare(sql).all(params) as CreatorRow[]).map(toCreator);
    },

    count(): number {
      return (db.prepare("SELECT COUNT(*) AS n FROM creators").get() as { n: number }).n;
    },
  };
}

export type CreatorRepository = ReturnType<typeof createCreatorRepository>;
