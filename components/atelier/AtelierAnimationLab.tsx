type Locale = "en" | "pl" | "de";

type MotionTier = "core" | "pro" | "advanced";

type AnimationSpec = {
  id: number;
  name: string;
  note: string;
  tone: string;
  tier: MotionTier;
};

const shieldAnimations: AnimationSpec[] = [
  { id: 1, name: "Black Glass Sentinel", note: "deep black glass crest, gold V core, slow authority sweep", tone: "sentinel", tier: "core" },
  { id: 2, name: "Velmère Seal Plate", note: "layered metal seal with premium edge light and controlled pulse", tone: "seal", tier: "core" },
  { id: 3, name: "Audit Beacon Crest", note: "thin scanner beacon crosses the V without looking cheap", tone: "audit", tier: "core" },
  { id: 4, name: "Obsidian V Guard", note: "matte black body, internal gold glow, luxury guard motion", tone: "guard", tier: "core" },
  { id: 5, name: "Quiet Vault Mark", note: "vault-door halo with shield depth and calm security feel", tone: "vault", tier: "core" },
  { id: 6, name: "Holo Trace Crest", note: "subtle holographic traces behind a clean black-gold V", tone: "holo", tier: "core" },
  { id: 7, name: "Orbital Trust Seal", note: "small gold satellites orbit a heavy central crest", tone: "trust", tier: "core" },
  { id: 8, name: "Layered Access Crest", note: "three dark plates align into a premium access shield", tone: "access", tier: "core" },
  { id: 9, name: "Risk Calm Emblem", note: "soft amber risk pulse, no alarm color, institutional calm", tone: "risk", tier: "core" },
  { id: 10, name: "Launch Lock Crest", note: "final lock ring closes around a restrained Velmère mark", tone: "launch", tier: "core" },
  { id: 11, name: "Pro Obsidian Gate", note: "double glass gates open, V light appears from depth", tone: "pro gate", tier: "pro" },
  { id: 12, name: "Prism Proof Crest", note: "angled light blades refract across a black proof seal", tone: "proof", tier: "pro" },
  { id: 13, name: "Magnetic Access Seal", note: "outer lock bands pull inward and arm the gold V", tone: "access", tier: "pro" },
  { id: 14, name: "Stealth Kernel Guard", note: "nearly black, one quiet core heartbeat, premium hidden power", tone: "stealth", tier: "pro" },
  { id: 15, name: "Data Veil Crest", note: "thin vertical data veil passes behind the V seal", tone: "data", tier: "pro" },
  { id: 16, name: "Ceramic Noir Shield", note: "ceramic dark body with warm gold bevel and depth", tone: "fashion", tier: "pro" },
  { id: 17, name: "Crown Trust Plate", note: "upper crown ring locks like a restrained luxury certificate", tone: "trust", tier: "pro" },
  { id: 18, name: "Neural Sentinel Crest", note: "three neural sparks route around a premium shield core", tone: "neural", tier: "pro" },
  { id: 19, name: "Pressure Proof Seal", note: "wide calm waves show pressure monitoring without panic", tone: "risk", tier: "pro" },
  { id: 20, name: "Frosted Black V", note: "frosted glass shield with clear V silhouette and slow shimmer", tone: "clean", tier: "pro" },
  { id: 21, name: "Advanced Quantum Gate", note: "side gates slide, black-gold crest emerges like a secure chamber", tone: "world-class", tier: "advanced" },
  { id: 22, name: "Iris Vault Crest", note: "camera-iris aperture arms the V in a premium vault motion", tone: "security", tier: "advanced" },
  { id: 23, name: "Sovereign Black Seal", note: "heavy ceremonial crest, slower and more expensive feeling", tone: "prestige", tier: "advanced" },
  { id: 24, name: "Holographic Risk Core", note: "micro-grid face with restrained proof pulse and depth layers", tone: "risk AI", tier: "advanced" },
  { id: 25, name: "Black Vault Reactor", note: "dark vault opens from the inside with protected AI glow", tone: "vault", tier: "advanced" },
  { id: 26, name: "Transformer V Assembly", note: "micro plates assemble into the Velmère V like a luxury machine", tone: "mech", tier: "advanced" },
  { id: 27, name: "Orbital Sentinel Lock", note: "satellite ring, tiny lock sparks, mature security identity", tone: "sentinel", tier: "advanced" },
  { id: 28, name: "Carbon Fiber Crest", note: "carbon-black material with animated gold fiber grain", tone: "carbon", tier: "advanced" },
  { id: 29, name: "AI Core Guardian", note: "protected AI reactor light inside a deep black shield shell", tone: "AI core", tier: "advanced" },
  { id: 30, name: "Velmère Final Crest", note: "launch-grade black-gold final seal candidate with strongest motion", tone: "final", tier: "advanced" },
];

const loadingAnimations: AnimationSpec[] = [
  { id: 1, name: "Three Dot V Forge", note: "three thinking dots fold into a Velmère V", tone: "clean", tier: "core" },
  { id: 2, name: "Mech Dot Assembly", note: "dots move like mechanical plates before forming V", tone: "robotic", tier: "core" },
  { id: 3, name: "Neural V Pulse", note: "dots connect with neural lines, then snap into V", tone: "AI brain", tier: "core" },
  { id: 4, name: "Golden Typing V", note: "classic typing dots, luxury V reveal", tone: "chat", tier: "core" },
  { id: 5, name: "Scanner Dots", note: "scan sweep crosses the dots before V lock", tone: "security", tier: "core" },
  { id: 6, name: "Orbit Dots", note: "dots orbit the center and land as V points", tone: "motion", tier: "core" },
  { id: 7, name: "Terminal V Loader", note: "terminal ticks, dots become a sharp V", tone: "lab", tier: "core" },
  { id: 8, name: "Liquid V Loader", note: "soft fluid dots merge into a glowing V", tone: "premium", tier: "core" },
  { id: 9, name: "Signal Lock Loader", note: "three dots verify, then V seal locks", tone: "proof", tier: "core" },
  { id: 10, name: "Angel Thinking V", note: "calm assistant-thinking rhythm with V finish", tone: "Angel", tier: "core" },
  { id: 11, name: "Transformer V Plates", note: "three dots become tiny plates, then snap into a V", tone: "mech", tier: "pro" },
  { id: 12, name: "Magnetic Dot Lock", note: "dots pull together like magnets before the V reveal", tone: "access", tier: "pro" },
  { id: 13, name: "Prism Thinking V", note: "dots split into prism glow and rejoin as a V", tone: "premium", tier: "pro" },
  { id: 14, name: "Neural Link V", note: "thin AI lines connect dots before the final mark", tone: "AI", tier: "pro" },
  { id: 15, name: "Vault Verify V", note: "three verification locks become the Velmère V", tone: "proof", tier: "pro" },
  { id: 16, name: "Carbon Pulse V", note: "quiet carbon grain with gold thinking pulse", tone: "stealth", tier: "pro" },
  { id: 17, name: "Halo Typing V", note: "typing dots orbit inside a soft halo, then land as V", tone: "chat", tier: "pro" },
  { id: 18, name: "Data Packet V", note: "dots behave like packets moving through a secure rail", tone: "data", tier: "pro" },
  { id: 19, name: "Crown Signal V", note: "gold signal crowns the dots before V lock", tone: "trust", tier: "pro" },
  { id: 20, name: "Silent Assistant V", note: "minimal slow loader for calm premium AI thinking", tone: "calm", tier: "pro" },
  { id: 21, name: "Advanced Transformer V", note: "mechanical dots rotate, hinge and transform into V", tone: "world-class", tier: "advanced" },
  { id: 22, name: "Iris Thinking V", note: "iris aperture closes while dots assemble the V", tone: "security", tier: "advanced" },
  { id: 23, name: "Quantum V Loader", note: "dots phase through positions before locking into V", tone: "quantum", tier: "advanced" },
  { id: 24, name: "Sentinel Scan V", note: "scanner crosshair validates each dot before the V", tone: "sentinel", tier: "advanced" },
  { id: 25, name: "AI Reactor V", note: "center glow charges like a protected AI core", tone: "AI core", tier: "advanced" },
  { id: 26, name: "Matrix Proof V", note: "micro grid flickers behind the dots during thinking", tone: "proof", tier: "advanced" },
  { id: 27, name: "Liquid Metal V", note: "dots stretch like liquid metal into the final mark", tone: "liquid", tier: "advanced" },
  { id: 28, name: "Orbital Angel V", note: "Angel-style calm orbit with a premium V lock", tone: "Angel", tier: "advanced" },
  { id: 29, name: "Risk Brain V", note: "soft risk pulses move through the dots before V", tone: "risk brain", tier: "advanced" },
  { id: 30, name: "Velmère Final Thinking", note: "launch-grade loader: three dots transform into full V seal", tone: "final", tier: "advanced" },
];

function copyFor(locale: string) {
  const safeLocale = (locale === "pl" || locale === "de" || locale === "en" ? locale : "en") as Locale;
  const copy = {
    en: {
      eyebrow: "VELMÈRE ATELIER · ADVANCED ANIMATION LAB",
      title: "Choose the final motion system.",
      body:
        "The old atelier globe remains removed. The first shield set was rejected and fully replaced. This page now shows 30 rebuilt premium black-gold shield animations plus 30 AI thinking loaders. Loader 18 is kept, but its dot motion now resolves into a normal upright Velmère V.",
      shieldTitle: "3D Shield Animations",
      loaderTitle: "AI Chat Thinking Loaders",
      shieldBody: "Thirty rebuilt premium shield concepts. The rejected old shield set is no longer rendered.",
      loaderBody: "Thirty three-dot AI loaders that mechanically transform into the Velmère V.",
      choose: "Choose number",
      oldRemoved: "Old atelier page removed for now",
      debug: "Advanced CSS motion · no external assets",
      count: "60 motion options",
    },
    pl: {
      eyebrow: "VELMÈRE ATELIER · ADVANCED ANIMATION LAB",
      title: "Wybierz finalny system ruchu.",
      body:
        "Stary glob atelier nadal jest usunięty. Pierwszy zestaw shieldów został odrzucony i w całości wymieniony. Ta podstrona pokazuje teraz 30 nowych premium black-gold shieldów plus 30 loaderów AI. Loader 18 zostaje, ale jego kropki składają się już w normalne, nieodwrócone V Velmère.",
      shieldTitle: "Animacje 3D Shielda",
      loaderTitle: "Loadery AI Chat Thinking",
      shieldBody: "Trzydzieści przebudowanych premium shieldów. Odrzucony stary zestaw nie jest już renderowany.",
      loaderBody: "Trzydzieści loaderów z trzema kropkami, które mechanicznie składają się w V Velmère.",
      choose: "Wybierz numer",
      oldRemoved: "Stara strona atelier usunięta na później",
      debug: "Advanced CSS motion · bez zewnętrznych assetów",
      count: "60 motion options",
    },
    de: {
      eyebrow: "VELMÈRE ATELIER · ADVANCED ANIMATION LAB",
      title: "Wähle das finale Motion-System.",
      body:
        "Die alte Atelier-Kugel bleibt entfernt. Das erste Shield-Set wurde verworfen und vollständig ersetzt. Diese Seite zeigt jetzt 30 neue Premium-Black-Gold-Shields plus 30 AI-Thinking-Loader. Loader 18 bleibt, aber die Punkte formen nun ein normales, aufrechtes Velmère V.",
      shieldTitle: "3D Shield Animationen",
      loaderTitle: "AI Chat Thinking Loader",
      shieldBody: "Dreißig neu gebaute Premium-Shields. Das abgelehnte alte Set wird nicht mehr gerendert.",
      loaderBody: "Dreißig Drei-Punkte-Loader, die sich mechanisch in das Velmère V verwandeln.",
      choose: "Nummer wählen",
      oldRemoved: "Alte Atelier-Seite vorerst entfernt",
      debug: "Advanced CSS-Motion · keine externen Assets",
      count: "60 Motion-Optionen",
    },
  } as const;
  return copy[safeLocale];
}

function tierLabel(tier: MotionTier) {
  if (tier === "advanced") return "ADVANCED";
  if (tier === "pro") return "PRO";
  return "CORE";
}

function ShieldPreview({ spec }: { spec: AnimationSpec }) {
  const index = String(spec.id).padStart(2, "0");
  return (
    <article
      className={`vlm-atelier-lab-card vlm-premium-shield-card vlm-premium-shield-variant-${spec.id}`}
      data-atelier-shield-option={index}
      data-motion-tier={spec.tier}
      data-pass2479-premium-shield-rebuild="true"
    >
      <div className="vlm-atelier-card-topline">
        <span>{index}</span>
        <span>{tierLabel(spec.tier)}</span>
      </div>
      <div className="vlm-atelier-card-tone">{spec.tone}</div>
      <div className="vlm-premium-shield-stage" aria-hidden="true">
        <span className="vlm-premium-shield-aura" />
        <span className="vlm-premium-shield-gate vlm-premium-shield-gate-left" />
        <span className="vlm-premium-shield-gate vlm-premium-shield-gate-right" />
        <span className="vlm-premium-shield-orbit vlm-premium-shield-orbit-a" />
        <span className="vlm-premium-shield-orbit vlm-premium-shield-orbit-b" />
        <span className="vlm-premium-shield-spark vlm-premium-shield-spark-a" />
        <span className="vlm-premium-shield-spark vlm-premium-shield-spark-b" />
        <span className="vlm-premium-shield-spark vlm-premium-shield-spark-c" />
        <span className="vlm-premium-shield-crest">
          <span className="vlm-premium-shield-backplate" />
          <span className="vlm-premium-shield-face" />
          <span className="vlm-premium-shield-inner" />
          <span className="vlm-premium-shield-grid" />
          <span className="vlm-premium-shield-v vlm-premium-shield-v-left" />
          <span className="vlm-premium-shield-v vlm-premium-shield-v-right" />
          <span className="vlm-premium-shield-core-dot" />
          <span className="vlm-premium-shield-edge-scan" />
          <span className="vlm-premium-shield-glass-sheen" />
        </span>
      </div>
      <div className="vlm-atelier-card-copy">
        <h3>{spec.name}</h3>
        <p>{spec.note}</p>
      </div>
    </article>
  );
}

function LoaderPreview({ spec }: { spec: AnimationSpec }) {
  const index = String(spec.id).padStart(2, "0");
  return (
    <article className={`vlm-atelier-lab-card vlm-loader-card vlm-loader-variant-${spec.id}`} data-atelier-loader-option={index} data-motion-tier={spec.tier}>
      <div className="vlm-atelier-card-topline">
        <span>{index}</span>
        <span>{tierLabel(spec.tier)}</span>
      </div>
      <div className="vlm-atelier-card-tone">{spec.tone}</div>
      <div className="vlm-loader-stage" aria-hidden="true">
        <span className="vlm-loader-frame" />
        <span className="vlm-loader-scanline" />
        <span className="vlm-loader-dot vlm-loader-dot-a" />
        <span className="vlm-loader-dot vlm-loader-dot-b" />
        <span className="vlm-loader-dot vlm-loader-dot-c" />
        <span className="vlm-loader-v-stem vlm-loader-v-left" />
        <span className="vlm-loader-v-stem vlm-loader-v-right" />
      </div>
      <div className="vlm-atelier-card-copy">
        <h3>{spec.name}</h3>
        <p>{spec.note}</p>
      </div>
    </article>
  );
}

export default function AtelierAnimationLab({ locale }: { locale: string }) {
  const t = copyFor(locale);

  return (
    <section className="vlm-atelier-lab-shell" data-pass2478-atelier-animation-lab="30x30" data-pass2479-atelier-animation-lab="shield-v2-loader18-fixed">
      <div className="vlm-atelier-lab-bg" aria-hidden="true" />
      <header className="vlm-atelier-lab-hero">
        <p className="vlm-atelier-lab-eyebrow">{t.eyebrow}</p>
        <h1>{t.title}</h1>
        <p>{t.body}</p>
        <div className="vlm-atelier-lab-meta" aria-label="Atelier animation lab status">
          <span>{t.oldRemoved}</span>
          <span>{t.count}</span>
          <span>30 rebuilt shields · 30 loaders</span>
          <span className="sr-only">30 shields · 30 loaders</span>
          <span>Core / Pro / Advanced · Loader 18 fixed</span>
          <span>{t.debug}</span>
        </div>
      </header>

      <div className="vlm-atelier-lab-section-head">
        <div>
          <p>{t.choose}: 01–30</p>
          <h2>{t.shieldTitle}</h2>
        </div>
        <span>{t.shieldBody}</span>
      </div>
      <div className="vlm-atelier-lab-grid" data-atelier-shield-grid="30-options">
        {shieldAnimations.map((spec) => (
          <ShieldPreview key={spec.id} spec={spec} />
        ))}
      </div>

      <div className="vlm-atelier-lab-section-head vlm-atelier-lab-section-head-spaced">
        <div>
          <p>{t.choose}: 01–30</p>
          <h2>{t.loaderTitle}</h2>
        </div>
        <span>{t.loaderBody}</span>
      </div>
      <div className="vlm-atelier-lab-grid" data-atelier-loader-grid="30-options">
        {loadingAnimations.map((spec) => (
          <LoaderPreview key={spec.id} spec={spec} />
        ))}
      </div>
    </section>
  );
}
