import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import ResearchLabExperience from "@/components/research/ResearchLabExperience";
import { buildVelmereMetadata, SUPPORTED_LOCALES } from "@/lib/seo/metadata";

type Locale = "pl" | "de" | "en";

const copy = {
  pl: {
    kicker: "laboratorium liczb pierwszych · kryptografia · badania deterministyczne",
    title: "Velmère Research Lab",
    subtitle: "Kryptografia, liczby pierwsze i determinizm informacyjny przedstawione jako testowalne badania, nie jako obietnica przełamania zabezpieczeń.",
    badge: "audyt numeryczny · wymaga replikacji",
    cards: [
      { label: "Kryptografia", title: "Sekret pozostaje sekretem", body: "Podpis i weryfikacja pozwalają udowodnić kontrolę bez ujawniania prywatnego klucza." },
      { label: "Liczby pierwsze", title: "Mierzalny błąd rekonstrukcji", body: "Badamy resztę funkcji liczącej liczby pierwsze i porównujemy model z klasycznymi punktami odniesienia." },
      { label: "B. Protocol", title: "Skończona rekonstrukcja numeryczna", body: "Hipoteza jest oceniana na zbiorze walidacyjnym, przez przesunięcia parametrów, kontrolę sztucznych zer i niezależną replikację." },
      { label: "Entropia", title: "Deterministyczny model to nie RNG", body: "Źródło klucza wymaga jakościowej losowości. Model matematyczny nie zastępuje fizycznej entropii." },
    ],
    method: "Metoda badawcza",
    steps: [
      ["01", "Punkt odniesienia", "Porównaj π(x), R(x) i klasyczne przybliżenia przed dodaniem korekty."],
      ["02", "B. Protocol", "Zdefiniuj skończoną korektę, parametry i przewidywany zakres działania."],
      ["03", "Falsyfikacja", "Sprawdź zbiór walidacyjny, sztuczne zera, przesunięcie sąsiedztwa i stabilność poza dobranym oknem."],
      ["04", "Replikacja", "Udostępnij metodę i wyniki do niezależnego odtworzenia przed mocniejszym twierdzeniem."],
    ],
    boundaryTitle: "Granica twierdzenia",
    boundary: "Research Lab może mówić o benchmarku, rekonstrukcji, błędzie i falsyfikacji. Nie twierdzi, że udowodniono hipotezę Riemanna, złamano Bitcoin ani odzyskano prywatne klucze.",
    benchmarkTitle: "Audyt v3.1 · wyniki, które przeszły kontrolę",
    benchmarkIntro: "Liczby poniżej pochodzą z lokalnego raportu B. Protocol, aktualizowanego do testów v59. Najmocniejszy argument dotyczy skończonej rekonstrukcji numerycznej, nie twierdzenia asymptotycznego.",
    metrics: [
      ["v51 · zbiór walidacyjny", "800 punktów", "zamrożona mapa Adaptive-K"],
      ["Redukcja MAE", "96,734%", "53 871,13 → 1 759,36 względem R(x)"],
      ["Wygrane v51", "795 / 800", "bez dostrajania na zbiorze walidacyjnym"],
      ["v40 · znaki mieszane", "MAE 3,197", "najmocniejszy test dopasowania punktowego"],
    ],
    inverseTitle: "Odwrócona formuła · aktywny tor testowy",
    inverseBody: "Badamy, czy z obserwowanej reszty i stabilnego progu można odtworzyć parametry korekty bez przecieku informacji ze zbioru walidacyjnego. Ten tor pozostaje eksperymentalny.",
    inverseTests: [
      "Rozdziel trening skali od testu punktowego.",
      "Porównaj wynik z R(x), Li(x), stałą korektą i gładkim modelem log(x).",
      "Wykonaj przesunięcie sąsiedztwa, przetasowanie wewnątrz okna i kontrolę sztucznych zer.",
      "Zamroź parametry przed nowym zakresem i opublikuj residuale.",
    ],
    caveat: "Ważna obserwacja v59: wąskie okna v51 są lokalnie gładkie, więc potwierdzają głównie zachowanie skali. v40/v49 pozostają mocniejszym testem fazy punktowej.",
  },
  de: {
    kicker: "primzahllabor · kryptografie · deterministische forschung",
    title: "Velmère Research Lab",
    subtitle: "Kryptografie, Primzahlen und Informationsdeterminismus als prüfbare Forschung, nicht als Versprechen gebrochener Sicherheit.",
    badge: "numerisches Audit · Replikation erforderlich",
    cards: [
      { label: "Kryptografie", title: "Das Geheimnis bleibt geheim", body: "Signatur und Verifikation beweisen Kontrolle, ohne den privaten Schlüssel offenzulegen." },
      { label: "Primzahlen", title: "Messbarer Rekonstruktionsfehler", body: "Wir untersuchen den Restfehler der Primzahlzählfunktion und vergleichen das Modell mit klassischen Referenzmodellen." },
      { label: "B. Protocol", title: "Finite numerische Rekonstruktion", body: "Die Hypothese wird mit Validierungsdaten, Parameterverschiebungen, künstlichen Nullstellen und unabhängiger Replikation geprüft." },
      { label: "Entropie", title: "Determinismus ist kein RNG", body: "Schlüsselmaterial braucht hochwertige Zufälligkeit. Ein mathematisches Modell ersetzt keine physische Entropie." },
    ],
    method: "Forschungsmethode",
    steps: [
      ["01", "Referenzmodell", "π(x), R(x) und klassische Näherungen vor jeder Korrektur vergleichen."],
      ["02", "B. Protocol", "Finite Korrektur, Parameter und erwarteten Geltungsbereich definieren."],
      ["03", "Falsifikation", "Validierungsdaten, künstliche Nullstellen, Nachbarschaftsverschiebung und Stabilität außerhalb des Fensters testen."],
      ["04", "Replikation", "Methode und Ergebnisse vor stärkeren Aussagen unabhängig reproduzieren lassen."],
    ],
    boundaryTitle: "Aussagegrenze",
    boundary: "Research Lab darf über Benchmark, Rekonstruktion, Fehler und Falsifikation sprechen. Es behauptet keinen Beweis der Riemann-Hypothese, keinen Bitcoin-Bruch und keine Wiederherstellung privater Schlüssel.",
    benchmarkTitle: "Audit v3.1 · kontrollierte Ergebnisse",
    benchmarkIntro: "Die Werte stammen aus dem lokalen B.-Protocol-Bericht bis Test v59. Die stärkste Aussage betrifft eine finite numerische Rekonstruktion, kein asymptotisches Theorem.",
    metrics: [
      ["v51 · Validierungsmenge", "800 Punkte", "eingefrorene Adaptive-K-Karte"],
      ["MAE-Reduktion", "96,734%", "53.871,13 → 1.759,36 gegenüber R(x)"],
      ["v51 Siege", "795 / 800", "ohne Anpassung an die Validierungsmenge"],
      ["v40 · gemischte Vorzeichen", "MAE 3,197", "stärkster punktweiser Abgleichstest"],
    ],
    inverseTitle: "Inverse Formulierung · aktiver Testpfad",
    inverseBody: "Wir testen, ob Korrekturparameter aus Restfehler und stabilem Grenzwert ohne Informationsleck aus den Validierungsdaten rekonstruiert werden können. Dieser Pfad bleibt experimentell.",
    inverseTests: [
      "Skalen-Training vom punktweisen Test trennen.",
      "Mit R(x), Li(x), konstanter Korrektur und glattem log(x)-Modell vergleichen.",
      "Neighbor-Shift, Window-Shuffle und Fake-Zero-Kontrollen ausführen.",
      "Parameter vor einem neuen Bereich einfrieren und Residuals veröffentlichen.",
    ],
    caveat: "Wichtige v59-Beobachtung: enge v51-Fenster sind lokal glatt und validieren primär Skalenverhalten. v40/v49 bleiben der stärkere punktweise Phasentest.",
  },
  en: {
    kicker: "prime lab · cryptography · deterministic research",
    title: "Velmère Research Lab",
    subtitle: "Cryptography, prime numbers and informational determinism framed as testable research, not a promise to defeat security.",
    badge: "numerical audit · replication required",
    cards: [
      { label: "Cryptography", title: "The secret stays secret", body: "Signatures and verification prove control without revealing the private key." },
      { label: "Prime numbers", title: "Measurable reconstruction error", body: "We study the residual of the prime-counting function and compare the model with classical baselines." },
      { label: "B. Protocol", title: "Finite numerical reconstruction", body: "The hypothesis is evaluated through holdout, parameter shifts, fake-zero controls and independent replication." },
      { label: "Entropy", title: "Determinism is not RNG", body: "Key material needs high-quality randomness. A mathematical model does not replace physical entropy." },
    ],
    method: "Research method",
    steps: [
      ["01", "Baseline", "Compare π(x), R(x) and classical approximations before adding a correction."],
      ["02", "B. Protocol", "Define the finite correction, parameters and expected operating range."],
      ["03", "Falsification", "Test holdout, fake zeros, neighbor shift and stability outside the selected window."],
      ["04", "Replication", "Publish the method and results for independent reproduction before stronger claims."],
    ],
    boundaryTitle: "Claim boundary",
    boundary: "Research Lab may discuss benchmarks, reconstruction, error and falsification. It does not claim a proof of the Riemann hypothesis, a break of Bitcoin or recovery of private keys.",
    benchmarkTitle: "Audit v3.1 · controlled results",
    benchmarkIntro: "The figures below come from the local B. Protocol report through test v59. The strongest claim is a finite numerical reconstruction, not an asymptotic theorem.",
    metrics: [
      ["v51 holdout", "800 points", "frozen Adaptive-K map"],
      ["MAE reduction", "96.734%", "53,871.13 → 1,759.36 against R(x)"],
      ["v51 wins", "795 / 800", "without holdout retuning"],
      ["v40 mixed-sign", "MAE 3.197", "strongest pointwise alignment test"],
    ],
    inverseTitle: "Inverse formulation · active test lane",
    inverseBody: "We are testing whether correction parameters can be reconstructed from the residual and a stable cutoff without holdout leakage. This lane remains experimental.",
    inverseTests: [
      "Separate scale training from pointwise testing.",
      "Compare against R(x), Li(x), a constant correction and a smooth log(x) model.",
      "Run neighbor-shift, within-window shuffle and fake-zero controls.",
      "Freeze parameters before a new range and publish residuals.",
    ],
    caveat: "Important v59 observation: narrow v51 windows are locally smooth, so they mainly validate scale behavior. v40/v49 remain the stronger pointwise phase test.",
  },
} as const;

const researchValidationCopy = {
  pl: {
    kicker: "Matryca walidacji",
    title: "Matryca walidacji i bezpiecznego ujawniania",
    body: "Badania pokazują metodę, benchmark i ograniczenia bez obietnic przełamania zabezpieczeń albo odzyskania kluczy.",
    rows: [
      ["Twierdzenie", "Tylko mierzalny benchmark, nie dowód asymptotyczny."],
      ["Ujawnianie", "Publiczne liczby tak, sekrety i prywatne klucze nigdy."],
      ["Replikacja", "Każde mocniejsze twierdzenie wymaga niezależnego odtworzenia."],
    ],
  },
  de: {
    kicker: "Validierungsmatrix",
    title: "Validierungsmatrix und sichere Offenlegung",
    body: "Die Forschung zeigt Methode, Benchmark und Grenzen, ohne gebrochene Sicherheit oder Schlüsselwiederherstellung zu versprechen.",
    rows: [
      ["Aussage", "Nur messbarer Benchmark, kein asymptotischer Beweis."],
      ["Offenlegung", "Öffentliche Zahlen ja, Geheimnisse und private Schlüssel nie."],
      ["Replikation", "Jede stärkere Aussage braucht unabhängige Reproduktion."],
    ],
  },
  en: {
    kicker: "Validation Matrix",
    title: "Validation matrix and safe disclosure",
    body: "Research shows method, benchmark and limits without promising broken security or private-key recovery.",
    rows: [
      ["Claim", "Only measurable benchmark language, not an asymptotic proof."],
      ["Disclosure", "Public numbers are allowed; secrets and private keys are never exposed."],
      ["Replication", "Any stronger claim requires independent reproduction."],
    ],
  },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return buildVelmereMetadata({
    locale,
    path: "/research-lab",
    title: "Velmère Research Lab",
    description: "Testable cryptography and prime-number research with clear claim boundaries.",
  });
}

export default async function ResearchLabPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!SUPPORTED_LOCALES.includes(locale as (typeof SUPPORTED_LOCALES)[number])) notFound();
  setRequestLocale(locale);
  const safeLocale: Locale = locale === "de" || locale === "en" ? locale : "pl";
  const c = copy[safeLocale];
  const validation = researchValidationCopy[safeLocale];

  return (
    <ResearchLabExperience
      locale={safeLocale}
      copy={c}
      validation={validation}
    />
  );
}

/* Public research surface: measurable evidence, explicit limits, independent replication. */
