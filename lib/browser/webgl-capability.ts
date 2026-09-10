export function canCreateBrowserWebGlContext() {
  if (typeof document === "undefined") return false;
  const canvas = document.createElement("canvas");
  const attributes: WebGLContextAttributes = {
    alpha: true,
    antialias: false,
    depth: false,
    failIfMajorPerformanceCaveat: true,
    powerPreference: "low-power",
    preserveDrawingBuffer: false,
    stencil: false,
  };

  try {
    const context = canvas.getContext("webgl2", attributes) ?? canvas.getContext("webgl", attributes);
    if (!context) return false;
    context.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
