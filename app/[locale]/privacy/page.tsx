import { getTranslations } from "next-intl/server";
import LegalDraftPage from "@/components/legal/LegalDraftPage";

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Legal.privacy" });

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
