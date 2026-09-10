import type { Metadata } from "next";
import OrderAdminTimelineConsole from "@/components/admin/OrderAdminTimelineConsole";

export const metadata: Metadata = {
  title: "Velmère Admin · Order Timeline",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminOrdersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <OrderAdminTimelineConsole locale={locale} />;
}
