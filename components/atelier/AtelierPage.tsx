import {
  ArrowUpRight,
  Check,
  CircleDot,
  Globe2,
  Layers3,
  Scissors,
  Shirt,
  Sparkles,
  Waypoints,
} from "lucide-react";
import AtelierNetworkMap from "@/components/atelier/AtelierNetworkMap";
import type { AtelierFacility } from "@/components/atelier/AtelierThreeGlobe";
import Reveal from "@/components/ui/Reveal";
import LuxuryProductCarousel from "@/components/home/LuxuryProductCarousel";

type Locale = "pl" | "en" | "de";
type RegionKey = "northAmerica" | "europe" | "asia" | "partner";
type CityKey =
  | "losAngeles"
  | "dallas"
  | "charlotte"
  | "toronto"
  | "tijuana"
  | "wolverhampton"
  | "riga"
  | "barcelona"
  | "china"
  | "japan"
  | "brazil"
  | "australia";

const FACILITY_SEEDS: ReadonlyArray<{
  id: string;
  cityKey: CityKey;
  regionKey: RegionKey;
  lat: number;
  lon: number;
  precision: AtelierFacility["precision"];
}> = [
  { id: "us-los-angeles", cityKey: "losAngeles", regionKey: "northAmerica", lat: 34.0522, lon: -118.2437, precision: "routing" },
  { id: "us-dallas", cityKey: "dallas", regionKey: "northAmerica", lat: 32.9546, lon: -97.015, precision: "exact" },
  { id: "us-charlotte", cityKey: "charlotte", regionKey: "northAmerica", lat: 35.2271, lon: -80.8431, precision: "exact" },
  { id: "ca-toronto", cityKey: "toronto", regionKey: "northAmerica", lat: 43.589, lon: -79.6441, precision: "exact" },
  { id: "mx-tijuana", cityKey: "tijuana", regionKey: "northAmerica", lat: 32.5149, lon: -117.0382, precision: "exact" },
  { id: "uk-wolverhampton", cityKey: "wolverhampton", regionKey: "europe", lat: 52.5862, lon: -2.128, precision: "exact" },
  { id: "eu-riga", cityKey: "riga", regionKey: "europe", lat: 56.923, lon: 24.034, precision: "exact" },
  { id: "eu-barcelona", cityKey: "barcelona", regionKey: "europe", lat: 41.337, lon: 1.995, precision: "exact" },
  { id: "asia-china", cityKey: "china", regionKey: "asia", lat: 22.5431, lon: 114.0579, precision: "routing" },
  { id: "jp-network", cityKey: "japan", regionKey: "partner", lat: 35.6762, lon: 139.6503, precision: "routing" },
  { id: "br-network", cityKey: "brazil", regionKey: "partner", lat: -23.5505, lon: -46.6333, precision: "routing" },
  { id: "au-network", cityKey: "australia", regionKey: "partner", lat: -33.8688, lon: 151.2093, precision: "routing" },
];

const COPY = {
  pl: {
    map: {
      mapKicker: "ATELIER NETWORK · GLOBAL CRAFT",
      titleLines: ["Projektowane przez", "Velmère.", "Tworzone globalnie."] as const,
      mapBody:
        "12 punktów sieci Atelier łączy wyselekcjonowane szwalnie, pracownie wykończeniowe i kierunki realizacji. Obróć glob — zamówienia obsługujemy worldwide.",
      nodeCountLabel: "punktów Atelier",
      realPositioning: "zweryfikowane współrzędne",
      cta: "Poznaj standard Atelier",
      cardsAria: "Standard rzemiosła Velmère Atelier",
    },
    globe: {
      visualAria: "Interaktywny glob Velmère Atelier z rzeczywistymi lokalizacjami regionalnej produkcji i realizacji.",
      controlAria: "Interaktywny glob Atelier. Przeciągnij lub dotknij punktu. Strzałki obracają glob, Enter wybiera punkt, a Escape zamyka etykietę.",
      loading: "Ładowanie sieci Atelier",
      fallbackTitle: "Sieć Atelier",
      fallbackBody: "WebGL jest niedostępny w tej sesji. Lista lokalizacji nadal przedstawia zweryfikowane współrzędne geograficzne.",
      selectedNode: "Wybrany punkt realizacji",
      dragTap: "Przeciągnij · dotknij punktu",
      dragTapKeyboard: "Przeciągnij · punkty · strzałki · Enter",
      realCoordinates: "Rzeczywiste współrzędne",
      surfaceMode: "Powierzchnia satelitarna · tryb dzień / noc",
      surfaceModeShort: "Satelitarna · dzień / noc",
      imageryCredit: "Zobrazowanie powierzchni · NASA Earth Observatory",
      nodeTypes: { exact: "PUNKT PRODUKCJI", country: "REGION PARTNERSKI", routing: "WĘZEŁ LOGISTYCZNY" },
    },
    cities: {
      losAngeles: "Los Angeles",
      dallas: "Dallas / Coppell",
      charlotte: "Charlotte",
      toronto: "Toronto / Mississauga",
      tijuana: "Tijuana",
      wolverhampton: "Wolverhampton",
      riga: "Ryga / Mārupe",
      barcelona: "Barcelona",
      china: "Shenzhen",
      japan: "Tokio",
      brazil: "São Paulo",
      australia: "Sydney",
    },
    regionNames: {
      northAmerica: "Ameryka Północna",
      europe: "Europa",
      asia: "Azja",
      partner: "Regiony partnerskie",
    },
    nodeGroups: {
      northAmerica: {
        title: "Produkcja i realizacja regionalna",
        note: "Wybrane fasony bazowe, dzianiny, haft i krótsze trasy dostaw dla Ameryki Północnej.",
      },
      europe: {
        title: "Europejskie wykończenie i realizacja",
        note: "Odzież, nadruk, haft i regionalna wysyłka dobierane do produktu oraz miejsca dostawy.",
      },
      asia: {
        title: "Rozszerzone możliwości konstrukcyjne",
        note: "Szerszy zakres cut-and-sew, efektów prania i personalizacji przy dostawie międzynarodowej.",
      },
      partner: {
        title: "Selektywna realizacja partnerska",
        note: "Wybrane produkty i lokalne trasy są uruchamiane zależnie od dostępności oraz kierunku zamówienia.",
      },
    },
    details: [
      { id: "material", icon: "material" as const, eyebrow: "01 · MATERIAŁ", title: "Ciężar, chwyt, trwałość", hint: "Dobieramy bazę produktu do sylwetki, przeznaczenia i standardu kolekcji." },
      { id: "construction", icon: "construction" as const, eyebrow: "02 · KONSTRUKCJA", title: "Forma przed dekoracją", hint: "Najpierw proporcja i sposób noszenia, potem nadruk, haft lub detal." },
      { id: "finish", icon: "tailor" as const, eyebrow: "03 · WYKOŃCZENIE", title: "Detal pod kontrolą", hint: "Pozycja zdobienia, czytelność i wykończenie są sprawdzane jako jeden system." },
      { id: "route", icon: "leaf" as const, eyebrow: "04 · REALIZACJA", title: "Najlepsza dostępna trasa", hint: "Węzeł dobieramy do produktu, regionu dostawy, jakości i bieżącej dostępności." },
    ],
    footer: [
      { icon: "shield" as const, label: "12 punktów Atelier", sublabel: "Szwalnie i węzły partnerskie" },
      { icon: "diamond" as const, label: "Dostawa worldwide", sublabel: "Trasa dopasowana do regionu" },
      { icon: "badge" as const, label: "Kontrola standardu", sublabel: "Jedna estetyka Velmère" },
      { icon: "lock" as const, label: "Obsługa prywatna", sublabel: "Osobista i dyskretna" },
    ],
    manifesto: {
      kicker: "JEDNA MARKA · WIELE SPECJALIZACJI",
      title: "Velmère projektuje system. Region dobiera najlepsze wykonanie.",
      body: "Atelier łączy kierunek kreatywny, specyfikację produktu i regionalną realizację. Nie każda technika jest dostępna w każdym miejscu — dlatego konkretny produkt otrzymuje trasę dopasowaną do fasonu, zdobienia, miejsca dostawy i aktualnej przepustowości.",
      metrics: [
        ["12", "pracowni i węzłów"],
        ["4", "główne regiony"],
        ["Global", "dostawa worldwide"],
      ],
    },
    regions: {
      kicker: "DOSTĘPNOŚĆ REGIONALNA",
      title: "Możliwości produkcji według kierunku.",
      body: "Poniższy zakres opisuje typowe możliwości sieci. Ostateczna dostępność jest zawsze potwierdzana dla konkretnego produktu.",
      available: "Dostępność selektywna",
      cards: [
        { key: "northAmerica" as const, code: "NA · 05", products: ["T-shirty i bluzy", "Nadruk bezpośredni", "Haft", "Realizacja regionalna"] },
        { key: "europe" as const, code: "EU · 03", products: ["Odzież bazowa", "Bluzy i warstwy", "Haft i nadruk", "Wykończenie regionalne"] },
        { key: "asia" as const, code: "AS · 01", products: ["Cut-and-sew", "Efekty prania", "Rozszerzona personalizacja", "Realizacja międzynarodowa"] },
        { key: "partner" as const, code: "PX · 03", products: ["Wybrane essentials", "Lokalne kierowanie", "Dostępność zależna od fasonu", "Japonia · Brazylia · Australia"] },
      ],
    },
    products: {
      kicker: "PRODUCT LANGUAGE",
      title: "Produkty budowane od sylwetki, nie od pustego nadruku.",
      body: "Każda rodzina produktu ma własną rolę w garderobie Velmère. Opisujemy to, co naprawdę wpływa na odbiór: ciężar, konstrukcję, powierzchnię i sposób wykończenia.",
      items: [
        { title: "Heavyweight jersey", label: "TEE · LONGSLEEVE", body: "Mięsista dzianina, spokojne układanie i powierzchnia, która utrzymuje wyrazisty detal bez wizualnego chaosu." },
        { title: "Structured fleece", label: "HOODIE · SWEAT", body: "Objętość, miękkie wnętrze i stabilna forma. Projektowany jako warstwa kolekcji, nie zwykły nośnik grafiki." },
        { title: "Cut & sew studies", label: "CUSTOM FORM", body: "Konstrukcje o szerszej swobodzie kroju, prania i detalu. Uruchamiane selektywnie dla właściwej serii." },
        { title: "Embroidery & finish", label: "SIGNATURE DETAIL", body: "Haft, rozmieszczenie oznaczeń i wykończenie budują rozpoznawalność z bliska, bez krzykliwego brandingu." },
      ],
    },
    method: {
      kicker: "OD KONCEPCJI DO DOSTAWY",
      title: "Cztery decyzje. Jedna odpowiedzialność.",
      steps: [
        ["01", "Kierunek", "Velmère definiuje sylwetkę, materiał, detal i granice jakości."],
        ["02", "Dopasowanie", "Produkt trafia do regionu z właściwą techniką oraz aktualną dostępnością."],
        ["03", "Kontrola", "Sprawdzamy spójność specyfikacji, zdobienia i prezentacji produktu."],
        ["04", "Realizacja", "Zamówienie otrzymuje możliwie krótką, uzasadnioną trasę do klienta."],
      ],
      disclosure: "Mapa przedstawia regionalną sieć produkcji i realizacji wykorzystywaną przez Velmère. Nie oznacza, że pokazane zakłady są własnością marki. Dostępność zależy od produktu, techniki, kraju dostawy i bieżącej przepustowości.",
    },
    cta: {
      kicker: "VELMÈRE COLLECTION",
      title: "Zobacz, jak standard Atelier przekłada się na produkt.",
      body: "Poznaj aktualne sylwetki, materiały i detale dostępne w kolekcji.",
      action: "Przejdź do sklepu",
      proofs: ["Sylwetka", "Materiał", "Wykończenie"],
    },
  },
  en: {
    map: {
      mapKicker: "ATELIER NETWORK · GLOBAL CRAFT",
      titleLines: ["Designed by", "Velmère.", "Crafted globally."] as const,
      mapBody:
        "12 Atelier network points connect selected sewing, finishing and fulfilment capabilities. Rotate the globe — orders are delivered worldwide.",
      nodeCountLabel: "Atelier points",
      realPositioning: "verified coordinates",
      cta: "Explore the Atelier standard",
      cardsAria: "Velmère Atelier craft standard",
    },
    globe: {
      visualAria: "Interactive Velmère Atelier globe with real regional production and fulfilment locations.",
      controlAria: "Interactive Atelier globe. Drag or tap a node. Arrow keys rotate, Enter selects a node and Escape closes the label.",
      loading: "Loading the Atelier network",
      fallbackTitle: "Atelier network",
      fallbackBody: "WebGL is unavailable in this session. The location list still presents verified geographic coordinates.",
      selectedNode: "Selected fulfilment node",
      dragTap: "Drag · tap a node",
      dragTapKeyboard: "Drag · nodes · arrows · Enter",
      realCoordinates: "Real geographic coordinates",
      surfaceMode: "Satellite surface · day / night mode",
      surfaceModeShort: "Satellite · day / night",
      imageryCredit: "Surface imagery · NASA Earth Observatory",
      nodeTypes: { exact: "PRODUCTION NODE", country: "PARTNER REGION", routing: "ROUTING NODE" },
    },
    cities: {
      losAngeles: "Los Angeles",
      dallas: "Dallas / Coppell",
      charlotte: "Charlotte",
      toronto: "Toronto / Mississauga",
      tijuana: "Tijuana",
      wolverhampton: "Wolverhampton",
      riga: "Riga / Mārupe",
      barcelona: "Barcelona",
      china: "Shenzhen",
      japan: "Tokyo",
      brazil: "São Paulo",
      australia: "Sydney",
    },
    regionNames: {
      northAmerica: "North America",
      europe: "Europe",
      asia: "Asia",
      partner: "Partner regions",
    },
    nodeGroups: {
      northAmerica: {
        title: "Regional production and fulfilment",
        note: "Selected essentials, jersey, embroidery and shorter delivery routes for North America.",
      },
      europe: {
        title: "European finishing and fulfilment",
        note: "Apparel, print, embroidery and regional delivery matched to the product and destination.",
      },
      asia: {
        title: "Expanded construction capabilities",
        note: "A broader cut-and-sew, wash and customisation range with international delivery.",
      },
      partner: {
        title: "Selective partner fulfilment",
        note: "Selected products and local routes open according to availability and order destination.",
      },
    },
    details: [
      { id: "material", icon: "material" as const, eyebrow: "01 · MATERIAL", title: "Weight, hand, durability", hint: "The product base is matched to silhouette, purpose and collection standard." },
      { id: "construction", icon: "construction" as const, eyebrow: "02 · CONSTRUCTION", title: "Form before decoration", hint: "Proportion and wear come first; print, embroidery or detail follow." },
      { id: "finish", icon: "tailor" as const, eyebrow: "03 · FINISHING", title: "Detail under control", hint: "Placement, legibility and finish are reviewed as one visual system." },
      { id: "route", icon: "leaf" as const, eyebrow: "04 · FULFILMENT", title: "The best available route", hint: "A node is selected for product, destination, quality and current availability." },
    ],
    footer: [
      { icon: "shield" as const, label: "12 Atelier points", sublabel: "Sewing and partner nodes" },
      { icon: "diamond" as const, label: "Worldwide delivery", sublabel: "Routing matched to the region" },
      { icon: "badge" as const, label: "Standard control", sublabel: "One Velmère language" },
      { icon: "lock" as const, label: "Private service", sublabel: "Personal and discreet" },
    ],
    manifesto: {
      kicker: "ONE BRAND · MANY SPECIALISMS",
      title: "Velmère designs the system. Each region supplies the right execution.",
      body: "Atelier connects creative direction, product specification and regional fulfilment. Not every technique is available everywhere, so each product receives a route matched to silhouette, decoration, destination and current capacity.",
      metrics: [
        ["12", "studios and nodes"],
        ["4", "core regions"],
        ["Global", "worldwide delivery"],
      ],
    },
    regions: {
      kicker: "REGIONAL AVAILABILITY",
      title: "Production capabilities by direction.",
      body: "This scope describes typical network capabilities. Final availability is always confirmed for the specific product.",
      available: "Selective availability",
      cards: [
        { key: "northAmerica" as const, code: "NA · 05", products: ["T-shirts and fleece", "Direct print", "Embroidery", "Regional fulfilment"] },
        { key: "europe" as const, code: "EU · 03", products: ["Apparel essentials", "Fleece and layers", "Embroidery and print", "Regional finishing"] },
        { key: "asia" as const, code: "AS · 01", products: ["Cut-and-sew", "Wash effects", "Expanded customisation", "International fulfilment"] },
        { key: "partner" as const, code: "PX · 03", products: ["Selected essentials", "Local routing", "Style-dependent availability", "Japan · Brazil · Australia"] },
      ],
    },
    products: {
      kicker: "PRODUCT LANGUAGE",
      title: "Products built from silhouette, not an empty print surface.",
      body: "Every product family has a distinct role in the Velmère wardrobe. We describe what truly shapes perception: weight, construction, surface and finish.",
      items: [
        { title: "Heavyweight jersey", label: "TEE · LONGSLEEVE", body: "Substantial jersey, a calm drape and a surface that carries a strong detail without visual noise." },
        { title: "Structured fleece", label: "HOODIE · SWEAT", body: "Volume, a soft interior and stable form. Designed as a collection layer, not a generic graphic carrier." },
        { title: "Cut & sew studies", label: "CUSTOM FORM", body: "Broader freedom in cut, wash and detail. Opened selectively for the right series and context." },
        { title: "Embroidery & finish", label: "SIGNATURE DETAIL", body: "Embroidery, label placement and finishing build recognition up close without loud branding." },
      ],
    },
    method: {
      kicker: "FROM CONCEPT TO DELIVERY",
      title: "Four decisions. One line of responsibility.",
      steps: [
        ["01", "Direction", "Velmère defines silhouette, material, detail and quality boundaries."],
        ["02", "Matching", "The product is routed to a region with the right technique and current availability."],
        ["03", "Control", "Specification, decoration and product presentation are reviewed for consistency."],
        ["04", "Fulfilment", "The order receives the shortest justified route available to the client."],
      ],
      disclosure: "The map presents the regional production and fulfilment network used by Velmère. It does not mean the displayed facilities are owned by the brand. Availability depends on product, technique, delivery country and current capacity.",
    },
    cta: {
      kicker: "VELMÈRE COLLECTION",
      title: "See how the Atelier standard becomes a product.",
      body: "Explore current silhouettes, materials and details available in the collection.",
      action: "Visit the shop",
      proofs: ["Silhouette", "Material", "Finish"],
    },
  },
  de: {
    map: {
      mapKicker: "ATELIER NETWORK · GLOBALES HANDWERK",
      titleLines: ["Entworfen von", "Velmère.", "Global gefertigt."] as const,
      mapBody:
        "12 Punkte im Atelier-Netzwerk verbinden ausgewählte Näherei-, Veredelungs- und Fulfilment-Kapazitäten. Drehe den Globus — wir liefern weltweit.",
      nodeCountLabel: "Atelier-Punkte",
      realPositioning: "geprüfte Koordinaten",
      cta: "Den Atelier-Standard entdecken",
      cardsAria: "Handwerksstandard des Velmère Atelier",
    },
    globe: {
      visualAria: "Interaktiver Globus des Velmère Atelier mit realen Standorten für regionale Produktion und Auftragsabwicklung.",
      controlAria: "Interaktiver Atelier-Globus. Ziehen oder einen Punkt antippen. Pfeiltasten drehen, Enter wählt einen Punkt und Escape schließt das Etikett.",
      loading: "Atelier-Netzwerk wird geladen",
      fallbackTitle: "Atelier-Netzwerk",
      fallbackBody: "WebGL ist in dieser Sitzung nicht verfügbar. Die Standortliste zeigt weiterhin geprüfte geografische Koordinaten.",
      selectedNode: "Ausgewählter Fertigungsknoten",
      dragTap: "Ziehen · Punkt antippen",
      dragTapKeyboard: "Ziehen · Punkte · Pfeile · Enter",
      realCoordinates: "Reale geografische Koordinaten",
      surfaceMode: "Satellitenoberfläche · Tag-/Nachtmodus",
      surfaceModeShort: "Satellit · Tag / Nacht",
      imageryCredit: "Oberflächenbilder · NASA Earth Observatory",
      nodeTypes: { exact: "PRODUKTIONSKNOTEN", country: "PARTNERREGION", routing: "LOGISTIKKNOTEN" },
    },
    cities: {
      losAngeles: "Los Angeles",
      dallas: "Dallas / Coppell",
      charlotte: "Charlotte",
      toronto: "Toronto / Mississauga",
      tijuana: "Tijuana",
      wolverhampton: "Wolverhampton",
      riga: "Riga / Mārupe",
      barcelona: "Barcelona",
      china: "Shenzhen",
      japan: "Tokio",
      brazil: "São Paulo",
      australia: "Sydney",
    },
    regionNames: {
      northAmerica: "Nordamerika",
      europe: "Europa",
      asia: "Asien",
      partner: "Partnerregionen",
    },
    nodeGroups: {
      northAmerica: {
        title: "Regionale Produktion und Abwicklung",
        note: "Ausgewählte Basics, Jersey, Stickerei und kürzere Lieferwege für Nordamerika.",
      },
      europe: {
        title: "Europäische Veredelung und Abwicklung",
        note: "Bekleidung, Druck, Stickerei und regionale Lieferung passend zu Produkt und Zielort.",
      },
      asia: {
        title: "Erweiterte Konstruktionsmöglichkeiten",
        note: "Ein breiteres Angebot für Cut-and-sew, Waschungen und Individualisierung mit internationaler Lieferung.",
      },
      partner: {
        title: "Selektive Partnerabwicklung",
        note: "Ausgewählte Produkte und lokale Wege werden nach Verfügbarkeit und Bestellziel aktiviert.",
      },
    },
    details: [
      { id: "material", icon: "material" as const, eyebrow: "01 · MATERIAL", title: "Gewicht, Griff, Haltbarkeit", hint: "Die Produktbasis wird auf Silhouette, Zweck und Kollektion abgestimmt." },
      { id: "construction", icon: "construction" as const, eyebrow: "02 · KONSTRUKTION", title: "Form vor Dekoration", hint: "Proportion und Tragegefühl kommen zuerst; Druck, Stickerei oder Detail folgen." },
      { id: "finish", icon: "tailor" as const, eyebrow: "03 · VEREDELUNG", title: "Detail unter Kontrolle", hint: "Platzierung, Lesbarkeit und Ausführung werden als ein System geprüft." },
      { id: "route", icon: "leaf" as const, eyebrow: "04 · ABWICKLUNG", title: "Der beste verfügbare Weg", hint: "Der Knoten wird nach Produkt, Zielort, Qualität und aktueller Verfügbarkeit gewählt." },
    ],
    footer: [
      { icon: "shield" as const, label: "12 Atelier-Punkte", sublabel: "Nähereien und Partnerknoten" },
      { icon: "diamond" as const, label: "Weltweite Lieferung", sublabel: "Route passend zur Region" },
      { icon: "badge" as const, label: "Standardkontrolle", sublabel: "Eine Sprache von Velmère" },
      { icon: "lock" as const, label: "Privater Service", sublabel: "Persönlich und diskret" },
    ],
    manifesto: {
      kicker: "EINE MARKE · VIELE SPEZIALISIERUNGEN",
      title: "Velmère entwirft das System. Die Region liefert die passende Ausführung.",
      body: "Atelier verbindet kreative Richtung, Produktspezifikation und regionale Abwicklung. Nicht jede Technik ist überall verfügbar. Deshalb erhält jedes Produkt einen Weg, der zu Silhouette, Veredelung, Zielort und aktueller Kapazität passt.",
      metrics: [
        ["12", "Ateliers und Knoten"],
        ["4", "Kernregionen"],
        ["Global", "weltweite Lieferung"],
      ],
    },
    regions: {
      kicker: "REGIONALE VERFÜGBARKEIT",
      title: "Produktionsmöglichkeiten nach Region.",
      body: "Der Umfang beschreibt typische Möglichkeiten des Netzwerks. Die endgültige Verfügbarkeit wird immer für das konkrete Produkt bestätigt.",
      available: "Selektive Verfügbarkeit",
      cards: [
        { key: "northAmerica" as const, code: "NA · 05", products: ["T-Shirts und Fleece", "Direktdruck", "Stickerei", "Regionale Abwicklung"] },
        { key: "europe" as const, code: "EU · 03", products: ["Bekleidungs-Basics", "Fleece und Layer", "Stickerei und Druck", "Regionale Veredelung"] },
        { key: "asia" as const, code: "AS · 01", products: ["Cut-and-sew", "Wascheffekte", "Erweiterte Individualisierung", "Internationale Abwicklung"] },
        { key: "partner" as const, code: "PX · 03", products: ["Ausgewählte Essentials", "Lokale Weiterleitung", "Modellabhängige Verfügbarkeit", "Japan · Brasilien · Australien"] },
      ],
    },
    products: {
      kicker: "PRODUCT LANGUAGE",
      title: "Produkte aus der Silhouette heraus entwickelt, nicht aus einer leeren Druckfläche.",
      body: "Jede Produktfamilie hat eine eigene Rolle in der Garderobe von Velmère. Wir beschreiben, was die Wahrnehmung wirklich prägt: Gewicht, Konstruktion, Oberfläche und Veredelung.",
      items: [
        { title: "Heavyweight Jersey", label: "TEE · LONGSLEEVE", body: "Substanzieller Jersey, ruhiger Fall und eine Oberfläche, die starke Details ohne visuelle Unruhe trägt." },
        { title: "Structured Fleece", label: "HOODIE · SWEAT", body: "Volumen, weiche Innenseite und stabile Form. Als Teil der Kollektion entworfen, nicht als beliebiger Grafikträger." },
        { title: "Cut & Sew Studies", label: "CUSTOM FORM", body: "Mehr Freiheit bei Schnitt, Waschung und Detail. Selektiv für die passende Serie geöffnet." },
        { title: "Embroidery & Finish", label: "SIGNATURE DETAIL", body: "Stickerei, Etikettenposition und Veredelung schaffen Wiedererkennung aus der Nähe, ohne lautes Branding." },
      ],
    },
    method: {
      kicker: "VOM KONZEPT ZUR LIEFERUNG",
      title: "Vier Entscheidungen. Eine Verantwortung.",
      steps: [
        ["01", "Richtung", "Velmère definiert Silhouette, Material, Detail und Qualitätsgrenzen."],
        ["02", "Zuordnung", "Das Produkt geht an eine Region mit passender Technik und aktueller Verfügbarkeit."],
        ["03", "Kontrolle", "Spezifikation, Veredelung und Produktdarstellung werden auf Konsistenz geprüft."],
        ["04", "Abwicklung", "Die Bestellung erhält den kürzesten sinnvoll verfügbaren Weg zum Kunden."],
      ],
      disclosure: "Die Karte zeigt das von Velmère genutzte regionale Produktions- und Abwicklungsnetzwerk. Sie bedeutet nicht, dass die dargestellten Betriebe der Marke gehören. Die Verfügbarkeit hängt von Produkt, Technik, Lieferland und aktueller Kapazität ab.",
    },
    cta: {
      kicker: "VELMÈRE COLLECTION",
      title: "Erlebe, wie der Atelier-Standard zum Produkt wird.",
      body: "Entdecke aktuelle Silhouetten, Materialien und Details der Kollektion.",
      action: "Zum Shop",
      proofs: ["Silhouette", "Material", "Veredelung"],
    },
  },
} as const;

const REGION_ICONS = [Globe2, Layers3, Scissors, Waypoints] as const;
const PRODUCT_ICONS = [Shirt, Layers3, Scissors, Sparkles] as const;

export default function AtelierPage({ locale }: { locale: Locale }) {
  const c = COPY[locale];
  const facilities: AtelierFacility[] = FACILITY_SEEDS.map((facility) => ({
    id: facility.id,
    city: c.cities[facility.cityKey],
    region: c.regionNames[facility.regionKey],
    title: c.nodeGroups[facility.regionKey].title,
    note: c.nodeGroups[facility.regionKey].note,
    lat: facility.lat,
    lon: facility.lon,
    precision: facility.precision,
  }));

  return (
    <main
      className="min-h-[100dvh] overflow-x-clip bg-[#020303] pt-[68px] text-white md:pt-20"
      data-atelier-page="regional-craft-network"
    >
      <AtelierNetworkMap
        facilities={facilities}
        copy={c.map}
        globeCopy={c.globe}
        detailSlots={c.details}
        footerItems={c.footer}
      />

      <section className="relative overflow-hidden bg-[#ece8df] px-5 py-16 text-[#171713] md:px-9 md:py-28 xl:px-12">
        <div className="pointer-events-none absolute inset-0 opacity-[0.24]" style={{ backgroundImage: "radial-gradient(circle at center, rgba(18,18,14,.12) 0.65px, transparent 0.75px)", backgroundSize: "9px 9px" }} />
        <div className="relative mx-auto grid max-w-[108rem] gap-14 lg:grid-cols-[minmax(0,1.12fr)_minmax(25rem,.88fr)] lg:items-end">
          <Reveal>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.26em] text-[#866b35]">{c.manifesto.kicker}</p>
            <h2 className="mt-6 max-w-[58rem] font-serif text-[clamp(2.6rem,5.4vw,6.2rem)] leading-[0.93] tracking-[-0.055em] text-[#12120f]">
              {c.manifesto.title}
            </h2>
          </Reveal>
          <Reveal delay={0.08} className="lg:pb-2">
            <p className="max-w-2xl text-sm leading-7 text-[#171713]/[0.66] md:text-base md:leading-8">{c.manifesto.body}</p>
            <div className="mt-8 grid grid-cols-3 border-y border-[#171713]/[0.14]">
              {c.manifesto.metrics.map(([value, label]) => (
                <div key={label} className="border-r border-[#171713]/[0.12] px-3 py-5 last:border-r-0 sm:px-5">
                  <strong className="block font-serif text-3xl font-normal tracking-[-0.05em] sm:text-4xl">{value}</strong>
                  <span className="mt-2 block font-mono text-[9px] uppercase leading-4 tracking-[0.14em] text-[#171713]/[0.52] sm:text-[9.5px]">{label}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="relative bg-[#060707] px-5 py-16 md:px-9 md:py-24 xl:px-12">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-velmere-gold/[0.30] to-transparent" />
        <div className="mx-auto max-w-[108rem]">
          <Reveal className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.26em] text-velmere-gold">{c.regions.kicker}</p>
              <h2 className="mt-5 max-w-4xl font-serif text-[clamp(2.5rem,5vw,5.4rem)] leading-[0.95] tracking-[-0.052em]">{c.regions.title}</h2>
            </div>
            <p className="max-w-xl text-sm leading-7 text-white/[0.52] md:text-base">{c.regions.body}</p>
          </Reveal>

          <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {c.regions.cards.map((region, index) => {
              const Icon = REGION_ICONS[index];
              return (
                <Reveal key={region.key} as="article" delay={index * 0.055} className="group relative min-h-[19rem] overflow-hidden border border-white/[0.085] bg-white/[0.022] p-5 transition duration-500 motion-safe:hover:-translate-y-1 hover:border-velmere-gold/[0.34] hover:bg-white/[0.038] md:min-h-[24rem] md:p-6">
                  <div className="pointer-events-none absolute -right-14 -top-14 h-40 w-40 rounded-full border border-velmere-gold/[0.12] transition duration-700 group-hover:scale-125 group-hover:border-velmere-gold/[0.22]" />
                  <div className="flex items-start justify-between gap-4">
                    <span className="grid h-12 w-12 place-items-center rounded-full border border-velmere-gold/[0.22] bg-velmere-gold/[0.055] text-velmere-gold">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/[0.32]">{region.code}</span>
                  </div>
                  <h3 className="mt-8 font-serif text-3xl tracking-[-0.045em] md:mt-10">{c.regionNames[region.key]}</h3>
                  <p className="mt-3 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.16em] text-emerald-200/[0.68]">
                    <CircleDot className="h-3.5 w-3.5" aria-hidden="true" />
                    {c.regions.available}
                  </p>
                  <ul className="mt-6 grid gap-3 md:mt-8">
                    {region.products.map((product) => (
                      <li key={product} className="flex items-start gap-3 border-t border-white/[0.065] pt-3 text-xs leading-5 text-white/[0.50]">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-velmere-gold/[0.80]" aria-hidden="true" />
                        {product}
                      </li>
                    ))}
                  </ul>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-[#f0ede6] px-5 py-16 text-[#171713] md:px-9 md:py-28 xl:px-12">
        <div className="mx-auto max-w-[108rem]">
          <Reveal className="grid gap-7 lg:grid-cols-[minmax(0,1.05fr)_minmax(20rem,.65fr)] lg:items-end">
            <div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.26em] text-[#866b35]">{c.products.kicker}</p>
              <h2 className="mt-5 max-w-5xl font-serif text-[clamp(2.6rem,5.3vw,5.8rem)] leading-[0.94] tracking-[-0.055em]">{c.products.title}</h2>
            </div>
            <p className="text-sm leading-7 text-[#171713]/[0.60] md:text-base md:leading-8">{c.products.body}</p>
          </Reveal>

          <div className="mt-12 grid gap-4 md:grid-cols-2">
            {c.products.items.map((product, index) => {
              const Icon = PRODUCT_ICONS[index];
              const patternClass =
                index === 0
                  ? "bg-[repeating-linear-gradient(135deg,rgba(255,255,255,.045)_0_1px,transparent_1px_7px),linear-gradient(145deg,#171713,#090a09)]"
                  : index === 1
                    ? "bg-[radial-gradient(circle_at_25%_20%,rgba(205,173,103,.18),transparent_30%),linear-gradient(145deg,#171713,#080908)]"
                    : index === 2
                      ? "bg-[linear-gradient(55deg,transparent_42%,rgba(205,173,103,.13)_43%_44%,transparent_45%),linear-gradient(145deg,#151613,#080908)]"
                      : "bg-[radial-gradient(circle_at_center,rgba(205,173,103,.12)_0_1px,transparent_1.5px),linear-gradient(145deg,#171713,#080908)] bg-[length:18px_18px,auto]";
              return (
                <Reveal key={product.title} as="article" delay={index * 0.06} className="group grid min-h-[20rem] grid-cols-[7.5rem_minmax(0,1fr)] overflow-hidden border border-[#171713]/[0.12] bg-[#e7e2d8] sm:min-h-[25rem] sm:grid-cols-[minmax(12rem,.75fr)_minmax(0,1.25fr)]">
                  <div className={`relative min-h-[20rem] overflow-hidden sm:min-h-[15rem] ${patternClass}`}>
                    <div className="absolute inset-5 border border-white/[0.08]" />
                    <div className="absolute inset-0 grid place-items-center">
                      <span className="grid h-16 w-16 place-items-center rounded-full border border-velmere-gold/[0.24] bg-black/[0.16] text-velmere-gold transition duration-700 group-hover:rotate-6 group-hover:scale-105 sm:h-24 sm:w-24">
                        <Icon className="h-7 w-7 stroke-[1.15] sm:h-9 sm:w-9" aria-hidden="true" />
                      </span>
                    </div>
                    <span className="absolute bottom-5 left-5 font-mono text-[8.5px] uppercase tracking-[0.20em] text-white/[0.42]">VELMÈRE · 0{index + 1}</span>
                  </div>
                  <div className="flex flex-col justify-between p-5 sm:p-8">
                    <div>
                      <p className="font-mono text-[9px] uppercase tracking-[0.20em] text-[#866b35]">{product.label}</p>
                      <h3 className="mt-5 font-serif text-[2.05rem] leading-[0.98] tracking-[-0.05em] sm:mt-6 sm:text-5xl">{product.title}</h3>
                      <p className="mt-5 max-w-xl text-xs leading-6 text-[#171713]/[0.62] sm:mt-6 sm:text-sm sm:leading-7">{product.body}</p>
                    </div>
                    <span className="mt-8 block h-px w-16 bg-[#866b35]/[0.60] transition-all duration-500 group-hover:w-28" />
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* Luxury Garments & Silhouette Showcase (Migrated from Home per zadanie.txt Pass 02) */}
      <section className="border-t border-white/[0.08] bg-[#070709] px-5 py-12 md:px-9 md:py-20 xl:px-12">
        <div className="mx-auto max-w-[108rem]">
          <LuxuryProductCarousel />
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#030404] px-5 py-16 md:px-9 md:py-28 xl:px-12">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[32rem] w-[64rem] -translate-x-1/2 rounded-full bg-velmere-gold/[0.055] blur-[140px]" />
        <div className="relative mx-auto max-w-[108rem]">
          <Reveal className="grid gap-10 lg:grid-cols-[minmax(20rem,.7fr)_minmax(0,1.3fr)]">
            <div className="lg:sticky lg:top-32 lg:self-start">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.26em] text-velmere-gold">{c.method.kicker}</p>
              <h2 className="mt-6 font-serif text-[clamp(2.8rem,5vw,5.5rem)] leading-[0.94] tracking-[-0.052em]">{c.method.title}</h2>
            </div>
            <div className="grid">
              {c.method.steps.map(([number, title, body]) => (
                <article key={number} className="group grid gap-4 border-t border-white/[0.09] py-7 sm:grid-cols-[4rem_11rem_1fr] sm:items-start">
                  <span className="font-mono text-xs text-velmere-gold">{number}</span>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.10em] text-white/[0.88]">{title}</h3>
                  <p className="max-w-2xl text-sm leading-7 text-white/[0.50]">{body}</p>
                </article>
              ))}
              <p className="mt-5 border-l border-velmere-gold/[0.42] bg-velmere-gold/[0.035] px-5 py-4 text-xs leading-6 text-white/[0.48]">
                {c.method.disclosure}
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.08} className="atelier-v4703-final mt-14 md:mt-20" data-atelier-final="signature">
            <div className="atelier-v4703-final-copy">
              <p>{c.cta.kicker}</p>
              <h2>{c.cta.title}</h2>
              <span>{c.cta.body}</span>
              <div className="atelier-v4703-proofline">
                {c.cta.proofs.map((proof, index) => (
                  <small key={proof}><b>0{index + 1}</b>{proof}</small>
                ))}
              </div>
            </div>

            <div className="atelier-v4703-final-action">
              <div className="atelier-v4703-seal" aria-hidden="true">
                <span>VLM / ATELIER</span>
                <strong>A</strong>
                <small>EST. EUROPE · 01—04</small>
              </div>
              <a href={`/${locale}/shop`}>
                {c.cta.action}
                <ArrowUpRight aria-hidden="true" />
              </a>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
