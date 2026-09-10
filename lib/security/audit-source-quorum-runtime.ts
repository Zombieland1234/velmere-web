import type { AuditReviewSubmission } from "./audit-review-flow";
import { buildPass2569AuditSourceSpine, type Pass2569AuditTier } from "./audit-source-spine";

export const PASS2570_AUDIT_SOURCE_QUORUM_RUNTIME_ID = "audit-source-quorum-runtime" as const;

export type Pass2570SourceState = "confirmed" | "partial" | "missing" | "not_run" | "blocked";
export type Pass2570AuditSourceQuorumLane = {
  id: string;
  label: string;
  family: string;
  tier: Pass2569AuditTier[];
  state: Pass2570SourceState;
  confidence: number;
  basicValue: string;
  proValue: string;
  advancedValue: string;
  evidence: string[];
  missing: string[];
  claimRule: string;
};

export type Pass2570AuditSourceQuorumReport = {
  passId: typeof PASS2570_AUDIT_SOURCE_QUORUM_RUNTIME_ID;
  generatedAt: string;
  locale: string;
  target: {
    projectName?: string;
    contractAddress?: string;
    chain: string;
    auditUrl?: string;
    docsUrl?: string;
    githubUrl?: string;
    website?: string;
    contactEmail?: string;
  };
  productRule: string;
  quorumRule: string;
  overall: {
    riskLabel: "Low" | "Medium" | "High" | "Unknown";
    riskScore: number | null;
    reviewPriorityScore: number;
    confidenceCap: number;
    confirmedSources: number;
    partialSources: number;
    missingSources: number;
    notRunSources: number;
    blockedSources: number;
  };
  basicChecks: Array<{ id: string; label: string; status: string; state: Pass2570SourceState }>;
  lanes: Pass2570AuditSourceQuorumLane[];
  missingEvidence: string[];
  proPdfSections: string[];
  advancedSections: string[];
  adapterBacklog: string[];
  safetyBoundaries: string[];
};

function clean(value: unknown, max = 180) {
  if (typeof value !== "string") return undefined;
  const text = value.replace(/[<>\r\n]/g, " ").trim();
  return text ? text.slice(0, max) : undefined;
}

function looksLikeEvmAddress(value?: string) {
  return Boolean(value && /^0x[a-fA-F0-9]{40}$/.test(value.trim()));
}

function t(locale: string, pl: string, de: string, en: string) {
  return locale === "pl" ? pl : locale === "de" ? de : en;
}

function stateWeight(state: Pass2570SourceState) {
  if (state === "confirmed") return 1;
  if (state === "partial") return 0.58;
  if (state === "not_run") return 0.22;
  if (state === "blocked") return 0.12;
  return 0;
}

function countByState(lanes: Pass2570AuditSourceQuorumLane[], state: Pass2570SourceState) {
  return lanes.filter((lane) => lane.state === state).length;
}

function reviewPriorityFromCoverage(args: { confirmed: number; partial: number; missing: number; notRun: number; blocked: number; hasContract: boolean }) {
  const targetPressure = args.hasContract ? 12 : 22;
  const missingPressure = args.missing * 9 + args.notRun * 5 + args.blocked * 7;
  const evidenceCredit = args.confirmed * 5 + args.partial * 2;
  return Math.max(0, Math.min(100, targetPressure + missingPressure - evidenceCredit));
}

function confidenceFromLanes(lanes: Pass2570AuditSourceQuorumLane[]) {
  if (!lanes.length) return 28;
  const weighted = lanes.reduce((sum, lane) => sum + stateWeight(lane.state), 0) / lanes.length;
  const laneConfidence = lanes.reduce((sum, lane) => sum + lane.confidence, 0) / lanes.length;
  return Math.max(18, Math.min(94, Math.round(weighted * 68 + laneConfidence * 0.28)));
}

function riskLabel(score: number | null): Pass2570AuditSourceQuorumReport["overall"]["riskLabel"] {
  if (score === null) return "Unknown";
  if (score >= 72) return "High";
  if (score >= 48) return "Medium";
  if (score >= 20) return "Low";
  return "Unknown";
}

export function buildPass2570AuditSourceQuorumReport(input: Partial<AuditReviewSubmission> & { locale?: string }): Pass2570AuditSourceQuorumReport {
  const locale = input.locale === "pl" || input.locale === "de" || input.locale === "en" ? input.locale : "en";
  const chain = clean(input.chain, 40) ?? "ethereum";
  const contractAddress = clean(input.contractAddress, 96);
  const projectName = clean(input.projectName, 90);
  const auditUrl = clean(input.auditUrl, 260);
  const docsUrl = clean(input.docsUrl, 260);
  const githubUrl = clean(input.githubUrl, 260);
  const website = clean(input.website, 260);
  const contactEmail = clean(input.contactEmail, 120);
  const hasContract = looksLikeEvmAddress(contractAddress);
  const hasAnyTarget = Boolean(hasContract || projectName || auditUrl || website);
  const hasDocs = Boolean(docsUrl || githubUrl || website);
  const hasPublicAudit = Boolean(auditUrl);
  const spine = buildPass2569AuditSourceSpine(locale);
  const byId = new Map(spine.lanes.map((lane) => [lane.id, lane]));

  const lane = (id: string, state: Pass2570SourceState, confidence: number, evidence: string[], missing: string[], basicValue: string, proValue: string, advancedValue: string): Pass2570AuditSourceQuorumLane => {
    const base = byId.get(id);
    return {
      id,
      label: base?.label ?? id,
      family: base?.sourceFamily ?? "Velmere source lane",
      tier: base?.tier ?? ["basic", "pro", "advanced"],
      state,
      confidence,
      basicValue,
      proValue,
      advancedValue,
      evidence,
      missing,
      claimRule: base?.claimRule ?? "Do not claim certainty without source evidence.",
    };
  };

  const lanes: Pass2570AuditSourceQuorumLane[] = [
    lane(
      "explorer-source-code",
      hasContract ? "partial" : "missing",
      hasContract ? 58 : 18,
      hasContract ? [t(locale, "Adres kontraktu gotowy do explorer/source adaptera.", "Contract Adresse bereit fuer Explorer/Source Adapter.", "Contract address ready for explorer/source adapter.")] : [],
      hasContract ? [t(locale, "Live explorer/source jeszcze nie potwierdził verified source w tym Basic runtime.", "Live Explorer/Source hat verified source in diesem Basic Runtime noch nicht bestaetigt.", "Live explorer/source has not confirmed verified source in this Basic runtime yet.")] : [t(locale, "Brak poprawnego adresu kontraktu.", "Keine gueltige Contract Adresse.", "Missing valid contract address.")],
      hasContract ? t(locale, "kontrakt rozpoznany; source do potwierdzenia", "Contract erkannt; Source zu bestaetigen", "contract recognized; source pending") : t(locale, "brak kontraktu", "Contract fehlt", "contract missing"),
      t(locale, "pełny explorer/source + ABI parser", "voller Explorer/Source + ABI Parser", "full explorer/source + ABI parser"),
      t(locale, "automatyczny source/bytecode/proxy cross-check + retest", "Automatischer Source/Bytecode/Proxy-Cross-Check + Retest", "automated source/bytecode/proxy cross-check + retest"),
    ),
    lane(
      "token-market-metadata",
      hasAnyTarget ? "partial" : "missing",
      hasAnyTarget ? 46 : 18,
      hasAnyTarget ? [t(locale, "Target gotowy do CoinGecko/market metadata matching.", "Target bereit fuer CoinGecko/Market Metadata Matching.", "Target ready for CoinGecko/market metadata matching.")] : [],
      hasAnyTarget ? [t(locale, "Market metadata wymaga live adaptera i drugiego źródła.", "Market Metadata braucht Live Adapter und zweite Quelle.", "Market metadata needs live adapter and second source.")] : [t(locale, "Brak targetu do market metadata.", "Kein Target fuer Market Metadata.", "No target for market metadata.")],
      hasAnyTarget ? t(locale, "identity lane częściowy", "Identity Lane teilweise", "identity lane partial") : t(locale, "brak danych", "fehlende Daten", "missing"),
      t(locale, "supply/market/links cross-check", "Supply/Market/Links Cross-check", "supply/market/links cross-check"),
      t(locale, "automatyczne dopasowanie projektu z konfliktem i provenance", "Automatisches Projekt-Matching mit Konflikt und Provenienz", "automated project matching with conflict and provenance handling"),
    ),
    lane(
      "dex-liquidity-pairs",
      hasContract ? "partial" : "missing",
      hasContract ? 42 : 18,
      hasContract ? [t(locale, "Kontrakt gotowy do DEX pair discovery.", "Contract bereit fuer DEX Pair Discovery.", "Contract ready for DEX pair discovery.")] : [],
      hasContract ? [t(locale, "Liquidity lock niepotwierdzony bez live DEX/lock źródeł.", "Liquidity Lock ohne Live DEX/Lock Quellen nicht bestaetigt.", "Liquidity lock unconfirmed without live DEX/lock sources.")] : [t(locale, "Brak kontraktu do liquidity lookup.", "Kein Contract fuer Liquidity Lookup.", "Missing contract for liquidity lookup.")],
      hasContract ? t(locale, "liquidity widoczność do sprawdzenia", "Liquidity Sichtbarkeit zu pruefen", "liquidity visibility pending") : t(locale, "brak danych", "fehlende Daten", "missing"),
      t(locale, "DEX pairs, depth, age, venue risk", "DEX Pairs, Tiefe, Alter, Venue Risk", "DEX pairs, depth, age, venue risk"),
      t(locale, "automatyczny lock/liquidity change cross-check i scenariusze", "Automatischer Lock/Liquidity-Change-Cross-Check und Szenarien", "automated lock/liquidity-change cross-check and scenarios"),
    ),
    lane(
      "security-signal-apis",
      hasContract ? "partial" : "missing",
      hasContract ? 44 : 18,
      hasContract ? [t(locale, "Kontrakt gotowy do GoPlus/Honeypot-style passive checks.", "Contract bereit fuer GoPlus/Honeypot-style passive Checks.", "Contract ready for GoPlus/Honeypot-style passive checks.")] : [],
      hasContract ? [t(locale, "Tax/honeypot/blacklist flags wymagają providerów live.", "Tax/Honeypot/Blacklist Flags brauchen Live Provider.", "Tax/honeypot/blacklist flags need live providers.")] : [t(locale, "Brak kontraktu do security API.", "Kein Contract fuer Security API.", "Missing contract for security API.")],
      hasContract ? t(locale, "quick flags do odpalenia", "Quick Flags ausstehend", "quick flags pending") : t(locale, "brak danych", "fehlende Daten", "missing"),
      t(locale, "cross-source security flags", "Cross-source Security Flags", "cross-source security flags"),
      t(locale, "automatyczna adjudykacja flag z konfliktem i confidence", "Automatisierte Flag-Adjudikation mit Konflikt und Konfidenz", "automated flag adjudication with conflict and confidence"),
    ),
    lane(
      "permissions-parser",
      hasContract ? "partial" : "missing",
      hasContract ? 40 : 18,
      hasContract ? [t(locale, "Adres jest gotowy do ABI/source permission parsera.", "Adresse bereit fuer ABI/Source Permission Parser.", "Address ready for ABI/source permission parser.")] : [],
      hasContract ? [t(locale, "Owner/mint/freeze/blacklist/proxy nie mogą być potwierdzone bez ABI/source.", "Owner/Mint/Freeze/Blacklist/Proxy ohne ABI/Source nicht bestaetigbar.", "Owner/mint/freeze/blacklist/proxy cannot be confirmed without ABI/source.")] : [t(locale, "Brak kontraktu do permission map.", "Kein Contract fuer Permission Map.", "Missing contract for permission map.")],
      hasContract ? t(locale, "headline permission flags: pending", "Headline Permission Flags: pending", "headline permission flags: pending") : t(locale, "brak danych", "fehlende Daten", "missing"),
      t(locale, "pełna mapa owner/admin/roles", "volle Owner/Admin/Roles Map", "full owner/admin/roles map"),
      t(locale, "automatyczny edge-case corpus + mutation/retest", "Automatischer Edge-Case-Korpus + Mutation/Retest", "automated edge-case corpus + mutation/retest"),
    ),
    lane(
      "holders-supply-concentration",
      hasContract ? "not_run" : "missing",
      hasContract ? 30 : 18,
      hasContract ? [t(locale, "Target gotowy do holder API.", "Target bereit fuer Holder API.", "Target ready for holder API.")] : [],
      hasContract ? [t(locale, "Top holder concentration nieuruchomione w Basic QA runtime.", "Top Holder Concentration in Basic QA Runtime nicht ausgefuehrt.", "Top holder concentration not run in Basic QA runtime.")] : [t(locale, "Brak kontraktu do holder lookup.", "Kein Contract fuer Holder Lookup.", "Missing contract for holder lookup.")],
      hasContract ? t(locale, "adapter holderów czeka", "Holder Adapter wartet", "holder adapter pending") : t(locale, "brak danych", "fehlende Daten", "missing"),
      t(locale, "top holders + concentration equation", "Top Holders + Konzentrationsgleichung", "top holders + concentration equation"),
      t(locale, "automatyczna analiza relacji holderów z provenance/confidence", "Automatisierte Holder-Beziehungsanalyse mit Provenienz/Konfidenz", "automated holder-relationship analysis with provenance/confidence"),
    ),
    lane(
      "defi-protocol-context",
      projectName || website ? "not_run" : "missing",
      projectName || website ? 28 : 18,
      projectName || website ? [t(locale, "Project target gotowy do protocol/TVL matching.", "Project Target bereit fuer Protocol/TVL Matching.", "Project target ready for protocol/TVL matching.")] : [],
      projectName || website ? [t(locale, "TVL/protocol context nie jest dowodem bezpieczeństwa i wymaga Pro.", "TVL/Protocol Context ist kein Safety Proof und braucht Pro.", "TVL/protocol context is not safety proof and needs Pro.")] : [t(locale, "Brak nazwy/strony projektu do DeFi context.", "Kein Projektname/Website fuer DeFi Context.", "Missing project name/website for DeFi context.")],
      t(locale, "nie wymagane w Basic", "nicht in Basic erforderlich", "not required in Basic"),
      t(locale, "protocol/TVL context", "Protocol/TVL Context", "protocol/TVL context"),
      t(locale, "automatyczny docs/protocol/contract consistency check", "Automatischer Docs/Protocol/Contract-Konsistenzcheck", "automated docs/protocol/contract consistency check"),
    ),
    lane(
      "docs-repo-audit-match",
      hasPublicAudit && hasDocs ? "confirmed" : hasPublicAudit || hasDocs ? "partial" : "missing",
      hasPublicAudit && hasDocs ? 76 : hasPublicAudit || hasDocs ? 48 : 18,
      [
        ...(hasPublicAudit ? [t(locale, "Public audit URL podany.", "Public Audit URL angegeben.", "Public audit URL provided.")] : []),
        ...(hasDocs ? [t(locale, "Docs/repo/website podane.", "Docs/Repo/Website angegeben.", "Docs/repo/website provided.")] : []),
      ],
      hasPublicAudit && hasDocs ? [] : [t(locale, "Brakuje pełnego dopasowania audit + docs/repo + target.", "Voller Match Audit + Docs/Repo + Target fehlt.", "Missing full audit + docs/repo + target match.")],
      hasPublicAudit || hasDocs ? t(locale, "częściowe publiczne źródła", "teilweise oeffentliche Quellen", "partial public evidence") : t(locale, "brak publicznych źródeł", "keine oeffentlichen Quellen", "public evidence missing"),
      t(locale, "scope/date/address matching", "Scope/Date/Address Matching", "scope/date/address matching"),
      t(locale, "automatyczny freshness/scope/version cross-check", "Automatischer Freshness/Scope/Version-Cross-Check", "automated freshness/scope/version cross-check"),
    ),
    lane(
      "manual-human-review",
      "not_run",
      0,
      [t(locale, "Opcjonalne wewnętrzne QA jest poza kontraktem produktu i ma zero customer feature credit.", "Optionales internes QA liegt ausserhalb des Produktvertrags und hat null Customer-Feature-Credit.", "Optional internal QA is outside the product contract and has zero customer feature credit.")],
      [],
      t(locale, "nie jest częścią Basic", "kein Bestandteil von Basic", "not part of Basic"),
      t(locale, "nie jest częścią Pro", "kein Bestandteil von Pro", "not part of Pro"),
      t(locale, "nie jest wymagane w Advanced; brak QA nie blokuje automatycznej analizy", "in Advanced nicht erforderlich; fehlendes QA blockiert die automatisierte Analyse nicht", "not required in Advanced; absence of QA never blocks automated analysis"),
    ),
  ];

  const scoredLanes = lanes.filter((laneItem) => laneItem.id !== "manual-human-review");
  const confirmed = countByState(scoredLanes, "confirmed");
  const partial = countByState(scoredLanes, "partial");
  const missing = countByState(scoredLanes, "missing");
  const notRun = countByState(scoredLanes, "not_run");
  const blocked = countByState(scoredLanes, "blocked");
  // Source coverage is not adverse security evidence. Missing lanes increase review priority,
  // but cannot manufacture a contract-risk score.
  const riskScore: number | null = null;
  const reviewPriorityScore = reviewPriorityFromCoverage({ confirmed, partial, missing, notRun, blocked, hasContract });
  const confidenceCap = confidenceFromLanes(scoredLanes);
  const missingEvidence = scoredLanes.flatMap((laneItem) => laneItem.missing.map((item) => `${laneItem.label}: ${item}`)).slice(0, 12);

  return {
    passId: PASS2570_AUDIT_SOURCE_QUORUM_RUNTIME_ID,
    generatedAt: new Date().toISOString(),
    locale,
    target: { projectName, contractAddress, chain, auditUrl, docsUrl, githubUrl, website, contactEmail },
    productRule: t(
      locale,
      "Basic daje ograniczony wynik automatyczny; Pro pogłębia automatyczne evidence i PDF; Advanced pozostaje NOT_FOR_SALE i ma najgłębszy automatyczny evidence/cross-check/retest bez obowiązkowego człowieka.",
      "Basic liefert einen begrenzten automatisierten Output; Pro vertieft automatisierte Evidenz und PDF; Advanced bleibt NOT_FOR_SALE mit tiefster automatisierter Evidenz/Cross-Check/Retest ohne verpflichtenden Menschen.",
      "Basic provides a bounded automated result; Pro deepens automated evidence and PDF; Advanced remains NOT_FOR_SALE with the deepest automated evidence/cross-check/retest and no mandatory human.",
    ),
    quorumRule: t(
      locale,
      "Claim bez źródła zostaje missing/partial i obniża confidence zamiast udawać pewność.",
      "Claim ohne Quelle bleibt missing/partial und senkt Confidence statt Sicherheit vorzutäuschen.",
      "A claim without source stays missing/partial and lowers confidence instead of pretending certainty.",
    ),
    overall: {
      riskLabel: riskLabel(riskScore),
      riskScore,
      reviewPriorityScore,
      confidenceCap,
      confirmedSources: confirmed,
      partialSources: partial,
      missingSources: missing,
      notRunSources: notRun,
      blockedSources: blocked,
    },
    basicChecks: [
      { id: "target", label: t(locale, "Target audytu", "Audit Target", "Audit target"), status: hasAnyTarget ? t(locale, "rozpoznany", "erkannt", "recognized") : t(locale, "brak", "fehlt", "missing"), state: hasAnyTarget ? "confirmed" : "missing" },
      { id: "contract", label: t(locale, "Kontrakt EVM", "EVM Contract", "EVM contract"), status: hasContract ? t(locale, "poprawny format", "gueltiges Format", "valid format") : t(locale, "brak / nie-EVM", "fehlt / nicht-EVM", "missing / non-EVM"), state: hasContract ? "confirmed" : "missing" },
      { id: "source", label: t(locale, "Explorer/source", "Explorer/Source", "Explorer/source"), status: hasContract ? t(locale, "do live potwierdzenia", "live zu bestaetigen", "needs live confirmation") : t(locale, "brak", "fehlt", "missing"), state: hasContract ? "partial" : "missing" },
      { id: "docs", label: t(locale, "Docs/repo/audit", "Docs/Repo/Audit", "Docs/repo/audit"), status: hasPublicAudit || hasDocs ? t(locale, "częściowo podane", "teilweise vorhanden", "partially provided") : t(locale, "brak", "fehlt", "missing"), state: hasPublicAudit && hasDocs ? "confirmed" : hasPublicAudit || hasDocs ? "partial" : "missing" },
      { id: "liquidity", label: t(locale, "Liquidity/holders", "Liquidity/Holder", "Liquidity/holders"), status: hasContract ? t(locale, "Pro adapter", "Pro Adapter", "Pro adapter") : t(locale, "brak", "fehlt", "missing"), state: hasContract ? "not_run" : "missing" },
      { id: "safe-mode", label: t(locale, "Safe mode", "Safe Mode", "Safe mode"), status: t(locale, "bez seed/private key/aktywnych testów", "ohne Seed/Private Key/aktive Tests", "no seed/private key/active tests"), state: "confirmed" },
    ],
    lanes,
    missingEvidence,
    proPdfSections: [
      "Executive summary + request ID",
      "Contract identity + chain + source verification",
      "Source quorum matrix + confidence cap",
      "Permission map: owner/admin/proxy/mint/freeze/blacklist/tax",
      "Liquidity and holder concentration lanes",
      "Docs/repo/public-audit scope matching",
      "Missing evidence and safe conclusion",
      "PDF watermark + QA/free-for-test note",
    ],
    advancedSections: [
      "Automated cross-tool and source contradiction adjudication",
      "Compiler/runtime/source identity replay",
      "Permission, liquidity and holder relationship evidence with provenance/confidence",
      "Automated attack-path/remediation/retest expansion",
      "Versioned report, uncertainty register and re-check triggers",
    ],
    adapterBacklog: [
      "Server-only Etherscan V2 / Blockscout adapter with timeout and key guard",
      "CoinGecko/market metadata adapter with second-source fallback",
      "DEX Screener liquidity/pair adapter and lock-proof boundary",
      "GoPlus/Honeypot-style passive security flags",
      "Holder concentration adapter with exchange/burn-wallet labeling",
      "Docs/repo/public-audit matching adapter",
      "Advanced automated adjudication/retest receipt and customer-safe redaction gate",
    ],
    safetyBoundaries: [
      "No seed phrase, no private key, no wallet custody.",
      "No exploit instructions and no unauthorized active testing.",
      "No guarantee of safety and no investment advice.",
      "Missing sources are visible, not hidden.",
    ],
  };
}
