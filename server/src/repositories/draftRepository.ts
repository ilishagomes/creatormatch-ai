import type { DB } from "../db/database.js";
import type { DraftInput, DraftUpdate } from "../validation/outreach.js";

export interface Draft {
  id: number;
  campaignId: number;
  creatorId: number;
  creatorName: string;
  brandName: string;
  subject: string;
  body: string;
  personalizationNote: string | null;
  aiGenerated: boolean;
  aiModel: string | null;
  reviewed: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DraftRow {
  id: number;
  campaign_id: number;
  creator_id: number;
  creator_name: string;
  brand_name: string;
  subject: string;
  body: string;
  personalization_note: string | null;
  ai_generated: number;
  ai_model: string | null;
  reviewed: number;
  created_at: string;
  updated_at: string;
}

const toDraft = (r: DraftRow): Draft => ({
  id: r.id,
  campaignId: r.campaign_id,
  creatorId: r.creator_id,
  creatorName: r.creator_name,
  brandName: r.brand_name,
  subject: r.subject,
  body: r.body,
  personalizationNote: r.personalization_note,
  aiGenerated: r.ai_generated === 1,
  aiModel: r.ai_model,
  reviewed: r.reviewed === 1,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

// JOIN so each draft carries the creator and brand names for display.
const SELECT = `
  SELECT d.*, c.name AS creator_name, p.brand_name AS brand_name
  FROM outreach_drafts d
  JOIN creators c ON c.id = d.creator_id
  JOIN campaigns p ON p.id = d.campaign_id`;

export function createDraftRepository(db: DB) {
  return {
    create(input: DraftInput): Draft {
      const result = db
        .prepare(
          `INSERT INTO outreach_drafts
             (campaign_id, creator_id, subject, body, personalization_note, ai_generated, ai_model, reviewed)
           VALUES (@campaignId, @creatorId, @subject, @body, @personalizationNote, @aiGenerated, @aiModel, @reviewed)`,
        )
        .run({ ...input, aiModel: input.aiGenerated ? input.aiModel : null, aiGenerated: input.aiGenerated ? 1 : 0, reviewed: input.reviewed ? 1 : 0 });
      return this.findById(Number(result.lastInsertRowid))!;
    },

    findById(id: number): Draft | null {
      const row = db.prepare(`${SELECT} WHERE d.id = ?`).get(id) as DraftRow | undefined;
      return row ? toDraft(row) : null;
    },

    findAll(campaignId?: number): Draft[] {
      const rows = campaignId
        ? (db.prepare(`${SELECT} WHERE d.campaign_id = ? ORDER BY d.updated_at DESC, d.id DESC`).all(campaignId) as DraftRow[])
        : (db.prepare(`${SELECT} ORDER BY d.updated_at DESC, d.id DESC`).all() as DraftRow[]);
      return rows.map(toDraft);
    },

    update(id: number, changes: DraftUpdate): Draft | null {
      const sets: string[] = [];
      const params: Record<string, unknown> = { id };
      if (changes.subject !== undefined) (sets.push("subject = @subject"), (params.subject = changes.subject));
      if (changes.body !== undefined) (sets.push("body = @body"), (params.body = changes.body));
      if (changes.reviewed !== undefined) (sets.push("reviewed = @reviewed"), (params.reviewed = changes.reviewed ? 1 : 0));
      const result = db
        .prepare(`UPDATE outreach_drafts SET ${sets.join(", ")}, updated_at = datetime('now') WHERE id = @id`)
        .run(params);
      return result.changes ? this.findById(id) : null;
    },

    delete(id: number): boolean {
      return db.prepare("DELETE FROM outreach_drafts WHERE id = ?").run(id).changes > 0;
    },
  };
}

export type DraftRepository = ReturnType<typeof createDraftRepository>;
