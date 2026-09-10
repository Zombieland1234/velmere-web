import type { Product } from "./types";

export const PRODUCTS: Product[] = [
  {
    id: "1",
    slug: "velmere-frost-zip-hoodie",
    provider: "manual",
    status: "coming_soon",
    fulfilmentMode: "disabled",
    title: {
      pl: "Bluza Frost Zip Hoodie",
      en: "Frost Zip Hoodie",
      de: "Frost Zip Hoodie",
    },
    shortDescription: {
      pl: "Szara bluza z kapturem i spokojnym brandingiem Velmère.",
      en: "A grey zip hoodie with quiet Velmère branding.",
      de: "Ein grauer Zip-Hoodie mit ruhigem Velmère Branding.",
    },
    description: {
      pl: "Bluza Velmère w jasnoszarej palecie, z zamkiem, kapturem i pudełkową sylwetką. Produkt jest tymczasowym podglądem pierwszego dropu; finalny skład, tabela wymiarów, produkcja i fulfillment zostaną potwierdzone przed sprzedażą.",
      en: "A Velmère hoodie in a light grey palette, with a zip front, hood, and boxy silhouette. This is a temporary first-drop preview; final composition, measurements, production, and fulfilment will be confirmed before sales.",
      de: "Ein Velmère Hoodie in hellgrauer Palette, mit Reißverschluss, Kapuze und kastiger Silhouette. Dies ist eine temporäre Vorschau des ersten Drops; finale Zusammensetzung, Maße, Produktion und Fulfilment werden vor dem Verkauf bestätigt.",
    },
    truth: {
      material: {
        pl: "Dzianina heavyweight fleece",
        en: "Heavyweight fleece knit",
        de: "Heavyweight Fleece-Strick",
      },
      composition: {
        pl: "Planowane: 80% bawełna / 20% poliester. Finalny skład zostanie potwierdzony przed sprzedażą.",
        en: "Planned: 80% cotton / 20% polyester. Final composition will be confirmed before sale.",
        de: "Geplant: 80% Baumwolle / 20% Polyester. Finale Zusammensetzung wird vor Verkauf bestätigt.",
      },
      weight: "450 GSM target",
      fit: {
        pl: "Boxy / lekko oversize. Krótszy korpus, szersza linia ramion.",
        en: "Boxy / slightly oversized. Shorter body, wider shoulder line.",
        de: "Boxy / leicht oversized. Kürzerer Körper, breitere Schulterlinie.",
      },
      care: [
        {
          pl: "Prać na lewej stronie w zimnej wodzie.",
          en: "Wash cold and inside out.",
          de: "Kalt und auf links waschen.",
        },
        {
          pl: "Nie suszyć w suszarce bębnowej; suszyć na powietrzu.",
          en: "Do not tumble dry; air dry.",
          de: "Nicht im Trockner trocknen; lufttrocknen.",
        },
      ],
      sizeGuide: {
        note: {
          pl: "Tabela mierzy produkt na płasko. Porównaj z bluzą, którą już nosisz.",
          en: "The table measures the garment flat. Compare it with a hoodie you already wear.",
          de: "Die Tabelle misst das Kleidungsstück flach. Vergleiche mit einem Hoodie, den du bereits trägst.",
        },
        measurements: [
          { size: "S", chest: "112 cm", length: "66 cm", shoulders: "58 cm" },
          { size: "M", chest: "118 cm", length: "68 cm", shoulders: "60 cm" },
          { size: "L", chest: "124 cm", length: "70 cm", shoulders: "62 cm" },
          { size: "XL", chest: "130 cm", length: "72 cm", shoulders: "64 cm" },
        ],
      },
      deliveryNote: {
        pl: "Preview: produkcja i fulfillment nie są jeszcze aktywne. Estymacja dostawy pojawi się przed checkoutem.",
        en: "Preview: production and fulfilment are not active yet. Delivery estimate will be shown before checkout.",
        de: "Preview: Produktion und Fulfilment sind noch nicht aktiv. Lieferzeit wird vor Checkout angezeigt.",
      },
      returnNote: {
        pl: "Prawo odstąpienia i instrukcja zwrotu muszą być widoczne przed płatnością.",
        en: "Withdrawal right and return instructions must be visible before payment.",
        de: "Widerrufsrecht und Rückgabehinweise müssen vor Zahlung sichtbar sein.",
      },
      launchNote: {
        pl: "Nie uruchamiać sprzedaży bez finalnego składu, size chart QA i provider mapping.",
        en: "Do not launch sale without final composition, size-chart QA and provider mapping.",
        de: "Kein Verkaufsstart ohne finale Zusammensetzung, Size-Chart-QA und Provider Mapping.",
      },
    },
    price: {
      amount: 24000,
      currency: "EUR",
    },
    images: [
      {
        url: "/products/velmere-preview/1.webp",
        alt: {
          pl: "Szara bluza z kapturem Velmère — podgląd pierwszego dropu",
          en: "Grey Velmère zip hoodie — first drop preview",
          de: "Grauer Velmère Zip-Hoodie — Vorschau des ersten Drops",
        },
        width: 1024,
        height: 1024,
      },
    ],
    variants: ["S", "M", "L", "XL"].map((size) => ({
      id: `velmere-frost-zip-hoodie-${size.toLowerCase()}`,
      title: size,
      size,
      price: {
        amount: 24000,
        currency: "EUR",
      },
      available: false,
    })),
    tags: ["hoodie", "zip", "new-drop", "coming-soon"],
    collection: "new-drop",
  },
  {
    id: "2",
    slug: "velmere-contrast-varsity-jacket",
    provider: "manual",
    status: "coming_soon",
    fulfilmentMode: "disabled",
    title: {
      pl: "Kurtka Contrast Varsity",
      en: "Contrast Varsity Jacket",
      de: "Contrast Varsity Jacket",
    },
    shortDescription: {
      pl: "Czarno-kremowa kurtka varsity z metalicznym znakiem Velmère.",
      en: "A black and cream varsity jacket with a metallic Velmère mark.",
      de: "Eine schwarz-cremefarbene Varsity-Jacke mit metallischem Velmère Zeichen.",
    },
    description: {
      pl: "Kurtka Velmère z kontrastowymi rękawami, prążkowanymi wykończeniami i spokojnym znakiem na piersi. Produkt pozostaje w trybie preview do czasu potwierdzenia finalnych wariantów, ceny i fulfillmentu.",
      en: "A Velmère jacket with contrast sleeves, ribbed trims, and a quiet chest mark. The product remains in preview mode until final variants, pricing, and fulfilment are confirmed.",
      de: "Eine Velmère Jacke mit kontrastierenden Ärmeln, gerippten Abschlüssen und ruhigem Brustzeichen. Das Produkt bleibt im Preview-Modus, bis finale Varianten, Preise und Fulfilment bestätigt sind.",
    },
    truth: {
      material: {
        pl: "Wełniany look / rękawy faux leather",
        en: "Wool-look body / faux-leather sleeves",
        de: "Wolloptik Body / Faux-Leder Ärmel",
      },
      composition: {
        pl: "Planowane: mieszanka poliestru z wykończeniem faux leather. Finalny skład zostanie potwierdzony przed sprzedażą.",
        en: "Planned: polyester blend with faux-leather finish. Final composition will be confirmed before sale.",
        de: "Geplant: Polyester-Mix mit Faux-Leder-Finish. Finale Zusammensetzung wird vor Verkauf bestätigt.",
      },
      weight: "Mid-heavy outerwear",
      fit: {
        pl: "Regular / lekko boxy. Zaprojektowana do warstwowania na hoodie.",
        en: "Regular / slightly boxy. Designed for layering over a hoodie.",
        de: "Regular / leicht boxy. Für Layering über einem Hoodie gedacht.",
      },
      care: [
        {
          pl: "Czyścić punktowo wilgotną szmatką; nie wybielać.",
          en: "Spot clean with a damp cloth; do not bleach.",
          de: "Punktuell mit feuchtem Tuch reinigen; nicht bleichen.",
        },
        {
          pl: "Finalne instrukcje care zależą od potwierdzonego składu.",
          en: "Final care instructions depend on confirmed composition.",
          de: "Finale Pflegehinweise hängen von bestätigter Zusammensetzung ab.",
        },
      ],
      sizeGuide: {
        note: {
          pl: "Tabela mierzy kurtkę. Zostaw miejsce na hoodie pod spodem.",
          en: "The table measures the jacket. Leave room for a hoodie underneath.",
          de: "Die Tabelle misst die Jacke. Platz für Hoodie darunter einplanen.",
        },
        measurements: [
          { size: "S", chest: "116 cm", length: "64 cm", shoulders: "54 cm" },
          { size: "M", chest: "122 cm", length: "66 cm", shoulders: "56 cm" },
          { size: "L", chest: "128 cm", length: "68 cm", shoulders: "58 cm" },
          { size: "XL", chest: "134 cm", length: "70 cm", shoulders: "60 cm" },
        ],
      },
      deliveryNote: {
        pl: "Preview: finalny provider kurtki nie jest potwierdzony. Nie aktywować checkoutu przed QA.",
        en: "Preview: final jacket provider is not confirmed. Do not enable checkout before QA.",
        de: "Preview: finaler Jacken-Provider ist nicht bestätigt. Checkout nicht vor QA aktivieren.",
      },
      returnNote: {
        pl: "Zwrot wymaga nieużywanego produktu i oryginalnego stanu zgodnie z polityką zwrotów.",
        en: "Return requires unused item in original condition according to the return policy.",
        de: "Rückgabe erfordert unbenutzten Artikel im Originalzustand gemäß Rückgabepolitik.",
      },
      launchNote: {
        pl: "Potwierdzić skład, care, warianty i koszty dostawy przed publicznym dropem.",
        en: "Confirm composition, care, variants and delivery costs before public drop.",
        de: "Zusammensetzung, Pflege, Varianten und Versandkosten vor Public Drop bestätigen.",
      },
    },
    price: {
      amount: 35000,
      currency: "EUR",
    },
    images: [
      {
        url: "/products/velmere-preview/2.webp",
        alt: {
          pl: "Kurtka varsity Velmère — podgląd pierwszego dropu",
          en: "Velmère varsity jacket — first drop preview",
          de: "Velmère Varsity-Jacke — Vorschau des ersten Drops",
        },
        width: 1024,
        height: 1024,
      },
    ],
    variants: ["S", "M", "L", "XL"].map((size) => ({
      id: `velmere-contrast-varsity-jacket-${size.toLowerCase()}`,
      title: size,
      size,
      price: {
        amount: 35000,
        currency: "EUR",
      },
      available: false,
    })),
    tags: ["jacket", "varsity", "new-drop", "coming-soon"],
    collection: "new-drop",
  },
  {
    id: "3",
    slug: "velmere-black-track-pants",
    provider: "manual",
    status: "coming_soon",
    fulfilmentMode: "disabled",
    title: {
      pl: "Spodnie Black Track",
      en: "Black Track Pants",
      de: "Black Track Pants",
    },
    shortDescription: {
      pl: "Czarne spodnie o czystej linii, kontrastowym pasie i prostym ciężarze.",
      en: "Black pants with a clean line, contrast stripe, and straight weight.",
      de: "Schwarze Hose mit klarer Linie, Kontraststreifen und ruhigem Gewicht.",
    },
    description: {
      pl: "Spodnie Velmère z elastycznym pasem, jasnymi liniami bocznymi i minimalistycznym brandingiem. Produkt pozostaje jako podgląd pierwszego dropu do czasu podpięcia produkcji, stanów i wysyłki.",
      en: "Velmère pants with an elastic waist, light side lines, and minimal branding. The product remains a first-drop preview until production, stock, and shipping are connected.",
      de: "Velmère Hose mit elastischem Bund, hellen Seitenlinien und minimalem Branding. Das Produkt bleibt eine Vorschau des ersten Drops, bis Produktion, Bestand und Versand verbunden sind.",
    },
    truth: {
      material: {
        pl: "Dzianina compact track",
        en: "Compact track knit",
        de: "Compact Track-Strick",
      },
      composition: {
        pl: "Planowane: mieszanka bawełny i poliestru z elastycznym pasem. Finalny skład zostanie potwierdzony przed sprzedażą.",
        en: "Planned: cotton/poly blend with elastic waistband. Final composition will be confirmed before sale.",
        de: "Geplant: Baumwoll/Poly-Mix mit elastischem Bund. Finale Zusammensetzung wird vor Verkauf bestätigt.",
      },
      weight: "320 GSM target",
      fit: {
        pl: "Straight / relaxed. Elastyczny pas, prosta nogawka.",
        en: "Straight / relaxed. Elastic waist, straight leg.",
        de: "Straight / relaxed. Elastischer Bund, gerades Bein.",
      },
      care: [
        {
          pl: "Prać na zimno z podobnymi kolorami.",
          en: "Wash cold with similar colours.",
          de: "Kalt mit ähnlichen Farben waschen.",
        },
        {
          pl: "Nie prasować bezpośrednio po nadruku lub znaku.",
          en: "Do not iron directly over print or mark.",
          de: "Nicht direkt über Print oder Markierung bügeln.",
        },
      ],
      sizeGuide: {
        note: {
          pl: "Tabela mierzy spodnie na płasko. Pas jest elastyczny.",
          en: "The table measures the pants flat. Waistband is elastic.",
          de: "Die Tabelle misst die Hose flach. Bund ist elastisch.",
        },
        measurements: [
          { size: "S", waist: "72–82 cm", length: "102 cm", inseam: "74 cm" },
          { size: "M", waist: "78–88 cm", length: "104 cm", inseam: "76 cm" },
          { size: "L", waist: "84–94 cm", length: "106 cm", inseam: "78 cm" },
          { size: "XL", waist: "90–100 cm", length: "108 cm", inseam: "80 cm" },
        ],
      },
      deliveryNote: {
        pl: "Preview: produkcja, stany i wysyłka nie są jeszcze aktywne.",
        en: "Preview: production, inventory and shipping are not active yet.",
        de: "Preview: Produktion, Bestand und Versand sind noch nicht aktiv.",
      },
      returnNote: {
        pl: "Zwrot według polityki zwrotów; stan produktu musi pozwalać na ponowną kontrolę jakości.",
        en: "Return according to return policy; product condition must allow quality review.",
        de: "Rückgabe gemäß Rückgabepolitik; Zustand muss Qualitätsprüfung erlauben.",
      },
      launchNote: {
        pl: "Nie uruchamiać bez finalnej tabeli pasa/nogawki i provider mapping.",
        en: "Do not launch without final waist/inseam table and provider mapping.",
        de: "Kein Launch ohne finale Bund/Innenbein-Tabelle und Provider Mapping.",
      },
    },
    price: {
      amount: 18000,
      currency: "EUR",
    },
    images: [
      {
        url: "/products/velmere-preview/3.webp",
        alt: {
          pl: "Czarne spodnie Velmère — podgląd pierwszego dropu",
          en: "Black Velmère pants — first drop preview",
          de: "Schwarze Velmère Hose — Vorschau des ersten Drops",
        },
        width: 1024,
        height: 1024,
      },
    ],
    variants: ["S", "M", "L", "XL"].map((size) => ({
      id: `velmere-black-track-pants-${size.toLowerCase()}`,
      title: size,
      size,
      price: {
        amount: 18000,
        currency: "EUR",
      },
      available: false,
    })),
    tags: ["pants", "track", "new-drop", "coming-soon"],
    collection: "new-drop",
  },
  {
    id: "4",
    slug: "velmere-ivory-collar-tee",
    provider: "manual",
    status: "coming_soon",
    fulfilmentMode: "disabled",
    title: {
      pl: "Koszulka Ivory Collar",
      en: "Ivory Collar Tee",
      de: "Ivory Collar Tee",
    },
    shortDescription: {
      pl: "Kremowa koszulka z kołnierzem i kontrastowym wykończeniem Velmère.",
      en: "An ivory collared tee with contrast Velmère detailing.",
      de: "Ein elfenbeinfarbenes Shirt mit Kragen und kontrastierenden Velmère Details.",
    },
    description: {
      pl: "Koszulka Velmère w jasnej palecie z prążkowanym kołnierzem, kontrastowymi liniami i centralnym podpisem marki. Produkt jest tymczasowym preview, bez aktywnego checkoutu do czasu finalnej produkcji.",
      en: "A Velmère tee in an ivory palette with a ribbed collar, contrast lines, and a centered brand signature. This is a temporary preview without active checkout until final production is ready.",
      de: "Ein Velmère Shirt in elfenbeinfarbener Palette mit geripptem Kragen, Kontrastlinien und zentraler Markensignatur. Dies ist eine temporäre Vorschau ohne aktiven Checkout bis zur finalen Produktion.",
    },
    truth: {
      material: {
        pl: "Bawełniana pika / collar jersey",
        en: "Cotton pique / collar jersey",
        de: "Baumwoll-Piqué / Collar Jersey",
      },
      composition: {
        pl: "Planowane: 100% bawełna lub mieszanka bawełny premium. Finalny skład zostanie potwierdzony przed sprzedażą.",
        en: "Planned: 100% cotton or premium cotton blend. Final composition will be confirmed before sale.",
        de: "Geplant: 100% Baumwolle oder Premium-Baumwollmix. Finale Zusammensetzung wird vor Verkauf bestätigt.",
      },
      weight: "240 GSM target",
      fit: {
        pl: "Regular / lekko boxy. Krótszy rękaw i czysta linia kołnierza.",
        en: "Regular / slightly boxy. Shorter sleeve and clean collar line.",
        de: "Regular / leicht boxy. Kürzerer Ärmel und klare Kragenlinie.",
      },
      care: [
        {
          pl: "Prać na lewej stronie w niskiej temperaturze.",
          en: "Wash inside out at low temperature.",
          de: "Auf links bei niedriger Temperatur waschen.",
        },
        {
          pl: "Suszyć na płasko lub na wieszaku, bez wysokiej temperatury.",
          en: "Dry flat or on hanger, without high heat.",
          de: "Flach oder auf Bügel trocknen, ohne hohe Hitze.",
        },
      ],
      sizeGuide: {
        note: {
          pl: "Tabela mierzy koszulkę. Dla luźniejszego efektu wybierz większy rozmiar.",
          en: "The table measures the shirt. Choose one size up for a looser effect.",
          de: "Die Tabelle misst das Shirt. Für lockereren Effekt eine Größe größer wählen.",
        },
        measurements: [
          { size: "S", chest: "104 cm", length: "66 cm", shoulders: "50 cm" },
          { size: "M", chest: "110 cm", length: "68 cm", shoulders: "52 cm" },
          { size: "L", chest: "116 cm", length: "70 cm", shoulders: "54 cm" },
          { size: "XL", chest: "122 cm", length: "72 cm", shoulders: "56 cm" },
        ],
      },
      deliveryNote: {
        pl: "Preview: checkout zostaje zamknięty do czasu finalnej produkcji.",
        en: "Preview: checkout stays closed until final production is ready.",
        de: "Preview: Checkout bleibt geschlossen, bis finale Produktion bereit ist.",
      },
      returnNote: {
        pl: "Zwroty zgodnie z polityką zwrotów i prawem odstąpienia.",
        en: "Returns follow the return policy and withdrawal right.",
        de: "Rückgaben gemäß Rückgabepolitik und Widerrufsrecht.",
      },
      launchNote: {
        pl: "Potwierdzić gramaturę, kołnierz, shrinkage test i care przed dropem.",
        en: "Confirm weight, collar, shrinkage test and care before drop.",
        de: "Gewicht, Kragen, Shrinkage Test und Pflege vor Drop bestätigen.",
      },
    },
    price: {
      amount: 12000,
      currency: "EUR",
    },
    images: [
      {
        url: "/products/velmere-preview/4.webp",
        alt: {
          pl: "Kremowa koszulka z kołnierzem Velmère — podgląd pierwszego dropu",
          en: "Ivory Velmère collared tee — first drop preview",
          de: "Elfenbeinfarbenes Velmère Shirt mit Kragen — Vorschau des ersten Drops",
        },
        width: 1024,
        height: 1024,
      },
    ],
    variants: ["S", "M", "L", "XL"].map((size) => ({
      id: `velmere-ivory-collar-tee-${size.toLowerCase()}`,
      title: size,
      size,
      price: {
        amount: 12000,
        currency: "EUR",
      },
      available: false,
    })),
    tags: ["tee", "collar", "new-drop", "coming-soon"],
    collection: "new-drop",
  },
];
