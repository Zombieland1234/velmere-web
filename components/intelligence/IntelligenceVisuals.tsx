import { Activity, Database, Fingerprint, Radar, ShieldCheck } from "lucide-react";
import styles from "./IntelligencePage.module.css";

export function HeroIntelligenceVisual({ legend }: { legend: [string, string, string] }) {
  const surfaces = [
    { label: "SHIELD", x: 118, y: 185 },
    { label: "MARKETS", x: 465, y: 142 },
    { label: "IMPACT", x: 532, y: 355 },
    { label: "AUDITS", x: 450, y: 545 },
    { label: "PDF", x: 120, y: 530 },
    { label: "ANGEL", x: 70, y: 342 },
  ];
  return (
    <div className={styles.heroVisual} role="img" aria-label={legend.join(" · ")}>
      <div className={styles.heroHalo} />
      <svg viewBox="0 0 680 680" aria-hidden="true">
        <defs>
          <radialGradient id="hero-ambient">
            <stop offset="0" stopColor="#d7b35f" stopOpacity=".13" />
            <stop offset=".56" stopColor="#4ccfc1" stopOpacity=".05" />
            <stop offset="1" stopColor="#020505" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="hero-gold" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#efe5ce" stopOpacity=".9" />
            <stop offset=".45" stopColor="#d4ac57" />
            <stop offset="1" stopColor="#5fd2c7" stopOpacity=".52" />
          </linearGradient>
        </defs>
        <circle cx="340" cy="340" r="320" fill="url(#hero-ambient)" />
        <g className={styles.heroOrbitGroup}>
          <circle cx="340" cy="340" r="250" />
          <circle cx="340" cy="340" r="195" />
          <circle cx="340" cy="340" r="140" />
        </g>
        <g className={styles.heroEvidenceNodes}>
          {[[340, 88], [548, 198], [585, 402], [450, 565], [228, 572], [87, 400], [130, 190]].map(([x, y], index) => (
            <g key={`${x}-${y}`} style={{ animationDelay: `${index * -.7}s` }}>
              <circle cx={x} cy={y} r={index % 3 === 0 ? 6 : 4} />
              <circle cx={x} cy={y} r={index % 3 === 0 ? 17 : 12} />
            </g>
          ))}
        </g>
        <g className={styles.heroSynapses}>
          {surfaces.map((surface) => <path key={surface.label} d={`M340 340C${(340 + surface.x) / 2} 340 ${(340 + surface.x) / 2} ${surface.y} ${surface.x} ${surface.y}`} />)}
          <path d="M268 314 309 289 350 315 392 274M277 366l40-25 39 28 46-22M309 289l8 52m75-67-36 95m-79-3 32 35 46-32 39 35" />
        </g>
        <g className={styles.heroBrain}>
          <path d="M339 221c-22-29-69-25-82 8-33-12-65 15-61 49-30 13-38 53-15 77-17 34 8 72 42 74 8 34 49 47 75 25 15 22 41 20 42-8V251c0-14 1-23-1-30Z" />
          <path d="M341 221c22-29 69-25 82 8 33-12 65 15 61 49 30 13 38 53 15 77 17 34-8 72-42 74-8 34-49 47-75 25-15 22-41 20-42-8V251c0-14-1-23 1-30Z" />
          <path d="M255 231c-5 24 12 39 31 42-18 11-24 30-17 48m-67-43c29-5 46 14 48 36-24 4-37 19-38 38m11 77c4-27 24-41 47-40-7-22 4-42 25-52m128-106c5 24-12 39-31 42 18 11 24 30 17 48m67-43c-29-5-46 14-48 36 24 4 37 19 38 38m-11 77c-4-27-24-41-47-40 7-22-4-42-25-52" />
        </g>
        <circle className={styles.heroBrainCore} cx="340" cy="340" r="43" />
        <text className={styles.heroBrainLabel} x="340" y="334">VLM</text>
        <text className={styles.heroBrainSubLabel} x="340" y="353">BRAIN</text>
        <g className={styles.heroSurfaceLabels}>{surfaces.map((surface, index) => <g key={surface.label}><circle cx={surface.x} cy={surface.y} r="7" /><circle cx={surface.x} cy={surface.y} r="17" /><text x={surface.x + (surface.x < 340 ? -18 : 18)} y={surface.y + 3} textAnchor={surface.x < 340 ? "end" : "start"}>0{index + 1} / {surface.label}</text></g>)}</g>
      </svg>
      <div className={styles.heroLegend}>
        {legend.map((item, index) => <span key={item}><i data-tone={index} />{item}</span>)}
      </div>
    </div>
  );
}

export function ComparisonVisual() {
  return (
    <div className={styles.comparisonVisual} aria-hidden="true">
      <div className={styles.comparisonSource}><Database /><span>01</span></div>
      <div className={styles.comparisonSource}><Radar /><span>02</span></div>
      <div className={styles.comparisonSource}><Fingerprint /><span>03</span></div>
      <svg viewBox="0 0 620 210" preserveAspectRatio="none">
        <path d="M70 45C210 45 210 105 310 105S420 45 550 45" />
        <path d="M70 105h480" />
        <path d="M70 165c140 0 140-60 240-60s110 60 240 60" />
      </svg>
      <div className={styles.comparisonResult}><ShieldCheck /><b>VLM</b><small>08 / 08</small></div>
    </div>
  );
}

export function ProductVisual({ id }: { id: string }) {
  if (id === "shield") {
    return <div className={styles.productVisual} data-product={id}><ShieldCheck /><i /><i /><i /><span>01 / 04</span></div>;
  }
  if (id === "markets") {
    return <div className={styles.productVisual} data-product={id}><Activity /><div className={styles.productBars}>{[36, 68, 48, 82, 58, 76].map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}</div><span>02 / 04</span></div>;
  }
  if (id === "pro") {
    return <div className={styles.productVisual} data-product={id}><Radar /><div className={styles.productGrid}>{Array.from({ length: 12 }, (_, i) => <i key={i} />)}</div><span>03 / 04</span></div>;
  }
  return <div className={styles.productVisual} data-product={id}><Fingerprint /><div className={styles.auditTrace}><i /><i /><i /></div><span>04 / 04</span></div>;
}
