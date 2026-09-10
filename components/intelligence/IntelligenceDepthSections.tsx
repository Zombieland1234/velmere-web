"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ComponentType, type CSSProperties } from "react";
import {
  Activity,
  ArrowRight,
  Blocks,
  Bot,
  Check,
  CircleAlert,
  Database,
  FileCheck2,
  FileText,
  Fingerprint,
  GitCompareArrows,
  Layers3,
  KeyRound,
  LockKeyhole,
  Network,
  Play,
  Radar,
  RefreshCw,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  StepForward,
  Waypoints,
} from "lucide-react";
import type { IntelligenceContent, IntelligenceLocale } from "@/lib/intelligence/intelligence-content";
import type { IntelligenceDepthCopy, IntelligenceScenario } from "@/lib/intelligence/intelligence-depth-content";
import styles from "./IntelligencePage.module.css";

const scenarioIcons: Record<IntelligenceScenario["id"], ComponentType<{ size?: number; "aria-hidden"?: boolean }>> = {
  collapse: CircleAlert,
  short: Activity,
  long: Waypoints,
  whale: Network,
  unlock: Layers3,
  depeg: Radar,
  permissions: KeyRound,
  disagreement: GitCompareArrows,
};

type ScenarioCandle = [open: number, high: number, low: number, close: number, volume: number];

const candleSeries: Record<IntelligenceScenario["id"], ScenarioCandle[]> = {
  collapse: [[56,61,53,59,34],[59,64,57,61,38],[61,63,56,58,31],[58,65,57,63,44],[63,67,60,65,47],[65,68,61,64,40],[64,70,62,68,49],[68,72,65,69,46],[69,73,67,71,45],[71,74,68,70,52],[70,75,69,73,56],[73,76,70,74,61],[74,77,70,71,68],[71,73,55,59,76],[59,61,14,22,100],[22,29,11,17,91],[17,23,8,13,72],[13,17,6,10,63]],
  short: [[28,34,26,31,31],[31,35,28,29,28],[29,34,27,32,30],[32,36,30,34,35],[34,37,30,31,31],[31,35,29,33,29],[33,38,31,36,34],[36,40,34,38,39],[38,43,36,41,45],[41,45,39,42,48],[42,48,40,46,56],[46,53,44,51,61],[51,59,49,57,70],[57,67,55,65,77],[65,76,63,74,88],[74,85,71,82,94],[82,94,80,91,100],[91,99,88,96,86]],
  long: [[82,88,79,85,32],[85,89,81,83,29],[83,87,79,81,30],[81,84,75,77,38],[77,82,74,79,35],[79,81,71,73,44],[73,76,67,69,52],[69,73,63,65,58],[65,69,58,60,65],[60,64,53,55,73],[55,59,47,49,82],[49,54,41,43,90],[43,48,34,36,96],[36,41,28,30,100],[30,35,22,25,92],[25,29,17,19,83],[19,24,13,16,69],[16,21,10,12,58]],
  whale: [[42,48,39,46,24],[46,51,43,48,27],[48,53,45,47,26],[47,52,44,50,29],[50,57,48,55,31],[55,59,51,53,32],[53,58,50,56,36],[56,61,53,59,38],[59,63,55,57,40],[57,61,52,54,58],[54,58,48,50,66],[50,53,43,45,78],[45,49,38,40,87],[40,44,33,35,93],[35,39,28,31,100],[31,36,25,29,91],[29,34,24,32,70],[32,37,28,34,54]],
  unlock: [[38,43,35,41,25],[41,46,39,44,28],[44,48,41,43,26],[43,49,40,47,31],[47,52,44,50,35],[50,54,47,49,32],[49,55,46,53,38],[53,58,50,55,42],[55,61,53,59,47],[59,64,56,61,53],[61,66,58,63,62],[63,68,60,65,69],[65,70,61,63,78],[63,67,55,57,88],[57,61,49,51,95],[51,56,45,48,100],[48,53,43,50,79],[50,55,46,52,61]],
  depeg: [[60,63,58,61,22],[61,64,59,62,24],[62,64,59,61,21],[61,63,58,60,25],[60,63,58,61,23],[61,64,59,62,24],[62,64,60,61,22],[61,63,59,62,25],[62,64,60,61,27],[61,63,58,60,31],[60,62,55,57,42],[57,59,50,52,55],[52,55,45,47,69],[47,50,40,43,82],[43,47,37,40,91],[40,44,35,38,100],[38,43,34,41,78],[41,45,37,42,59]],
  permissions: [[32,37,29,35,23],[35,40,33,38,27],[38,42,35,37,24],[37,43,34,41,30],[41,47,39,45,32],[45,49,42,44,30],[44,50,41,48,35],[48,53,45,51,40],[51,56,48,54,43],[54,58,50,52,47],[52,57,49,55,50],[55,60,52,58,55],[58,63,55,61,62],[61,68,58,66,76],[66,75,64,72,91],[72,78,67,69,100],[69,74,65,71,82],[71,76,68,74,68]],
  disagreement: [[44,49,41,47,26],[47,52,44,50,28],[50,54,47,49,27],[49,55,46,53,31],[53,58,50,56,33],[56,60,52,54,35],[54,59,51,57,38],[57,62,54,60,42],[60,64,57,59,45],[59,65,56,63,48],[63,68,60,66,54],[66,70,62,64,58],[64,69,61,67,63],[67,72,64,70,69],[70,74,66,68,75],[68,73,65,71,80],[71,76,68,74,85],[74,79,71,77,91]],
};

function ScenarioVisual({ scenario, run }: { scenario: IntelligenceScenario; run: number }) {
  const candles = candleSeries[scenario.id];
  const y = (value: number) => 258 - value * 2.18;

  return (
    <div className={styles.scenarioVisual} data-scenario={scenario.id} data-run={run} aria-hidden="true">
      <svg viewBox="0 0 720 300" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`scenario-volume-${scenario.id}`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#4bcbbc" stopOpacity=".5" /><stop offset="1" stopColor="#4bcbbc" stopOpacity=".04" /></linearGradient>
        </defs>
        <path className={styles.scenarioGridLine} d="M0 45H720M0 100H720M0 155H720M0 210H720M80 0V275M200 0V275M320 0V275M440 0V275M560 0V275M680 0V275" />
        {scenario.id === "depeg" ? <path className={styles.parityLine} d={`M8 ${y(60)}H712`} /> : null}
        {scenario.id === "long" ? <g className={styles.liquidationLevels}>{[66,52,38,24].map((level) => <line key={level} x1="260" x2="712" y1={y(level)} y2={y(level)} />)}</g> : null}
        <g className={styles.candles}>
          {candles.map(([open, high, low, close, volume], index) => {
            const x = 26 + index * 38;
            const up = close >= open;
            const top = y(Math.max(open, close));
            const bodyHeight = Math.max(3, Math.abs(y(open) - y(close)));
            return (
              <g key={`${scenario.id}-${index}`} data-direction={up ? "up" : "down"} style={{ "--candle-delay": `${index * 58}ms` } as CSSProperties}>
                <line x1={x} x2={x} y1={y(high)} y2={y(low)} />
                <rect x={x - 7} y={top} width="14" height={bodyHeight} rx="1.5" />
                <rect className={styles.scenarioVolume} x={x - 7} y={286 - volume * .42} width="14" height={volume * .42} fill={`url(#scenario-volume-${scenario.id})`} />
              </g>
            );
          })}
        </g>
        {scenario.id === "collapse" ? <g className={styles.collapseMarker}><path d="M555 22v192" /><circle cx="555" cy="22" r="5" /><text x="566" y="35">DEPTH WITHDRAWAL</text></g> : null}
        {scenario.id === "short" ? <g className={styles.coverMarkers}>{[480,556,632].map((x, index) => <g key={x}><path d={`M${x} ${175-index*42}v-30m-8 9 8-9 8 9`} /><circle cx={x} cy={181-index*42} r="3" /></g>)}</g> : null}
        {scenario.id === "whale" ? <g className={styles.whaleRoute}><circle cx="160" cy="70" r="25" /><circle cx="160" cy="70" r="6" /><path d="M190 72C270 72 325 108 405 108" /><path d="m397 100 10 8-10 8" /><rect x="414" y="88" width="84" height="40" rx="7" /></g> : null}
        {scenario.id === "unlock" ? <g className={styles.unlockRings}><circle cx="420" cy="95" r="43" /><path d="M420 52a43 43 0 0 1 41 56" /><rect x="404" y="81" width="32" height="26" rx="5" /><path d="M411 81v-8a9 9 0 0 1 18 0" /></g> : null}
        {scenario.id === "permissions" ? <g className={styles.permissionMap}><circle cx="420" cy="95" r="16" /><circle cx="525" cy="68" r="20" /><path d="M436 91 505 73M525 48v-18M525 106V88M505 68h-22M566 68h-21" /><rect x="513" y="58" width="24" height="20" rx="4" /><path d="M518 58v-5a7 7 0 0 1 14 0" /></g> : null}
        {scenario.id === "disagreement" ? <g className={styles.providerDisagreement}><path d="M26 176 102 163 178 168 254 144 330 151 406 119 482 130 558 92 634 100 710 72" /><path d="M26 185 102 180 178 186 254 178 330 191 406 184 482 213 558 202 634 229 710 218" /><circle cx="406" cy="119" r="4" /><circle cx="406" cy="184" r="4" /><path d="M406 119v65" /></g> : null}
      </svg>
      <span className={styles.scenarioSweep} />
    </div>
  );
}

export function DetectionScenarioLab({ copy }: { copy: IntelligenceDepthCopy["scenarios"] }) {
  const [activeId, setActiveId] = useState<IntelligenceScenario["id"]>(copy.items[0].id);
  const [run, setRun] = useState(0);
  const active = copy.items.find((item) => item.id === activeId) ?? copy.items[0];
  const ActiveIcon = scenarioIcons[active.id];

  return (
    <div className={styles.scenarioLab}>
      <div className={styles.scenarioSelector} role="tablist" aria-label={copy.title}>
        {copy.items.map((item, index) => {
          const Icon = scenarioIcons[item.id];
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              data-scenario-id={item.id}
              aria-selected={active.id === item.id}
              onClick={() => setActiveId(item.id)}
              onPointerEnter={() => setActiveId(item.id)}
            >
              <span>0{index + 1}</span><Icon size={17} aria-hidden /><b>{item.title}</b>
            </button>
          );
        })}
      </div>
      <article className={styles.scenarioStage} key={`${active.id}-${run}`}>
        <div className={styles.scenarioStageMeta}><span>{copy.demo}</span><button type="button" onClick={() => setRun((value) => value + 1)}><RefreshCw size={13} />{copy.replay}</button></div>
        <ScenarioVisual scenario={active} run={run} />
        <div className={styles.scenarioNarrative}>
          <span><ActiveIcon size={18} aria-hidden />{active.signal}</span>
          <h3>{active.title}</h3>
          <p>{active.description}</p>
          <div><span>{copy.observed}</span>{active.evidence.split(" · ").map((item) => <b key={item}>{item}</b>)}</div>
        </div>
      </article>
    </div>
  );
}

const pipelineIcons = [Database, Blocks, RefreshCw, Fingerprint, Network, Activity, ShieldCheck, Sparkles];

export function OutputPathExperience({
  stages,
  outcomes,
  replayLabel,
  nextLabel,
  activeLabel,
}: {
  stages: string[];
  outcomes: IntelligenceDepthCopy["pipeline"]["outcomes"];
  replayLabel: string;
  nextLabel: string;
  activeLabel: string;
}) {
  const [run, setRun] = useState(0);
  const [activeStage, setActiveStage] = useState(0);
  const [activeOutcome, setActiveOutcome] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [autoPlay, setAutoPlay] = useState(true);
  const experienceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = experienceRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.42 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible || !autoPlay) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const resetFrame = window.requestAnimationFrame(() => {
      setActiveStage(reducedMotion ? stages.length - 1 : 0);
    });
    if (reducedMotion) return () => window.cancelAnimationFrame(resetFrame);

    let step = 0;
    const timer = window.setInterval(() => {
      step += 1;
      setActiveStage(Math.min(step, stages.length - 1));
      if (step >= stages.length - 1) window.clearInterval(timer);
    }, 430);
    return () => {
      window.cancelAnimationFrame(resetFrame);
      window.clearInterval(timer);
    };
  }, [autoPlay, isVisible, run, stages.length]);

  const replay = () => {
    setActiveStage(0);
    setAutoPlay(true);
    setRun((value) => value + 1);
  };

  const step = () => {
    setAutoPlay(false);
    setActiveStage((stage) => Math.min(stage + 1, stages.length - 1));
  };

  return (
    <div ref={experienceRef} className={styles.outputExperience} data-ready={activeStage === stages.length - 1}>
      <div className={styles.outputToolbar}>
        <span>{activeLabel}: <b>{stages[activeStage]}</b></span>
        <div className={styles.outputToolbarActions}>
          <button type="button" onClick={step} disabled={activeStage === stages.length - 1}><StepForward size={14} />{nextLabel}</button>
          <button type="button" onClick={replay}><Play size={14} />{replayLabel}</button>
        </div>
      </div>
      <ol className={styles.outputTrack}>
        {stages.map((stage, index) => {
          const Icon = pipelineIcons[index] ?? Activity;
          const state = index < activeStage ? "complete" : index === activeStage ? "active" : "waiting";
          return (
            <li key={stage} data-state={state}>
              <button
                type="button"
                className={styles.outputStageButton}
                disabled={index > activeStage}
                aria-current={index === activeStage ? "step" : undefined}
                onClick={() => { setAutoPlay(false); setActiveStage(index); }}
              >
                <span className={styles.outputStageIcon}><Icon aria-hidden /><small>0{index + 1}</small></span>
                <b>{stage}</b>
              </button>
              {index < stages.length - 1 ? <i><em /></i> : null}
            </li>
          );
        })}
      </ol>
      <div className={styles.outcomeExperience}>
        <div className={styles.outcomeButtons} role="tablist">
          {outcomes.map((outcome, index) => (
            <button key={outcome.title} type="button" role="tab" aria-selected={activeOutcome === index} onClick={() => setActiveOutcome(index)}>
              <span>0{index + 1}</span>{outcome.title}
            </button>
          ))}
        </div>
        <div className={styles.outcomeExplanation} aria-live="polite">
          <ShieldCheck size={21} aria-hidden />
          <div><b>{outcomes[activeOutcome].title}</b><p>{outcomes[activeOutcome].description}</p></div>
        </div>
      </div>
    </div>
  );
}

const productIcons: Record<string, ComponentType<{ size?: number; "aria-hidden"?: boolean }>> = {
  shield: ShieldCheck,
  markets: Activity,
  pro: Radar,
  audit: Fingerprint,
};

function ProductSurfaceVisual({ id }: { id: string }) {
  return (
    <div className={styles.surfaceVisual} data-surface={id} aria-hidden="true">
      <div className={styles.surfaceTopline}><i /><i /><i /><span>VLM / {id.toUpperCase()}</span></div>
      {id === "shield" ? <><div className={styles.surfaceAssetList}>{["BTC", "ETH", "USDC", "SOL"].map((item, index) => <span key={item}><b>{item}</b><i style={{ width: `${72 - index * 9}%` }} /></span>)}</div><div className={styles.surfaceRadar}><Radar /><i /><i /></div></> : null}
      {id === "markets" ? <><div className={styles.surfaceSessions}>{["NY", "LON", "FRK", "APAC"].map((item) => <span key={item}>{item}</span>)}</div><svg viewBox="0 0 460 180"><path d="M12 137 65 122 112 127 164 94 212 105 263 69 315 81 368 42 448 25" /></svg></> : null}
      {id === "pro" ? <div className={styles.surfaceTerminal}>{Array.from({ length: 16 }, (_, index) => <i key={index} style={{ opacity: .22 + (index % 5) * .13 }} />)}</div> : null}
      {id === "audit" ? <div className={styles.surfaceAudit}><FileCheck2 /><span /><span /><span /><b>VERIFIED TRACE</b></div> : null}
      <div className={styles.surfaceScanline} />
    </div>
  );
}

export function ProductSurfaceExplorer({
  locale,
  items,
  copy,
}: {
  locale: IntelligenceLocale;
  items: IntelligenceContent["products"]["items"];
  copy: IntelligenceDepthCopy["products"];
}) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? "shield");
  const active = items.find((item) => item.id === activeId) ?? items[0];
  const Icon = productIcons[active.id] ?? ScanSearch;

  return (
    <div className={styles.surfaceExplorer}>
      <div className={styles.surfaceSelector}>
        <span>{copy.selector}</span>
        {items.map((item, index) => {
          const ItemIcon = productIcons[item.id] ?? ScanSearch;
          return <button key={item.id} type="button" aria-pressed={active.id === item.id} onClick={() => setActiveId(item.id)}><small>0{index + 1}</small><ItemIcon size={18} aria-hidden /><b>{item.title}</b><ArrowRight size={15} /></button>;
        })}
      </div>
      <article className={styles.surfaceDisplay} key={active.id}>
        <ProductSurfaceVisual id={active.id} />
        <div className={styles.surfaceCopy}>
          <span><Icon size={18} aria-hidden />{active.kicker}</span>
          <h3>{active.title}</h3>
          <p>{active.description}</p>
          <h4>{copy.evidence}</h4>
          <ul>{(copy.features[active.id] ?? []).map((feature) => <li key={feature}><Check size={14} />{feature}</li>)}</ul>
          <Link href={`/${locale}${active.href}`}>{active.cta}<ArrowRight size={16} /></Link>
        </div>
      </article>
    </div>
  );
}

export function ReportJourney({ copy }: { copy: IntelligenceDepthCopy["report"] }) {
  const [active, setActive] = useState(0);
  const progress = copy.stages.length > 1 ? (active / (copy.stages.length - 1)) * 100 : 100;
  const metadata = [
    [copy.packet, "DEMO-VLM-0716"],
    [copy.sourceSummary, "04 / 04"],
    [copy.findings, "07"],
    [copy.missing, "01"],
    [copy.version, "1.4"],
    [copy.timestamp, "DEMO / T+00"],
    [copy.integrity, "8c1e…a904"],
    [copy.reviewState, copy.stages[Math.min(active, 5)]],
    [copy.deliveryState, active === copy.stages.length - 1 ? copy.stages.at(-1) ?? "—" : "—"],
  ];
  return (
    <div className={styles.reportExperience} data-stage={active}>
      <div className={styles.reportRoute} role="group" aria-label={copy.title}>
        {copy.stages.map((stage, index) => {
          const Icon = [Activity, Database, Blocks, FileText, LockKeyhole][index] ?? FileText;
          const state = index < active ? "complete" : index === active ? "active" : "upcoming";
          return <button key={stage} type="button" data-state={state} aria-pressed={active === index} onClick={() => setActive(index)}><Icon size={18} aria-hidden /><span>0{index + 1}</span><b>{stage}</b>{index < copy.stages.length - 1 ? <i aria-hidden><em /></i> : null}</button>;
        })}
      </div>
      <div className={styles.reportPacket} data-active={active} data-final={active === copy.stages.length - 1} style={{ "--report-progress": `${progress}%` } as CSSProperties}>
        <div className={styles.reportSpine}><span>VELMÈRE</span><b>{copy.stages[1]}</b><small>{copy.stages.at(-1)}</small></div>
        <div className={styles.reportAssembly}>
          <div className={styles.reportStack} role="group" aria-live="polite" aria-label={copy.stages[active]}>
            {[4, 3, 2, 1].map((page) => <div key={page} className={styles.reportSheet} data-page={page} aria-hidden="true"><i /><i /><i /></div>)}
            <div className={styles.reportPage}>
              <div className={styles.reportMark}><ShieldCheck aria-hidden /><span>VLM</span></div>
              <div key={active} className={styles.reportStageStatus}><span>0{active + 1}</span><b>{copy.stages[active]}</b></div>
              <div className={styles.reportLines} aria-hidden><i /><i /><i /><i /></div>
              <div className={styles.reportPageIndex} aria-hidden><b>0{active + 1}</b><span>/ 0{copy.stages.length}</span></div>
              <div className={styles.reportDigest}>DEMO SHA-256 <b>8c1e…a904</b></div>
              <div className={styles.reportSeal}><LockKeyhole aria-hidden /><span>{copy.sample}</span></div>
            </div>
          </div>
          <div className={styles.reportAssemblyRail} aria-hidden>
            {copy.stages.map((stage, index) => <i key={stage} data-state={index < active ? "complete" : index === active ? "active" : "upcoming"} />)}
          </div>
        </div>
        <div className={styles.reportManifest}>
          <div className={styles.reportManifestHeader}><span>0{active + 1} / 0{copy.stages.length}</span><b key={active}>{copy.stages[active]}</b></div>
          <dl>{metadata.map(([label, value], index) => <div key={label} data-active={index <= active}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          <div className={styles.reportDeliveryStatus} data-ready={active === copy.stages.length - 1}><ShieldCheck aria-hidden /><span>{copy.stages.at(-1)}</span><i aria-hidden /></div>
        </div>
      </div>
    </div>
  );
}

export function BrainHub({ copy }: { copy: IntelligenceDepthCopy["brain"] }) {
  const [activeSurface, setActiveSurface] = useState(() => Math.max(0, copy.surfaces.length - 1));
  const nodeLayout = [
    { x: 15, y: 18 }, { x: 38, y: 8 }, { x: 62, y: 8 }, { x: 85, y: 18 },
    { x: 15, y: 82 }, { x: 38, y: 92 }, { x: 62, y: 92 }, { x: 85, y: 82 },
  ];
  return (
    <div className={styles.brainExperience} data-surface={activeSurface}>
      <div className={styles.brainMap}>
        <div className={styles.brainCore}><Bot /><span>{copy.core}</span><i /><i /><i /></div>
        {copy.surfaces.map((surface, index) => {
          const node = nodeLayout[index] ?? nodeLayout[index % nodeLayout.length];
          return <button key={surface} type="button" aria-pressed={activeSurface === index} style={{ "--node-x": `${node.x}%`, "--node-y": `${node.y}%` } as CSSProperties} onClick={() => setActiveSurface(index)}><span>{surface}</span></button>;
        })}
        <svg viewBox="0 0 640 420" aria-hidden="true">
          {copy.surfaces.map((surface, index) => {
            const node = nodeLayout[index] ?? nodeLayout[index % nodeLayout.length];
            return <line key={surface} x1="320" y1="210" x2={node.x * 6.4} y2={node.y * 4.2} data-active={activeSurface === index} />;
          })}
        </svg>
      </div>
      <aside className={styles.brainDetailPanel} aria-live="polite">
        <span>{copy.inspect} / 0{activeSurface + 1}</span>
        <div className={styles.brainDetailIndex}><b>0{activeSurface + 1}</b><small>/ 0{copy.surfaces.length}</small></div>
        <h3>{copy.surfaces[activeSurface]}</h3>
        <p>{copy.surfaceDetails[activeSurface]}</p>
        <div className={styles.brainSignalRoute} aria-hidden="true">
          <i /><i /><i /><i /><i />
        </div>
        <ul>
          {copy.surfaces.filter((_, index) => index !== activeSurface).slice(0, 3).map((surface) => <li key={surface}><span />{surface}<ArrowRight size={13} /></li>)}
        </ul>
      </aside>
    </div>
  );
}
