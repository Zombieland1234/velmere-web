import fs from "node:fs";
import path from "node:path";

function reportedOutputPath(outputRoot, candidate) {
  const relative = path.relative(outputRoot, candidate);
  if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error("segmented_build_compat_path_outside_output");
  }
  return relative.split(path.sep).join("/");
}

function copyIfPresent(outputRoot, source, target, copied) {
  if (!fs.existsSync(source)) return;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
  copied.push({
    source: reportedOutputPath(outputRoot, source),
    target: reportedOutputPath(outputRoot, target),
    bytes: fs.statSync(target).size,
    rawAbsolutePathDisclosed: false,
  });
}

export function stageWebpackProxyForGenerate(distDir) {
  const serverDir = path.join(distDir, "server");
  const middleware = path.join(serverDir, "middleware.js");
  const proxy = path.join(serverDir, "proxy.js");
  const copied = [];
  if (!fs.existsSync(middleware)) {
    return { status: "NOT_REQUIRED", copied, reason: "compiled_middleware_missing" };
  }
  if (fs.existsSync(proxy)) {
    return { status: "NOT_REQUIRED", copied, reason: "compiled_proxy_present" };
  }
  copyIfPresent(distDir, middleware, proxy, copied);
  copyIfPresent(distDir, `${middleware}.nft.json`, `${proxy}.nft.json`, copied);
  copyIfPresent(distDir, `${middleware}.map`, `${proxy}.map`, copied);
  if (!fs.existsSync(proxy)) throw new Error("segmented_build_proxy_bridge_failed");
  return {
    status: "STAGED",
    copied,
    truthBoundary: "Build-output compatibility only. No source route or deployment handler is created or restored.",
  };
}
