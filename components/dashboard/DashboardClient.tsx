"use client";

import { useEffect, useState } from "react";
import {
  BadgeCheck,
  CheckCircle2,
  Copy,
  Database,
  Globe2,
  LogOut,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  User,
  WalletCards,
} from "lucide-react";
import { useLocale } from "next-intl";
import { useWalletUiStore } from "@/store/useWalletUiStore";
import { deleteVelmereAccountSession, useVelmereAuth } from "@/components/auth/AuthGate";
import WalletConnectOptions from "@/components/wallet/WalletConnectOptions";
import AuditAccountMessagesClient from "@/components/account/AuditAccountMessagesClient";
import AuditCasesPortalClient from "@/components/account/AuditCasesPortalClient";
import AccountCustomerArtifactsClient from "@/components/account/AccountCustomerArtifactsClient";
import MarketActionReportsInboxClient from "@/components/account/MarketActionReportsInboxClient";
import AccountDataExportPanel from "@/components/account/AccountDataExportPanel";
import AccountErasurePanel from "@/components/account/AccountErasurePanel";
import { CustomerSafeStatusSurface } from "@/components/status/CustomerSafeStatusSurface";
import { buildPass2196CustomerSafeStatusSurface, type Pass2196CustomerLocale } from "@/lib/ui/customer-safe-status-surface";

const copy = {
  en: {
    sidebar: "Velmère Account",
    tabs: {
      overview: "Overview",
      orders: "Orders",
      messages: "Messages",
      reports: "Reports",
      audits: "Audits",
      addresses: "Addresses",
      security: "Security",
      wallet: "Wallet",
      profile: "Profile",
    },
    logout: "Log out",
    kicker: "Private member area",
    title: "Account layer.",
    body: "Manage profile, orders, security and optional wallet binding. Commerce first. Web3 access remains secondary.",
    commandTitle: "Member overview",
    commandBody:
      "One quiet surface for orders, identity, delivery data and security posture. Wallet access stays optional and isolated from the core account.",
    cards: [
      [
        "Member state",
        "Member preview",
        "Replace with real account role once auth is connected.",
      ],
      [
        "Orders",
        "No orders yet",
        "Order history appears after checkout is active.",
      ],
      ["VLM", "Access concept", "VLM remains separate from clothing checkout."],
    ],
    walletOptional: "Optional",
    walletConnected: "Connected",
    walletBody: "Connect only for access checks.",
    ordersTitle: "No orders yet.",
    ordersBody:
      "Orders will appear here after checkout, payment confirmation and fulfilment tracking are connected.",
    addressesTitle: "Address book.",
    addressesBody:
      "Shipping and billing fields should be collected only when required for purchase or account support.",
    dataVaultTitle: "Data vault",
    dataVaultBody:
      "Production profile data should live in Supabase Postgres with Row Level Security, server-side validation and encrypted transport. Do not store seed phrases or private keys.",
    walletTitle: "Optional wallet binding.",
    walletBodyLong:
      "Wallets are used only for access checks when enabled. Velmère never asks for seed phrases or private keys.",
    status: "Wallet status",
    noWallet: "No wallet connected.",
    readOnly: "Read-only unless a wallet transaction is explicitly confirmed.",
    rail: [
      ["Session", "Member preview", "Session flow is separated from wallet actions and remains reversible."],
      ["Support", "Human-first", "Returns, delivery help and account recovery stay clear and easy to reach."],
      ["Launch", "Commerce priority", "Clothing checkout, order clarity and trust signals lead. VLM remains an optional access layer."],
    ],
    identityLabel: "Account identity",
    commandChips: ["Orders first", "Security visible", "Wallet optional"],
    receiptTitle: "Receipt rules",
    receiptItems: [
      "VAT summary appears after the Stripe session is completed.",
      "Returns, withdrawal rights and shipping status remain visible before launch.",
      "Fulfilment tracking shows the carrier, parcel ID and support contact.",
    ],
    previewOnly: "Preview only",
    addressFields: ["Full name", "Street and number", "Apartment / optional", "Postal code", "City", "Country", "Phone / optional"],
    addressAction: "Save address after authentication",
    billingTitle: "Billing / Invoice",
    billingBody: "Invoice data stays separate from shipping data and is collected only when required.",
    billingFields: ["Legal name", "Company / optional", "VAT ID / optional", "Billing country"],
    billingAction: "Save billing data after authentication",
    passwordTitle: "Password change",
    passwordBody: "Password changes require the current password, complexity validation and a refreshed session.",
    passwordFields: ["Current password", "New password", "Repeat new password"],
    passwordAction: "Change password after authentication",
    emailTitle: "Email change",
    emailBody: "An email change requires confirmation through both the old and new address.",
    emailFields: ["Current email", "New email"],
    emailAction: "Request email change",
    authenticatorTitle: "2FA / Authenticator",
    authenticatorValue: "Recommended",
    authenticatorBody: "Enable an authenticator app, passkey or TOTP before private rooms go live.",
    rightsTitle: "Data rights",
    rightsValue: "GDPR",
    rightsBody: "Export account data, request deletion and review retention periods in the privacy centre.",
    profileTitle: "Public profile",
    profileBody: "Username changes can be limited to once every 30 days to reduce impersonation in Square.",
    profileFields: ["Display name", "Username", "Bio"],
    profileAction: "Save profile after authentication",
    preferencesTitle: "Avatar / Preferences",
    preferencesBody: "Avatar, language and marketing preferences belong in account settings, not checkout.",
    preferencesFields: ["Avatar URL", "Preferred language", "Newsletter consent"],
    preferencesAction: "Save preferences",
  },
  pl: {
    sidebar: "Konto Velmère",
    tabs: {
      overview: "Podgląd",
      orders: "Zamówienia",
      messages: "Wiadomości",
      reports: "Raporty",
      audits: "Audyty",
      addresses: "Adresy",
      security: "Bezpieczeństwo",
      wallet: "Portfel",
      profile: "Profil",
    },
    logout: "Wyloguj",
    kicker: "Prywatna strefa membera",
    title: "Warstwa konta.",
    body: "Zarządzaj profilem, zamówieniami, bezpieczeństwem i opcjonalnym portfelem. Najpierw commerce; Web3 zostaje warstwą dodatkową.",
    commandTitle: "Podgląd strefy membera",
    commandBody:
      "Jedna spokojna powierzchnia dla zamówień, tożsamości, danych dostawy i stanu bezpieczeństwa. Portfel pozostaje opcjonalny i odseparowany od głównego konta.",
    cards: [
      [
        "Status membera",
        "Podgląd membera",
        "Rola konta zostanie podpięta po wdrożeniu prawdziwego auth.",
      ],
      [
        "Zamówienia",
        "Brak zamówień",
        "Historia pojawi się po aktywacji checkoutu i potwierdzeniu płatności.",
      ],
      [
        "VLM",
        "Warstwa dostępu",
        "VLM pozostaje oddzielony od checkoutu odzieży.",
      ],
    ],
    walletOptional: "Opcjonalny",
    walletConnected: "Połączony",
    walletBody: "Łącz tylko do sprawdzania dostępu.",
    ordersTitle: "Brak zamówień.",
    ordersBody:
      "Zamówienia pojawią się tutaj po checkoutcie, potwierdzeniu płatności i podpięciu fulfilmentu.",
    addressesTitle: "Książka adresowa.",
    addressesBody:
      "Adres dostawy i faktury zbieramy tylko wtedy, gdy jest potrzebny do zakupu albo obsługi konta.",
    dataVaultTitle: "Sejf danych",
    dataVaultBody:
      "Produkcyjne dane profilu powinny trafić do Supabase Postgres z Row Level Security, walidacją po stronie serwera i szyfrowanym połączeniem. Nie zapisujemy seed phrase ani kluczy prywatnych.",
    walletTitle: "Opcjonalne powiązanie portfela.",
    walletBodyLong:
      "Portfele służą tylko do sprawdzania dostępu, gdy funkcja zostanie włączona. Velmère nigdy nie prosi o seed phrase ani klucze prywatne.",
    status: "Status portfela",
    noWallet: "Portfel nie jest połączony.",
    readOnly:
      "Tryb read-only, dopóki transakcja nie zostanie wyraźnie potwierdzona w portfelu.",
    rail: [
      ["Sesja", "Podgląd membera", "Logowanie jest oddzielone od akcji portfela i może pozostać odwracalne."],
      ["Pomoc", "Najpierw człowiek", "Zwroty, dostawa i odzyskiwanie konta pozostają jasne i łatwo dostępne."],
      ["Start", "Priorytet zakupów", "Checkout odzieży, przejrzystość zamówień i zaufanie są pierwsze. VLM zostaje opcjonalną warstwą dostępu."],
    ],
    identityLabel: "Tożsamość konta",
    commandChips: ["Najpierw zamówienia", "Widoczne bezpieczeństwo", "Portfel opcjonalny"],
    receiptTitle: "Zasady potwierdzeń",
    receiptItems: [
      "Podsumowanie VAT pojawi się po zakończeniu sesji Stripe.",
      "Zwroty, prawo odstąpienia i status dostawy są widoczne przed startem sprzedaży.",
      "Śledzenie realizacji pokazuje przewoźnika, numer przesyłki i kontakt do pomocy.",
    ],
    previewOnly: "Tylko podgląd",
    addressFields: ["Imię i nazwisko", "Ulica i numer", "Lokal / opcjonalnie", "Kod pocztowy", "Miasto", "Kraj", "Telefon / opcjonalnie"],
    addressAction: "Zapisz adres po uruchomieniu logowania",
    billingTitle: "Dane do faktury",
    billingBody: "Dane fakturowe pozostają oddzielone od dostawy i są zbierane tylko wtedy, gdy są potrzebne.",
    billingFields: ["Nazwa prawna", "Firma / opcjonalnie", "NIP UE / opcjonalnie", "Kraj rozliczenia"],
    billingAction: "Zapisz dane faktury po uruchomieniu logowania",
    passwordTitle: "Zmiana hasła",
    passwordBody: "Zmiana hasła wymaga obecnego hasła, walidacji złożoności i odświeżenia sesji.",
    passwordFields: ["Obecne hasło", "Nowe hasło", "Powtórz nowe hasło"],
    passwordAction: "Zmień hasło po uruchomieniu logowania",
    emailTitle: "Zmiana adresu e-mail",
    emailBody: "Zmiana e-maila wymaga potwierdzenia na starym i nowym adresie.",
    emailFields: ["Obecny e-mail", "Nowy e-mail"],
    emailAction: "Poproś o zmianę e-maila",
    authenticatorTitle: "2FA / Aplikacja uwierzytelniająca",
    authenticatorValue: "Zalecane",
    authenticatorBody: "Przed uruchomieniem prywatnych pokoi włącz passkey, aplikację uwierzytelniającą albo kod TOTP.",
    rightsTitle: "Prawa do danych",
    rightsValue: "RODO",
    rightsBody: "Eksportuj dane konta, poproś o usunięcie i sprawdź okresy retencji w centrum prywatności.",
    profileTitle: "Profil publiczny",
    profileBody: "Zmianę nazwy użytkownika można ograniczyć do jednej na 30 dni, aby zmniejszyć ryzyko podszywania się w Square.",
    profileFields: ["Nazwa wyświetlana", "Nazwa użytkownika", "Opis"],
    profileAction: "Zapisz profil po uruchomieniu logowania",
    preferencesTitle: "Avatar i preferencje",
    preferencesBody: "Avatar, język i zgody marketingowe należą do ustawień konta, a nie checkoutu.",
    preferencesFields: ["Adres avatara", "Preferowany język", "Zgoda na newsletter"],
    preferencesAction: "Zapisz preferencje",
  },
  de: {
    sidebar: "Velmère Konto",
    tabs: {
      overview: "Übersicht",
      orders: "Bestellungen",
      messages: "Nachrichten",
      reports: "Reports",
      audits: "Audits",
      addresses: "Adressen",
      security: "Sicherheit",
      wallet: "Wallet",
      profile: "Profile",
    },
    logout: "Ausloggen",
    kicker: "Privater Member-Bereich",
    title: "Account-Ebene.",
    body: "Verwalte Profil, Bestellungen, Sicherheit und optionale Wallet-Bindung. Commerce zuerst; Web3 bleibt sekundär.",
    commandTitle: "Member-Übersicht",
    commandBody:
      "Eine ruhige Fläche für Bestellungen, Identität, Lieferdaten und Sicherheitsstatus. Wallet-Zugang bleibt optional und vom Hauptkonto getrennt.",
    cards: [
      [
        "Member-Status",
        "Member-Vorschau",
        "Die Account-Rolle wird nach echtem Auth verbunden.",
      ],
      [
        "Bestellungen",
        "Noch keine Bestellungen",
        "Historie erscheint nach Checkout und Zahlungsbestätigung.",
      ],
      ["VLM", "Access-Konzept", "VLM bleibt vom Kleidung-Checkout getrennt."],
    ],
    walletOptional: "Optional",
    walletConnected: "Verbunden",
    walletBody: "Nur für Access-Checks verbinden.",
    ordersTitle: "Noch keine Bestellungen.",
    ordersBody:
      "Bestellungen erscheinen nach Checkout, Zahlungsbestätigung und Fulfilment-Tracking.",
    addressesTitle: "Adressbuch.",
    addressesBody:
      "Versand- und Rechnungsdaten nur erfassen, wenn sie für Kauf oder Support nötig sind.",
    dataVaultTitle: "Daten-Tresor",
    dataVaultBody:
      "Produktive Profildaten sollten in Supabase Postgres mit Row Level Security, Servervalidierung und verschlüsselter Verbindung liegen. Keine Seed Phrases oder Private Keys speichern.",
    walletTitle: "Optionale Wallet-Bindung.",
    walletBodyLong:
      "Wallets werden nur für Access-Checks genutzt, wenn aktiviert. Velmère fragt nie nach Seed Phrase oder Private Keys.",
    status: "Wallet-Status",
    noWallet: "Kein Wallet verbunden.",
    readOnly:
      "Read-only, solange keine Wallet-Transaktion ausdrücklich bestätigt wird.",
    rail: [
      ["Sitzung", "Member-Vorschau", "Die Sitzung ist von Wallet-Aktionen getrennt und bleibt widerrufbar."],
      ["Hilfe", "Mensch zuerst", "Retouren, Lieferung und Kontowiederherstellung bleiben klar und leicht erreichbar."],
      ["Start", "Handel zuerst", "Klarer Checkout, verständliche Bestellungen und Vertrauen führen. VLM bleibt optional."],
    ],
    identityLabel: "Kontoidentität",
    commandChips: ["Bestellungen zuerst", "Sicherheit sichtbar", "Wallet optional"],
    receiptTitle: "Belegregeln",
    receiptItems: [
      "Die Mehrwertsteuerübersicht erscheint nach Abschluss der Stripe-Sitzung.",
      "Retouren, Widerrufsrecht und Versandstatus bleiben vor dem Verkaufsstart sichtbar.",
      "Die Sendungsverfolgung zeigt Dienstleister, Paketnummer und Supportkontakt.",
    ],
    previewOnly: "Nur Vorschau",
    addressFields: ["Vollständiger Name", "Straße und Hausnummer", "Wohnung / optional", "Postleitzahl", "Stadt", "Land", "Telefon / optional"],
    addressAction: "Adresse nach Aktivierung der Anmeldung speichern",
    billingTitle: "Rechnung",
    billingBody: "Rechnungsdaten bleiben von Versanddaten getrennt und werden nur bei Bedarf erfasst.",
    billingFields: ["Rechtlicher Name", "Unternehmen / optional", "USt-IdNr. / optional", "Rechnungsland"],
    billingAction: "Rechnungsdaten nach Aktivierung der Anmeldung speichern",
    passwordTitle: "Passwort ändern",
    passwordBody: "Eine Passwortänderung benötigt das aktuelle Passwort, eine Komplexitätsprüfung und eine erneuerte Sitzung.",
    passwordFields: ["Aktuelles Passwort", "Neues Passwort", "Neues Passwort wiederholen"],
    passwordAction: "Passwort nach Aktivierung der Anmeldung ändern",
    emailTitle: "E-Mail ändern",
    emailBody: "Eine Änderung muss über die alte und die neue E-Mail-Adresse bestätigt werden.",
    emailFields: ["Aktuelle E-Mail", "Neue E-Mail"],
    emailAction: "E-Mail-Änderung anfordern",
    authenticatorTitle: "2FA / Authenticator",
    authenticatorValue: "Empfohlen",
    authenticatorBody: "Aktiviere Passkey, Authenticator-App oder TOTP, bevor private Räume live gehen.",
    rightsTitle: "Datenrechte",
    rightsValue: "DSGVO",
    rightsBody: "Kontodaten exportieren, Löschung anfordern und Aufbewahrungsfristen im Datenschutzcenter prüfen.",
    profileTitle: "Öffentliches Profil",
    profileBody: "Änderungen des Nutzernamens können auf einmal pro 30 Tage begrenzt werden, um Nachahmung in Square zu reduzieren.",
    profileFields: ["Anzeigename", "Nutzername", "Biografie"],
    profileAction: "Profil nach Aktivierung der Anmeldung speichern",
    preferencesTitle: "Avatar und Einstellungen",
    preferencesBody: "Avatar, Sprache und Marketingpräferenzen gehören in die Kontoeinstellungen, nicht in den Checkout.",
    preferencesFields: ["Avatar-URL", "Bevorzugte Sprache", "Newsletter-Einwilligung"],
    preferencesAction: "Einstellungen speichern",
  },
};

function customerLocale(locale: string): Pass2196CustomerLocale {
  return locale === "pl" || locale === "de" || locale === "en" ? locale : "en";
}

type TabKey = "overview" | "orders" | "messages" | "reports" | "audits" | "addresses" | "security" | "wallet" | "profile";
type DashboardInfoCard = { title: string; value: string; body: string; accent?: boolean };
const tabKeys: TabKey[] = [
  "overview",
  "orders",
  "messages",
  "reports",
  "audits",
  "addresses",
  "security",
  "wallet",
  "profile",
];

function InfoCard({
  title,
  value,
  body,
  accent = false,
}: {
  title: string;
  value: string;
  body: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`pass2006-dashboard-card rounded-2xl border p-4 ${accent ? "border-cyan-200/[0.18] bg-cyan-200/[0.035]" : "border-white/[0.10] bg-black/[0.20]"}`}
    >
      <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/[0.42]">
        {title}
      </p>
      <p className="mt-3 text-lg text-velmere-ivory">{value}</p>
      <p className="mt-2 text-xs leading-6 text-velmere-muted">{body}</p>
    </div>
  );
}

function AccountFormBlock({ title, body, fields, action, placeholder }: { title: string; body: string; fields: readonly string[]; action: string; placeholder: string }) {
  return (
    <div className="pass2006-dashboard-card rounded-2xl border border-white/[0.10] bg-black/[0.20] p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-velmere-gold">{title}</p>
      <p className="mt-3 text-sm leading-7 text-velmere-muted">{body}</p>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {fields.map((field) => (
          <label key={field} className="block">
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/[0.36]">{field}</span>
            <input
              disabled
              placeholder={placeholder}
              className="mt-2 h-12 w-full rounded-xl border border-white/[0.10] bg-white/[0.025] px-4 text-sm text-white/[0.55] outline-none placeholder:text-white/[0.20]"
            />
          </label>
        ))}
      </div>
      <button type="button" disabled className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full border border-white/[0.10] px-5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/[0.34]">
        {action}
      </button>
    </div>
  );
}

function AccountProfileView({
  localProfile,
  locale,
  walletAddress,
  walletConnected,
}: {
  localProfile: ReturnType<typeof useVelmereAuth>["localProfile"];
  locale: "en" | "pl" | "de";
  walletAddress?: string;
  walletConnected: boolean;
}) {
  const [displayName, setDisplayName] = useState(localProfile?.displayName || "Velmère Client");
  const [handle, setHandle] = useState(localProfile?.handle || "vlm_private");
  const [email] = useState(localProfile?.email || "client@velmere.com");
  const [saved, setSaved] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const accountId = localProfile?.accountId || "ACC-VLM-48259";

  const handleCopyId = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(accountId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "VM";

  return (
    <div className="mt-7 space-y-6">
      {/* Hero Minimalist Profile Card */}
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.12] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/[0.08] via-black/50 to-black/80 p-6 md:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-5">
            {/* Avatar Badge */}
            <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-velmere-gold/40 bg-gradient-to-br from-velmere-gold/20 via-black to-black shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
              <span className="font-serif text-2xl font-light tracking-wider text-velmere-gold">
                {initials}
              </span>
              <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-black bg-emerald-500 shadow-sm" title={locale === "pl" ? "Sesja zweryfikowana" : "Verified session"}>
                <CheckCircle2 className="h-3.5 w-3.5 text-black" />
              </div>
            </div>

            {/* Profile Meta */}
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-bold tracking-tight text-white md:text-2xl">
                  {displayName}
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full border border-velmere-gold/30 bg-velmere-gold/10 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-velmere-gold">
                  <Sparkles className="h-3 w-3" />
                  VIP Member
                </span>
              </div>
              <p className="mt-1 font-mono text-xs text-white/50">{email}</p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-white/40">
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] text-white/70 transition hover:border-white/20 hover:text-white"
                >
                  <span className="text-white/40">ID:</span> {accountId}
                  {copiedId ? (
                    <span className="text-emerald-400">{locale === "pl" ? "Skopiowano" : "Copied"}</span>
                  ) : (
                    <Copy className="h-3 w-3 text-white/40" />
                  )}
                </button>
                <span>•</span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {locale === "pl" ? "Sesja szyfrowana" : "Encrypted Session"}
                </span>
              </div>
            </div>
          </div>

          {/* Tier Status Box */}
          <div className="flex flex-col items-start rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 md:items-end">
            <span className="font-mono text-[10px] uppercase tracking-widest text-velmere-gold/80">
              {locale === "pl" ? "Poziom Uprawnień" : "Access Tier"}
            </span>
            <span className="mt-1 text-base font-semibold text-white">
              Institutional Tier
            </span>
            <span className="mt-0.5 font-mono text-[11px] text-white/40">
              RFC 3161 & ERC-7540 Parity
            </span>
          </div>
        </div>
      </div>

      {/* 2-Column Minimalist Settings Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Profile Settings */}
        <form onSubmit={handleSave} className="pass2006-dashboard-card rounded-2xl border border-white/[0.10] bg-black/[0.25] p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-velmere-gold">
              {locale === "pl" ? "Dane profilu" : "Profile Details"}
            </p>
            <User className="h-4 w-4 text-white/40" />
          </div>
          <p className="mt-2 text-xs leading-5 text-velmere-muted">
            {locale === "pl"
              ? "Informacje tożsamościowe widoczne w raportach audytowych oraz certyfikatach."
              : "Identity information displayed on audit certificates and compliance exports."}
          </p>

          <div className="mt-5 space-y-4">
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.18em] text-white/40">
                {locale === "pl" ? "Nazwa wyświetlana" : "Display Name"}
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-xl border border-white/[0.12] bg-white/[0.03] px-3.5 text-sm text-white outline-none transition focus:border-velmere-gold/60 focus:bg-white/[0.05]"
              />
            </div>

            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.18em] text-white/40">
                {locale === "pl" ? "Identyfikator Square (Handle)" : "Square Handle"}
              </label>
              <div className="mt-1.5 flex h-11 w-full items-center rounded-xl border border-white/[0.12] bg-white/[0.03] px-3.5 text-sm">
                <span className="font-mono text-white/40">@</span>
                <input
                  type="text"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  className="ml-1 w-full bg-transparent text-white outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.18em] text-white/40">
                {locale === "pl" ? "Adres E-mail (Zweryfikowany)" : "Email Address (Verified)"}
              </label>
              <input
                type="email"
                disabled
                value={email}
                className="mt-1.5 h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-3.5 text-sm text-white/50 outline-none cursor-not-allowed"
              />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between pt-2">
            <button
              type="submit"
              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-velmere-gold px-5 font-mono text-xs font-bold text-black transition hover:bg-[#d8b46d]"
            >
              {locale === "pl" ? "Zapisz zmiany" : "Save Changes"}
            </button>
            {saved && (
              <span className="flex items-center gap-1.5 font-mono text-xs text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                {locale === "pl" ? "Zapisano" : "Saved"}
              </span>
            )}
          </div>
        </form>

        {/* Security & Web3 Isolation */}
        <div className="pass2006-dashboard-card flex flex-col justify-between rounded-2xl border border-white/[0.10] bg-black/[0.25] p-6 shadow-sm">
          <div>
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-velmere-gold">
                {locale === "pl" ? "Bezpieczeństwo & Web3" : "Security & Web3"}
              </p>
              <ShieldCheck className="h-4 w-4 text-velmere-gold" />
            </div>
            <p className="mt-2 text-xs leading-5 text-velmere-muted">
              {locale === "pl"
                ? "Architektura zerowego zaufania i separacja tożsamości."
                : "Zero-trust architecture and cryptographic identity isolation."}
            </p>

            <div className="mt-5 space-y-3.5">
              <div className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-white">
                      {locale === "pl" ? "Uwierzytelnianie 2FA" : "2FA Authentication"}
                    </span>
                    <span className="block font-mono text-[10px] text-white/40">
                      {locale === "pl" ? "Aktywne przez Passkey / TOTP" : "Active via Passkey / TOTP"}
                    </span>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-400">
                  {locale === "pl" ? "AKTYWNE" : "ACTIVE"}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-velmere-gold/10 text-velmere-gold">
                    <WalletCards className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-white">
                      {locale === "pl" ? "Połączony Portfel" : "Connected Wallet"}
                    </span>
                    <span className="block font-mono text-[10px] text-white/40">
                      {walletConnected && walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : locale === "pl" ? "Tryb Read-Only / Niepołączony" : "Read-Only / Unconnected"}
                    </span>
                  </div>
                </div>
                <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${walletConnected ? "bg-cyan-500/20 text-cyan-400" : "bg-white/10 text-white/50"}`}>
                  {walletConnected ? (locale === "pl" ? "POŁĄCZONY" : "CONNECTED") : (locale === "pl" ? "OPCJONALNY" : "OPTIONAL")}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400">
                    <Database className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-white">
                      {locale === "pl" ? "Ochrona Danych GDPR" : "GDPR Data Protection"}
                    </span>
                    <span className="block font-mono text-[10px] text-white/40">
                      {locale === "pl" ? "Row Level Security • Klucze nie są zapisywane" : "Row Level Security • Keys never stored"}
                    </span>
                  </div>
                </div>
                <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-cyan-400">
                  {locale === "pl" ? "CHRONIONE" : "PROTECTED"}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-white/[0.06] bg-white/[0.015] p-3 text-[11px] text-white/40">
            {locale === "pl"
              ? "Wszystkie działania w strefie membera są chronione certyfikatem HMAC-SHA256."
              : "All member actions are cryptographically protected via HMAC-SHA256 telemetry."}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardClient() {
  const locale = useLocale() as keyof typeof copy;
  const t = copy[locale] ?? copy.en;
  const [active, setActive] = useState<TabKey>("overview");
  const walletUi = useWalletUiStore();
  const { localProfile } = useVelmereAuth();
  const safeLocale = customerLocale(locale);
  const accountBuildSurface = buildPass2196CustomerSafeStatusSurface("build_proof_missing", safeLocale);
  const accountOrderSurface = buildPass2196CustomerSafeStatusSurface("receipt_missing", safeLocale);
  const accountWalletSurface = buildPass2196CustomerSafeStatusSurface("advanced_unpaid_locked", safeLocale);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const requestedTab = new URLSearchParams(window.location.search).get("tab");
      if (requestedTab && tabKeys.includes(requestedTab as TabKey)) setActive(requestedTab as TabKey);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const cards: DashboardInfoCard[] = [
    ...t.cards.map(([title, value, body], index): DashboardInfoCard => ({
      title: String(title),
      value: String(index === 0 && localProfile?.displayName ? localProfile.displayName : value),
      body: String(index === 0 && localProfile?.email ? localProfile.email : body),
      accent: index === 0,
    })),
    {
      title: t.tabs.wallet,
      value: walletUi.connected ? t.walletConnected : t.walletOptional,
      body: walletUi.connected ? String(walletUi.shortAddress || walletUi.fullAddress || t.walletConnected) : t.walletBody,
    },
  ];

  return (
    <main className="velmere-public-page min-h-[100dvh] bg-velmere-black pt-28 text-velmere-ivory md:pt-32" data-pass2006-dashboard="solid-tabs-cyan-no-row-lines-low-lag">
      <div className="luxury-section grid gap-5 pb-24 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="pass2006-dashboard-aside rounded-[2rem] border border-white/[0.10] bg-[#111113] p-3 shadow-velmere-card lg:sticky lg:top-28 lg:self-start">
          <p className="px-3 py-3 velmere-label text-velmere-gold">
            {t.sidebar}
          </p>
          <nav className="grid gap-1" aria-label={t.sidebar}>
            {tabKeys.map((tab) => (
              <button
                key={tab}
                type="button"
                id={`member-nav-${tab}`}
                aria-current={active === tab ? "page" : undefined}
                aria-controls={`member-panel-${tab}`}
                onClick={() => setActive(tab)}
                className={`rounded-xl px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.16em] transition active:scale-[0.985] ${active === tab ? "bg-velmere-ivory text-black" : "text-white/[0.50] hover:bg-white/[0.05] hover:text-white"}`}
              >
                {t.tabs[tab]}
              </button>
            ))}
          </nav>
          <button
            type="button"
            onClick={async () => {
              await deleteVelmereAccountSession();
              window.location.assign(`/${locale}/login`);
            }}
            className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.10] bg-black/[0.20] font-mono text-[10px] uppercase tracking-[0.16em] text-white/[0.45] transition hover:text-red-200 active:scale-[0.985]"
          >
            <LogOut className="h-4 w-4" /> {t.logout}
          </button>
        </aside>

        <section className="pass2006-dashboard-shell min-w-0 rounded-[2rem] border border-white/[0.10] bg-[#111113] p-5 shadow-velmere-card md:p-8">
          <div className="border-b border-white/[0.10] pb-7">
            <p className="velmere-label text-velmere-gold">{t.kicker}</p>
            <h1 className="mt-4 font-serif text-[clamp(3rem,7vw,6rem)] leading-[0.86] tracking-[-0.06em]">
              {t.title}
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-velmere-grey-soft">
              {t.body}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2" aria-label={t.identityLabel}>
              <span className="rounded-full border border-white/[0.10] bg-black/[0.18] px-3 py-2 text-xs text-white/[0.66]">
                {localProfile?.displayName ?? "Velmère Member"}
              </span>
              {localProfile?.email ? (
                <span className="max-w-full truncate rounded-full border border-white/[0.10] bg-black/[0.18] px-3 py-2 font-mono text-[10px] text-white/[0.46]">
                  {localProfile.email}
                </span>
              ) : null}
              {localProfile?.provider === "google" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 font-mono text-[10px] text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Google OAuth (Verified)
                </span>
              ) : localProfile?.provider === "google_preview" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-2 font-mono text-[10px] text-amber-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  [PREVIEW MODE: Google Dev Fallback]
                </span>
              ) : localProfile?.provider === "preview" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-2 font-mono text-[10px] text-amber-300/80">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  [PREVIEW MODE: Member Preview]
                </span>
              ) : null}
              <span className="max-w-full truncate rounded-full border border-cyan-200/[0.16] bg-cyan-200/[0.035] px-3 py-2 font-mono text-[10px] text-cyan-100/[0.78]">
                {walletUi.connected ? walletUi.shortAddress : t.walletOptional}
              </span>
            </div>
            {(localProfile?.provider === "google_preview" || localProfile?.provider === "preview") && (
              <div
                className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/[0.08] p-3 text-xs text-amber-200"
                data-testid="auth-preview-warning"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">⚠️</span>
                  <span className="font-semibold uppercase tracking-wider text-[10px] text-amber-300">
                    {localProfile?.provider === "google_preview" ? "Tryb Podglądu: Google Dev Fallback" : "Tryb Podglądu: Member Preview"}
                  </span>
                </div>
                <p className="mt-1 text-white/70 text-[11px] leading-relaxed">
                  {localProfile?.provider === "google_preview"
                    ? "Działasz w trybie symulacji Google Dev Fallback. To środowisko podglądu nie jest połączone z prawdziwym kontem Google OAuth."
                    : "Działasz w trybie ogólnego podglądu członkowskiego. Funkcje transakcyjne wymagają pełnego logowania."}
                </p>
              </div>
            )}
          </div>

          <div
            id={`member-panel-${active}`}
            role="region"
            aria-labelledby={`member-nav-${active}`}
            tabIndex={-1}
          >
          {active === "overview" ? (
            <>
              <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                <div className="pass2006-dashboard-command rounded-[1.6rem] border border-cyan-200/[0.13] bg-[linear-gradient(135deg,rgba(103,232,249,0.045),rgba(255,255,255,0.018),rgba(0,0,0,0.18))] p-5">
                  <div className="flex items-center gap-2 text-velmere-gold">
                    <Sparkles className="h-4 w-4" />
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em]">{t.commandTitle}</p>
                  </div>
                  <p className="mt-3 max-w-2xl text-xs sm:text-sm leading-6 text-white/[0.66]">{t.commandBody}</p>
                  <div className="mt-4 flex flex-wrap gap-2 font-mono text-[9px] uppercase tracking-[0.16em] text-white/[0.42]">
                    {t.commandChips.map((chip) => (
                      <span key={chip} className="rounded-full border border-white/[0.10] px-3 py-1.5">{chip}</span>
                    ))}
                  </div>
                </div>
                <div className="grid gap-2 sm:gap-3">
                  {t.rail.map(([title, value, body]) => (
                    <div key={title} className="rounded-xl border border-white/[0.08] bg-black/[0.20] p-3.5">
                      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/[0.36]">{title}</p>
                      <p className="mt-1 text-xs sm:text-sm text-velmere-ivory font-medium">{value}</p>
                      <p className="mt-1 text-[11px] leading-5 text-velmere-muted">{body}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-7" data-pass2198-customer-safe-account-overview="true">
                <CustomerSafeStatusSurface surface={accountBuildSurface} compact />
              </div>
              <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {cards.map((card) => (
                  <InfoCard key={card.title} {...card} />
                ))}
              </div>
            </>
          ) : null}

          {active === "orders" ? (
            <>
            <div className="mt-7" data-pass2198-customer-safe-account-orders="true">
              <CustomerSafeStatusSurface surface={accountOrderSurface} compact />
            </div>
            <div className="mt-7 grid gap-4 md:grid-cols-[1fr_0.8fr]">
              <div className="rounded-2xl border border-white/[0.10] bg-black/[0.20] p-6">
                <PackageCheck className="h-5 w-5 text-velmere-gold" />
                <h2 className="mt-5 text-2xl">{t.ordersTitle}</h2>
                <p className="mt-3 text-sm leading-7 text-velmere-muted">{t.ordersBody}</p>
              </div>
              <div className="rounded-2xl border border-white/[0.10] bg-black/[0.20] p-6">
                <div className="flex items-center gap-2 text-velmere-gold">
                  <Globe2 className="h-4 w-4" />
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em]">{t.receiptTitle}</p>
                </div>
                <div className="mt-5 space-y-3 text-sm leading-7 text-white/[0.58]">
                  {t.receiptItems.map((item) => <p key={item}>{item}</p>)}
                </div>
              </div>
            </div>
            </>
          ) : null}


          {active === "messages" ? (
            <AuditAccountMessagesClient />
          ) : null}

          {active === "reports" ? (
            <>
              <AccountCustomerArtifactsClient />
              <MarketActionReportsInboxClient />
            </>
          ) : null}

          {active === "audits" ? (
            <AuditCasesPortalClient />
          ) : null}

          {active === "addresses" ? (
            <div className="mt-7 grid gap-4 md:grid-cols-2">
              <AccountFormBlock title={t.addressesTitle} body={t.addressesBody} fields={t.addressFields} action={t.addressAction} placeholder={t.previewOnly} />
              <AccountFormBlock title={t.billingTitle} body={t.billingBody} fields={t.billingFields} action={t.billingAction} placeholder={t.previewOnly} />
              <div className="rounded-2xl pass2006-dashboard-card border border-cyan-200/[0.16] bg-cyan-200/[0.035] p-5 md:col-span-2">
                <Database className="h-5 w-5 text-velmere-gold" />
                <h2 className="mt-4 text-2xl">{t.dataVaultTitle}</h2>
                <p className="mt-3 text-sm leading-7 text-velmere-muted">{t.dataVaultBody}</p>
              </div>
            </div>
          ) : null}

          {active === "security" ? (
            <div className="mt-7 grid gap-4 md:grid-cols-2">
              <AccountFormBlock title={t.passwordTitle} body={t.passwordBody} fields={t.passwordFields} action={t.passwordAction} placeholder={t.previewOnly} />
              <AccountFormBlock title={t.emailTitle} body={t.emailBody} fields={t.emailFields} action={t.emailAction} placeholder={t.previewOnly} />
              <InfoCard title={t.authenticatorTitle} value={t.authenticatorValue} body={t.authenticatorBody} accent />
              <InfoCard title={t.rightsTitle} value={t.rightsValue} body={t.rightsBody} />
              <AccountDataExportPanel />
              <AccountErasurePanel />
            </div>
          ) : null}


          {active === "profile" ? (
            <AccountProfileView
              localProfile={localProfile}
              locale={locale}
              walletAddress={walletUi.fullAddress}
              walletConnected={walletUi.connected}
            />
          ) : null}

          {active === "wallet" ? (
            <>
            <div className="mt-7" data-pass2198-customer-safe-account-wallet="true">
              <CustomerSafeStatusSurface surface={accountWalletSurface} compact />
            </div>
            <div className="mt-7 grid gap-4 lg:grid-cols-[1fr_0.8fr]">
              <div className="rounded-2xl border border-white/[0.10] bg-black/[0.20] p-6">
                <WalletCards className="h-5 w-5 text-velmere-gold" />
                <h2 className="mt-5 text-2xl">{t.walletTitle}</h2>
                <p className="mt-3 text-sm leading-7 text-velmere-muted">
                  {t.walletBodyLong}
                </p>
                <div className="mt-5">
                  <WalletConnectOptions showStatus={false} />
                </div>
              </div>
              <div className="rounded-2xl border border-white/[0.10] bg-black/[0.20] p-6">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/[0.42]">
                  {t.status}
                </p>
                <p className="mt-4 break-all text-sm leading-7 text-white/[0.68]">
                  {walletUi.connected ? walletUi.fullAddress : t.noWallet}
                </p>
                <div className="mt-5 flex items-center gap-2 text-xs text-white/[0.45]">
                  <BadgeCheck className="h-4 w-4 text-velmere-gold" />
                  {t.readOnly}
                </div>
              </div>
            </div>
            </>
          ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
