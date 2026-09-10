"use client";

import { VlmMotionScene } from "./VlmMotionScene";
import styles from "./VlmAnimationLab.module.css";

const names = {
  pl: ["Fala źródeł", "Konwergencja V", "Orbitalny rdzeń", "Profil głębokości", "Helisa sygnałów", "Konstelacja dowodów", "Deszcz danych", "Korytarz impulsu", "Faza monochromatyczna", "Skan integralności"],
  de: ["Quellenwelle", "V-Konvergenz", "Orbitaler Kern", "Tiefenprofil", "Signalhelix", "Evidenz-Konstellation", "Datenregen", "Impulskorridor", "Monochrome Phase", "Integritätsscan"],
  en: ["Source wave", "V convergence", "Orbital core", "Depth profile", "Signal helix", "Evidence constellation", "Data rain", "Pulse corridor", "Monochrome phase", "Integrity scan"],
} as const;

export function VlmAnimationLab({ locale }: { locale: "pl" | "de" | "en" }) {
  const intro = locale === "pl"
    ? "Dziesięć lekkich kierunków animacji. Każda scena zatrzymuje się poza ekranem — wybierz numer, który przeniesiemy do Analysis."
    : locale === "de"
      ? "Zehn leichte Animationsrichtungen. Jede Szene pausiert außerhalb des Viewports – wähle die Nummer für Analysis."
      : "Ten lightweight motion directions. Every scene pauses outside the viewport—choose the number to move into Analysis.";
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <p>VLM MOTION LAB · 01—10</p>
        <h1>{locale === "pl" ? "Laboratorium animacji" : locale === "de" ? "Animationslabor" : "Animation laboratory"}</h1>
        <span>{intro}</span>
      </header>
      <div className={styles.list}>
        {names[locale].map((name, index) => (
          <section className={styles.card} key={name}>
            <div className={styles.meta}><b>{String(index + 1).padStart(2, "0")}</b><div><h2>{name}</h2><p>VLM / SIGNAL MOTION SYSTEM</p></div></div>
            <VlmMotionScene variant={index + 1} monochrome={index === 8} />
          </section>
        ))}
      </div>
    </main>
  );
}
