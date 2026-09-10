/**
 * Commercial Honesty Standard & Blocker Registry
 * Section 31 Mandate from zadanie.txt:
 * 
 * Rules:
 * 1. If something is not available: write WHY, give BLOCKER code, propose FIX.
 * 2. NEVER use forbidden marketing placeholders:
 *    - "Coming soon"
 *    - "Enterprise only"
 *    - "Contact sales"
 * 3. ALWAYS use truthful, verifiable disclosures:
 *    - "Brak licencji providera X (potrzebna umowa komercyjna)"
 *    - "Brak niezależnego benchmarku (w trakcie weryfikacji)"
 *    - "Brak drugiego audytora (wymaga 2 niezależnych podpisów)"
 */

export type CommercialHonestyBlocker = {
  blockerCode: string;
  category: "licensing" | "verification" | "attestation" | "entitlement" | "supply_chain";
  whyPl: string;
  whyEn: string;
  whyDe: string;
  blockerDetailsPl: string;
  blockerDetailsEn: string;
  blockerDetailsDe: string;
  suggestedFixPl: string;
  suggestedFixEn: string;
  suggestedFixDe: string;
};

export const COMMERCIAL_HONESTY_BLOCKERS: Record<string, CommercialHonestyBlocker> = {
  MISSING_PROVIDER_LICENSE: {
    blockerCode: "MISSING_PROVIDER_LICENSE",
    category: "licensing",
    whyPl: "Brak licencji providera danych rynkowych (potrzebna umowa komercyjna)",
    whyEn: "Missing market data provider license (commercial contract required)",
    whyDe: "Fehlende Marktdatenanbieter-Lizenz (kommerzieller Vertrag erforderlich)",
    blockerDetailsPl: "Provider redystrybucji danych L2/L3 nie zezwala na publiczną redystrybucję bez dedykowanej licencji Enterprise Feed.",
    blockerDetailsEn: "L2/L3 market data redistribution provider prohibits public resale without dedicated Enterprise Feed license.",
    blockerDetailsDe: "L2/L3-Marktdatenanbieter verbietet Weiterverbreitung ohne dedizierte Enterprise-Feed-Lizenz.",
    suggestedFixPl: "Zawarcie umowy komercyjnej z providerem lub konfiguracja własnego klucza API (BYOK) w panelu ustawień.",
    suggestedFixEn: "Sign commercial redistribution contract with provider or configure Bring-Your-Own-Key (BYOK) in settings.",
    suggestedFixDe: "Kommerziellen Vertrag mit Anbieter abschließen oder eigenen API-Schlüssel (BYOK) in den Einstellungen hinterlegen.",
  },

  PENDING_INDEPENDENT_BENCHMARK: {
    blockerCode: "PENDING_INDEPENDENT_BENCHMARK",
    category: "verification",
    whyPl: "Brak niezależnego benchmarku (w trakcie weryfikacji)",
    whyEn: "Missing independent benchmark (verification in progress)",
    whyDe: "Fehlender unabhängiger Benchmark (Verifizierung läuft)",
    blockerDetailsPl: "Metodologia testowa nie uzyskała jeszcze 100% powtarzalności w 3 zewnętrznych środowiskach referencyjnych.",
    blockerDetailsEn: "Test methodology has not yet achieved 100% reproducibility across 3 external reference environments.",
    blockerDetailsDe: "Testmethodik hat noch keine 100% Reproduzierbarkeit in 3 externen Referenzumgebungen erreicht.",
    suggestedFixPl: "Zakończenie pełnego cyklu replikacji w środowisku testnet/mainnet-fork i publikacja skrótu kryptograficznego wyników.",
    suggestedFixEn: "Complete full replication cycle in testnet/mainnet-fork environment and publish cryptographic results digest.",
    suggestedFixDe: "Vollständigen Replikationszyklus in Testnet/Fork abschließen und kryptografischen Ergebnis-Digest veröffentlichen.",
  },

  MISSING_SECOND_AUDITOR: {
    blockerCode: "MISSING_SECOND_AUDITOR",
    category: "attestation",
    whyPl: "Brak drugiego audytora (wymaga 2 niezależnych podpisów)",
    whyEn: "Missing second auditor sign-off (requires 2 independent signatures)",
    whyDe: "Fehlende Freigabe des zweiten Prüfers (erfordert 2 unabhängige Unterschriften)",
    blockerDetailsPl: "Polityka jakości Velmère bezwzględnie wymaga 2 niezależnych podpisów audytorów bezpieczeństwa przed nadaniem statusu finalnego.",
    blockerDetailsEn: "Velmère quality policy strictly requires 2 independent auditor signatures before granting final attested status.",
    blockerDetailsDe: "Die Velmère-Qualitätsrichtlinie erfordert strikt 2 unabhängige Prüferunterschriften vor Erteilung des Endstatus.",
    suggestedFixPl: "Przekazanie raportu do drugiego certyfikowanego audytora w celu przeprowadzenia niezależnego peer-review i złożenia podpisu cyfrowego.",
    suggestedFixEn: "Route report to second certified auditor for independent peer-review and cryptographic signature.",
    suggestedFixDe: "Bericht an zweiten zertifizierten Prüfer für unabhängiges Peer-Review und kryptografische Signatur übergeben.",
  },

  SUPPLY_CHAIN_VERIFICATION: {
    blockerCode: "SUPPLY_CHAIN_VERIFICATION",
    category: "supply_chain",
    whyPl: "Wstrzymano: Weryfikacja łańcucha dostaw i certyfikacja laboratoryjna w toku",
    whyEn: "Paused: Supply chain verification and laboratory certification in progress",
    whyDe: "Angehalten: Lieferkettenprüfung und Laborzertifizierung im Gange",
    blockerDetailsPl: "Próbki tkanin i przędzy oczekują na certyfikat składu surowcowego od akredytowanego laboratorium włókienniczego.",
    blockerDetailsEn: "Textile and yarn samples are awaiting raw material composition certificate from accredited testing laboratory.",
    blockerDetailsDe: "Textilproben warten auf das Rohstoff-Zertifikat eines akkreditierten Prüflabors.",
    suggestedFixPl: "Otrzymanie protokołu z badań laboratoryjnych oraz wygenerowanie kryptograficznego Cyfrowego Paszportu Produktu (DPP).",
    suggestedFixEn: "Receive laboratory test certificate and mint cryptographic Digital Product Passport (DPP).",
    suggestedFixDe: "Laborzertifikat erhalten und kryptografischen digitalen Produktpass (DPP) ausstellen.",
  },

  TIER_ENTITLEMENT_BOUNDARY: {
    blockerCode: "TIER_ENTITLEMENT_BOUNDARY",
    category: "entitlement",
    whyPl: "Wymaga licencji wyższego pakietu (Pro / Advanced)",
    whyEn: "Requires higher tier entitlement (Pro / Advanced)",
    whyDe: "Erfordert höhere Berechtigung (Pro / Advanced)",
    blockerDetailsPl: "Ta funkcja operuje na dedykowanych zasobach obliczeniowych lub wymaga manualnego zaangażowania zespołu analityków.",
    blockerDetailsEn: "This capability requires dedicated compute cluster capacity or manual security analyst time allocation.",
    blockerDetailsDe: "Diese Funktion erfordert dedizierte Cluster-Rechenkapazität oder manuelle Analystenprüfung.",
    suggestedFixPl: "Aktywuj odpowiedni pakiet licencyjny w zakładce Subskrypcje lub skontaktuj się w celu weryfikacji uprawnień.",
    suggestedFixEn: "Activate matching entitlement in Account / Subscriptions or submit verification request.",
    suggestedFixDe: "Passendes Paket im Kontobereich aktivieren oder Verifizierungsanfrage einreichen.",
  },
};

export const FORBIDDEN_MARKETING_PHRASES = [
  "coming soon",
  "coming-soon",
  "enterprise only",
  "contact sales",
  "już wkrótce",
  "demnächst verfügbar",
] as const;

export function checkForbiddenPhrases(text: string): { found: boolean; matches: string[] } {
  const lower = text.toLowerCase();
  const matches = FORBIDDEN_MARKETING_PHRASES.filter((phrase) => lower.includes(phrase));
  return {
    found: matches.length > 0,
    matches,
  };
}

export function formatHonestBlocker(
  blockerKey: keyof typeof COMMERCIAL_HONESTY_BLOCKERS,
  locale: "pl" | "en" | "de" = "en"
): { why: string; blocker: string; fix: string } {
  const b = COMMERCIAL_HONESTY_BLOCKERS[blockerKey] || COMMERCIAL_HONESTY_BLOCKERS.MISSING_PROVIDER_LICENSE;
  if (locale === "pl") {
    return { why: b.whyPl, blocker: b.blockerDetailsPl, fix: b.suggestedFixPl };
  }
  if (locale === "de") {
    return { why: b.whyDe, blocker: b.blockerDetailsDe, fix: b.suggestedFixDe };
  }
  return { why: b.whyEn, blocker: b.blockerDetailsEn, fix: b.suggestedFixEn };
}
