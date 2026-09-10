import CustomerSupportHandoffPacketPage from "@/components/security/CustomerSupportHandoffPacketPage";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { resolveRequestAccount } from "@/lib/auth/account-session";
import { buildPass2380CustomerSupportHandoffPacket } from "@/lib/security/customer-support-handoff-packet";
import { buildPass2381SupportHandoffEventLedger } from "@/lib/security/support-handoff-event-ledger";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ locale: string; receiptId: string }>;
};

async function resolveServerAccount() {
  const incoming = await headers();
  return resolveRequestAccount(new Request("http://velmere.local/support-handoff", { headers: incoming }));
}

function isProductionLike() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

export default async function SupportHandoffPage({ params }: PageProps) {
  const { locale, receiptId } = await params;
  const account = await resolveServerAccount();
  if (!account || (isProductionLike() && account.sessionSource === "preview")) notFound();
  const packet = await buildPass2380CustomerSupportHandoffPacket({ locale, receiptId, accountId: account.accountId });
  if (!packet.receiptId || packet.project.accountId !== account.accountId) notFound();
  const supportHandoffEventLedger = await buildPass2381SupportHandoffEventLedger({
    packet,
    eventType: "support_route_open",
    recordEvent: false,
    limit: 12,
  });
  return <CustomerSupportHandoffPacketPage packet={packet} supportHandoffEventLedger={supportHandoffEventLedger} />;
}
