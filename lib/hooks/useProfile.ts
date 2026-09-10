"use client";

import { readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";
import { fetchWithCustomerAuth } from "@/lib/auth/customer-auth-fetch";

import useSWR from "swr";
import type { ProfileRecord } from "@/lib/db/profile-service";

type ProfileResponse = {
  profile: ProfileRecord;
  source: "supabase" | "user_rls" | "demo_fallback" | "local-preview";
  account?: {
    accountId: string;
    displayName: string;
    handle: string;
    email?: string;
    provider?: string;
    passId?: string;
  } | null;
};

function jsonHeaders(): HeadersInit {
  return { "Content-Type": "application/json" };
}

const fetcher = async (url: string) => {
  const response = await fetchWithCustomerAuth(url, { cache: "no-store" }, { operation: "profile_read" });
  if (!response.ok) throw new Error("Unable to fetch profile");
  return readJsonResponseBounded<ProfileResponse>(response, 256 * 1024);
};

export function profileRequestKey(enabled: boolean): "/api/profile" | null {
  return enabled ? "/api/profile" : null;
}

export function useProfile(fallback: ProfileRecord, enabled = true) {
  return useSWR<ProfileResponse>(profileRequestKey(enabled), fetcher, {
    fallbackData: { profile: fallback, source: "demo_fallback", account: null },
    revalidateOnFocus: false,
  });
}

export async function updateProfileRequest(profile: ProfileRecord) {
  const response = await fetchWithCustomerAuth("/api/profile", {
    method: "PATCH",
    headers: jsonHeaders(),
    body: JSON.stringify(profile),
  }, { operation: "profile_update" });
  if (!response.ok) throw new Error("Unable to update profile");
  return readJsonResponseBounded<ProfileResponse>(response, 256 * 1024);
}
