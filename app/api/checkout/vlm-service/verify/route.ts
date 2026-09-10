import {
  handleVlmServiceVerifyRequest,
} from "@/lib/server/vlm-service-verify-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return handleVlmServiceVerifyRequest(request);
}
