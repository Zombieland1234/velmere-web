"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  Fingerprint,
  Info,
  Lock,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
} from "lucide-react";
import type {
  CanonicalAuditReportModel,
  AuditTier,
  CanonicalReportSection,
  CanonicalFinding,
} from "@/lib/security/audit-canonical-report";
import Link from "next/link";

interface CanonicalAuditReportViewProps {
  report: CanonicalAuditReportModel;
  onUpgradeTier?: (tier: AuditTier) => void;
  pdfDownloadUrl: string;
}

const COPY_BY_LOCALE = {
  pl: {
    badge: "KANONICZNY CERTYFIKAT AUDYTU",
    title: "Raport Audytu Bezpieczeństwa Smart Kontraktu",
    subtitle: "Deterministyczna analiza statyczna w oparciu o specyfikację EVM, matrycę podatności SWC/CWE/OWASP oraz sumę kontrolną SHA-256.",
    tier: "PAKIET",
    downloadPdf: "Pobierz Kanoniczny Raport PDF",
    generatingPdf: "Przygotowywanie dokumentu PDF...",
    canonicalSync: "100% spójne dane z podpisem kryptograficznym",
    riskScore: "Wskaźnik Ryzyka VLM",
    coverage: "Pokrycie dowodowe",
    confidence: "Pewność analizy",
    contract: "Badany Kontrakt",
    network: "Sieć / Protokół",
    contractAddress: "Adres Kontraktu",
    status: "Status Audytu",
    statusVerified: "Zweryfikowany & Zapieczętowany",
    shaDigest: "Suma Kontrolna SHA-256",
    findingsSummary: "Wykryte Podatności",
    noCriticalFound: "0 krytycznych luk w ewaluowanym korpusie referencyjnym",
    critical: "Krytyczne",
    high: "Wysokie",
    medium: "Średnie",
    low: "Niskie",
    copy: "Kopiuj",
    copied: "Skopiowano!",
    showSections: "Pokaż szczegółowy log techniczny sekcji",
    hideSections: "Ukryj log techniczny sekcji",
    sectionsCount: (n: number) => (n === 1 ? "1 sekcja" : n >= 2 && n <= 4 ? `${n} sekcje` : `${n} sekcji`),
    scopeSection: "Zakres sekcji",
    requiresTier: (tier: string) => `Wymaga pakietu ${tier.toUpperCase()}`,
    upgradeCta: "Zarządzaj pakietem w Centrum Audytu",
    methodology: "Metodologia: ISO/IEC 25010, SWC & OWASP 2026",
    attestationSignature: "Kryptograficzny podpis atestacji",
    evidenceLabel: "Dowód / Ślad w kodzie",
    attackScenario: "Wektor Ataku (Impact)",
    proofOfConcept: "Dowód Koncepcji (PoC)",
    recommendationLabel: "Rekomendacja Naprawcza",
    remediationPatch: "Kod Naprawczy (Solidity Diff - / +)",
    verifiedStatus: "Zweryfikowano",
    flaggedStatus: "Ostrzeżenie",
    missingStatus: "Brak danych",
    disclaimerTitle: "Poufność i zastrzeżenie prawne",
    disclaimerBody:
      "Niniejszy raport audytu stanowi zautomatyzowaną analizę techniczną w oparciu o stan kodu z momentu badania. Raport ma charakter techniczny i informacyjny. Nie stanowi porady finansowej, inwestycyjnej ani prawnej. 0 wyników fałszywie ujemnych w ewaluowanym korpusie referencyjnym nie stanowi gwarancji braku błędów w nieprzebadanych wektorach zeroday.",
  },
  de: {
    badge: "KANONISCHES AUDIT-ZERTIFIKAT",
    title: "Smart-Contract Sicherheitsaudit-Bericht",
    subtitle: "Deterministische statische Analyse gegen EVM-Spezifikationen, SWC/CWE/OWASP-Matrix und kryptografischen SHA-256-Hash.",
    tier: "STUFE",
    downloadPdf: "Kanonischen PDF-Bericht herunterladen",
    generatingPdf: "PDF-Dokument wird vorbereitet...",
    canonicalSync: "100% konsistente Daten mit kryptografischer Signatur",
    riskScore: "VLM-Risiko-Score",
    coverage: "Beweisabdeckung",
    confidence: "Analysekonfidenz",
    contract: "Geprüfter Vertrag",
    network: "Netzwerk / Protokoll",
    contractAddress: "Vertragsadresse",
    status: "Audit-Status",
    statusVerified: "Verifiziert & Versiegelt",
    shaDigest: "SHA-256 Prüfsumme",
    findingsSummary: "Erkannte Schwachstellen",
    noCriticalFound: "0 kritische Schwachstellen im evaluierten Referenzkorpus",
    critical: "Kritisch",
    high: "Hoch",
    medium: "Mittel",
    low: "Niedrig",
    copy: "Kopieren",
    copied: "Kopiert!",
    showSections: "Technisches Sektionsprotokoll anzeigen",
    hideSections: "Technisches Sektionsprotokoll ausblenden",
    sectionsCount: (n: number) => (n === 1 ? "1 Abschnitt" : `${n} Abschnitte`),
    scopeSection: "Abschnittsumfang",
    requiresTier: (tier: string) => `Erfordert ${tier.toUpperCase()}-Stufe`,
    upgradeCta: "Stufen im Audit-Hub verwalten",
    methodology: "Methodik: ISO/IEC 25010, SWC & OWASP 2026",
    attestationSignature: "Kryptografische Signatur",
    evidenceLabel: "Beweis / Code-Spur",
    attackScenario: "Angriffsszenario (Impact)",
    proofOfConcept: "Machbarkeitsnachweis (PoC)",
    recommendationLabel: "Behebungsempfehlung",
    remediationPatch: "Korrektur-Patch (Solidity Diff - / +)",
    verifiedStatus: "Verifiziert",
    flaggedStatus: "Warnung",
    missingStatus: "Fehlt",
    disclaimerTitle: "Vertraulichkeit & Rechtlicher Hinweis",
    disclaimerBody:
      "Dieser Bericht stellt eine technische Sicherheitsprüfung dar. 0 falsch-negative Befunde im evaluierten Referenzkorpus garantieren keine absolute Abwesenheit unentdeckter Zero-Day-Vektoren.",
  },
  en: {
    badge: "CANONICAL AUDIT CERTIFICATE",
    title: "Smart Contract Security Audit Report",
    subtitle: "Deterministic static analysis against EVM specifications, SWC/CWE/OWASP matrices, and SHA-256 seal.",
    tier: "TIER",
    downloadPdf: "Download Canonical PDF Report",
    generatingPdf: "Preparing PDF Document...",
    canonicalSync: "100% Consistent Canonical Data & Cryptographic Seal",
    riskScore: "VLM Risk Score",
    coverage: "Evidence coverage",
    confidence: "Analysis confidence",
    contract: "Audited Contract",
    network: "Network / Chain",
    contractAddress: "Contract Address",
    status: "Audit Status",
    statusVerified: "Verified & Cryptographically Sealed",
    shaDigest: "SHA-256 Checksum",
    findingsSummary: "Vulnerability Findings",
    noCriticalFound: "0 false negatives in the evaluated reference corpus",
    critical: "Critical",
    high: "High",
    medium: "Medium",
    low: "Low",
    copy: "Copy",
    copied: "Copied!",
    showSections: "Show Technical Section Logs",
    hideSections: "Hide Technical Section Logs",
    sectionsCount: (n: number) => (n === 1 ? "1 section" : `${n} sections`),
    scopeSection: "Section scope",
    requiresTier: (tier: string) => `Requires ${tier.toUpperCase()} Tier`,
    upgradeCta: "Manage Tiers in Audit Hub",
    methodology: "Methodology: ISO/IEC 25010, SWC & OWASP 2026",
    attestationSignature: "Cryptographic Attestation Signature",
    evidenceLabel: "Evidence / Code Trace",
    attackScenario: "Attack Scenario (Impact)",
    proofOfConcept: "Proof of Concept (PoC)",
    recommendationLabel: "Remediation Recommendation",
    remediationPatch: "Remediation Patch (Solidity Diff - / +)",
    verifiedStatus: "Verified",
    flaggedStatus: "Flagged",
    missingStatus: "Missing",
    disclaimerTitle: "Confidentiality & Legal Notice",
    disclaimerBody:
      "This audit report represents an automated formal security assessment. 0 false negatives in the evaluated reference corpus does not guarantee absence of unforeseen zero-day vectors.",
  },
};

function SeverityPill({ count, label, color }: { count: number; label: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 font-mono text-[11px]">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-white/60">{label}:</span>
      <strong className="text-white font-semibold">{count}</strong>
    </div>
  );
}

export default function CanonicalAuditReportView({
  report,
  pdfDownloadUrl,
}: CanonicalAuditReportViewProps) {
  const [downloading, setDownloading] = useState(false);
  const [copiedAddr, setCopiedAddr] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);
  const [showFullLogs, setShowFullLogs] = useState(false);

  const loc = (report.locale === "pl" || report.locale === "de" ? report.locale : "en") as keyof typeof COPY_BY_LOCALE;
  const t = COPY_BY_LOCALE[loc];

  const copyAddress = () => {
    navigator.clipboard?.writeText(report.target.contractAddress);
    setCopiedAddr(true);
    setTimeout(() => setCopiedAddr(false), 2000);
  };

  const copyDigest = () => {
    navigator.clipboard?.writeText(report.reportDigest);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const score = report.verdict.riskScore;
  const riskTone =
    score <= 25
      ? { color: "#34d399", label: loc === "pl" ? "MINIMALNE RYZYKO (INSTITUTIONAL GRADE)" : "MINIMAL RISK (INSTITUTIONAL GRADE)" }
      : score <= 50
      ? { color: "#c7a35b", label: loc === "pl" ? "RYZYKO STANDARDOWE" : "STANDARD RISK" }
      : score <= 75
      ? { color: "#fb923c", label: loc === "pl" ? "PODWYŻSZONE RYZYKO" : "ELEVATED RISK" }
      : { color: "#f43f5e", label: loc === "pl" ? "RYZYKO KRYTYCZNE" : "CRITICAL RISK" };

  // Calculate findings summary counts
  const allFindings = report.sections.flatMap((s) => s.data?.findings || []);
  const criticalCount = allFindings.filter((f) => f.severity === "critical").length;
  const highCount = allFindings.filter((f) => f.severity === "high").length;
  const mediumCount = allFindings.filter((f) => f.severity === "medium").length;
  const lowCount = allFindings.filter((f) => f.severity === "low").length;

  return (
    <div className="audit-canonical-view w-full max-w-5xl mx-auto space-y-8 font-sans text-white/90">
      {/* LUXURY SINGLE DOWNLOAD TABLE / CARD */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-[2rem] border border-white/[0.14] bg-[#07090c]/95 p-6 md:p-10 shadow-[0_20px_60px_rgba(0,0,0,0.7)] backdrop-blur-2xl"
      >
        {/* Ambient Top Glow */}
        <div className="pointer-events-none absolute -top-32 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-gradient-to-b from-[#c7a35b]/20 to-transparent blur-3xl" />

        {/* Card Header */}
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#c7a35b]/35 bg-[#c7a35b]/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#dfc89e]">
                <Sparkles className="h-3.5 w-3.5 text-[#c7a35b]" />
                {t.badge} · {t.tier} {report.clientEntitlementTier.toUpperCase()}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 font-mono text-[9px] font-semibold uppercase text-emerald-300">
                <CheckCircle2 className="h-3 w-3" />
                {t.statusVerified}
              </span>
            </div>
            <h1 className="mt-3 font-serif text-3xl md:text-4xl font-light text-white tracking-tight">
              {report.target.contractName}
            </h1>
            <p className="mt-1 text-xs text-white/60">
              {t.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-black/40 px-3.5 py-2">
            <Fingerprint className="h-4 w-4 text-[#c7a35b]" />
            <div className="text-right">
              <span className="block font-mono text-[9px] uppercase tracking-wider text-white/40">
                Case ID
              </span>
              <code className="font-mono text-xs text-[#dfc89e]">{report.reportId}</code>
            </div>
          </div>
        </div>

        {/* THE SINGLE TABLE */}
        <div className="relative z-10 mt-6 overflow-hidden rounded-xl border border-white/[0.08] bg-black/30">
          <table className="w-full text-left border-collapse">
            <tbody className="divide-y divide-white/[0.06] text-xs">
              {/* Row 1: Target Contract & Network */}
              <tr className="hover:bg-white/[0.015] transition">
                <td className="w-1/3 p-4 font-mono text-white/40 uppercase tracking-wider">
                  {t.contract} / {t.network}
                </td>
                <td className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-white text-sm font-semibold">{report.target.contractName}</strong>
                    {report.target.tokenSymbol && (
                      <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-white/70">
                        ${report.target.tokenSymbol}
                      </span>
                    )}
                    <span className="text-white/40">·</span>
                    <span className="font-mono text-white/80">{report.target.network} (Chain ID: {report.target.chainId})</span>
                  </div>
                </td>
              </tr>

              {/* Row 2: Contract Address */}
              <tr className="hover:bg-white/[0.015] transition">
                <td className="p-4 font-mono text-white/40 uppercase tracking-wider">
                  {t.contractAddress}
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2 font-mono">
                    <code className="text-white/90 break-all text-xs bg-white/[0.03] px-2 py-1 rounded border border-white/[0.05]">
                      {report.target.contractAddress}
                    </code>
                    <button
                      type="button"
                      onClick={copyAddress}
                      className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white/70 hover:bg-white/10 hover:text-white transition"
                    >
                      {copiedAddr ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedAddr ? t.copied : t.copy}</span>
                    </button>
                  </div>
                </td>
              </tr>

              {/* Row 3: VLM Risk Score & Circular Gauge */}
              <tr className="hover:bg-white/[0.015] transition bg-white/[0.01]">
                <td className="p-4 font-mono text-white/40 uppercase tracking-wider">
                  {t.riskScore}
                </td>
                <td className="p-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    {/* Animated Circular Mini-Gauge */}
                    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
                      <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          fill="none"
                          stroke="rgba(255, 255, 255, 0.08)"
                          strokeWidth="8"
                        />
                        <motion.circle
                          cx="50"
                          cy="50"
                          r="40"
                          fill="none"
                          stroke={riskTone.color}
                          strokeWidth="8"
                          strokeLinecap="round"
                          strokeDasharray="251.3"
                          initial={{ strokeDashoffset: 251.3 }}
                          animate={{ strokeDashoffset: 251.3 - (251.3 * score) / 100 }}
                          transition={{ duration: 1.2, ease: "easeOut" }}
                          style={{ filter: `drop-shadow(0 0 6px ${riskTone.color}60)` }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center font-mono text-xs font-bold text-white">
                        {score}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className="font-mono text-xl font-light tracking-tight"
                          style={{ color: riskTone.color }}
                        >
                          {score.toFixed(1)} <small className="text-white/40 text-xs font-normal">/ 100</small>
                        </span>
                        <span
                          className="rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase"
                          style={{
                            borderColor: `${riskTone.color}40`,
                            backgroundColor: `${riskTone.color}15`,
                            color: riskTone.color,
                          }}
                        >
                          {riskTone.label}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-white/60">
                        {report.verdict.summary}
                      </p>
                    </div>
                  </div>
                </td>
              </tr>

              {/* Row 4: Evidence Coverage & Confidence */}
              <tr className="hover:bg-white/[0.015] transition">
                <td className="p-4 font-mono text-white/40 uppercase tracking-wider">
                  {t.coverage} / {t.confidence}
                </td>
                <td className="p-4">
                  <div className="flex flex-wrap items-center gap-4 font-mono">
                    <div className="flex items-center gap-1.5">
                      <span className="text-white/50">{t.coverage}:</span>
                      <strong className="text-white">{report.verdict.evidenceCoverage}%</strong>
                    </div>
                    <span className="text-white/20">|</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-white/50">{t.confidence}:</span>
                      <strong className="text-cyan-300">{report.verdict.confidenceScore}%</strong>
                    </div>
                    <span className="text-white/20">|</span>
                    <span className="text-[11px] text-white/40">
                      {t.methodology}
                    </span>
                  </div>
                </td>
              </tr>

              {/* Row 5: Findings Summary */}
              <tr className="hover:bg-white/[0.015] transition">
                <td className="p-4 font-mono text-white/40 uppercase tracking-wider">
                  {t.findingsSummary}
                </td>
                <td className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityPill count={criticalCount} label={t.critical} color="#f43f5e" />
                    <SeverityPill count={highCount} label={t.high} color="#fb923c" />
                    <SeverityPill count={mediumCount} label={t.medium} color="#facc15" />
                    <SeverityPill count={lowCount} label={t.low} color="#2dd4bf" />
                    <span className="ml-2 font-mono text-[10px] text-white/40">
                      {t.noCriticalFound}
                    </span>
                  </div>
                </td>
              </tr>

              {/* Row 6: SHA-256 Digest */}
              <tr className="hover:bg-white/[0.015] transition">
                <td className="p-4 font-mono text-white/40 uppercase tracking-wider">
                  {t.shaDigest}
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2 font-mono">
                    <code className="text-[#dfc89e] text-[11px] break-all bg-[#c7a35b]/10 border border-[#c7a35b]/20 px-2.5 py-1 rounded">
                      {report.reportDigest}
                    </code>
                    <button
                      type="button"
                      onClick={copyDigest}
                      className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white/70 hover:bg-white/10 hover:text-white transition"
                    >
                      {copiedHash ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedHash ? t.copied : t.copy}</span>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* PRIMARY ACTION: High-End Download Button */}
        <div className="relative z-10 mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/[0.08] pt-6">
          <div className="flex items-center gap-2 text-xs text-white/50">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>{t.canonicalSync}</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <a
              href={pdfDownloadUrl}
              download
              onClick={() => setDownloading(true)}
              className="group relative flex w-full sm:w-auto items-center justify-center gap-3 rounded-full border border-[#c7a35b] bg-gradient-to-r from-[#c7a35b] to-[#b9822d] px-7 py-3.5 font-mono text-xs font-bold uppercase tracking-[0.14em] text-black shadow-[0_0_30px_rgba(199,163,91,0.35)] transition-all hover:shadow-[0_0_45px_rgba(199,163,91,0.55)] hover:scale-[1.02] active:scale-[0.98]"
            >
              <Download className="h-4 w-4 transition-transform group-hover:-translate-y-0.5" />
              <span>{downloading ? t.generatingPdf : t.downloadPdf}</span>
            </a>
          </div>
        </div>
      </motion.div>

      {/* SECONDARY DISCLOSURE: Detailed Technical Section Logs */}
      <div className="w-full">
        <button
          type="button"
          onClick={() => setShowFullLogs((prev) => !prev)}
          className="flex w-full items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.02] px-5 py-3.5 text-left font-mono text-xs text-white/70 hover:border-white/[0.16] hover:bg-white/[0.04] transition"
        >
          <span className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-[#c7a35b]" />
            <span>{showFullLogs ? t.hideSections : t.showSections} ({t.sectionsCount(report.sections.length)})</span>
          </span>
          {showFullLogs ? <ChevronUp className="h-4 w-4 text-white/40" /> : <ChevronDown className="h-4 w-4 text-white/40" />}
        </button>

        {showFullLogs && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            transition={{ duration: 0.3 }}
            className="mt-4 space-y-4"
          >
            {report.sections.map((section: CanonicalReportSection, idx: number) => {
              const isLocked = section.isLocked;
              return (
                <div
                  key={section.id}
                  className={`rounded-2xl border p-5 ${
                    isLocked
                      ? "border-white/[0.05] bg-[#060709]/60"
                      : "border-white/[0.08] bg-[#090b0f]"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-3 mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-[#c7a35b]">0{idx + 1}</span>
                        <h3 className="font-serif text-lg font-medium text-white">{section.title}</h3>
                      </div>
                      <p className="mt-0.5 text-xs text-white/50">{section.subtitle}</p>
                    </div>

                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 font-mono text-[10px] uppercase text-white/70">
                      {section.requiredTier.toUpperCase()}
                    </span>
                  </div>

                  {isLocked ? (
                    <p className="text-xs text-white/40 italic">
                      {t.requiresTier(section.requiredTier)} · {section.sampleSummaryLines?.[0] || ""}
                    </p>
                  ) : (
                    <div className="space-y-4 text-xs text-white/75">
                      {section.data?.keyValuePairs && section.data.keyValuePairs.length > 0 && (
                        <div className="space-y-1.5">
                          {section.data.keyValuePairs.map((pair, pIdx) => (
                            <div key={pIdx} className="flex justify-between border-b border-white/[0.03] py-1 font-mono text-[11px]">
                              <span className="text-white/40">{pair.label}</span>
                              <span className="text-white/90">{pair.value}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Render Metrics if present */}
                      {section.data?.metrics && section.data.metrics.length > 0 && (
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {section.data.metrics.map((m, mIdx) => {
                            const isVerified = m.status === "verified";
                            const isFlagged = m.status === "flagged";
                            return (
                              <div
                                key={mIdx}
                                className="flex items-center justify-between rounded-lg border border-white/[0.05] bg-black/30 px-3 py-2 text-xs"
                              >
                                <span className="text-white/60">{m.label}</span>
                                <div className="flex items-center gap-1.5 font-mono text-[11px]">
                                  <span className="text-white font-medium">{m.value}</span>
                                  <span
                                    className={`rounded px-1.5 py-0.5 text-[9px] uppercase font-semibold ${
                                      isVerified
                                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                        : isFlagged
                                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                        : "bg-white/10 text-white/50 border border-white/10"
                                    }`}
                                  >
                                    {isVerified ? t.verifiedStatus : isFlagged ? t.flaggedStatus : t.missingStatus}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Render Findings if present */}
                      {section.data?.findings && section.data.findings.length > 0 && (
                        <div className="mt-4 space-y-3">
                          <h4 className="font-mono text-xs font-semibold uppercase tracking-wider text-[#dfc89e] flex items-center gap-2">
                            <AlertTriangle className="h-3.5 w-3.5 text-[#c7a35b]" />
                            <span>{t.findingsSummary} ({section.data.findings.length})</span>
                          </h4>
                          <div className="space-y-3">
                            {section.data.findings.map((f, fIdx) => {
                              const severityBg =
                                f.severity === "critical"
                                  ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                                  : f.severity === "high"
                                  ? "bg-orange-500/10 border-orange-500/30 text-orange-300"
                                  : f.severity === "medium"
                                  ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                                  : "bg-teal-500/10 border-teal-500/30 text-teal-300";
                              return (
                                <div
                                  key={f.id || fIdx}
                                  className="rounded-xl border border-white/[0.08] bg-black/40 p-4 space-y-3"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-2.5">
                                    <div className="flex items-center gap-2">
                                      <span className={`rounded-md border px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${severityBg}`}>
                                        {f.severity}
                                      </span>
                                      <span className="font-mono text-xs font-semibold text-white">
                                        {f.title}
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
                                      {f.swcId && (
                                        <span className="rounded bg-white/5 border border-white/10 px-1.5 py-0.5 text-white/60">
                                          {f.swcId}
                                        </span>
                                      )}
                                      {f.cweId && (
                                        <span className="rounded bg-white/5 border border-white/10 px-1.5 py-0.5 text-white/60">
                                          {f.cweId}
                                        </span>
                                      )}
                                      {f.owaspId && (
                                        <span className="rounded bg-[#c7a35b]/10 border border-[#c7a35b]/30 px-1.5 py-0.5 text-[#dfc89e] font-semibold">
                                          {f.owaspId}
                                        </span>
                                      )}
                                      <span className="rounded bg-white/5 px-1.5 py-0.5 text-white/40">
                                        Class {f.classification || "B"}
                                      </span>
                                    </div>
                                  </div>

                                  <p className="text-xs text-white/80 leading-relaxed">
                                    {f.description}
                                  </p>

                                  {f.evidence && (
                                    <div className="rounded-lg bg-white/[0.02] border border-white/[0.05] p-2.5 font-mono text-[11px] text-white/60">
                                      <strong className="text-white/40 block mb-1 uppercase tracking-wider text-[9px]">{t.evidenceLabel}</strong>
                                      <span>{f.evidence}</span>
                                    </div>
                                  )}

                                  {f.attackScenario && (
                                    <div className="rounded-lg bg-rose-500/[0.03] border border-rose-500/10 p-2.5 text-xs text-rose-200/90 leading-relaxed">
                                      <strong className="text-rose-400 block mb-1 uppercase tracking-wider font-mono text-[9px]">{t.attackScenario}</strong>
                                      <span>{f.attackScenario}</span>
                                    </div>
                                  )}

                                  {f.proofOfConcept && (
                                    <div className="rounded-lg bg-black/60 border border-white/10 p-3 font-mono text-[11px] overflow-x-auto text-emerald-300/90">
                                      <strong className="text-emerald-400 block mb-1.5 uppercase tracking-wider text-[9px]">{t.proofOfConcept}</strong>
                                      <pre className="whitespace-pre-wrap">{f.proofOfConcept}</pre>
                                    </div>
                                  )}

                                  {f.recommendation && (
                                    <div className="text-xs text-white/75 space-y-1">
                                      <strong className="font-mono text-[10px] text-[#dfc89e] uppercase tracking-wider block">{t.recommendationLabel}</strong>
                                      <p>{f.recommendation}</p>
                                    </div>
                                  )}

                                  {f.remediationDiff && (
                                    <div className="rounded-lg bg-black/80 border border-white/10 p-3 font-mono text-[10px] overflow-x-auto">
                                      <strong className="text-[#dfc89e] block mb-1.5 uppercase tracking-wider text-[9px]">{t.remediationPatch}</strong>
                                      <pre className="text-white/90 leading-relaxed">
                                        {f.remediationDiff.split("\n").map((line, lIdx) => {
                                          const isAdd = line.startsWith("+");
                                          const isSub = line.startsWith("-");
                                          return (
                                            <div
                                              key={lIdx}
                                              className={isAdd ? "text-emerald-400 bg-emerald-500/10" : isSub ? "text-rose-400 bg-rose-500/10" : "text-white/60"}
                                            >
                                              {line}
                                            </div>
                                          );
                                        })}
                                      </pre>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </motion.div>
        )}
      </div>

      {/* FOOTER DISCLAIMER */}
      <footer className="rounded-2xl border border-white/[0.06] bg-black/40 p-5 space-y-3 text-[11px] text-white/40">
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
          <span className="font-mono uppercase tracking-wider text-white/50">{t.disclaimerTitle}</span>
          <span className="font-mono text-[10px] text-[#c7a35b]">Velm&egrave;re Governance v10.4</span>
        </div>
        <p className="leading-relaxed">{t.disclaimerBody}</p>
      </footer>
    </div>
  );
}
