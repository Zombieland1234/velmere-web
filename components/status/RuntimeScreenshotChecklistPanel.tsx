import { buildPass2199RuntimeScreenshotChecklistReport, type Pass2199RuntimeScreenshotChecklistItem } from "@/lib/worldclass/runtime-screenshot-checklist-ui";

type Locale = "pl" | "en" | "de";

const copy = {
  pl: {
    eyebrow: "Operator runtime proof",
    title: "Checklist screenów do lokalnego odpalenia",
    body: "Ten panel pokazuje, co uruchomić, co sprawdzić i jaki zredagowany dowód zebrać, aby zamknąć blokadę środowiska.",
    command: "Najpierw lokalnie",
    noSecrets: "Nie wrzucaj sekretów, raw payloadów ani danych klienta. Tylko nazwy screenów, hashe i krótkie redacted summary.",
    route: "Route",
    action: "Akcja",
    expected: "Oczekiwany efekt",
    receipt: "Receipt target",
    screenshot: "Nazwa screena",
    board: "Board lane",
    forbidden: "Nie może zawierać",
    selectors: "Markery do sprawdzenia",
    blocked: "Status: static checklist gotowa, runtime dowody nadal do złapania.",
    assembler: "Po wykonaniu zrzutów skopiuj szablon, uzupełnij hashe i uruchom npm run local:runtime-receipt-auto-assembler.",
  },
  en: {
    eyebrow: "Operator runtime proof",
    title: "Local screenshot checklist",
    body: "This panel shows what to run, what to verify and which redacted evidence to capture to close the environment blocker.",
    command: "Run locally first",
    noSecrets: "Do not paste secrets, raw payloads, or customer data. Use screenshot names, hashes and short redacted summaries only.",
    route: "Route",
    action: "Action",
    expected: "Expected result",
    receipt: "Receipt target",
    screenshot: "Screenshot name",
    board: "Board lane",
    forbidden: "Must not contain",
    selectors: "Selector hints",
    blocked: "Status: static checklist ready; runtime evidence still needs capture.",
    assembler: "After the screenshots, copy the template, fill in the hashes and run npm run local:runtime-receipt-auto-assembler.",
  },
  de: {
    eyebrow: "Operator Runtime Proof",
    title: "Lokale Screenshot-Checkliste",
    body: "Dieses Panel zeigt, was lokal gestartet und geprüft wird und welche redigierten Nachweise nötig sind, um die Umgebungsblockade zu schließen.",
    command: "Zuerst lokal ausführen",
    noSecrets: "Keine Secrets, Raw Payloads oder Kundendaten einfügen. Nur Screenshot-Namen, Hashes und kurze redacted Summaries.",
    route: "Route",
    action: "Aktion",
    expected: "Erwartetes Ergebnis",
    receipt: "Receipt target",
    screenshot: "Screenshot-Name",
    board: "Board lane",
    forbidden: "Darf nicht enthalten",
    selectors: "Selector hints",
    blocked: "Status: statische Checkliste bereit; Runtime-Beweise müssen noch erfasst werden.",
    assembler: "Nach den Screenshots die Vorlage kopieren, Hashes eintragen und npm run local:runtime-receipt-auto-assembler starten.",
  },
} satisfies Record<Locale, Record<string, string>>;

function severityClass(severity: Pass2199RuntimeScreenshotChecklistItem["severity"]) {
  if (severity === "P0") return "border-red-400/30 bg-red-400/10 text-red-100";
  if (severity === "P1") return "border-amber-300/30 bg-amber-300/10 text-amber-100";
  return "border-white/15 bg-white/5 text-white/[0.70]";
}

export function RuntimeScreenshotChecklistPanel({ locale = "pl" }: { locale?: string }) {
  const normalized = locale === "en" || locale === "de" || locale === "pl" ? locale : "pl";
  const t = copy[normalized];
  const report = buildPass2199RuntimeScreenshotChecklistReport();

  return (
    <section
      data-pass2199-runtime-checklist
      className="mx-auto w-full max-w-7xl px-4 py-10 text-white sm:px-6 lg:px-8"
    >
      <div className="rounded-[2rem] border border-white/10 bg-black/55 p-5 shadow-2xl shadow-black/40 backdrop-blur md:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-white/[0.45]">{t.eyebrow}</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white md:text-5xl">{t.title}</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/[0.62] md:text-base">{t.body}</p>
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/[0.68]">
              <p className="font-medium text-white">{t.command}</p>
              <code data-pass2199-command-pack className="mt-2 block overflow-x-auto rounded-xl bg-black/45 px-3 py-2 text-xs text-white/[0.75]">
                npm ci --no-audit --no-fund --progress=false &amp;&amp; npm run typecheck &amp;&amp; npm run build &amp;&amp; npm run dev
              </code>
            </div>
          </div>
          <div className="rounded-[1.5rem] border border-amber-300/20 bg-amber-300/10 p-5 text-sm leading-7 text-amber-50">
            <p className="font-semibold">{t.blocked}</p>
            <p className="mt-3 text-amber-50/75">{t.noSecrets}</p>
            <p data-pass2200-local-runtime-receipt-auto-assembler className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-amber-50/80">{t.assembler}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs uppercase tracking-[0.2em] text-white/[0.45]">
              <span>Runtime checklist</span>
              <span>{report.productionGate}</span>
              <span>{report.items.length} checks</span>
              <span>{report.boardLane}</span>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-4">
          {report.items.map((item, index) => (
            <article
              key={item.id}
              data-pass2199-checklist-item={item.id}
              className="rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-4 shadow-lg shadow-black/20"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-white/[0.55]">{String(index + 1).padStart(2, "0")}</span>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${severityClass(item.severity)}`}>{item.severity}</span>
                <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs uppercase tracking-[0.22em] text-white/[0.45]">{item.group}</span>
                <span className="text-xs text-white/[0.40]">{item.id}</span>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="space-y-3 text-sm text-white/[0.68]">
                  <p><span className="text-white/[0.40]">{t.route}: </span>{item.route}</p>
                  <p><span className="text-white/[0.40]">{t.action}: </span>{item.action}</p>
                  <p><span className="text-white/[0.40]">{t.expected}: </span>{item.expectedCustomerSafeResult}</p>
                </div>
                <div className="space-y-3 rounded-2xl border border-white/10 bg-black/25 p-4 text-xs text-white/[0.58]">
                  <p><span className="text-white/[0.35]">{t.receipt}: </span><code>{item.receiptTarget}</code></p>
                  <p><span className="text-white/[0.35]">{t.screenshot}: </span><code>{item.screenshotName}</code></p>
                  <p><span className="text-white/[0.35]">{t.board}: </span><code>{item.boardLane}</code></p>
                  <p><span className="text-white/[0.35]">{t.selectors}: </span>{item.selectorHints.join(", ")}</p>
                  <p><span className="text-white/[0.35]">{t.forbidden}: </span>{item.mustNotContain.join(", ")}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
