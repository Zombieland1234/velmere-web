import { getSupabasePublicClient } from "@/lib/db/supabase";
import { resolveCustomerOwnedWriteBoundary, type CustomerOwnedWriteBoundaryDependencies } from "@/lib/db/customer-owned-write-boundary";

export type ProfileRecord = {
  displayName: string;
  handle: string;
  bio: string;
  lastNameChange: string;
};

const PROFILE_TABLE = "velmere_profiles";
const DEFAULT_PROFILE: ProfileRecord = {
  displayName: "Velmère Member",
  handle: "velmere.member",
  bio: "Spokojny profil dostępu dla dropów Velmère, archiwum i aktywności Square.",
  lastNameChange: "2026-05-01T00:00:00.000Z",
};

export async function getProfile(profileId?: string): Promise<{ profile: ProfileRecord; source: "supabase" | "demo_fallback" }> {
  const supabase = getSupabasePublicClient();
  if (!supabase || !profileId) return { profile: DEFAULT_PROFILE, source: "demo_fallback" };

  const { data, error } = await supabase
    .from(PROFILE_TABLE)
    .select("display_name, handle, bio, last_name_change")
    .eq("id", profileId)
    .maybeSingle();

  if (error || !data) return { profile: DEFAULT_PROFILE, source: "demo_fallback" };

  return {
    source: "supabase",
    profile: {
      displayName: data.display_name ?? DEFAULT_PROFILE.displayName,
      handle: data.handle ?? DEFAULT_PROFILE.handle,
      bio: data.bio ?? DEFAULT_PROFILE.bio,
      lastNameChange: data.last_name_change ?? DEFAULT_PROFILE.lastNameChange,
    },
  };
}

export async function getProfileForRequest(
  request: Request,
  profileId: string,
  boundaryDependencies?: CustomerOwnedWriteBoundaryDependencies,
): Promise<{ profile: ProfileRecord; source: "user_rls"; rlsEnforced: true }> {
  const boundary = await resolveCustomerOwnedWriteBoundary(
    { request, accountId: profileId },
    boundaryDependencies,
  );
  const { data, error } = await boundary.client
    .from(PROFILE_TABLE)
    .select("display_name, handle, bio, last_name_change")
    .eq("id", boundary.accountId)
    .maybeSingle();

  if (error) throw new Error("profile_read_failed");
  return {
    source: "user_rls",
    rlsEnforced: true,
    profile: data ? {
      displayName: data.display_name ?? DEFAULT_PROFILE.displayName,
      handle: data.handle ?? DEFAULT_PROFILE.handle,
      bio: data.bio ?? DEFAULT_PROFILE.bio,
      lastNameChange: data.last_name_change ?? DEFAULT_PROFILE.lastNameChange,
    } : DEFAULT_PROFILE,
  };
}

export async function updateProfile(
  request: Request,
  profileId: string,
  profile: ProfileRecord,
  boundaryDependencies?: CustomerOwnedWriteBoundaryDependencies,
): Promise<{ profile: ProfileRecord; source: "supabase"; rlsEnforced: true }> {
  const boundary = await resolveCustomerOwnedWriteBoundary(
    { request, accountId: profileId },
    boundaryDependencies,
  );

  const { data, error } = await boundary.client
    .from(PROFILE_TABLE)
    .upsert({
      id: boundary.accountId,
      display_name: profile.displayName,
      handle: profile.handle,
      bio: profile.bio,
      last_name_change: profile.lastNameChange,
    })
    .select("display_name, handle, bio, last_name_change")
    .single();

  if (error || !data) throw new Error("profile_write_failed");

  return {
    source: "supabase",
    rlsEnforced: true,
    profile: {
      displayName: data.display_name,
      handle: data.handle,
      bio: data.bio,
      lastNameChange: data.last_name_change,
    },
  };
}
