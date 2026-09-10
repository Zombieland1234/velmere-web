import { generateTextWithVlmProvider } from "./vlm-provider-registry";
import { sanitizeVlmText } from "./vlm-security";

type GeminiTask = "product_description" | "rewrite_copy" | "alt_text" | "import_cleanup";

type GenerateGeminiTextInput = {
  task: GeminiTask;
  locale: "pl" | "en" | "de";
  input: string;
};

const TASK_INSTRUCTIONS: Record<GeminiTask, string> = {
  product_description:
    "Generate refined product copy for a luxury streetwear product. Do not invent composition, stock, delivery promises, discounts, provider names, checkout readiness, image URLs or visual claims not supplied by the operator.",
  rewrite_copy:
    "Rewrite weak storefront copy in the Velmère tone: restrained, premium, clothing-first, minimal and never crypto-hype.",
  alt_text:
    "Generate concise accessibility alt text only from operator-supplied image context. Never invent image URLs, mockups, models, colors or visible details not provided.",
  import_cleanup:
    "Clean an imported product draft into review notes and improved product copy. Preserve warnings when data is missing. Do not publish or approve it. Images are manual-only: never fetch, generate, suggest or copy provider image URLs.",
};

export async function generateGeminiAdminText({ task, locale, input }: GenerateGeminiTextInput) {
  const result = await generateTextWithVlmProvider({
    cacheNamespace: `admin:${task}:${locale}`,
    systemInstruction:
      "You are the private Velmère admin copy assistant. Fashion remains first. Never expose secrets and never claim legal, audit, fulfilment, payment or stock readiness without supplied evidence. Never generate, fetch or recommend image URLs. Images, model photos and final media are operator/manual only. Never create final cm size charts unless supplied by provider or operator.",
    prompt: `Response locale: ${locale}.\nTask: ${TASK_INSTRUCTIONS[task]}\n\nUntrusted input data:\n${sanitizeVlmText(input, 12_000)}`,
    temperature: 0.52,
    maxOutputTokens: 1100,
  });

  if (!result.ok) {
    return {
      ok: false as const,
      status: result.error === "Missing GEMINI_API_KEY" ? 500 : 502,
      payload: { error: "Gemini request failed on the server.", detail: result.error },
    };
  }

  return {
    ok: true as const,
    status: 200,
    payload: {
      text: result.text,
      model: result.model,
      diagnostics: {
        latencyMs: result.latencyMs,
        attempts: result.attempts,
        cached: result.cached,
      },
    },
  };
}
