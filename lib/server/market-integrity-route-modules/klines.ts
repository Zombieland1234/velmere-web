import { handleKlineGet } from "@/lib/market-integrity/kline-route-handler";

export async function GET(request: Request) {
  return handleKlineGet(request);
}
