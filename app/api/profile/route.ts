import { NextResponse } from "next/server";
import { assertSameOriginRequest as assertPass2177SameOriginRequest, rejectLargeContentLength as rejectPass2177LargeContentLength } from "@/lib/security/api-guard";
import { z } from "zod";
import { getProfile, getProfileForRequest, updateProfile } from "@/lib/db/profile-service";
import { getVelmereSession, rateLimit, requireVelmereSession } from "@/lib/api/request-guards";
import { appendPass2178MutationReceipt } from "@/lib/security/mutation-receipt-vault";
import { PASS2363_ACCOUNT_AUTH_SPINE_ID, accountPublicPayload, resolveRequestAccount } from "@/lib/auth/account-session";
import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";
import { CustomerOwnedWriteBoundaryError, customerOwnedWriteErrorPayload } from "@/lib/db/customer-owned-write-boundary";
import { isProductionLikeEnvironment, validateExactObjectKeys } from "@/lib/security/exact-request-boundary";

export const dynamic = "force-dynamic";

const profileSchema = z.object({
  displayName: z.string().trim().min(2).max(48).default("Velmère Member"),
  handle: z.string().trim().min(2).max(32).regex(/^[a-zA-Z0-9._-]+$/).default("velmere.member"),
  bio: z.string().trim().max(240).default(""),
  lastNameChange: z.string().datetime().optional(),
}).strict();

export async function GET(request: Request) {
  const session = await getVelmereSession(request);
  const account = await resolveRequestAccount(request);
  try {
    let result: { profile: import("@/lib/db/profile-service").ProfileRecord; source: string; rlsEnforced?: boolean };
    if (session?.id) {
      try {
        result = await getProfileForRequest(request, session.id);
      } catch (e) {
        if (e instanceof CustomerOwnedWriteBoundaryError && (e.code === "missing_token" || e.code === "invalid_token")) {
          const fallback = await getProfile();
          result = {
            profile: {
              ...fallback.profile,
              displayName: account?.displayName ?? fallback.profile.displayName,
              handle: account?.handle ?? fallback.profile.handle,
            },
            source: "demo_fallback",
          };
        } else {
          throw e;
        }
      }
    } else {
      result = await getProfile();
    }
    return NextResponse.json({
      ...result,
      account: account ? accountPublicPayload(account) : null,
      pass2363: {
        passId: PASS2363_ACCOUNT_AUTH_SPINE_ID,
        accountId: session?.id ?? null,
        boundary: session?.id ? "Profile read is owner-bound by caller JWT and RLS." : "No authenticated account; only fallback profile is returned.",
      },
    }, { headers: { "Cache-Control": "no-store", "Vary": "Cookie, Authorization", "x-velmere-pass2363-auth-spine": PASS2363_ACCOUNT_AUTH_SPINE_ID } });
  } catch (error) {
    if (error instanceof CustomerOwnedWriteBoundaryError) {
      return NextResponse.json(customerOwnedWriteErrorPayload(error), { status: error.httpStatus });
    }
    return NextResponse.json({ error: "PROFILE_READ_UNAVAILABLE", retryable: true }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const pass2177ProfileSizeGuard = rejectPass2177LargeContentLength(request, 64 * 1024);
  if (pass2177ProfileSizeGuard) return pass2177ProfileSizeGuard;

  const pass2177ProfileOriginGuard = assertPass2177SameOriginRequest(request, { allowMissingOrigin: !isProductionLikeEnvironment() });
  if (pass2177ProfileOriginGuard) return pass2177ProfileOriginGuard;

  try {
    const sessionGate = await requireVelmereSession(request);
    if (!sessionGate.session) return sessionGate.response;
    const session = sessionGate.session;

    const limited = await rateLimit(request, "profile", 10, 60_000);
    if (limited) return limited;

    const parsedBody = await readBoundedJsonBody<unknown>(request, 64 * 1024, { maxDepth: 8 });
    if (!parsedBody.ok) return parsedBody.response;
    const exactBody = validateExactObjectKeys(parsedBody.value, ["displayName", "handle", "bio", "lastNameChange"]);
    if (!exactBody.ok) return exactBody.response;
    const payload = profileSchema.parse(parsedBody.value);
    const result = await updateProfile(request, session.id, {
      displayName: payload.displayName,
      handle: payload.handle.replace(/^@/, "") || "velmere.member",
      bio: payload.bio,
      lastNameChange: payload.lastNameChange ?? new Date().toISOString(),
    });
    const mutationReceipt = await appendPass2178MutationReceipt({
      request,
      action: "profile_update",
      targetType: "member_profile",
      targetId: session.id,
      actorId: session.id,
      actorMode: "member",
      payload: { handleChanged: payload.handle !== session.handle, bioLength: payload.bio.length, lastNameChange: payload.lastNameChange ?? "generated" },
      safeSummary: "Member profile update wrote a redacted PASS2178 mutation receipt without storing profile text.",
    });
    const account = await resolveRequestAccount(request);
    return NextResponse.json({
      ...result,
      account: account ? accountPublicPayload(account) : null,
      pass2363: { passId: PASS2363_ACCOUNT_AUTH_SPINE_ID, accountId: session.id },
      mutationReceipt,
    });
  } catch (error: unknown) {
    if (error instanceof CustomerOwnedWriteBoundaryError) {
      return NextResponse.json(customerOwnedWriteErrorPayload(error), { status: error.httpStatus });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "VALIDATION_FAILED", issues: (error as { flatten: () => unknown }).flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "PROFILE_WRITE_UNAVAILABLE", retryable: true }, { status: 503 });
  }
}
