import type { SquareComment, SquarePost } from "@/lib/square/types";
import { getDemoSquarePosts } from "@/lib/db/demo-square";
import { getSupabasePublicClient } from "@/lib/db/supabase";
import { resolveCustomerOwnedWriteBoundary, type CustomerOwnedWriteBoundaryDependencies } from "@/lib/db/customer-owned-write-boundary";

const POSTS_TABLE = "velmere_square_posts";
const COMMENTS_TABLE = "velmere_square_comments";

type CreatePostInput = {
  locale: string;
  title: string;
  body: string;
  authorName: string;
  authorHandle: string;
  imageUrl?: string;
  tags?: string[];
};

type CreateCommentInput = {
  postId: string;
  body: string;
  authorName: string;
};

type SquareRow = Record<string, unknown>;

function asSquareRow(value: unknown): SquareRow {
  return value && typeof value === "object" ? (value as SquareRow) : {};
}

function stringField(row: SquareRow, key: string, fallback = ""): string {
  const value = row[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

function optionalStringField(row: SquareRow, key: string): string | undefined {
  const value = row[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function numberField(row: SquareRow, key: string, fallback = 0): number {
  const value = row[key];
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(numeric) ? numeric : fallback;
}

function stringArrayField(row: SquareRow, key: string): string[] {
  const value = row[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function moderationStatusField(row: SquareRow): SquareComment["moderationStatus"] {
  const value = row.moderation_status ?? row.moderationStatus;
  return value === "draft" || value === "pending" || value === "approved" || value === "hidden" || value === "reported" ? value : "pending";
}

function authorTypeField(row: SquareRow): SquarePost["authorType"] {
  const value = row.author_type ?? row.authorType;
  return value === "official" || value === "community" || value === "moderator" ? value : "community";
}

function toPost(value: unknown): SquarePost {
  const row = asSquareRow(value);
  const id = stringField(row, "id", "square-post");
  const comments = row.comments;
  return {
    id,
    slug: stringField(row, "slug", id),
    authorName: stringField(row, "author_name", stringField(row, "authorName", "Velmère Member")),
    authorHandle: stringField(row, "author_handle", stringField(row, "authorHandle", "@member")),
    authorType: authorTypeField(row),
    locale: stringField(row, "locale", "en"),
    title: stringField(row, "title", "Velmère Square Signal"),
    body: stringField(row, "body"),
    imageUrl: optionalStringField(row, "image_url") ?? optionalStringField(row, "imageUrl"),
    tags: stringArrayField(row, "tags"),
    views: numberField(row, "views"),
    likes: numberField(row, "likes"),
    commentsCount: numberField(row, "comments_count", numberField(row, "commentsCount")),
    createdAt: stringField(row, "created_at_label", stringField(row, "createdAt", stringField(row, "created_at", "now"))),
    moderationStatus: moderationStatusField(row),
    comments: Array.isArray(comments) ? comments.map(toComment) : [],
  };
}

function toComment(value: unknown): SquareComment {
  const row = asSquareRow(value);
  return {
    id: stringField(row, "id", "square-comment"),
    authorName: stringField(row, "author_name", stringField(row, "authorName", "Velmère Member")),
    body: stringField(row, "body"),
    createdAt: stringField(row, "created_at_label", stringField(row, "createdAt", stringField(row, "created_at", "now"))),
    moderationStatus: moderationStatusField(row),
  };
}

export async function getSquarePosts(locale: string): Promise<{ posts: SquarePost[]; source: "supabase" | "demo_fallback" }> {
  const supabase = getSupabasePublicClient();
  if (!supabase) return { posts: getDemoSquarePosts(locale), source: "demo_fallback" };

  const { data, error } = await supabase
    .from(POSTS_TABLE)
    .select("*")
    .eq("locale", locale)
    .eq("moderation_status", "approved")
    .order("created_at", { ascending: false });

  if (error || !data) {
    return { posts: getDemoSquarePosts(locale), source: "demo_fallback" };
  }

  return { posts: data.map(toPost), source: "supabase" };
}

export async function getOwnSquarePosts(
  request: Request,
  accountId: string,
  locale: string,
  boundaryDependencies?: CustomerOwnedWriteBoundaryDependencies,
): Promise<{ posts: SquarePost[]; source: "user_rls"; rlsEnforced: true }> {
  const boundary = await resolveCustomerOwnedWriteBoundary(
    { request, accountId },
    boundaryDependencies,
  );
  const { data, error } = await boundary.client
    .from(POSTS_TABLE)
    .select("*")
    .eq("locale", locale)
    .eq("author_account_id", boundary.accountId)
    .order("created_at", { ascending: false });
  if (error || !data) throw new Error("square_owner_read_failed");
  return { posts: data.map(toPost), source: "user_rls", rlsEnforced: true };
}

export async function createSquarePost(
  request: Request,
  accountId: string,
  input: CreatePostInput,
  boundaryDependencies?: CustomerOwnedWriteBoundaryDependencies,
): Promise<{ post: SquarePost; source: "supabase"; rlsEnforced: true }> {
  const boundary = await resolveCustomerOwnedWriteBoundary(
    { request, accountId },
    boundaryDependencies,
  );
  const slug = `post-${Date.now()}`;

  const { data, error } = await boundary.client
    .from(POSTS_TABLE)
    .insert({
      slug,
      locale: input.locale,
      title: input.title,
      body: input.body,
      author_account_id: boundary.accountId,
      author_name: input.authorName,
      author_handle: input.authorHandle,
      author_type: "community",
      image_url: input.imageUrl ?? null,
      tags: input.tags ?? [],
      views: 1,
      likes: 0,
      comments_count: 0,
      moderation_status: "pending",
    })
    .select("*")
    .single();

  if (error || !data) throw new Error("square_post_write_failed");
  return { post: toPost(data), source: "supabase", rlsEnforced: true };
}

export async function createSquareComment(
  request: Request,
  accountId: string,
  input: CreateCommentInput,
  boundaryDependencies?: CustomerOwnedWriteBoundaryDependencies,
): Promise<{ comment: SquareComment; source: "supabase"; rlsEnforced: true }> {
  const boundary = await resolveCustomerOwnedWriteBoundary(
    { request, accountId },
    boundaryDependencies,
  );

  const { data, error } = await boundary.client
    .from(COMMENTS_TABLE)
    .insert({
      post_id: input.postId,
      author_account_id: boundary.accountId,
      author_name: input.authorName,
      body: input.body,
      moderation_status: "pending",
    })
    .select("*")
    .single();

  if (error || !data) throw new Error("square_comment_write_failed");
  return { comment: toComment(data), source: "supabase", rlsEnforced: true };
}
