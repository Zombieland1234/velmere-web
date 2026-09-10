/**
 * Canonical identity of the byte renderer used by Lens preview, PDF replay and
 * account artifacts. Keep this value stable until a renderer change is
 * intentionally versioned and old artifacts have an explicit replay policy.
 */
export const PASS4823_LENS_PDF_RENDERER_ID =
  "pass4822-lens-canonical-customer-artifact-v1" as const;
