"use client";

import { useState } from "react";
import { Check, CornerDownRight } from "lucide-react";
import styles from "./MotionAtelier.module.css";

type Locale = "en" | "pl" | "de";

const loaderCatalog = [
  { id: "01", name: "V Shield Pulse", use: "System boot" },
  { id: "02", name: "Evidence Orbit", use: "Deep research" },
  { id: "03", name: "Gold Aperture", use: "Camera / scan" },
  { id: "04", name: "Proof Kernel", use: "Verification" },
  { id: "05", name: "Signal Columns", use: "Market stream" },
  { id: "06", name: "Neural Relay", use: "Angel reasoning" },
  { id: "07", name: "Liquid Drop", use: "Liquidity model" },
  { id: "08", name: "Packet Assembly", use: "Report build" },
  { id: "09", name: "Cipher Halo", use: "Secure action" },
  { id: "10", name: "Evidence Helix", use: "Source merge" },
  { id: "11", name: "Source Quorum", use: "Provider check" },
  { id: "12", name: "Risk Dial", use: "Score compute" },
  { id: "13", name: "Diamond Trace", use: "Premium wait" },
  { id: "14", name: "Ledger Stack", use: "Archive write" },
  { id: "15", name: "Market Wave", use: "Live response" },
  { id: "16", name: "Constellation V", use: "Intelligence" },
  { id: "17", name: "Proof Stamp", use: "Final validation" },
  { id: "18", name: "Halo Grid", use: "Data loading" },
  { id: "19", name: "Secure Relay", use: "Network handoff" },
  { id: "20", name: "Velmère Monogram", use: "Universal brand" },
] as const;

type LoaderId = (typeof loaderCatalog)[number]["id"];

const copy = {
  en: {
    eyebrow: "VELMÈRE / MOTION SYSTEMS",
    title: "Twenty ways to make waiting feel intentional.",
    intro: "Compact, seamless loops designed at real chat size. Every candidate stays legible on black, avoids visual noise and respects reduced-motion settings.",
    live: "LIVE LOOP / 1:1",
    select: "Select a candidate",
    selected: "Selected direction",
    instruction: "Click any tile to compare it in the master preview.",
    compact: "CHAT-SAFE / 64 PX",
  },
  pl: {
    eyebrow: "VELMÈRE / SYSTEMY RUCHU",
    title: "Dwadzieścia sposobów, by oczekiwanie było częścią marki.",
    intro: "Kompaktowe, płynne pętle zaprojektowane w realnym rozmiarze czatu. Każdy wariant jest czytelny na czerni, spokojny i ma tryb ograniczonego ruchu.",
    live: "PĘTLA LIVE / 1:1",
    select: "Wybierz kierunek",
    selected: "Wybrany wariant",
    instruction: "Kliknij kafel, aby porównać go w głównym podglądzie.",
    compact: "CHAT-SAFE / 64 PX",
  },
  de: {
    eyebrow: "VELMÈRE / MOTION-SYSTEME",
    title: "Zwanzig Wege, Wartezeit bewusst zu gestalten.",
    intro: "Kompakte, nahtlose Loops in echter Chat-Größe. Jeder Entwurf bleibt auf Schwarz lesbar, ruhig und unterstützt reduzierte Bewegung.",
    live: "LIVE-LOOP / 1:1",
    select: "Variante auswählen",
    selected: "Gewählte Richtung",
    instruction: "Eine Kachel anklicken und im Hauptfenster vergleichen.",
    compact: "CHAT-SAFE / 64 PX",
  },
} as const;

function LoaderArtwork({ id }: { id: LoaderId }) {
  if (id === "01") {
    return <div className={styles.art} data-art={id}><svg viewBox="0 0 80 80"><path className={styles.goldLine} pathLength="1" d="M40 8 64 18v18c0 16-9 27-24 36C25 63 16 52 16 36V18Z" /><path className={styles.tealLine} d="m28 30 12 24 13-26" /></svg><i className={styles.scan} /></div>;
  }
  if (id === "02") {
    return <div className={styles.art} data-art={id}><span className={styles.orbit}><i /><i /><i /></span><b>V</b></div>;
  }
  if (id === "03") {
    return <div className={styles.art} data-art={id}><span className={styles.aperture}>{Array.from({ length: 6 }, (_, index) => <i key={index} />)}</span><b>V</b></div>;
  }
  if (id === "04") {
    return <div className={styles.art} data-art={id}><span className={styles.kernel}><i /><i /><i /><i /></span><b>V</b></div>;
  }
  if (id === "05") {
    return <div className={styles.art} data-art={id}><span className={styles.columns}>{Array.from({ length: 5 }, (_, index) => <i key={index} />)}</span><em>LIVE</em></div>;
  }
  if (id === "06") {
    return <div className={styles.art} data-art={id}><svg viewBox="0 0 80 80"><g className={styles.networkLines}><path d="M18 22 40 40 62 18M18 58l22-18 24 20M18 22v36M62 18l2 42" /></g>{[[18,22],[62,18],[40,40],[18,58],[64,60]].map(([cx,cy], index) => <circle key={index} cx={cx} cy={cy} r={index === 2 ? 5 : 3} />)}</svg></div>;
  }
  if (id === "07") {
    return <div className={styles.art} data-art={id}><svg viewBox="0 0 80 80"><path className={styles.goldLine} d="M40 9C33 22 21 35 21 48a19 19 0 0 0 38 0C59 35 47 22 40 9Z" /><path className={styles.waterWave} d="M22 47c8-5 15 5 23 0s11-2 14 0" /></svg><i className={styles.dropGlint} /></div>;
  }
  if (id === "08") {
    return <div className={styles.art} data-art={id}><span className={styles.packets}><i /><i /><i /></span><b>V</b></div>;
  }
  if (id === "09") {
    return <div className={styles.art} data-art={id}><span className={styles.cipher}><i /></span><b>V</b></div>;
  }
  if (id === "10") {
    return <div className={styles.art} data-art={id}><svg viewBox="0 0 80 80"><path className={styles.helixA} d="M22 12c31 12 31 44 0 56" /><path className={styles.helixB} d="M58 12C27 24 27 56 58 68" /><g className={styles.helixRungs}><path d="M28 21h24M23 34h34M23 47h34M28 60h24" /></g></svg></div>;
  }
  if (id === "11") {
    return <div className={styles.art} data-art={id}><svg viewBox="0 0 80 80"><path className={styles.goldLine} d="m40 12 28 51H12Z" /><path className={styles.tealLine} d="M40 12v34M12 63l28-17 28 17" />{[[40,12],[12,63],[68,63],[40,46]].map(([cx,cy], index) => <circle key={index} cx={cx} cy={cy} r={index === 3 ? 5 : 3} />)}</svg></div>;
  }
  if (id === "12") {
    return <div className={styles.art} data-art={id}><svg viewBox="0 0 80 80"><path className={styles.dialTrack} d="M14 55a28 28 0 0 1 52 0" /><path className={styles.dialProgress} pathLength="1" d="M14 55a28 28 0 0 1 52 0" /><line className={styles.needle} x1="40" y1="56" x2="40" y2="25" /><circle cx="40" cy="56" r="4" /></svg><em>RISK</em></div>;
  }
  if (id === "13") {
    return <div className={styles.art} data-art={id}><span className={styles.diamonds}><i /><i /><i /></span><b>V</b></div>;
  }
  if (id === "14") {
    return <div className={styles.art} data-art={id}><span className={styles.ledger}><i /><i /><i /><b /><b /><b /></span></div>;
  }
  if (id === "15") {
    return <div className={styles.art} data-art={id}><svg viewBox="0 0 80 80"><path className={styles.waveGhost} d="M7 42h12l6-18 10 36 9-43 9 31 7-14 6 8h7" /><path className={styles.waveLive} pathLength="1" d="M7 42h12l6-18 10 36 9-43 9 31 7-14 6 8h7" /></svg></div>;
  }
  if (id === "16") {
    return <div className={styles.art} data-art={id}><svg viewBox="0 0 80 80"><path className={styles.constellationLine} d="M12 15 28 53l12 15 12-15 16-38M12 15l28 53 28-53" />{[[12,15],[28,53],[40,68],[52,53],[68,15]].map(([cx,cy], index) => <circle key={index} cx={cx} cy={cy} r={index === 2 ? 4 : 2.5} />)}</svg></div>;
  }
  if (id === "17") {
    return <div className={styles.art} data-art={id}><svg viewBox="0 0 80 80"><circle className={styles.stampOuter} cx="40" cy="40" r="29" /><circle className={styles.stampInner} cx="40" cy="40" r="21" /><path className={styles.stampCheck} pathLength="1" d="m27 41 9 9 18-22" /></svg></div>;
  }
  if (id === "18") {
    return <div className={styles.art} data-art={id}><span className={styles.haloGrid}>{Array.from({ length: 9 }, (_, index) => <i key={index} />)}<b /></span></div>;
  }
  if (id === "19") {
    return <div className={styles.art} data-art={id}><svg viewBox="0 0 80 80"><path className={styles.relayTrack} d="M12 55c12-39 33-39 56 0" /><circle className={styles.relayNode} cx="12" cy="55" r="5" /><circle className={styles.relayNode} cx="68" cy="55" r="5" /><circle className={styles.relayDot} cx="0" cy="0" r="3"><animateMotion dur="2.4s" repeatCount="indefinite" path="M12 55c12-39 33-39 56 0" /></circle></svg><em>SECURE</em></div>;
  }
  return <div className={styles.art} data-art={id}><span className={styles.monogramHalo}><i /><i /></span><svg viewBox="0 0 80 80"><path className={styles.monogramLeft} pathLength="1" d="M14 18 38 65" /><path className={styles.monogramRight} pathLength="1" d="M66 18 42 65" /><path className={styles.monogramCut} pathLength="1" d="M25 18h10l5 12 5-12h10" /></svg></div>;
}

export default function MotionAtelier({ locale }: { locale: Locale }) {
  const text = copy[locale];
  const [selectedId, setSelectedId] = useState<LoaderId>("01");
  const selected = loaderCatalog.find((item) => item.id === selectedId) ?? loaderCatalog[0];

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroGrid} aria-hidden="true" />
        <div className={styles.heroCopy}>
          <span>{text.eyebrow}</span>
          <h1>{text.title}</h1>
          <p>{text.intro}</p>
        </div>
        <div className={styles.masterPreview}>
          <div className={styles.previewTopline}><span><i />{text.live}</span><b>{text.compact}</b></div>
          <div className={styles.previewBody} key={selectedId}>
            <div className={styles.previewArtwork}><LoaderArtwork id={selectedId} /></div>
            <div className={styles.previewMeta}><small>{selected.id} / 20</small><strong>{selected.name}</strong><span>{selected.use}</span></div>
          </div>
        </div>
      </header>

      <section className={styles.catalog} aria-labelledby="motion-catalog-title">
        <div className={styles.catalogHeader}>
          <div><span>{text.select}</span><h2 id="motion-catalog-title">01—20 / LOADING IDENTITIES</h2></div>
          <p><CornerDownRight size={14} />{text.instruction}</p>
        </div>
        <div className={styles.grid}>
          {loaderCatalog.map((loader) => {
            const active = loader.id === selectedId;
            return (
              <button
                key={loader.id}
                type="button"
                className={styles.card}
                data-selected={active ? "true" : "false"}
                aria-pressed={active}
                onClick={() => setSelectedId(loader.id)}
              >
                <div className={styles.cardTopline}><span>{loader.id}</span>{active ? <Check size={13} /> : <i />}</div>
                <div className={styles.cardStage}><LoaderArtwork id={loader.id} /></div>
                <div className={styles.cardCopy}><strong>{loader.name}</strong><span>{loader.use}</span></div>
              </button>
            );
          })}
        </div>
        <div className={styles.selectionBar}><span>{text.selected}</span><b>{selected.id}</b><strong>{selected.name}</strong><small>{selected.use}</small></div>
      </section>
    </main>
  );
}
