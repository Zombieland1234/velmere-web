export type Pass584Locale = "pl" | "de" | "en";

export type Pass584PdfAccessibility = {
  version: "pdf-accessibility";
  state: "reader_ready_pdf_limited";
  documentLanguage: string;
  headingOrder: ["h1", "h2", "h2", "h2", "h2"];
  keyboard: {
    previousPage: "ArrowLeft";
    nextPage: "ArrowRight";
    firstPage: "Home";
    lastPage: "End";
    close: "Escape";
  };
  reader: {
    selectableText: true;
    visibleFocus: true;
    landmarkNavigation: true;
    reducedMotionSafe: true;
  };
  pdf: {
    selectableText: true;
    titleMetadata: true;
    languageMetadata: true;
    taggedStructure: false;
  };
  boundary: string;
};

const languages: Record<Pass584Locale, string> = {
  pl: "pl-PL",
  de: "de-DE",
  en: "en-US",
};

export function buildPass584PdfAccessibility(
  locale: Pass584Locale,
): Pass584PdfAccessibility {
  return {
    version: "pdf-accessibility",
    state: "reader_ready_pdf_limited",
    documentLanguage: languages[locale],
    headingOrder: ["h1", "h2", "h2", "h2", "h2"],
    keyboard: {
      previousPage: "ArrowLeft",
      nextPage: "ArrowRight",
      firstPage: "Home",
      lastPage: "End",
      close: "Escape",
    },
    reader: {
      selectableText: true,
      visibleFocus: true,
      landmarkNavigation: true,
      reducedMotionSafe: true,
    },
    pdf: {
      selectableText: true,
      titleMetadata: true,
      languageMetadata: true,
      taggedStructure: false,
    },
    boundary:
      "The browser Reader has semantic headings and keyboard navigation. The generated PDF has selectable text and language/title metadata, but is not claimed as a fully tagged PDF.",
  };
}
