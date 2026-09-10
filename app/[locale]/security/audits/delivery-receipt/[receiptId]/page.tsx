import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import DeliveryReceiptPacketPage from "@/components/security/DeliveryReceiptPacketPage";
import { resolveRequestAccount } from "@/lib/auth/account-session";
import { buildPass2378DeliveryReceiptPacket } from "@/lib/security/delivery-receipt-packet";
import { buildPass2379ReceiptRouteHealthFromPacket } from "@/lib/security/receipt-route-health";

async function resolveServerAccount() {
  const incoming = await headers();
  return resolveRequestAccount(new Request("http://velmere.local/delivery-receipt", { headers: incoming }));
}

function isProductionLike() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; receiptId: string }> }): Promise<Metadata> {
  const { locale, receiptId } = await params;
  const account = await resolveServerAccount();
  const packet = account
    ? await buildPass2378DeliveryReceiptPacket({ locale, receiptId, accountId: account.accountId })
    : null;
  if (!packet?.receipt) return { title: "Velmère account receipt", robots: { index: false, follow: false } };
  return {
    title: `${packet.status === "ready" ? "Delivery receipt" : "Receipt pending"} · Velmère`,
    description: "Customer-safe Velmère delivery receipt route with immutable receipt id, checksum and redacted delivery-gate snapshot.",
    robots: { index: false, follow: false },
  };
}

export default async function Page({ params }: { params: Promise<{ locale: string; receiptId: string }> }) {
  const { locale, receiptId } = await params;
  const account = await resolveServerAccount();
  if (!account || (isProductionLike() && account.sessionSource === "preview")) notFound();
  const packet = await buildPass2378DeliveryReceiptPacket({ locale, receiptId, accountId: account.accountId });
  if (!packet.receipt || packet.project.accountId !== account.accountId) notFound();
  const receiptRouteHealth = buildPass2379ReceiptRouteHealthFromPacket(packet);
  return <DeliveryReceiptPacketPage packet={packet} receiptRouteHealth={receiptRouteHealth} />;
}
