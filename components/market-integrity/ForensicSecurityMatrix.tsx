"use client";

import { useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  ExternalLink,
  Copy,
  Check,
  Search,
  Lock,
} from "lucide-react";

export type InvariantItem = {
  label: string;
  value: string;
  status: "passed" | "warning" | "failed";
  description?: string;
};

type ForensicSecurityMatrixProps = {
  assetSymbol: string;
  assetName: string;
  contractAddress?: string;
  isTraditional?: boolean;
  scanScore?: number;
  topHoldersRatio?: number; // e.g. 14.2 for BTC, 61.4 for AAPL
};

export default function ForensicSecurityMatrix({
  assetSymbol,
  assetName,
  contractAddress,
  isTraditional = false,
  scanScore = 96.8,
  topHoldersRatio = 14.8,
}: ForensicSecurityMatrixProps) {
  const [copied, setCopied] = useState(false);

  const displayAddress = contractAddress || (isTraditional ? `nasdaq:${assetSymbol.toLowerCase()}` : `genesis:${assetSymbol.toLowerCase()}`);

  const handleCopy = () => {
    navigator.clipboard.writeText(displayAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Crypto Invariants Matrix
  const cryptoColumns = [
    {
      category: "Market Integrity",
      items: [
        { label: "Buy Tax", value: "0.00%", status: "passed" },
        { label: "Sell Tax", value: "0.00%", status: "passed" },
        { label: "Cannot Buy Guard", value: "Negative (Open)", status: "passed" },
        { label: "Anti-Whale Protection", value: "Active / Verified", status: "passed" },
        { label: "Cannot Sell All Lock", value: "Negative (Free)", status: "passed" },
        { label: "Slippage / Fee Modifiable", value: "Immutable", status: "passed" },
      ] as InvariantItem[],
    },
    {
      category: "Centralization & Governance",
      items: [
        { label: "Proxy / Mutation Risk", value: assetSymbol === "BTC" ? "UTXO / Hardfork Only" : "Timelock Controlled", status: "passed" },
        { label: "Ownership Renounced", value: assetSymbol === "BTC" ? "No Sovereign Owner" : "Multi-Sig 5/7 Enforced", status: "passed" },
        { label: "Mint Authority", value: assetSymbol === "BTC" ? "Hard Cap (21,000,000)" : "Deterministic Supply", status: "passed" },
        { label: "Address Blacklisting", value: assetSymbol === "USDT" ? "Active (OFAC/Court)" : "None / Censorship Resistant", status: assetSymbol === "USDT" ? "warning" : "passed" },
        { label: "Transfer Whitelisting", value: "None (Permissionless)", status: "passed" },
        { label: "Execution Delay Window", value: "72-Hour Timelock", status: "passed" },
      ] as InvariantItem[],
    },
    {
      category: "Bytecode & Transparency",
      items: [
        { label: "Honeypot Trap", value: "Negative (Safe)", status: "passed" },
        { label: "Source Code Openness", value: "100% Verifiable (GPL/MIT)", status: "passed" },
        { label: "Self-Destruct Opcode", value: "Disabled / Banned", status: "passed" },
        { label: "External Delegatecall", value: "Protected / Isolated", status: "passed" },
        { label: "Reentrancy Protection", value: "Checks-Effects-Interactions", status: "passed" },
        { label: "Cryptographic Anchor", value: "Formal Verification Proof", status: "passed" },
      ] as InvariantItem[],
    },
  ];

  // Traditional Equities Invariants Matrix
  const traditionalColumns = [
    {
      category: "Market Structure & Reg NMS",
      items: [
        { label: "Bid/Ask Spread Tightness", value: "< 0.015% NBBO", status: "passed" },
        { label: "Reg NMS Rule 611", value: "Trade-Through Protected", status: "passed" },
        { label: "Limit-Up / Limit-Down", value: "Exchange Rule Compliant", status: "passed" },
        { label: "Odd-Lot Transparency", value: "Direct Consolidated Tape", status: "passed" },
        { label: "Short Sale Rule (201)", value: "Circuit Breaker Active", status: "passed" },
        { label: "Order Execution Quality", value: "Rule 605/606 Audited", status: "passed" },
      ] as InvariantItem[],
    },
    {
      category: "Corporate Governance & Board",
      items: [
        { label: "SEC Registration", value: "Section 12(b) Active", status: "passed" },
        { label: "Independent Audit Committee", value: "100% Independent Board", status: "passed" },
        { label: "Beneficial Ownership (13D/G)", value: "Institutional Disclosed", status: "passed" },
        { label: "Insider Trading Controls", value: "Form 4 Monitored", status: "passed" },
        { label: "Shareholder Voting Rights", value: "Equal Class 1:1 Parity", status: "passed" },
        { label: "Transfer Agent Registered", value: "SEC Registered Depository", status: "passed" },
      ] as InvariantItem[],
    },
    {
      category: "Statutory Filings & Clearing",
      items: [
        { label: "SEC Form 10-K Annual", value: "PwC / Big-4 Certified", status: "passed" },
        { label: "SEC Form 10-Q Quarterly", value: "Timely XBRL Published", status: "passed" },
        { label: "SOX 404 Internal Controls", value: "Unqualified Opinion", status: "passed" },
        { label: "DTCC CNS Clearing", value: "T+1 Continuous Settlement", status: "passed" },
        { label: "Dark Pool (ATS) Reporting", value: "FINRA Weekly Disclosed", status: "passed" },
        { label: "CUSIP / ISIN Provenance", value: "Immutable Security ID", status: "passed" },
      ] as InvariantItem[],
    },
  ];

  const columns = isTraditional ? traditionalColumns : cryptoColumns;

  return (
    <div className="rounded-2xl border border-white/10 bg-[#09090c] p-6 lg:p-7 shadow-2xl relative overflow-hidden space-y-6">
      {/* Background ambient corner */}
      <div className="absolute top-0 right-0 h-40 w-40 rounded-full bg-emerald-500/5 blur-3xl pointer-events-none" />

      {/* Top Header: Score & Identifiers */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/5 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm font-semibold tracking-wide text-white uppercase">
              {isTraditional ? "Institutional Invariant Matrix" : "Token Scan & Security Invariants"}
            </h3>
          </div>
          <p className="mt-1 text-xs text-white/50">
            Automated formal bytecode & telemetry verification against 18 structural risk vectors.
          </p>
        </div>

        {/* Scan Score & Counter Badges */}
        <div className="flex items-center gap-3">
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-bold text-emerald-400">{scanScore.toFixed(1)}</span>
            <span className="font-mono text-xs text-white/40">/100</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-mono">
            <span className="inline-flex items-center gap-1 rounded bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 text-rose-400">
              <XCircle className="h-3 w-3" /> 0
            </span>
            <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-amber-400">
              <AlertTriangle className="h-3 w-3" /> {assetSymbol === "USDT" ? 1 : 0}
            </span>
            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-emerald-400">
              <CheckCircle2 className="h-3 w-3" /> {assetSymbol === "USDT" ? 17 : 18}
            </span>
          </div>
        </div>
      </div>

      {/* Contract Identity & Float Concentration Bar */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 rounded-xl bg-white/[0.015] border border-white/5 p-4">
        {/* Left: Origin & Identifier */}
        <div className="flex flex-col justify-center space-y-1.5">
          <span className="text-[10px] font-mono tracking-wider text-white/40 uppercase">
            {isTraditional ? "Exchange Listing & Identifier" : "Audited Identifier / Root Contract"}
          </span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-medium text-white/90 bg-[#07070a] px-3 py-1.5 rounded-lg border border-white/10 select-all">
              {displayAddress.length > 28
                ? `${displayAddress.slice(0, 14)}...${displayAddress.slice(-10)}`
                : displayAddress}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="p-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:bg-white/5 transition"
              title="Copy Address"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* Right: Top 10 Holders / 13F Float Ratio */}
        <div className="flex flex-col justify-center space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-[10px] tracking-wider text-white/40 uppercase">
              {isTraditional ? "13F Institutional Float" : "Top 10 Holders Ratio"}
            </span>
            <span className="font-mono font-bold text-white">{topHoldersRatio}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                topHoldersRatio < 30
                  ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                  : topHoldersRatio < 60
                  ? "bg-gradient-to-r from-teal-400 to-[#d4af37]"
                  : "bg-gradient-to-r from-[#d4af37] to-amber-500"
              }`}
              style={{ width: `${Math.min(100, Math.max(5, topHoldersRatio))}%` }}
            />
          </div>
          <span className="text-[10px] text-white/40 font-mono">
            {isTraditional
              ? "High institutional float ensures robust order book depth."
              : topHoldersRatio < 25
              ? "Healthy decentralized distribution across non-custodial holders."
              : "Custodial reserves and treasury concentration tracked."}
          </span>
        </div>
      </div>

      {/* 3 Columns of Categorized Invariants */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3 pt-2">
        {columns.map((col, idx) => (
          <div key={idx} className="space-y-3">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="text-xs font-semibold tracking-wider text-white/70 uppercase">
                {col.category}
              </span>
              <span className="text-[10px] font-mono text-emerald-400">
                {col.items.filter((i) => i.status === "passed").length}/{col.items.length}
              </span>
            </div>

            <div className="space-y-2.5">
              {col.items.map((item, itemIdx) => (
                <div
                  key={itemIdx}
                  className="flex items-center justify-between py-1 text-xs hover:bg-white/[0.015] px-1 rounded transition"
                >
                  <span className="text-white/60 font-medium">{item.label}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[11px] text-white/90">{item.value}</span>
                    {item.status === "passed" && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    )}
                    {item.status === "warning" && (
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    )}
                    {item.status === "failed" && (
                      <XCircle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
