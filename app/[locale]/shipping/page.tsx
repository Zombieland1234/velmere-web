import { getTranslations } from "next-intl/server";
import LegalDraftPage from "@/components/legal/LegalDraftPage";

export default async function ShippingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Legal.shipping" });

  return (
    <LegalDraftPage
      kicker={t("kicker")}
      title={t("title")}
      updated={t("updated")}
      draftNotice={t("draftNotice")}
      intro={t("intro")}
      sections={t.raw("sections")}
    />
  );
}
