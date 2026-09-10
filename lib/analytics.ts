export type VelmereAnalyticsEvent =
  | "clothing_view"
  | "filter_use"
  | "product_view"
  | "size_select"
  | "add_to_cart"
  | "checkout_start"
  | "wallet_connect"
  | "waitlist_submit"
  | "purchase_complete";

type AnalyticsPayload = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    va?: (eventName: string, payload?: AnalyticsPayload) => void;
  }
}

export function trackVelmereEvent(eventName: VelmereAnalyticsEvent, payload: AnalyticsPayload = {}) {
  if (typeof window === "undefined") return;

  const detail = {
    eventName,
    payload,
    timestamp: new Date().toISOString(),
  };

  window.dispatchEvent(new CustomEvent("velmere:analytics", { detail }));

  if (typeof window.va === "function") {
    window.va(eventName, payload);
  }
}
