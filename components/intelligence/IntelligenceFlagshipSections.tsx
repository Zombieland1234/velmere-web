"use client";

import { useState, type CSSProperties } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  BadgeCheck,
  Beaker,
  Blocks,
  CircleDot,
  Database,
  Droplets,
  FileCheck2,
  Fingerprint,
  Gauge,
  LockKeyhole,
  Network,
  Radar,
  ScanSearch,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Waves,
} from "lucide-react";
import type {
  AuditDepthTier,
  IntelligenceFlagshipCopy,
  LiquidityExperiment,
  MarketImpactScenario,
  WhaleBand,
} from "@/lib/intelligence/intelligence-flagship-content";
import type { IntelligenceTier } from "./IntelligenceInteractive";
import styles from "./IntelligenceFlagshipSections.module.css";

const orderSizes = ["1M", "10M", "50M"] as const;

const depthPaths = {
  normal: {
    bid: "M12 24H68V30H122V39H176V50H230V63H284V77H338V92H392V109H446V130H500V148",
    ask: "M500 148H554V130H608V109H662V92H716V77H770V63H824V50H878V39H932V30H988V24",
  },
  stressed: {
    bid: "M12 38H82V44H154V54H226V69H298V88H370V112H442V148H500",
    ask: "M500 148H558V116H630V92H702V72H774V58H846V49H918V43H988V38",
  },
  thin: {
    bid: "M12 54H102V60H192V73H282V96H372V125H456V148H500",
    ask: "M500 148H548V129H628V103H718V79H808V65H898V57H988V54",
  },
} as const;

const labValues = {
  normal: [
    { spread: "1.8 bps", slippage: "0.04%", impact: "−0.03%", consumed: "1.1%" },
    { spread: "2.2 bps", slippage: "0.21%", impact: "−0.18%", consumed: "8.4%" },
    { spread: "3.1 bps", slippage: "0.78%", impact: "−0.69%", consumed: "34.8%" },
  ],
  stressed: [
    { spread: "3.4 bps", slippage: "0.09%", impact: "−0.07%", consumed: "2.8%" },
    { spread: "5.8 bps", slippage: "0.42%", impact: "−0.36%", consumed: "16.7%" },
    { spread: "9.6 bps", slippage: "1.64%", impact: "−1.41%", consumed: "58.6%" },
  ],
  thin: [
    { spread: "7.2 bps", slippage: "0.18%", impact: "−0.15%", consumed: "5.9%" },
    { spread: "12.4 bps", slippage: "0.88%", impact: "−0.73%", consumed: "31.5%" },
    { spread: "24.8 bps", slippage: "3.12%", impact: "−2.71%", consumed: "82.4%" },
  ],
} as const;

function LaboratoryDepth({ regime, direction }: { regime: keyof typeof depthPaths; direction: number }) {
  const path = depthPaths[regime];

  return (
    <svg className={styles.liquidityDepthSvg} viewBox="0 0 1000 180" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="vlm-lab-bid" x1="0" x2="1">
          <stop offset="0" stopColor="rgba(43, 207, 183, .04)" />
          <stop offset="1" stopColor="rgba(43, 207, 183, .32)" />
        </linearGradient>
        <linearGradient id="vlm-lab-ask" x1="0" x2="1">
          <stop offset="0" stopColor="rgba(203, 164, 73, .28)" />
          <stop offset="1" stopColor="rgba(203, 164, 73, .04)" />
        </linearGradient>
      </defs>
      <path className={styles.liquidityGridLine} d="M0 42H1000M0 94H1000M0 148H1000" />
      <path className={styles.liquidityBidArea} d={`${path.bid}H12Z`} fill="url(#vlm-lab-bid)" />
      <path className={styles.liquidityAskArea} d={`${path.ask}H988Z`} fill="url(#vlm-lab-ask)" />
      <path className={styles.liquidityBidPath} d={path.bid} />
      <path className={styles.liquidityAskPath} d={path.ask} />
      <path className={styles.liquidityMidLine} d="M500 10V166" />
      <g className={styles.liquidityOrderMarker} data-direction={direction === 0 ? "buy" : "sell"}>
        <circle cx={direction === 0 ? 568 : 432} cy="105" r="8" />
        <path d={direction === 0 ? "M530 105h29m-10-10 10 10-10 10" : "M470 105h-29m10-10-10 10 10 10"} />
      </g>
    </svg>
  );
}

function LiquidityFlaskVisual({
  experiment,
  regime,
  sizeIndex,
  direction,
}: {
  experiment: LiquidityExperiment["id"];
  regime: keyof typeof labValues;
  sizeIndex: number;
  direction: number;
}) {
  const fillTop = 240 - sizeIndex * 32;
  return (
    <div className={styles.liquidityFlaskVisual} data-experiment={experiment} data-regime={regime} data-direction={direction === 0 ? "buy" : "sell"}>
      <svg viewBox="0 0 260 340" role="img" aria-label="Illustrative liquidity experiment flask">
        <defs>
          <clipPath id="liquidity-flask-clip"><path d="M102 22h56v86l69 139c18 37-3 67-45 67H78c-42 0-63-30-45-67l69-139Z" /></clipPath>
          <linearGradient id="liquidity-fluid" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#55e0cf" stopOpacity=".78" /><stop offset=".58" stopColor="#1f9f92" stopOpacity=".48" /><stop offset="1" stopColor="#071717" stopOpacity=".8" /></linearGradient>
          <linearGradient id="liquidity-glass" x1="0" x2="1"><stop stopColor="#e9e4d8" stopOpacity=".08" /><stop offset=".5" stopColor="#fff" stopOpacity=".02" /><stop offset="1" stopColor="#d2ad5b" stopOpacity=".1" /></linearGradient>
          <filter id="liquidity-glow"><feGaussianBlur stdDeviation="4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <g className={styles.flaskMeasurements}>{[132,156,180,204,228,252,276].map((y, index) => <g key={y}><path d={`M45 ${y}h${index % 2 ? 12 : 18}`} /><text x="24" y={y + 3}>{index + 1}</text></g>)}</g>
        <g clipPath="url(#liquidity-flask-clip)" className={styles.flaskLiquid}>
          <rect x="18" y={fillTop} width="224" height={330 - fillTop} fill="url(#liquidity-fluid)" />
          <path d={`M12 ${fillTop + 5}C48 ${fillTop - 10} 83 ${fillTop + 15} 119 ${fillTop + 2}S190 ${fillTop - 8} 248 ${fillTop + 5}V340H12Z`} fill="rgba(77, 215, 198, .34)" />
          {[{x:68,y:265,r:5},{x:94,y:238,r:3},{x:130,y:274,r:7},{x:164,y:248,r:4},{x:196,y:286,r:6},{x:150,y:208,r:3}].map((bubble, index) => <circle key={index} style={{ "--bubble-index": index } as CSSProperties} cx={bubble.x} cy={bubble.y} r={bubble.r} />)}
          {experiment === "concentration" ? <g className={styles.flaskConcentration}><circle cx="82" cy="255" r="26" /><circle cx="170" cy="275" r="36" /><circle cx="150" cy="220" r="18" /></g> : null}
          {experiment === "flow" ? <g className={styles.flaskSmartFlow}><path d="M58 274C86 225 117 285 143 226S200 213 213 170" /><circle cx="58" cy="274" r="4" /><circle cx="143" cy="226" r="4" /><circle cx="213" cy="170" r="4" /></g> : null}
        </g>
        <path className={styles.flaskGlass} fill="url(#liquidity-glass)" d="M102 22h56v86l69 139c18 37-3 67-45 67H78c-42 0-63-30-45-67l69-139Z" />
        <path className={styles.flaskOutline} d="M102 22h56v86l69 139c18 37-3 67-45 67H78c-42 0-63-30-45-67l69-139Z" />
        <path className={styles.flaskRim} d="M94 22h72M97 14h66v16H97Z" />
        {experiment === "slippage" ? <g className={styles.flaskPour}><path d="M130 0v96" /><circle cx="130" cy="104" r="7" /><circle cx="130" cy="76" r="4" /><circle cx="130" cy="49" r="3" /></g> : null}
        {experiment === "exit" ? <g className={styles.flaskExit}><path d="M182 204c44-5 60-31 68-65" /><path d="m241 151 9-12 3 14" /><circle cx="182" cy="204" r="6" /></g> : null}
        {experiment === "depth" ? <g className={styles.flaskDepthContours}>{[0,1,2].map((index) => <path key={index} d={`M${54-index*8} ${278-index*26}C92 ${248-index*22} 174 ${248-index*22} ${206+index*8} ${278-index*26}`} />)}</g> : null}
        <g className={styles.flaskSensor} filter="url(#liquidity-glow)"><circle cx="130" cy={fillTop + 4} r="5" /><path d={`M130 ${fillTop + 4}h92`} /></g>
      </svg>
      <span>0{["depth", "slippage", "concentration", "flow", "exit"].indexOf(experiment) + 1}</span>
    </div>
  );
}

export function LiquidityLabSection({ copy }: { copy: IntelligenceFlagshipCopy["liquidityLab"] }) {
  const [sizeIndex, setSizeIndex] = useState(1);
  const [modeId, setModeId] = useState<keyof typeof labValues>("normal");
  const [direction, setDirection] = useState(1);
  const [experimentId, setExperimentId] = useState<LiquidityExperiment["id"]>("depth");
  const selectedMode = copy.modes.find((mode) => mode.id === modeId) ?? copy.modes[0];
  const selectedExperiment = copy.experiments.find((experiment) => experiment.id === experimentId) ?? copy.experiments[0];
  const values = labValues[modeId][sizeIndex];

  return (
    <div className={styles.liquidityLab} data-regime={modeId}>
      <div className={styles.liquidityControlRail}>
        <div className={styles.liquidityControlHeading}>
          <Beaker aria-hidden="true" />
          <div><span>{copy.eyebrow}</span><h3>{copy.scienceTitle}</h3></div>
        </div>

        <label className={styles.liquiditySizeControl}>
          <span>{copy.amountLabel}</span>
          <strong>{orderSizes[sizeIndex]}</strong>
          <input
            type="range"
            min="0"
            max="2"
            step="1"
            value={sizeIndex}
            aria-valuetext={orderSizes[sizeIndex]}
            onChange={(event) => setSizeIndex(Number(event.currentTarget.value))}
          />
          <i><small>1M</small><small>10M</small><small>50M</small></i>
        </label>

        <fieldset className={styles.liquidityDirectionControl}>
          <legend>{copy.directionLabel}</legend>
          <div>
            {copy.directions.map((label, index) => (
              <button key={label} type="button" aria-pressed={direction === index} onClick={() => setDirection(index)}>{label}</button>
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.liquidityModeControl}>
          <legend>{copy.modeLabel}</legend>
          <div>
            {copy.modes.map((mode) => (
              <button key={mode.id} type="button" aria-pressed={mode.id === modeId} onClick={() => setModeId(mode.id)}>
                <span>{mode.label}</span><small>{mode.description}</small>
              </button>
            ))}
          </div>
        </fieldset>

        <p className={styles.liquidityModeSummary} aria-live="polite"><CircleDot size={14} />{selectedMode.description}</p>
      </div>

      <div className={styles.liquidityStage}>
        <div className={styles.liquidityStageHeader}>
          <div><span>{copy.depthTitle}</span><b>{orderSizes[sizeIndex]} / {selectedMode.label}</b></div>
          <div className={styles.liquidityLegend}><span><i />{copy.bid}</span><span><i />{copy.ask}</span></div>
        </div>
        <div className={styles.liquidityDepthChart}>
          <LaboratoryDepth regime={modeId} direction={direction} />
          <span className={styles.liquidityMidLabel}>{copy.mid}<b>100.00</b></span>
        </div>
        <div className={styles.liquidityReadouts} aria-live="polite">
          <article><Waves /><span>{copy.metrics.spread}</span><strong>{values.spread}</strong></article>
          <article><ArrowDownRight /><span>{copy.metrics.slippage}</span><strong>{values.slippage}</strong></article>
          <article><Activity /><span>{copy.metrics.impact}</span><strong>{values.impact}</strong></article>
          <article><Droplets /><span>{copy.metrics.consumed}</span><strong>{values.consumed}</strong></article>
        </div>
        <div className={styles.liquidityScienceFlow}>
          {copy.scienceSteps.map((step, index) => (
            <article key={step.label}>
              <span>0{index + 1}</span><i />
              <div><b>{step.label}</b><small>{step.note}</small></div>
            </article>
          ))}
        </div>
      </div>

      <aside className={styles.liquidityResultPanel}>
        <fieldset className={styles.liquidityExperimentSelector}>
          <legend>{copy.experimentLabel}</legend>
          <div>{copy.experiments.map((experiment, index) => <button key={experiment.id} type="button" aria-pressed={experiment.id === experimentId} onClick={() => setExperimentId(experiment.id)}><span>0{index + 1}</span><b>{experiment.label}</b></button>)}</div>
        </fieldset>
        <LiquidityFlaskVisual experiment={experimentId} regime={modeId} sizeIndex={sizeIndex} direction={direction} />
        <h3>{selectedExperiment.label}</h3>
        <p className={styles.liquidityExperimentDescription}>{selectedExperiment.description}</p>
        <h4>{copy.resultTitle}</h4>
        <ul>{copy.resultNotes.map((note) => <li key={note}><ShieldCheck size={15} />{note}</li>)}</ul>
      </aside>
    </div>
  );
}

const auditIcons = [Fingerprint, Network, Database, Radar, FileCheck2, LockKeyhole];

function AuditEvidenceMap({ tier, copy }: { tier: AuditDepthTier; copy: IntelligenceFlagshipCopy["securityAudits"] }) {
  return (
    <div className={styles.auditEvidenceMap} data-tier={tier.id}>
      <div className={styles.auditMapHeading}><span>{copy.evidenceTitle}</span><b>{tier.kicker}</b></div>
      <div className={styles.auditMapCanvas} aria-hidden="true">
        <svg viewBox="0 0 520 290" preserveAspectRatio="xMidYMid meet">
          <path className={styles.auditMapOrbit} d="M260 30C379 30 472 87 472 145S379 260 260 260 48 203 48 145 141 30 260 30Z" />
          <path className={styles.auditMapOrbit} d="M260 64C348 64 416 100 416 145s-68 81-156 81-156-36-156-81 68-81 156-81Z" />
          <path className={styles.auditMapConnections} d="M260 145 123 88M260 145 397 88M260 145 107 199M260 145 413 199M260 145V39M260 145v111" />
        </svg>
        <div className={styles.auditMapCore}><ShieldCheck /><span>VLM</span><i /></div>
        {tier.evidenceLanes.map((lane, index) => {
          const Icon = auditIcons[index % auditIcons.length];
          return <span key={lane} className={styles.auditMapNode} data-node={index}><Icon /><b>{lane}</b></span>;
        })}
      </div>
      <p><ScanSearch size={15} />{copy.evidenceNote}</p>
    </div>
  );
}

export function SecurityAuditsDepthSection({ copy, auditTiers }: { copy: IntelligenceFlagshipCopy["securityAudits"]; auditTiers: IntelligenceTier[] }) {
  const [selectedId, setSelectedId] = useState<AuditDepthTier["id"]>("pro");
  const selected = copy.tiers.find((tier) => tier.id === selectedId) ?? copy.tiers[1];

  return (
    <div className={styles.auditDepthExperience} data-tier={selected.id}>
      <div className={styles.auditTierSelector} role="tablist" aria-label={copy.selectorLabel}>
        {copy.tiers.map((tier, index) => {
          const canonicalTier = auditTiers.find((item) => item.id === tier.id);
          return (
          <button
            key={tier.id}
            type="button"
            role="tab"
            id={`audit-tier-${tier.id}`}
            aria-selected={selected.id === tier.id}
            aria-controls="audit-depth-panel"
            onClick={() => setSelectedId(tier.id)}
          >
            <span>0{index + 1}</span><div><small>{tier.kicker}</small><b>{tier.label}</b><strong>{canonicalTier?.price}</strong></div><ArrowRight size={16} />
          </button>
          );
        })}
      </div>

      <div className={styles.auditStatusRail}>
        <h3>{copy.statusTitle}</h3>
        <ol>{copy.states.map((state, index) => {
          const currentIndex = selected.id === "basic" ? 1 : selected.id === "pro" ? 2 : 3;
          return <li key={state} data-state={index === currentIndex ? "current" : index < currentIndex ? "observed" : "bounded"}><span>0{index + 1}</span><i /><b>{state}</b></li>;
        })}</ol>
      </div>

      <div className={styles.auditDepthPanel} id="audit-depth-panel" role="tabpanel" aria-labelledby={`audit-tier-${selected.id}`}>
        <article className={styles.auditTierNarrative} key={selected.id}>
          <span>{selected.kicker}</span>
          <h3>{selected.label}</h3>
          <p>{selected.description}</p>
          <ul>{selected.capabilities.map((capability) => <li key={capability}><BadgeCheck size={15} />{capability}</li>)}</ul>
          <blockquote><Sparkles size={16} /><p>{selected.outcome}</p></blockquote>
        </article>
        <AuditEvidenceMap tier={selected} copy={copy} />
        <article className={styles.auditReportPreview} aria-label={copy.reportLabel}>
          <div className={styles.auditReportPaper}>
            <header><span>VELMÈRE</span><b>SECURITY AUDIT</b></header>
            <div><i /><i /><i /><i /></div>
            <footer><small>TRACE / 0{copy.tiers.findIndex((tier) => tier.id === selected.id) + 1}</small><strong>{selected.id.toUpperCase()}</strong></footer>
          </div>
          <div className={styles.auditBoundaryCard}><LockKeyhole /><span>{copy.boundaryLabel}</span><b>{selected.evidenceLanes.length} / 6</b></div>
        </article>
      </div>

      <div className={styles.auditComparisonTable}>
        <h3>{copy.comparisonTitle}</h3>
        <div role="region" tabIndex={0} aria-label={copy.comparisonTitle}>
          <table>
            <thead><tr><th scope="col" /><th scope="col">Basic</th><th scope="col">Pro</th><th scope="col">Advanced</th></tr></thead>
            <tbody>{copy.comparison.map((row) => <tr key={row.label}><th scope="row">{row.label}</th><td>{row.basic}</td><td>{row.pro}</td><td>{row.advanced}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ImpactDepthChart({ scenario }: { scenario: MarketImpactScenario }) {
  return (
    <svg className={styles.impactDepthSvg} viewBox="0 0 1000 220" preserveAspectRatio="none" aria-hidden="true" data-scenario={scenario.id}>
      <defs>
        <linearGradient id="impact-bid" x1="0" x2="1"><stop stopColor="rgba(29, 192, 168, .32)" /><stop offset="1" stopColor="rgba(29, 192, 168, .04)" /></linearGradient>
        <linearGradient id="impact-ask" x1="0" x2="1"><stop stopColor="rgba(225, 226, 220, .03)" /><stop offset="1" stopColor="rgba(225, 226, 220, .22)" /></linearGradient>
      </defs>
      <path className={styles.impactGridLine} d="M0 55H1000M0 110H1000M0 165H1000" />
      <path className={styles.impactBidFill} fill="url(#impact-bid)" d="M0 30H95V40H180V51H270V66H355V84H430V109H500V210H0Z" />
      <path className={styles.impactAskFill} fill="url(#impact-ask)" d="M500 210V109H570V84H645V66H730V51H820V40H905V30H1000V210Z" />
      <path className={styles.impactBidPath} d="M0 30H95V40H180V51H270V66H355V84H430V109H500" />
      <path className={styles.impactAskPath} d="M500 109H570V84H645V66H730V51H820V40H905V30H1000" />
      <path className={styles.impactMidLine} d="M500 8V210" />
      <circle className={styles.impactPressurePoint} cx={scenario.id === "measured" ? 535 : scenario.id === "large" ? 620 : 788} cy={scenario.id === "measured" ? 101 : scenario.id === "large" ? 72 : 46} r="8" />
    </svg>
  );
}

function MarketImpactPanel({ copy }: { copy: IntelligenceFlagshipCopy["impactWhale"]["impact"] }) {
  const [scenarioId, setScenarioId] = useState<MarketImpactScenario["id"]>("large");
  const scenario = copy.scenarios.find((item) => item.id === scenarioId) ?? copy.scenarios[1];

  return (
    <div className={styles.marketImpactExperience} data-scenario={scenario.id}>
      <div className={styles.impactScenarioSelector} role="tablist" aria-label={copy.selectorLabel}>
        {copy.scenarios.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={item.id === scenario.id} onClick={() => setScenarioId(item.id)}>
            <span>{item.label}</span><strong>{item.amount}</strong><small>{item.risk}</small>
          </button>
        ))}
      </div>

      <div className={styles.impactMetricStrip} aria-live="polite">
        <article><Droplets /><span>{copy.depthTitle}</span><b>{scenario.depth}</b></article>
        <article><Activity /><span>Impact</span><b>{scenario.impact}</b></article>
        <article><Waves /><span>Slippage</span><b>{scenario.slippage}</b></article>
        <article><Gauge /><span>Risk</span><b>{scenario.risk}</b></article>
      </div>

      <div className={styles.impactDepthPanel}>
        <header><h3>{copy.depthTitle}</h3><div><span><i />{copy.bids}</span><span><i />{copy.asks}</span></div></header>
        <div className={styles.impactDepthScroll} role="region" tabIndex={0} aria-label={copy.depthTitle}>
          <ImpactDepthChart scenario={scenario} />
        </div>
      </div>

      <div className={styles.impactVenueTable}>
        <h3>{copy.venuesTitle}</h3>
        <div role="region" tabIndex={0} aria-label={copy.venuesTitle}>
          <table>
            <thead><tr>{copy.venueHeaders.map((header) => <th scope="col" key={header}>{header}</th>)}</tr></thead>
            <tbody>{copy.venues.map((venue) => <tr key={venue[0]}>{venue.map((cell, index) => index === 0 ? <th scope="row" key={cell}><CircleDot size={12} />{cell}</th> : <td key={cell}>{cell}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </div>
      <p className={styles.flagshipDisclaimer}><ShieldCheck size={14} />{copy.note}</p>
    </div>
  );
}

function ConcentrationRing({ band }: { band: WhaleBand }) {
  const number = Number.parseFloat(band.concentration.replace(",", "."));
  const dash = `${number} ${100 - number}`;
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" r="45" pathLength="100" />
      <circle className={styles.whaleRingValue} cx="60" cy="60" r="45" pathLength="100" strokeDasharray={dash} />
    </svg>
  );
}

function WhaleWatchPanel({ copy }: { copy: IntelligenceFlagshipCopy["impactWhale"]["whale"] }) {
  const [bandId, setBandId] = useState<WhaleBand["id"]>("top50");
  const [transferIndex, setTransferIndex] = useState(0);
  const band = copy.bands.find((item) => item.id === bandId) ?? copy.bands[1];
  const transfer = copy.transfers[transferIndex];

  return (
    <div className={styles.whaleWatchExperience} data-band={band.id}>
      <div className={styles.whaleConcentrationPanel}>
        <div className={styles.whaleBandSelector} role="tablist" aria-label={copy.selectorLabel}>
          {copy.bands.map((item) => (
            <button key={item.id} type="button" role="tab" aria-selected={item.id === band.id} onClick={() => setBandId(item.id)}>{item.label}</button>
          ))}
        </div>
        <div className={styles.whaleRingPanel} aria-live="polite">
          <ConcentrationRing band={band} />
          <div><strong>{band.concentration}</strong><span>{band.label}</span><b>{band.delta}</b></div>
        </div>
        <p>{band.interpretation}</p>
      </div>

      <div className={styles.whaleTransfersPanel}>
        <h3>{copy.transfersTitle}</h3>
        <div className={styles.whaleTransferList}>
          {copy.transfers.map((item, index) => (
            <button key={`${item.from}-${item.to}`} type="button" aria-pressed={transferIndex === index} onClick={() => setTransferIndex(index)}>
              <Network size={15} /><span>{item.from}</span><ArrowRight size={13} /><span>{item.to}</span><b>{item.amount}</b><small>{item.age}</small>
            </button>
          ))}
        </div>
        <div className={styles.whaleTransferDetail} aria-live="polite">
          <span>{transfer.from}</span><i /><span>{transfer.to}</span><strong>{transfer.amount}</strong>
        </div>
      </div>

      <div className={styles.whaleFlowPanel}>
        <h3>{copy.flowTitle}</h3>
        <div>{copy.flowMetrics.map((metric, index) => <article key={metric.label}><span>{metric.label}</span><b>{metric.value}</b><small>{metric.note}</small><i style={{ "--flow-index": index } as CSSProperties} /></article>)}</div>
      </div>

      <div className={styles.whaleEvidencePanel}>
        <h3>{copy.evidenceTitle}</h3>
        <div>{copy.evidence.map((item, index) => <article key={item}><span>0{index + 1}</span><Radar size={16} /><b>{item}</b></article>)}</div>
      </div>
      <p className={styles.flagshipDisclaimer}><ShieldCheck size={14} />{copy.note}</p>
    </div>
  );
}

export function MarketImpactWhaleSection({ copy, instanceId = "flagship" }: { copy: IntelligenceFlagshipCopy["impactWhale"]; instanceId?: string }) {
  const [activeTab, setActiveTab] = useState<"impact" | "whale">("impact");
  const panelTitle = activeTab === "impact" ? copy.impact.title : copy.whale.title;
  const panelIntro = activeTab === "impact" ? copy.impact.intro : copy.whale.intro;

  return (
    <div className={styles.impactWhaleExperience} data-active={activeTab}>
      <div className={styles.impactWhaleToolbar}>
        <div><h3>{panelTitle}</h3><p>{panelIntro}</p></div>
        <div role="tablist" aria-label={copy.title}>
          <button type="button" role="tab" aria-selected={activeTab === "impact"} aria-controls={`${instanceId}-impact-panel`} onClick={() => setActiveTab("impact")}><SlidersHorizontal />{copy.tabs[0]}</button>
          <button type="button" role="tab" aria-selected={activeTab === "whale"} aria-controls={`${instanceId}-whale-panel`} onClick={() => setActiveTab("whale")}><Network />{copy.tabs[1]}</button>
        </div>
      </div>
      <div className={styles.impactWhalePanel} id={activeTab === "impact" ? `${instanceId}-impact-panel` : `${instanceId}-whale-panel`} role="tabpanel" key={activeTab}>
        {activeTab === "impact" ? <MarketImpactPanel copy={copy.impact} /> : <WhaleWatchPanel copy={copy.whale} />}
      </div>
    </div>
  );
}

export function LiquidityLabChapter({ copy, sectionId = "liquidity-lab" }: { copy: IntelligenceFlagshipCopy; sectionId?: string }) {
  const titleId = `${sectionId}-title`;
  return (
    <section id={sectionId} className={`${styles.section} ${styles.liquidityLabSection}`} aria-labelledby={titleId}>
      <header className={styles.sectionHeader}>
        <span className={styles.eyebrow}>{copy.liquidityLab.eyebrow}</span>
        <h2 id={titleId}>{copy.liquidityLab.title}</h2>
        <p>{copy.liquidityLab.intro}</p>
      </header>
      <LiquidityLabSection copy={copy.liquidityLab} />
      <p className={styles.flagshipDisclaimer}><Blocks size={14} />{copy.common.illustrative}</p>
    </section>
  );
}

export function SecurityAuditsChapter({ copy, auditTiers }: { copy: IntelligenceFlagshipCopy; auditTiers: IntelligenceTier[] }) {
  return (
    <section id="security-audits-depth" className={`${styles.section} ${styles.auditDepthSection}`} aria-labelledby="security-audits-depth-title">
      <header className={styles.sectionHeader}>
        <span className={styles.eyebrow}>{copy.securityAudits.eyebrow}</span>
        <h2 id="security-audits-depth-title">{copy.securityAudits.title}</h2>
        <p>{copy.securityAudits.intro}</p>
      </header>
      <SecurityAuditsDepthSection copy={copy.securityAudits} auditTiers={auditTiers} />
    </section>
  );
}

export function MarketImpactWhaleChapter({ copy }: { copy: IntelligenceFlagshipCopy }) {
  return (
    <section id="impact-whale" className={`${styles.section} ${styles.impactWhaleSection}`} aria-labelledby="impact-whale-title">
      <header className={styles.sectionHeader}>
        <span className={styles.eyebrow}>{copy.impactWhale.eyebrow}</span>
        <h2 id="impact-whale-title">{copy.impactWhale.title}</h2>
        <p>{copy.impactWhale.intro}</p>
      </header>
      <MarketImpactWhaleSection copy={copy.impactWhale} />
    </section>
  );
}
