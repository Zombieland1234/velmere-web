import { getSupabaseServiceRoleClient, hasSupabaseServiceRoleConfig } from "@/lib/db/supabase";
import { inspectVlmText, sanitizeVlmText, stableHash } from "@/lib/ai/vlm-security";
import { recordVlmSecurityInspection } from "@/lib/ai/vlm-security-events";

export type AngelFeedbackRating =
  | "helpful"
  | "unhelpful"
  | "accurate_evidence"
  | "inaccurate_evidence"
  | "missing_evidence_noted"
  | "advice_abstention_respected";

export type AngelFeedbackCategory =
  | "grounding"
  | "evidence_coverage"
  | "advice_abstention"
  | "clarity"
  | "memory_continuity"
  | "general";

export type AngelFeedbackItem = Readonly<{
  feedbackId: string;
  requestId: string;
  sessionId?: string | null;
  rating: AngelFeedbackRating;
  category: AngelFeedbackCategory;
  comment?: string | null;
  locale: "pl" | "en" | "de";
  createdAt: string;
  source: "web_client" | "api";
}>;

export type AngelFeedbackMetrics = Readonly<{
  schemaVersion: "velmere.angel.feedback-metrics.v1";
  totalCount: number;
  positiveCount: number;
  negativeCount: number;
  categoryCounts: Record<AngelFeedbackCategory, number>;
  recentRatings: Array<{ rating: AngelFeedbackRating; category: AngelFeedbackCategory; timestamp: string }>;
  learningTruthStatement: string;
}>;

const MAX_FEEDBACK_HISTORY = 256;
const feedbackStore: AngelFeedbackItem[] = [];

const VALID_RATINGS = new Set<AngelFeedbackRating>([
  "helpful",
  "unhelpful",
  "accurate_evidence",
  "inaccurate_evidence",
  "missing_evidence_noted",
  "advice_abstention_respected",
]);

const VALID_CATEGORIES = new Set<AngelFeedbackCategory>([
  "grounding",
  "evidence_coverage",
  "advice_abstention",
  "clarity",
  "memory_continuity",
  "general",
]);

export const AI_LEARNING_REALITY_DISCLOSURE = {
  pl: "Angel i VLM Brain operują w trybie uziemionego wnioskowania kontekstowego (RAG) z deterministyczną weryfikacją dowodów i pamięcią sesyjną. Velmère NIE przeprowadza autonomicznego treningu wag modelu ani ciągłej modyfikacji parametrów neuronowych w czasie rzeczywistym.",
  en: "Angel and VLM Brain operate via grounded retrieval-augmented context (RAG) with deterministic evidence verification and session continuity. Velmère does NOT perform autonomous model weight training or real-time continual parameter updates.",
  de: "Angel und VLM Brain arbeiten über evidenzgebundenen Abrufkontext (RAG) mit deterministischer Beweisprüfung und Sitzungskontinuität. Velmère führt KEIN autonomes Modellgewichtstraining oder kontinuierliche Parameteraktualisierungen in Echtzeit durch.",
} as const;

export function validateFeedbackRating(value: unknown): AngelFeedbackRating | null {
  if (typeof value === "string" && VALID_RATINGS.has(value as AngelFeedbackRating)) {
    return value as AngelFeedbackRating;
  }
  return null;
}

export function validateFeedbackCategory(value: unknown): AngelFeedbackCategory {
  if (typeof value === "string" && VALID_CATEGORIES.has(value as AngelFeedbackCategory)) {
    return value as AngelFeedbackCategory;
  }
  return "general";
}
export async function submitAngelFeedback(input: {
  requestId: string;
  rating: unknown;
  category?: unknown;
  comment?: unknown;
  sessionId?: unknown;
  locale?: unknown;
}): Promise<{ ok: true; feedbackId: string } | { ok: false; error: string }> {
  const rating = validateFeedbackRating(input.rating);
  if (!rating) {
    return { ok: false, error: "invalid_feedback_rating" };
  }

  const rawRequestId = String(input.requestId ?? "").trim();
  if (!rawRequestId || rawRequestId.length > 128 || !/^[A-Za-z0-9_.:-]+$/.test(rawRequestId)) {
    return { ok: false, error: "invalid_request_id" };
  }
  const requestId = sanitizeVlmText(rawRequestId, 128);

  const category = validateFeedbackCategory(input.category);
  const locale: "pl" | "en" | "de" =
    input.locale === "pl" || input.locale === "de" || input.locale === "en" ? input.locale : "en";

  let cleanComment: string | null = null;
  if (typeof input.comment === "string" && input.comment.trim()) {
    const rawComment = input.comment.trim();
    const inspection = inspectVlmText(rawComment, 600);
    recordVlmSecurityInspection({
      inspection,
      vector: "input",
      route: "/api/angel/feedback",
      profile: "angel-feedback",
    });
    if (!inspection.safe) {
      return { ok: false, error: "comment_rejected_by_security_policy" };
    }
    cleanComment = sanitizeVlmText(rawComment, 500);
  }

  const sessionId = typeof input.sessionId === "string" && input.sessionId.trim()
    ? sanitizeVlmText(input.sessionId.trim(), 120)
    : null;

  const now = new Date().toISOString();
  const feedbackId = stableHash({
    namespace: "velmere.angel.feedback",
    requestId,
    rating,
    timestamp: now,
  }).slice(0, 24);

  const item: AngelFeedbackItem = {
    feedbackId,
    requestId,
    sessionId,
    rating,
    category,
    comment: cleanComment,
    locale,
    createdAt: now,
    source: "web_client",
  };

  feedbackStore.push(item);
  while (feedbackStore.length > MAX_FEEDBACK_HISTORY) {
    feedbackStore.shift();
  }

  const supabase = getSupabaseServiceRoleClient();
  if (supabase && hasSupabaseServiceRoleConfig()) {
    try {
      await supabase.from("velmere_angel_feedback").insert({
        feedback_id: item.feedbackId,
        request_id: item.requestId,
        session_id: item.sessionId,
        rating: item.rating,
        category: item.category,
        comment: item.comment,
        locale: item.locale,
        created_at: item.createdAt,
      });
    } catch {
      // Supabase write error does not block the user response; in-memory buffer retains the event.
    }
  }

  return { ok: true, feedbackId };
}

export function getAngelFeedbackMetrics(locale: "pl" | "en" | "de" = "en"): AngelFeedbackMetrics {
  const categoryCounts: Record<AngelFeedbackCategory, number> = {
    grounding: 0,
    evidence_coverage: 0,
    advice_abstention: 0,
    clarity: 0,
    memory_continuity: 0,
    general: 0,
  };

  let positiveCount = 0;
  let negativeCount = 0;

  for (const item of feedbackStore) {
    categoryCounts[item.category] = (categoryCounts[item.category] ?? 0) + 1;
    if (
      item.rating === "helpful" ||
      item.rating === "accurate_evidence" ||
      item.rating === "missing_evidence_noted" ||
      item.rating === "advice_abstention_respected"
    ) {
      positiveCount += 1;
    } else {
      negativeCount += 1;
    }
  }

  const recentRatings = feedbackStore.slice(-10).map((f) => ({
    rating: f.rating,
    category: f.category,
    timestamp: f.createdAt,
  }));

  return {
    schemaVersion: "velmere.angel.feedback-metrics.v1",
    totalCount: feedbackStore.length,
    positiveCount,
    negativeCount,
    categoryCounts,
    recentRatings,
    learningTruthStatement: AI_LEARNING_REALITY_DISCLOSURE[locale],
  };
}

