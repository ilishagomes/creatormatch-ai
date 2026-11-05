import type {
  BriefTopic, Campaign, CampaignInput, Creator, Draft, GeneratedOutreach, MatchResult, RankedCreator,
} from "../types";

export interface FieldError {
  field: string;
  message: string;
}

/** Error thrown for any non-2xx API response. `fieldErrors` is filled for 400 validation errors. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fieldErrors: FieldError[] = [],
    public details: string[] = [],
    /** Machine-readable error code from the server, e.g. "schema", "guardrail", "auth" */
    public code?: string,
    /** Whether trying again might succeed */
    public retryable = false,
  ) {
    super(message);
  }
}

/**
 * Every request to the backend goes through this one function, so loading
 * and error handling work the same way everywhere.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Is the backend running (npm run dev)?");
  }
  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => null);
  // The Vite dev proxy answers 5xx with an empty body when the API isn't running.
  if (!body && res.status >= 500) {
    throw new ApiError(res.status, "Can't reach the API server. Is it running? Start everything with npm run dev.", [], [], "api_unreachable", true);
  }
  if (!res.ok) {
    const raw = body?.details;
    const fieldErrors = Array.isArray(raw) && typeof raw[0] === "object" ? (raw as FieldError[]) : [];
    const details = Array.isArray(raw) && typeof raw[0] === "string" ? (raw as string[]) : [];
    throw new ApiError(res.status, body?.error ?? `Request failed (${res.status})`, fieldErrors, details, body?.code, Boolean(body?.retryable));
  }
  return body as T;
}

const json = (method: string, data: unknown): RequestInit => ({ method, body: JSON.stringify(data) });

export const api = {
  health: () => request<{ status: string; aiConfigured: boolean }>("/health"),

  listCampaigns: () => request<Campaign[]>("/campaigns"),
  getCampaign: (id: number) => request<Campaign>(`/campaigns/${id}`),
  createCampaign: (input: CampaignInput) => request<Campaign>("/campaigns", json("POST", input)),

  listCreators: (params: { search?: string; niche?: string; platform?: string } = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
    return request<Creator[]>(`/creators${qs.size ? `?${qs}` : ""}`);
  },
  getCreator: (id: number) => request<Creator>(`/creators/${id}`),

  getMatches: (campaignId: number) =>
    request<{ campaign: Campaign; weights: Record<string, number>; briefTopics: BriefTopic[]; results: RankedCreator[] }>(`/campaigns/${campaignId}/matches`),
  getMatch: (campaignId: number, creatorId: number) =>
    request<{ campaign: Campaign; creator: Creator; weights: Record<string, number>; match: MatchResult }>(`/campaigns/${campaignId}/matches/${creatorId}`),
  explainMatch: (campaignId: number, creatorId: number) =>
    request<{ explanation: string; model: string }>(`/campaigns/${campaignId}/matches/${creatorId}/explanation`, { method: "POST" }),

  generateOutreach: (campaignId: number, creatorId: number) =>
    request<GeneratedOutreach>("/outreach/generate", json("POST", { campaignId, creatorId })),

  getDraft: (id: number) => request<Draft>(`/drafts/${id}`),
  listDrafts: (campaignId?: number) => request<Draft[]>(`/drafts${campaignId ? `?campaignId=${campaignId}` : ""}`),
  createDraft: (input: Omit<Draft, "id" | "creatorName" | "brandName" | "createdAt" | "updatedAt">) =>
    request<Draft>("/drafts", json("POST", input)),
  updateDraft: (id: number, changes: Partial<Pick<Draft, "subject" | "body" | "reviewed">>) =>
    request<Draft>(`/drafts/${id}`, json("PUT", changes)),
  deleteDraft: (id: number) => request<void>(`/drafts/${id}`, { method: "DELETE" }),
};
