"use client";

import { readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";
import { fetchWithCustomerAuth } from "@/lib/auth/customer-auth-fetch";

import useSWR from "swr";
import type { SquarePost } from "@/lib/square/types";

type SquarePostsResponse = {
  posts: SquarePost[];
  source: "supabase" | "user_rls" | "demo_fallback";
};

function jsonHeaders(): HeadersInit {
  return { "Content-Type": "application/json" };
}

const fetcher = async (url: string) => {
  const response = await fetchWithCustomerAuth(url, { cache: "no-store" }, { operation: "square_feed_read" });
  if (!response.ok) throw new Error("Unable to fetch Square posts");
  return readJsonResponseBounded<SquarePostsResponse>(response, 512 * 1024);
};

export function useSquarePosts(locale: string, fallbackPosts: SquarePost[]) {
  return useSWR<SquarePostsResponse>(`/api/square/posts?locale=${locale}`, fetcher, {
    fallbackData: { posts: fallbackPosts, source: "demo_fallback" },
    revalidateOnFocus: false,
    keepPreviousData: true,
  });
}

export async function createSquarePostRequest(input: {
  locale: string;
  title: string;
  body: string;
  authorName: string;
  authorHandle: string;
  imageUrl?: string;
  tags: string[];
}, options: { signal?: AbortSignal; requestId?: string } = {}) {
  const response = await fetchWithCustomerAuth("/api/square/posts", {
    method: "POST",
    headers: {
      ...jsonHeaders(),
      ...(options.requestId ? { "x-velmere-client-request-id": options.requestId } : {}),
    },
    body: JSON.stringify(input),
    signal: options.signal,
  }, { operation: "square_post_create" });

  if (!response.ok) throw new Error("Unable to publish Square post");
  return readJsonResponseBounded<{ post: SquarePost; source: "supabase" | "user_rls" | "demo_fallback" }>(response, 256 * 1024);
}
