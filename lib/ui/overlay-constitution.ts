export const PASS628_OVERLAY_VERSION = "pass755-unified-overlay-constitution" as const;

/**
 * Finite product-wide stacking order. Every blocking surface is portalled to
 * document.body and receives a separate backdrop and content layer. Components
 * must not invent unbounded z-index values.
 */
export const VELMERE_OVERLAY_LAYERS = Object.freeze({
  content: 0,
  raised: 10,
  sticky: 20,
  header: 30,
  listbox: 120,
  floatingAction: 125,
  drawerBackdrop: 130,
  drawer: 140,
  modalBackdrop: 150,
  modal: 160,
  nestedBackdrop: 170,
  nestedModal: 180,
  tooltip: 190,
  toast: 200,
  skipLink: 210,
  debug: 220,
});

export type VelmereOverlayLayer = keyof typeof VELMERE_OVERLAY_LAYERS;

export function pass628LayerStyle(layer: VelmereOverlayLayer): { zIndex: number } {
  return { zIndex: VELMERE_OVERLAY_LAYERS[layer] };
}

export function assertPass628LayerOrder(): boolean {
  const values = Object.values(VELMERE_OVERLAY_LAYERS);
  return values.every((value, index) => index === 0 || value > values[index - 1]);
}
