import { ASCII_CONTROL_PATTERN } from "./ascii-control-characters";

import type { SupabaseAuthFlowState } from "@/lib/auth/supabase-auth-flow-state";
import { validateExactSearchParams } from "@/lib/security/exact-request-boundary";

export const PASS36_A89_AUTH_CALLBACK_CONTRACT_ID = "velmere.pass36.a89.auth-callback-contract.v1" as const;

const CONTROL = ASCII_CONTROL_PATTERN;
const TOKEN_TYPES = new Set(["signup", "recovery", "email_change", "invite"]);

type ContractSuccess = {
  ok: true;
  mode: "code" | "otp" | "error";
  code: string | null;
  tokenHash: string | null;
  otpType: "signup" | "recovery" | "email_change" | "invite" | null;
  providerError: string | null;
};

type ContractFailure = {
  ok: false;
  code:
    | "callback_query_contract_invalid"
    | "callback_state_mismatch"
    | "callback_intent_mismatch"
    | "callback_locale_mismatch"
    | "callback_mode_confusion"
    | "callback_otp_type_mismatch"
    | "callback_value_invalid";
};

export type AuthCallbackContractResult = ContractSuccess | ContractFailure;

function cleanBounded(value: string | null, max: number) {
  if (!value || value.length > max || CONTROL.test(value)) return null;
  return value;
}

export function validateSupabaseAuthCallbackContract(
  request: Request,
  state: SupabaseAuthFlowState,
): AuthCallbackContractResult {
  const url = new URL(request.url);
  const exact = validateExactSearchParams(url, [
    "state",
    "intent",
    "locale",
    "code",
    "token_hash",
    "type",
    "error",
    "error_code",
    "error_description",
  ]);
  if (!exact.ok) return { ok: false, code: "callback_query_contract_invalid" };

  const stateParam = exact.values.state;
  const intentParam = exact.values.intent;
  const localeParam = exact.values.locale;
  if (stateParam !== state.nonce) return { ok: false, code: "callback_state_mismatch" };
  if (intentParam !== state.intent) return { ok: false, code: "callback_intent_mismatch" };
  if (localeParam !== state.locale) return { ok: false, code: "callback_locale_mismatch" };

  const code = cleanBounded(exact.values.code, 4096);
  const tokenHash = cleanBounded(exact.values.token_hash, 4096);
  const type = exact.values.type;
  const providerError = cleanBounded(exact.values.error, 160);
  const errorCode = cleanBounded(exact.values.error_code, 160);
  const errorDescription = cleanBounded(exact.values.error_description, 1024);
  if ((exact.values.code && !code) || (exact.values.token_hash && !tokenHash) || (exact.values.error && !providerError) || (exact.values.error_code && !errorCode) || (exact.values.error_description && !errorDescription)) {
    return { ok: false, code: "callback_value_invalid" };
  }

  const hasError = Boolean(providerError || errorCode || errorDescription);
  const hasCode = Boolean(code);
  const hasOtp = Boolean(tokenHash || type);
  const modes = Number(hasError) + Number(hasCode) + Number(hasOtp);
  if (modes !== 1) return { ok: false, code: "callback_mode_confusion" };

  if (hasError) {
    return { ok: true, mode: "error", code: null, tokenHash: null, otpType: null, providerError: providerError ?? errorCode ?? "provider_error" };
  }

  const codeIntent = state.intent === "google_oauth" || state.intent === "email_confirmation";
  if (code) {
    if (!codeIntent || tokenHash || type) return { ok: false, code: "callback_mode_confusion" };
    return { ok: true, mode: "code", code, tokenHash: null, otpType: null, providerError: null };
  }
  if (state.intent === "google_oauth") return { ok: false, code: "callback_mode_confusion" };

  if (!tokenHash || !type || !TOKEN_TYPES.has(type)) return { ok: false, code: "callback_mode_confusion" };
  const allowedType = state.intent === "password_recovery"
    ? type === "recovery"
    : state.intent === "email_change"
      ? type === "email_change"
      : state.intent === "email_confirmation"
        ? type === "signup" || type === "invite"
        : false;
  if (!allowedType) return { ok: false, code: "callback_otp_type_mismatch" };
  return {
    ok: true,
    mode: "otp",
    code: null,
    tokenHash,
    otpType: type as ContractSuccess["otpType"],
    providerError: null,
  };
}
