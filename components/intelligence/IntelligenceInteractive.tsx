"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  Activity,
  ArrowUpRight,
  Binary,
  Braces,
  Database,
  Droplets,
  Fingerprint,
  Gauge,
  Layers3,
  LockKeyhole,
  Network,
  Radar,
  RefreshCw,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Waypoints,
} from "lucide-react";
import type { IntelligenceContent, IntelligenceLane } from "@/lib/intelligence/intelligence-content";
import { getIntelligenceTierMatrix } from "@/lib/intelligence/intelligence-tier-matrix";
import styles from "./IntelligencePage.module.css";

const laneIcons = [Activity, Droplets, Radar, Layers3, Network, Braces, Fingerprint, ScanSearch];

export function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  // Content is a progressive enhancement boundary: it must be readable in the
  // server render and when observers or client motion fail to initialise.
  const [visible, setVisible] = useState(true);
  const [active, setActive] = useState(true);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) {
      const frame = window.requestAnimationFrame(() => {
        setVisible(true);
        setActive(true);
      });
      return () => window.cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        setActive(entry.isIntersecting);
        if (entry.isIntersecting) {
          setVisible(true);
        }
      },
      { rootMargin: "220px 0px 220px 0px", threshold: 0.01 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-active={active ? "true" : "false"}
      className={`${styles.reveal} ${visible ? styles.revealVisible : ""} ${className}`}
    >
      {children}
    </div>
  );
}

function IntelligenceCore({ activeLane }: { activeLane: number }) {
  return (
    <div className={styles.engineCore} aria-hidden="true" style={{ "--lane": activeLane } as CSSProperties}>
      <svg viewBox="0 0 540 540" role="presentation">
        <defs>
          <radialGradient id="intelligence-core-glow">
            <stop offset="0" stopColor="#d4ad5b" stopOpacity=".22" />
            <stop offset=".55" stopColor="#56d8c9" stopOpacity=".07" />
            <stop offset="1" stopColor="#020708" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="intelligence-core-line" x1="0" x2="1">
            <stop stopColor="#57d8ca" stopOpacity=".45" />
            <stop offset=".48" stopColor="#d5b263" stopOpacity=".95" />
            <stop offset="1" stopColor="#57d8ca" stopOpacity=".32" />
          </linearGradient>
        </defs>
        <circle cx="270" cy="270" r="225" fill="url(#intelligence-core-glow)" />
        {[210, 174, 138, 102].map((radius, index) => (
          <circle key={radius} cx="270" cy="270" r={radius} className={styles.coreOrbit} style={{ animationDelay: `${index * -1.2}s` }} />
        ))}
        {Array.from({ length: 8 }, (_, index) => {
          const angle = (Math.PI * 2 * index) / 8 - Math.PI / 2;
          const x = 270 + Math.cos(angle) * 210;
          const y = 270 + Math.sin(angle) * 210;
          return (
            <g key={index} className={index === activeLane ? styles.coreNodeActive : styles.coreNode}>
              <line x1="270" y1="270" x2={x} y2={y} />
              <circle cx={x} cy={y} r={index === activeLane ? 7 : 4} />
            </g>
          );
        })}
        <path className={styles.coreShield} d="M270 158 348 190v66c0 62-32 102-78 127-46-25-78-65-78-127v-66l78-32Z" />
        <path className={styles.corePulse} d="M214 272h35l13-31 19 60 17-42 11 13h28" />
        <circle cx="270" cy="270" r="54" className={styles.coreCenter} />
      </svg>
      <div className={styles.coreLabel}>0{activeLane + 1} / 08</div>
    </div>
  );
}

function LaneSignalVisual({ lane }: { lane: IntelligenceLane }) {
  const profile = lane.id;
  return (
    <div className={styles.laneSignalVisual} data-profile={profile} aria-hidden="true">
      <svg viewBox="0 0 420 126" preserveAspectRatio="none">
        <path className={styles.laneSignalGrid} d="M0 25h420M0 63h420M0 101h420" />
        {profile === "velocity" ? <path className={styles.laneSignalPath} d="M8 91 58 87 102 84 146 70 190 74 224 42 260 45 292 18 335 29 412 12" /> : null}
        {profile === "liquidity" ? <><path className={styles.laneDepthBid} d="M8 105 8 84 58 84 58 76 108 76 108 64 158 64 158 51 208 51" /><path className={styles.laneDepthAsk} d="M212 51 262 51 262 64 312 64 312 76 362 76 362 84 412 84 412 105" /><path className={styles.laneSignalMarker} d="M210 15v96" /></> : null}
        {profile === "microstructure" ? <><path className={styles.laneSignalPath} d="M8 71 42 68 76 72 110 49 144 75 178 47 212 84 246 53 280 79 314 45 348 68 412 59" /><path className={styles.laneSignalMarker} d="M181 17v94M236 17v94" /></> : null}
        {profile === "supply" ? <><circle className={styles.laneRing} cx="116" cy="63" r="38" /><path className={styles.laneRingAccent} d="M116 25a38 38 0 0 1 36 50" /><rect className={styles.laneBlock} x="196" y="41" width="55" height="44" rx="5" /><path className={styles.laneSignalPath} d="M263 63h42l26-24 31 24h50" /></> : null}
        {profile === "holders" ? <><circle className={styles.laneNodeStrong} cx="89" cy="63" r="25" />{[[162,31],[181,83],[235,48],[278,87],[331,36],[374,70]].map(([cx,cy]) => <circle key={`${cx}-${cy}`} className={styles.laneNode} cx={cx} cy={cy} r="7" />)}<path className={styles.laneConnections} d="M112 53 155 35M113 72l61 9M114 61l114-12M114 69l157 16M114 55l210-18M114 65l253 5" /></> : null}
        {profile === "contract" ? <><rect className={styles.laneBlock} x="18" y="39" width="76" height="49" rx="7" /><rect className={styles.laneBlock} x="172" y="20" width="76" height="49" rx="7" /><rect className={styles.laneBlock} x="326" y="56" width="76" height="49" rx="7" /><path className={styles.laneConnections} d="M94 63h49l29-19M248 44h36l42 36" /><circle className={styles.laneNodeStrong} cx="143" cy="63" r="5" /><circle className={styles.laneNodeStrong} cx="284" cy="44" r="5" /></> : null}
        {profile === "evidence" ? <><path className={styles.laneSignalPath} d="M8 91 65 70 120 76 178 48 235 55 294 30 352 42 412 18" />{[65,120,178,235,294,352].map((cx,index) => <circle key={cx} className={index === 4 ? styles.laneNodeStale : styles.laneNodeStrong} cx={cx} cy={[70,76,48,55,30,42][index]} r="5" />)}</> : null}
        {profile === "context" ? <>{["TOKEN","EQUITY","ETF","FX"].map((label,index) => <g key={label} className={index === 1 ? styles.laneContextActive : styles.laneContext}><rect x={12 + index * 103} y="38" width="86" height="51" rx="7" /><text x={55 + index * 103} y="68">{label}</text></g>)}</> : null}
      </svg>
      <span>{lane.signal}</span>
    </div>
  );
}

export function RiskEngineSection({ copy }: { copy: IntelligenceContent["engine"] }) {
  const [active, setActive] = useState(0);

  const lane = copy.lanes[active];

  return (
    <div className={styles.engineLayout}>
      <div className={styles.engineLaneList} aria-label={copy.instruction}>
        {copy.lanes.map((item, index) => {
          const Icon = laneIcons[index];
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={active === index}
              className={`${styles.engineLane} ${active === index ? styles.engineLaneActive : ""}`}
              onClick={() => setActive(index)}
              onPointerEnter={() => setActive(index)}
            >
              <span className={styles.laneIndex}>0{index + 1}</span>
              <Icon size={18} aria-hidden="true" />
              <span>{item.label}</span>
              <ArrowUpRight size={15} aria-hidden="true" />
            </button>
          );
        })}
      </div>

      <div className={styles.engineSticky}>
        <IntelligenceCore activeLane={active} />
      </div>

      <div className={styles.engineDetail} aria-live="polite">
        <div className={styles.engineDetailMeta}>
          <span>0{active + 1} / 08</span>
          <span>{lane.signal}</span>
        </div>
        <h3>{lane.label}</h3>
        <p>{lane.description}</p>
        <LaneSignalVisual lane={lane} />
        <div className={styles.evidenceBoundary}>
          <span>{copy.evidenceLabel}</span>
          <p>{lane.evidence}</p>
        </div>
      </div>
    </div>
  );
}

function MetricRing({ value, label, tone }: { value: number; label: string; tone: "gold" | "teal" | "muted" }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={styles.metricRing} data-tone={tone} style={{ "--metric": `${clamped * 3.6}deg` } as CSSProperties}>
      <div><strong>{clamped}</strong><span>/100</span></div>
      <p>{label}</p>
    </div>
  );
}

export function EvidenceDemo({ copy }: { copy: IntelligenceContent["triad"] }) {
  const [completeness, setCompleteness] = useState(82);
  const confidence = Math.round(28 + completeness * 0.67);
  const uncertainty = Math.round(100 - completeness * 0.82);
  const missing = 100 - completeness;

  return (
    <div className={styles.triadGrid}>
      <div className={styles.triadCards}>
        {[
          { ...copy.risk, icon: Gauge },
          { ...copy.confidence, icon: ShieldCheck },
          { ...copy.uncertainty, icon: Waypoints },
        ].map((item, index) => {
          const Icon = item.icon;
          return (
            <article key={item.label} className={styles.triadCard}>
              <Icon aria-hidden="true" />
              <span>0{index + 1}</span>
              <h3>{item.label}</h3>
              <p>{item.description}</p>
            </article>
          );
        })}
      </div>
      <div className={styles.evidenceDemo}>
        <span className={styles.eyebrow}>{copy.demoLabel}</span>
        <h3>{copy.demoTitle}</h3>
        <div className={styles.demoRings}>
          <MetricRing value={64} label={copy.risk.label} tone="gold" />
          <MetricRing value={confidence} label={copy.confidence.label} tone="teal" />
          <MetricRing value={uncertainty} label={copy.uncertainty.label} tone="muted" />
        </div>
        <label className={styles.evidenceSlider}>
          <span><b>{copy.completeness}</b><strong>{completeness}%</strong></span>
          <input
            type="range"
            min="25"
            max="100"
            value={completeness}
            onChange={(event) => setCompleteness(Number(event.currentTarget.value))}
          />
        </label>
        <div className={styles.missingEvidence}>
          <span>{copy.missing}</span>
          <div><i style={{ width: `${missing}%` }} /></div>
          <b>{missing}%</b>
        </div>
        <p className={styles.demoNote}>{copy.demoNote}</p>
      </div>
    </div>
  );
}

export function EvidenceTransformation({ copy, replayLabel }: { copy: IntelligenceContent; replayLabel: string }) {
  const [run, setRun] = useState(0);
  const streams = [
    copy.engine.lanes[2]?.label,
    copy.engine.lanes[1]?.label,
    copy.engine.lanes[4]?.label,
    copy.engine.lanes[5]?.label,
    copy.engine.lanes[6]?.label,
    copy.pipeline.stages[6],
  ].filter(Boolean) as string[];
  const outputs = [copy.triad.risk.label, copy.triad.confidence.label, copy.triad.uncertainty.label, copy.triad.missing];

  return (
    <div className={styles.evidenceTransformation} key={run}>
      <div className={styles.evidenceTransformationToolbar}>
        <span><i />{copy.triad.demoLabel}</span>
        <button type="button" onClick={() => setRun((value) => value + 1)}><RefreshCw size={14} />{replayLabel}</button>
      </div>
      <div className={styles.evidenceTransformationCanvas} role="img" aria-label={`${copy.comparison.intro} ${copy.triad.intro}`}>
        <svg className={styles.evidenceTransformationNetwork} viewBox="0 0 1200 520" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="evidence-transform-line" x1="0" x2="1">
              <stop stopColor="#d2ad5b" stopOpacity=".85" />
              <stop offset=".55" stopColor="#4bcbbc" stopOpacity=".72" />
              <stop offset="1" stopColor="#e8e4dc" stopOpacity=".28" />
            </linearGradient>
            <radialGradient id="evidence-transform-core">
              <stop stopColor="#d2ad5b" stopOpacity=".2" />
              <stop offset=".72" stopColor="#4bcbbc" stopOpacity=".04" />
              <stop offset="1" stopColor="#020506" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="730" cy="260" r="150" fill="url(#evidence-transform-core)" />
          {[92, 158, 224, 290, 356, 422].map((y, index) => (
            <path key={`input-${y}`} className={styles.evidenceInputPath} style={{ "--path-index": index } as CSSProperties} d={`M184 260 C290 260 310 ${y} 430 ${y} S610 ${y} 690 245`} />
          ))}
          {[130, 220, 310, 400].map((y, index) => (
            <path key={`output-${y}`} className={styles.evidenceOutputPath} style={{ "--path-index": index } as CSSProperties} d={`M770 260 C850 260 860 ${y} 1005 ${y}`} />
          ))}
          <path className={styles.evidenceFracture} d="M176 178 159 219 187 252 164 288 181 337" />
        </svg>

        <div className={styles.isolatedScore}>
          <span>{copy.comparison.columns[0]?.title}</span>
          <strong>42<small>/100</small></strong>
          <p>{copy.comparison.columns[0]?.items[0]}<br />{copy.comparison.columns[0]?.items[1]}</p>
          <i aria-hidden /><i aria-hidden /><i aria-hidden />
        </div>

        <div className={styles.evidenceStreams}>
          {streams.map((stream, index) => <span key={stream} style={{ "--stream-index": index } as CSSProperties}><i />{stream}</span>)}
        </div>

        <div className={styles.evidenceBrainCore}>
          <span>VLM</span>
          <b>BRAIN</b>
          <i /><i /><i />
        </div>

        <div className={styles.explainableOutputs}>
          {outputs.map((output, index) => <span key={output} style={{ "--output-index": index } as CSSProperties}><small>0{index + 1}</small><b>{output}</b><i /></span>)}
        </div>
      </div>
      <div className={styles.evidenceTransformationSummary}>
        {copy.comparison.columns.map((column, index) => (
          <article key={column.title}>
            <span>0{index + 1}</span><h3>{column.title}</h3><p>{column.items.join(" · ")}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

export type IntelligenceTier = {
  id: "basic" | "pro" | "advanced";
  label: string;
  subtitle: string;
  price: string;
  signals: number;
};

export function TierComparison({
  copy,
  locale,
  marketTiers,
}: {
  copy: IntelligenceContent["tiers"];
  locale: IntelligenceContent["locale"];
  marketTiers: IntelligenceTier[];
}) {
  const [selectedTierId, setSelectedTierId] = useState<IntelligenceTier["id"]>("pro");
  const selectedTier = marketTiers.find((tier) => tier.id === selectedTierId) ?? marketTiers[1] ?? marketTiers[0];
  const matrix = getIntelligenceTierMatrix(locale, [
    marketTiers[0]?.signals ?? 10,
    marketTiers[1]?.signals ?? 14,
    marketTiers[2]?.signals ?? 20,
  ]);

  return (
    <div className={styles.tierExperience}>
      <div className={styles.tierProductLabel}><Activity size={15} aria-hidden /><span>{copy.marketTab}</span><i /></div>
      <div className={styles.tierGrid} role="tablist" aria-label={copy.title}>
        {marketTiers.map((tier) => (
          <button key={tier.id} type="button" role="tab" aria-selected={selectedTier.id === tier.id} onClick={() => setSelectedTierId(tier.id)} className={styles.tierCard} data-tier={tier.id}>
            <div className={styles.tierCardTop}>
              <span>0{tier.id === "basic" ? 1 : tier.id === "pro" ? 2 : 3}</span>
              {tier.id === "pro" ? <b>{copy.recommended}</b> : null}
            </div>
            <h3>{tier.label}</h3>
            <p>{tier.subtitle}</p>
            <div className={styles.tierPrice}>{tier.price}</div>
            <div className={styles.signalCount}>{tier.signals} {copy.signalsLabel}</div>
            <span className={styles.tierHighlights} aria-hidden="true">
              {copy.marketFeatures[tier.id].slice(0, 3).map((feature) => <span key={feature}><i />{feature}</span>)}
            </span>
            <span className={styles.tierInspect}>{copy.marketFeatures[tier.id].length} {copy.capabilitiesLabel}<ArrowUpRight size={14} /></span>
          </button>
        ))}
      </div>
      <div className={styles.tierMatrixBlock}>
        <div className={styles.tierMatrixHeader}>
          <span>{copy.marketTab}</span>
          <h3>{copy.capabilitiesLabel}</h3>
          <p>{copy.note}</p>
        </div>
        <div className={styles.tierMatrixDesktop} role="region" tabIndex={0} aria-label={`${copy.marketTab} ${copy.capabilitiesLabel}`}>
          <table>
            <thead><tr><th scope="col">{copy.capabilitiesLabel}</th>{marketTiers.map((tier) => <th scope="col" key={tier.id}>{tier.label}</th>)}</tr></thead>
            <tbody>
              {matrix.map((row) => (
                <tr key={row.id}>
                  <th scope="row">{row.label}</th>
                  {row.cells.map((cell, index) => <td key={`${row.id}-${marketTiers[index]?.id}`}><span className={styles.tierMatrixCell} data-state={cell.state}><i aria-hidden />{cell.label}</span></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.tierMatrixMobile}>
          {matrix.map((row) => (
            <details key={row.id}>
              <summary>{row.label}<ArrowUpRight size={14} /></summary>
              <div>{row.cells.map((cell, index) => <p key={`${row.id}-mobile-${marketTiers[index]?.id}`}><b>{marketTiers[index]?.label}</b><span className={styles.tierMatrixCell} data-state={cell.state}><i aria-hidden />{cell.label}</span></p>)}</div>
            </details>
          ))}
        </div>
      </div>
      <div className={styles.entitlementNote}><LockKeyhole size={16} /><p>{copy.note}</p></div>
    </div>
  );
}

export function PipelineGraphic({ stages }: { stages: string[] }) {
  const icons = [Database, Binary, Activity, Fingerprint, Network, Gauge, ShieldCheck, Sparkles];
  return (
    <ol className={styles.pipelineList}>
      {stages.map((stage, index) => {
        const Icon = icons[index];
        return (
          <li key={stage}>
            <span>0{index + 1}</span>
            <div><Icon aria-hidden="true" /><b>{stage}</b></div>
            {index < stages.length - 1 ? <i aria-hidden="true" /> : null}
          </li>
        );
      })}
    </ol>
  );
}
