import { C0_OR_BRACE_ANGLE_PATTERN } from "./ascii-control-characters";

import type { AuditReviewSubmission } from "./audit-review-flow";
import type { Pass2578AuditReportAssemblerReport } from "./audit-report-assembler";

export const PASS2579_ADVANCED_MANUAL_REVIEW_QUEUE_ID = "advanced-manual-review-queue" as const;
export const PASS2579_CURRENT_SEMANTICS = "advanced-automated-evidence-queue" as const;
// LEGACY_COMPATIBILITY_NAME_ONLY: exported Pass2579 names are retained for old receipts/API readers.
// Current Advanced product semantics are automated; optional internal QA has zero customer feature credit and never gates delivery.

export type Pass2579ManualReviewPriority = "low" | "normal" | "high" | "urgent";
export type Pass2579ManualReviewGate = "payment_required" | "scope_required" | "evidence_required" | "operator_only" | "ready_for_operator";
export type Pass2579ManualReviewStatus = "queued" | "blocked" | "ready" | "customer_safe";

export type Pass2579ManualReviewItem = {
  id: string;
  title: string;
  priority: Pass2579ManualReviewPriority;
  gate: Pass2579ManualReviewGate;
  status: Pass2579ManualReviewStatus;
  publicLine: string;
  operatorAction: string;
  requiredEvidence: string[];
  sourceFamilies: string[];
  safeToShowPublicly: boolean;
};

export type Pass2579AdvancedManualReviewQueueReport = {
  passId: typeof PASS2579_ADVANCED_MANUAL_REVIEW_QUEUE_ID;
  generatedAt: string;
  locale: string;
  target: {
    contractAddress?: string;
    projectName?: string;
    chain: string;
  };
  rule: string;
  customerRule: string;
  operatorRule: string;
  paymentBoundary: string;
  summary: {
    totalItems: number;
    readyForOperator: number;
    readyForAutomation: number;
    blockedByPayment: number;
    blockedByEvidence: number;
    blockedByScope: number;
    urgent: number;
    high: number;
    customerVisible: number;
  };
  publicUpgradeRows: Array<{ label: string; status: Pass2579ManualReviewStatus; output: string }>;
  operatorChecklist: string[];
  visualMergeContract: {
    publicSlot: string;
    privateSlot: string;
    rule: string;
    doNotExpose: string[];
  };
  items: Pass2579ManualReviewItem[];
};

type ManualReviewInput = Partial<AuditReviewSubmission> & {
  locale?: string;
  reportAssembler?: Pass2578AuditReportAssemblerReport | null;
};

function t(locale: string, pl: string, de: string, en: string) {
  return locale === "pl" ? pl : locale === "de" ? de : en;
}

function clean(value: unknown, max = 180) {
  if (typeof value !== "string") return undefined;
  const text = value.replace(C0_OR_BRACE_ANGLE_PATTERN, " ").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : undefined;
}

function unique(values: string[], max = 8) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean))).slice(0, max);
}

function priorityFromLine(line: string): Pass2579ManualReviewPriority {
  const lower = line.toLowerCase();
  if (/blacklist|freeze|mint|proxy|owner|liquidity|holder|lock|blocked|critical/.test(lower)) return "high";
  if (/expired|stale|missing|partial|manual|unknown/.test(lower)) return "normal";
  return "low";
}

function gateFromLine(line: string): Pass2579ManualReviewGate {
  const lower = line.toLowerCase();
  if (/not_for_sale|not for sale|niedostępny|nicht im verkauf/.test(lower)) return "operator_only";
  if (/active test|active testing|aktywn|aktive tests/.test(lower)) return "operator_only";
  if (/payment|entitlement|premium|receipt/.test(lower)) return "payment_required";
  if (/scope|consent|authorization/.test(lower)) return "scope_required";
  if (/missing|source|evidence|proof|fresh|expired|stale|lock|holder/.test(lower)) return "evidence_required";
  return "operator_only";
}

function statusFromGate(gate: Pass2579ManualReviewGate): Pass2579ManualReviewStatus {
  if (gate === "payment_required" || gate === "scope_required" || gate === "evidence_required") return "blocked";
  if (gate === "ready_for_operator") return "ready";
  return "queued";
}

function sourceFamiliesFromLine(line: string) {
  const lower = line.toLowerCase();
  const families: string[] = [];
  if (/explorer|etherscan|source|contract|owner|proxy|mint|blacklist|freeze/.test(lower)) families.push("explorer/source");
  if (/liquidity|lp|pool|dex|lock/.test(lower)) families.push("dex/liquidity");
  if (/holder|supply|deployer/.test(lower)) families.push("holders/supply");
  if (/audit|docs|github|repo|scope/.test(lower)) families.push("docs/audit-scope");
  if (/fresh|ttl|expired|stale|time/.test(lower)) families.push("freshness/timecode");
  return families.length ? families : ["velmere-engine"];
}

function publicLineFor(locale: string, line: string, gate: Pass2579ManualReviewGate) {
  const prefix = gate === "payment_required"
    ? t(locale, "Advanced wymaga potwierdzonej płatności.", "Advanced braucht bestaetigte Zahlung.", "Advanced requires verified payment.")
    : gate === "scope_required"
      ? t(locale, "Wymagamy potwierdzonego zakresu i zgody.", "Bestaetigter Scope und Zustimmung erforderlich.", "Confirmed scope and consent are required.")
      : gate === "evidence_required"
        ? t(locale, "Brakuje potwierdzonego dowodu źródłowego.", "Bestaetigter Quellenbeweis fehlt.", "Verified source evidence is missing.")
        : t(locale, "To jest wewnętrzna kontrola automatycznej ścieżki; opcjonalne QA nie blokuje wyniku.", "Dies ist eine interne Kontrolle des automatisierten Pfads; optionales QA blockiert das Ergebnis nicht.", "This is an internal control of the automated path; optional QA never blocks the result.");
  return `${prefix} ${clean(line, 220) ?? t(locale, "Pozycja automatycznej evidence queue.", "Position der automatisierten Evidence Queue.", "Automated evidence-queue item.")}`.slice(0, 360);
}

function baseRequiredEvidence(locale: string, gate: Pass2579ManualReviewGate, sourceFamilies: string[]) {
  const evidence = gate === "payment_required"
    ? [
        t(locale, "server-side receipt", "server-side Receipt", "server-side receipt"),
        t(locale, "entitlement id", "Entitlement ID", "entitlement id"),
      ]
    : gate === "scope_required"
      ? [
          t(locale, "zakres audytu", "Audit Scope", "audit scope"),
          t(locale, "zgoda na aktywniejszą analizę", "Zustimmung fuer aktivere Analyse", "consent for deeper review"),
        ]
      : gate === "evidence_required"
        ? [
            t(locale, "drugi niezależny provider", "zweiter unabhaengiger Provider", "second independent provider"),
            t(locale, "timestamp/TTL", "Timestamp/TTL", "timestamp/TTL"),
          ]
        : [t(locale, "automatyczny receipt decyzji", "automatisierter Decision-Receipt", "automated decision receipt")];
  return unique([...evidence, ...sourceFamilies], 6);
}

function makeItem(locale: string, line: string, index: number): Pass2579ManualReviewItem {
  const gate = gateFromLine(line);
  const priority = priorityFromLine(line);
  const sourceFamilies = sourceFamiliesFromLine(line);
  return {
    id: `adv-review-${String(index + 1).padStart(2, "0")}`,
    title: clean(line.split(":")[0], 90) ?? `Automated evidence action ${index + 1}`,
    priority,
    gate,
    status: statusFromGate(gate),
    publicLine: publicLineFor(locale, line, gate),
    operatorAction: clean(line, 420) ?? "Automated evidence action",
    requiredEvidence: baseRequiredEvidence(locale, gate, sourceFamilies),
    sourceFamilies,
    safeToShowPublicly: gate !== "operator_only",
  };
}

export function buildPass2579AdvancedManualReviewQueueReport(input: ManualReviewInput): Pass2579AdvancedManualReviewQueueReport {
  const locale = input.locale === "pl" || input.locale === "de" || input.locale === "en" ? input.locale : "en";
  const chain = clean(input.chain, 40) ?? input.reportAssembler?.target.chain ?? "ethereum";
  const contractAddress = clean(input.contractAddress, 96) ?? input.reportAssembler?.target.contractAddress;
  const projectName = clean(input.projectName, 90) ?? input.reportAssembler?.target.projectName;

  const assemblerQueue = input.reportAssembler?.advancedQueue ?? [];
  const seedQueue = [
    ...assemblerQueue,
    t(locale, "NOT_FOR_SALE: obecny Advanced nie może zostać odblokowany płatnością ani entitlementem.", "NOT_FOR_SALE: Das aktuelle Advanced kann weder durch Zahlung noch Entitlement freigeschaltet werden.", "NOT_FOR_SALE: current Advanced cannot be unlocked by payment or entitlement."),
    t(locale, "Passive-only safety: automatyczna analiza nie wykonuje aktywnych testów bez autoryzacji.", "Passive-only Safety: Die automatisierte Analyse führt ohne Autorisierung keine aktiven Tests aus.", "Passive-only safety: automated analysis performs no active testing without authorization."),
    t(locale, "Automated redaction: prywatne dane i raw evidence nie wychodzą do customer output.", "Automatisierte Redaction: Private Daten und Raw Evidence verlassen den Customer Output nicht.", "Automated redaction: private data and raw evidence never enter customer output."),
  ];

  const items = unique(seedQueue, 24).map((line, index) => makeItem(locale, line, index));
  const blockedByPayment = items.filter((item) => item.gate === "payment_required").length;
  const blockedByEvidence = items.filter((item) => item.gate === "evidence_required").length;
  const blockedByScope = items.filter((item) => item.gate === "scope_required").length;
  const readyForAutomation = items.filter((item) => item.status === "ready" || item.status === "queued").length;
  const readyForOperator = readyForAutomation; // legacy field alias only
  const urgent = items.filter((item) => item.priority === "urgent").length;
  const high = items.filter((item) => item.priority === "high").length;
  const customerVisible = items.filter((item) => item.safeToShowPublicly).length;

  const publicUpgradeRows = items
    .filter((item) => item.safeToShowPublicly)
    .slice(0, 7)
    .map((item) => ({
      label: item.title,
      status: item.status,
      output: item.publicLine,
    }));

  const operatorChecklist = items.slice(0, 18).flatMap((item, index) => [
    `${index + 1}. [${item.priority}] ${item.title}`,
    `   gate=${item.gate}; status=${item.status}; evidence=${item.requiredEvidence.join(", ")}`,
    `   action=${item.operatorAction}`,
  ]);

  return {
    passId: PASS2579_ADVANCED_MANUAL_REVIEW_QUEUE_ID,
    generatedAt: new Date().toISOString(),
    locale,
    target: {
      ...(contractAddress ? { contractAddress } : {}),
      ...(projectName ? { projectName } : {}),
      chain,
    },
    rule: "LEGACY NAME ONLY: this Pass2579 payload is the current automated Advanced evidence/adjudication/retest queue. Human/operator review is optional internal QA only, has zero customer feature credit and never gates customer delivery. Advanced remains NOT_FOR_SALE.",
    customerRule: t(
      locale,
      "Advanced pokazuje tylko bezpieczny status automatycznej analizy, evidence gaps i ograniczenia; brak human QA nigdy nie blokuje wyniku.",
      "Advanced zeigt nur sicheren Status der automatisierten Analyse, Evidenzlücken und Grenzen; fehlendes Human-QA blockiert das Ergebnis nie.",
      "Advanced shows only safe automated-analysis status, evidence gaps and limitations; absence of human QA never blocks the result.",
    ),
    operatorRule: "Automated evidence/conflict/remediation/retest gates determine product readiness. Optional internal QA may observe or challenge them but cannot unlock, block or certify the customer product.",
    paymentBoundary: "Advanced is currently NOT_FOR_SALE. Payment or entitlement cannot unlock execution or customer delivery until a later owner-bound sale decision and full release gates exist.",
    summary: {
      totalItems: items.length,
      readyForOperator,
      readyForAutomation,
      blockedByPayment,
      blockedByEvidence,
      blockedByScope,
      urgent,
      high,
      customerVisible,
    },
    publicUpgradeRows,
    operatorChecklist,
    visualMergeContract: {
      publicSlot: "advanced_upgrade_preview",
      privateSlot: "optional_internal_qa_observer",
      rule: "The visual audit UI may show publicUpgradeRows. Legacy operatorChecklist is an internal automated-action/optional-QA projection and must never become a customer requirement or unlock gate.",
      doNotExpose: [
        "raw operator notes",
        "private customer/contact data",
        "payment/receipt internals",
        "unredacted source packets",
        "active test instructions",
      ],
    },
    items,
  };
}
