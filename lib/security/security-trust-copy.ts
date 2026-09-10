export type SecurityTrustLocale = "pl" | "de" | "en";
export type SecurityTrustPillarId =
  | "headers_csp"
  | "api_abuse_shield"
  | "rate_limit"
  | "admin_gate"
  | "event_ledger"
  | "safe_export"
  | "provider_boundaries"
  | "quality_control";

export type SecurityTrustPillar = {
  id: SecurityTrustPillarId;
  progress: number;
  status: "live" | "preview" | "planned" | "blocked";
  title: Record<SecurityTrustLocale, string>;
  summary: Record<SecurityTrustLocale, string>;
  implemented: string[];
  next: string[];
};

export type SecurityTrustRoadmapItem = {
  id: string;
  phase: "now" | "next" | "later";
  label: Record<SecurityTrustLocale, string>;
  description: Record<SecurityTrustLocale, string>;
  blockers: string[];
};

export const securityTrustForbiddenClaims = [
  "najlepsze zabezpieczenia świata",
  "nie do zhakowania",
  "gwarantowane bezpieczeństwo",
  "100% secure",
  "unhackable",
  "hack proof",
  "world's best security",
  "best security in the world",
  "military-grade security",
  "bank-level guaranteed",
];

export const securityTrustPillars: SecurityTrustPillar[] = [
  {
    id: "headers_csp",
    progress: 88,
    status: "live",
    title: {
      pl: "Twarde nagłówki bezpieczeństwa",
      de: "Starke Security Headers",
      en: "Strict security headers",
    },
    summary: {
      pl: "CSP, HSTS, frame blocking, nosniff, referrer policy i permissions policy ograniczają podstawowe ryzyka przeglądarkowe.",
      de: "CSP, HSTS, Frame Blocking, nosniff, Referrer Policy und Permissions Policy reduzieren grundlegende Browser-Risiken.",
      en: "CSP, HSTS, frame blocking, nosniff, referrer policy and permissions policy reduce common browser-side risk.",
    },
    implemented: ["Content-Security-Policy", "HSTS", "X-Frame-Options", "nosniff", "Permissions-Policy"],
    next: ["CSP nonce rollout", "production browser CSP report review"],
  },
  {
    id: "api_abuse_shield",
    progress: 86,
    status: "live",
    title: {
      pl: "API Abuse Shield",
      de: "API Abuse Shield",
      en: "API Abuse Shield",
    },
    summary: {
      pl: "Publiczne endpointy mają scoring podejrzanych requestów, limity, blokady wzorców skanerów i bezpieczne odpowiedzi JSON.",
      de: "Öffentliche Endpunkte nutzen Request Scoring, Limits, Scanner-Pattern-Blocking und sichere JSON-Antworten.",
      en: "Public endpoints use suspicious request scoring, limits, scanner-pattern blocking and safe JSON responses.",
    },
    implemented: ["scanner user-agent scoring", "malicious URL pattern scoring", "bounded query sanitizer", "no-store JSON"],
    next: ["production tuning", "WAF rule sync"],
  },
  {
    id: "rate_limit",
    progress: 78,
    status: "preview",
    title: {
      pl: "Durable rate limit",
      de: "Durable Rate Limit",
      en: "Durable rate limit",
    },
    summary: {
      pl: "System ma adapter Upstash/Redis i memory fallback. Produkcja wymaga envów i obserwacji fallbacków.",
      de: "Das System hat Upstash/Redis Adapter und Memory Fallback. Produktion braucht Envs und Fallback-Monitoring.",
      en: "The system has an Upstash/Redis adapter and memory fallback. Production needs envs and fallback monitoring.",
    },
    implemented: ["Upstash REST adapter", "memory fallback", "per-route profiles"],
    next: ["configure production envs", "load test", "fallback alerting"],
  },
  {
    id: "admin_gate",
    progress: 80,
    status: "preview",
    title: {
      pl: "Security admin gate",
      de: "Security Admin Gate",
      en: "Security admin gate",
    },
    summary: {
      pl: "Wrażliwe endpointy security wymagają server-side tokenu i scope. Panel admina jest domyślnie zablokowany.",
      de: "Sensible Security-Endpunkte benötigen serverseitigen Token und Scope. Das Admin Panel ist standardmäßig gesperrt.",
      en: "Sensitive security endpoints require a server-side token and scope. The admin panel is locked by default.",
    },
    implemented: ["server token gate", "scoped security APIs", "locked admin console"],
    next: ["real session identity", "role-based admin access"],
  },
  {
    id: "event_ledger",
    progress: 79,
    status: "preview",
    title: {
      pl: "Security event ledger",
      de: "Security Event Ledger",
      en: "Security event ledger",
    },
    summary: {
      pl: "Blokady, rate limit, provider fallback i podejrzany ruch trafiają do redagowanego event trail.",
      de: "Blocks, Rate Limits, Provider Fallbacks und verdächtiger Traffic landen in einem redigierten Event Trail.",
      en: "Blocks, rate limits, provider fallback and suspicious traffic enter a redacted event trail.",
    },
    implemented: ["redacted event records", "append adapter", "admin audit preview"],
    next: ["durable retention", "alert delivery", "admin audit persistence"],
  },
  {
    id: "safe_export",
    progress: 84,
    status: "preview",
    title: {
      pl: "Safe export",
      de: "Safe Export",
      en: "Safe export",
    },
    summary: {
      pl: "Eksport security nie zawiera raw IP, raw query, tokenów ani sekretów. Wymaga admin scope.",
      de: "Security Export enthält keine Raw IP, Raw Query, Tokens oder Secrets. Er benötigt Admin Scope.",
      en: "Security export contains no raw IP, raw query, tokens or secrets. It requires admin scope.",
    },
    implemented: ["admin-scoped export", "redacted security snapshot", "no raw payload export"],
    next: ["durable export archive", "operator identity binding"],
  },
  {
    id: "provider_boundaries",
    progress: 67,
    status: "preview",
    title: {
      pl: "Granice providerów",
      de: "Provider-Grenzen",
      en: "Provider boundaries",
    },
    summary: {
      pl: "Integracje z live feeds mają być server-only, z timeoutami, allowlistą i jasnym source confidence.",
      de: "Live-Feed Integrationen bleiben server-only mit Timeouts, Allowlist und klarer Source Confidence.",
      en: "Live feed integrations should stay server-only with timeouts, allowlists and clear source confidence.",
    },
    implemented: ["token icon allowlist", "source boundary contracts", "adapter readiness"],
    next: ["holder/orderbook/contract live adapters", "source snapshot durability"],
  },
  {
    id: "quality_control",
    progress: 82,
    status: "preview",
    title: {
      pl: "Kontrola jakości i bezpieczny język",
      de: "Qualitätskontrolle und sichere Sprache",
      en: "Quality control and safe wording",
    },
    summary: {
      pl: "Shield nie udaje pewności. Używa jawnych braków danych, nieskalibrowanej pewności, wewnętrznej kontroli jakości i bezpiecznych komunikatów.",
      de: "Shield behauptet keine Gewissheit. Es nutzt sichtbare Datenlücken, nicht kalibrierte Konfidenz, interne Qualitätskontrolle und sichere Aussagen.",
      en: "Shield does not pretend certainty. It uses explicit missing data, uncalibrated confidence, internal quality control and safe statements.",
    },
    implemented: ["not financial advice boundary", "missing data warnings", "safe risk language"],
    next: ["source ledger timestamps", "independent reviewer workflow before any reviewed-service claim"],
  },
];

export const securityTrustRoadmap: SecurityTrustRoadmapItem[] = [
  {
    id: "configure-production-envs",
    phase: "now",
    label: {
      pl: "Ustawić produkcyjne env security",
      de: "Produktions-Security-Envs setzen",
      en: "Configure production security envs",
    },
    description: {
      pl: "Upstash, admin token hash, security admin scopes i event append key muszą być ustawione w Vercel.",
      de: "Upstash, Admin Token Hash, Security Admin Scopes und Event Append Key müssen in Vercel gesetzt werden.",
      en: "Upstash, admin token hash, security admin scopes and event append key need to be set in Vercel.",
    },
    blockers: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "VELMERE_SECURITY_ADMIN_TOKEN_SHA256"],
  },
  {
    id: "waf-bot-layer",
    phase: "next",
    label: {
      pl: "WAF i bot protection",
      de: "WAF und Bot Protection",
      en: "WAF and bot protection",
    },
    description: {
      pl: "App-level guards muszą zostać wsparte regułami na brzegu: skanery, wysokie tempo API, znane ścieżki ataków.",
      de: "App-level Guards brauchen Edge-Regeln: Scanner, hohe API-Frequenz, bekannte Angriffspfade.",
      en: "App-level guards need edge rules: scanners, high-rate API traffic and known attack paths.",
    },
    blockers: ["Vercel Firewall rules", "bot rules", "production logs"],
  },
  {
    id: "durable-retention-alerts",
    phase: "next",
    label: {
      pl: "Retencja i alerty",
      de: "Retention und Alerts",
      en: "Retention and alerts",
    },
    description: {
      pl: "Eventy security muszą mieć retencję, purge policy i alert delivery do operatora.",
      de: "Security Events brauchen Retention, Purge Policy und Alert Delivery zum Operator.",
      en: "Security events need retention, purge policy and alert delivery to the operator.",
    },
    blockers: ["durable storage", "retention policy", "email/Discord/Slack alert channel"],
  },
  {
    id: "external-review",
    phase: "later",
    label: {
      pl: "Zewnętrzny security review",
      de: "Externer Security Review",
      en: "External security review",
    },
    description: {
      pl: "Przed dużym ruchem trzeba zrobić realny test konfiguracji, zależności, payment flows i publicznych API.",
      de: "Vor großem Traffic braucht es echte Tests für Konfiguration, Dependencies, Payment Flows und öffentliche APIs.",
      en: "Before major traffic, configuration, dependencies, payment flows and public APIs need real testing.",
    },
    blockers: ["dependency scanning", "payment/webhook review", "browser QA", "external security test"],
  },
];

export const securityTrustCopy = {
  pl: {
    eyebrow: "Velmère Security",
    title: "Budujemy security-first system, warstwa po warstwie.",
    subtitle:
      "Nie obiecujemy niemożliwego. Wdrażamy twarde nagłówki, API Abuse Shield, rate limits, admin gate, event ledger, safe export i manual review, aby ograniczać realne ryzyko przed publicznym ruchem.",
    short:
      "Velmère korzysta z podejścia security-first: ograniczamy powierzchnię ataku, chronimy publiczne API, blokujemy podejrzany ruch i zapisujemy redagowane eventy bezpieczeństwa bez raw IP, raw query ani sekretów.",
    disclaimer:
      "Żaden system nie usuwa całego ryzyka. Security Velmère oznacza ciągłe wzmacnianie, audyt, monitoring i jasne granice produkcyjne.",
  },
  de: {
    eyebrow: "Velmère Security",
    title: "Wir bauen ein security-first System, Schicht für Schicht.",
    subtitle:
      "Wir versprechen nichts Unmögliches. Wir implementieren Security Headers, API Abuse Shield, Rate Limits, Admin Gate, Event Ledger, Safe Export und Manual Review, um reale Risiken vor öffentlichem Traffic zu reduzieren.",
    short:
      "Velmère nutzt einen security-first Ansatz: Wir reduzieren die Angriffsfläche, schützen öffentliche APIs, blockieren verdächtigen Traffic und speichern redigierte Security Events ohne Raw IP, Raw Query oder Secrets.",
    disclaimer:
      "Kein System entfernt jedes Risiko. Velmère Security bedeutet kontinuierliche Härtung, Audit, Monitoring und klare Produktionsgrenzen.",
  },
  en: {
    eyebrow: "Velmère Security",
    title: "We are building a security-first system, layer by layer.",
    subtitle:
      "We do not promise the impossible. We implement strict headers, API Abuse Shield, rate limits, admin gate, event ledger, safe export and manual review to reduce real risk before public traffic.",
    short:
      "Velmère follows a security-first approach: we reduce attack surface, protect public APIs, block suspicious traffic and store redacted security events without raw IP, raw query or secrets.",
    disclaimer:
      "No system can remove every risk. Velmère Security means continuous hardening, audit, monitoring and clear production boundaries.",
  },
} as const;

export function resolveSecurityTrustLocale(locale: string): SecurityTrustLocale {
  return locale === "pl" || locale === "de" || locale === "en" ? locale : "en";
}

export function buildSecurityTrustSnapshot(locale = "en") {
  const safeLocale = resolveSecurityTrustLocale(locale);
  return {
    schemaVersion: "velmere-security-trust-v1",
    locale: safeLocale,
    copy: securityTrustCopy[safeLocale],
    pillars: securityTrustPillars.map((pillar) => ({
      id: pillar.id,
      progress: pillar.progress,
      status: pillar.status,
      title: pillar.title[safeLocale],
      summary: pillar.summary[safeLocale],
      implemented: pillar.implemented,
      next: pillar.next,
    })),
    roadmap: securityTrustRoadmap.map((item) => ({
      id: item.id,
      phase: item.phase,
      label: item.label[safeLocale],
      description: item.description[safeLocale],
      blockers: item.blockers,
    })),
    forbiddenClaims: securityTrustForbiddenClaims,
    productionBoundary:
      "Public security copy must describe implemented layers and roadmap honestly. It must not claim risk-free operation, guaranteed protection or world-best status.",
  };
}
