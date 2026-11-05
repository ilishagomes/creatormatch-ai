import type { DB } from "../db/database.js";
import type { Campaign } from "../types.js";
import type { CampaignInput } from "../validation/campaign.js";

/** Shape of a row exactly as SQLite returns it (snake_case, JSON as text). */
interface CampaignRow {
  id: number;
  brand_name: string;
  product: string;
  industry: string;
  description: string;
  target_audience: string;
  age_min: number;
  age_max: number;
  platforms: string;
  budget: number;
  currency: string;
  goal: string;
  created_at: string;
}

/** Converts a database row into the camelCase object the rest of the app uses. */
function toCampaign(row: CampaignRow): Campaign {
  return {
    id: row.id,
    brandName: row.brand_name,
    product: row.product,
    industry: row.industry as Campaign["industry"],
    description: row.description,
    targetAudience: row.target_audience,
    ageMin: row.age_min,
    ageMax: row.age_max,
    platforms: JSON.parse(row.platforms),
    budget: row.budget,
    currency: row.currency as Campaign["currency"],
    goal: row.goal as Campaign["goal"],
    createdAt: row.created_at,
  };
}

export function createCampaignRepository(db: DB) {
  return {
    create(input: CampaignInput): Campaign {
      // Named parameters (@brandName) prevent SQL injection: values are never
      // pasted into the SQL string.
      const result = db
        .prepare(
          `INSERT INTO campaigns
             (brand_name, product, industry, description, target_audience,
              age_min, age_max, platforms, budget, currency, goal)
           VALUES
             (@brandName, @product, @industry, @description, @targetAudience,
              @ageMin, @ageMax, @platforms, @budget, @currency, @goal)`,
        )
        .run({ ...input, platforms: JSON.stringify(input.platforms) });
      return this.findById(Number(result.lastInsertRowid))!;
    },

    findById(id: number): Campaign | null {
      const row = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(id) as CampaignRow | undefined;
      return row ? toCampaign(row) : null;
    },

    findAll(): Campaign[] {
      const rows = db.prepare("SELECT * FROM campaigns ORDER BY id DESC").all() as CampaignRow[];
      return rows.map(toCampaign);
    },
  };
}

export type CampaignRepository = ReturnType<typeof createCampaignRepository>;
