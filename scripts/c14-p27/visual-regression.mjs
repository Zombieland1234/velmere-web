import { chromium } from "playwright";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const require = createRequire(import.meta.url);
const root = resolve(process.cwd());
const config = JSON.parse(await readFile(resolve(root, "config/c14-p27/visual-regression.json"), "utf8"));
const baselinePath = resolve(root, "config/c14-p27/baseline-manifest.json");
const baseline = existsSync(baselinePath) ? JSON.parse(await readFile(baselinePath, "utf8")) : null;
const baseUrl = process.env.C14_P27_BASE_URL || config.baseUrl;
const baseOrigin = new URL(baseUrl).origin;
const outputDir = resolve(process.env.C14_P27_OUTPUT_DIR || "/tmp/c14-p27-visual");
const screenshotDir = join(outputDir, "screenshots");
const routeTimeoutMs = Number(config.budgets.routeTimeoutMs || 90000);
const sourceSha = process.env.GITHUB_SHA || process.env.C14_P27_SOURCE_SHA || "local";
const fingerprintSize = 64;

await rm(outputDir, { recursive: true, force: true });
await mkdir(screenshotDir, { recursive: true });

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function safeName(value) {
  return String(value).replace(/[^a-z0-9._-]+/gi, "-");
}

function actionableConsole(messages) {
  return messages.filter((message) => !(
    /ERR_(?:BLOCKED_BY_CLIENT|FAILED|CONNECTION|NAME_NOT_RESOLVED|INTERNET_DISCONNECTED)/i.test(message)
    || /Failed to load resource/i.test(message)
  ));
}

async function waitForBaseUrl() {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < 90000) {
    try {
      const response = await fetch(baseUrl, { redirect: "manual" });
      if (response.status > 0) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((done) => setTimeout(done, 500));
  }
  throw new Error("Visual target did not become ready at " + baseUrl + ": " + String(lastError || "timeout"));
}

async function installObservationHooks(page) {
  await page.addInitScript(() => {
    window.__c14P27LayoutShift = 0;
    window.__c14P27LayoutShiftEntries = [];
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            window.__c14P27LayoutShift += entry.value;
            window.__c14P27LayoutShiftEntries.push({ value: entry.value, startTime: entry.startTime });
          }
        }
      });
      observer.observe({ type: "layout-shift", buffered: true });
    } catch {
      // A missing LayoutShift API is reported by the null metric below.
    }
  });
}

async function disableMotionNoise(page) {
  await page.addStyleTag({
    content: "*,*::before,*::after{animation-delay:0s!important;animation-duration:0s!important;transition-delay:0s!important;transition-duration:0s!important;scroll-behavior:auto!important;caret-color:transparent!important}",
  });
}

async function settle(page) {
  await Promise.race([
    page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => undefined),
    page.waitForTimeout(5000),
  ]);
  await page.evaluate(async () => {
    if (document.fonts && document.fonts.ready) await document.fonts.ready.catch(() => undefined);
  });
  await page.waitForTimeout(350);
}

async function resolveRoutePath(page, routeDef) {
  if (routeDef.path) return routeDef.path;
  if (!routeDef.discoverFrom) throw new Error("Route has neither path nor discoverFrom: " + routeDef.id);
  await page.goto(new URL(routeDef.discoverFrom, baseUrl).href, { waitUntil: "domcontentloaded", timeout: routeTimeoutMs });
  await settle(page);
  const href = await page.evaluate(() => {
    const values = Array.from(document.querySelectorAll("a[href]"))
      .map((node) => node.getAttribute("href"))
      .filter((value) => typeof value === "string");
    return values.find((value) => /^\/en\/shop\/[^/?#]+(?:[?#].*)?$/.test(value)) || null;
  });
  if (!href) throw new Error("No product detail link discovered from " + routeDef.discoverFrom);
  return href;
}

function fixtureSessionPayload() {
  return {
    ok: true,
    passId: "pass2363-supabase-auth-google-account-spine",
    authenticated: true,
    accountAuthenticated: true,
    supabaseAuthenticated: true,
    bindingState: "ready",
    refreshRequired: false,
    authMode: "supabase_http_only",
    session: {
      accountId: "server:c14-p27-visual-fixture",
      displayName: "Velmère Visual Fixture",
      handle: "@visual.fixture",
      email: "visual-fixture@example.invalid",
      provider: "server",
      passId: "pass2363-supabase-auth-google-account-spine"
    },
    google: {
      supabaseConfigured: true,
      googleOAuthConfigured: true,
      signedSessionConfigured: true,
      mode: "ready_for_real_oauth",
      boundary: "C14-P27 synthetic browser fixture; no customer identity."
    }
  };
}

async function addRouteIsolation(page, routeDef, externalBlocked) {
  await page.route("**/*", async (route) => {
    const request = route.request();
    const requestUrl = new URL(request.url());

    if (
      routeDef.authFixture
      && request.method() === "GET"
      && requestUrl.origin === baseOrigin
      && requestUrl.pathname === "/api/auth/session"
    ) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "cache-control": "no-store" },
        body: JSON.stringify(fixtureSessionPayload())
      });
      return;
    }

    if (requestUrl.origin !== baseOrigin) {
      externalBlocked.push({
        url: requestUrl.href,
        resourceType: request.resourceType(),
        method: request.method()
      });
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });
}

async function collectVisualMetrics(page, routeDef) {
  const metrics = await page.evaluate((args) => {
    const root = document.documentElement;
    const body = document.body;
    const viewportWidth = window.innerWidth;
    const isVisible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none"
        && style.visibility !== "hidden"
        && Number(style.opacity || "1") > 0.01
        && rect.width > 0
        && rect.height > 0;
    };

    const brokenImages = Array.from(document.images)
      .filter((image) => isVisible(image) && image.complete && image.naturalWidth === 0)
      .map((image) => ({ src: image.currentSrc || image.src, alt: image.alt }))
      .slice(0, 25);

    const criticalTextNodes = Array.from(document.querySelectorAll("a,button,label,h1,h2,h3,h4,input,textarea,select,[role='button']"));
    const clippedCriticalText = criticalTextNodes.flatMap((element) => {
      if (!(element instanceof HTMLElement) || !isVisible(element)) return [];
      const style = getComputedStyle(element);
      const clips = ["hidden", "clip"].includes(style.overflowX)
        || ["hidden", "clip"].includes(style.overflowY)
        || ["hidden", "clip"].includes(style.overflow);
      if (!clips) return [];
      const clippedX = element.scrollWidth - element.clientWidth > 3;
      const clippedY = element.scrollHeight - element.clientHeight > 3;
      if (!clippedX && !clippedY) return [];
      if (style.textOverflow === "ellipsis") return [];
      const text = (element.innerText || element.getAttribute("aria-label") || element.getAttribute("placeholder") || "").trim();
      if (!text) return [];
      return [{
        tag: element.tagName.toLowerCase(),
        text: text.slice(0, 160),
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight
      }];
    }).slice(0, 25);

    const viewportEscapes = Array.from(document.querySelectorAll("main *")).flatMap((element) => {
      if (!(element instanceof HTMLElement) || !isVisible(element)) return [];
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (style.position === "fixed") return [];
      const leftEscape = Math.max(0, -rect.left);
      const rightEscape = Math.max(0, rect.right - viewportWidth);
      if (leftEscape <= args.maximumHorizontalOverflowPx && rightEscape <= args.maximumHorizontalOverflowPx) return [];
      return [{
        tag: element.tagName.toLowerCase(),
        className: typeof element.className === "string" ? element.className.slice(0, 180) : "",
        leftEscape: Math.round(leftEscape * 100) / 100,
        rightEscape: Math.round(rightEscape * 100) / 100
      }];
    }).slice(0, 25);

    const visibleText = (body && body.innerText ? body.innerText : "").replace(/\s+/g, " ").trim();
    const matches = Array.from(document.querySelectorAll(args.selector || "body"));
    const visibleSelectorMatches = matches.filter((node) => node instanceof HTMLElement && isVisible(node)).length;

    return {
      viewportWidth,
      viewportHeight: window.innerHeight,
      bodyHeight: Math.max(body ? body.scrollHeight : 0, root ? root.scrollHeight : 0),
      documentScrollWidth: Math.max(body ? body.scrollWidth : 0, root ? root.scrollWidth : 0),
      horizontalOverflowPx: Math.max(0, Math.max(body ? body.scrollWidth : 0, root ? root.scrollWidth : 0) - viewportWidth),
      visibleTextCharacters: visibleText.length,
      visibleSelectorMatches,
      brokenImages,
      clippedCriticalText,
      viewportEscapes,
      layoutShiftScore: typeof window.__c14P27LayoutShift === "number" ? window.__c14P27LayoutShift : null,
      layoutShiftEntries: Array.isArray(window.__c14P27LayoutShiftEntries) ? window.__c14P27LayoutShiftEntries.slice(0, 25) : []
    };
  }, { selector: routeDef.selector, maximumHorizontalOverflowPx: config.budgets.maximumHorizontalOverflowPx });
  metrics.requiredSelector = routeDef.selector;
  return metrics;
}

async function collectContrast(page) {
  try {
    const axePath = require.resolve("axe-core/axe.min.js");
    await page.addScriptTag({ path: axePath });
    return await page.evaluate(async () => {
      if (!window.axe) return { available: false, violations: [] };
      const result = await window.axe.run(document, { runOnly: { type: "rule", values: ["color-contrast"] } });
      return {
        available: true,
        violations: result.violations.map((violation) => ({
          id: violation.id,
          impact: violation.impact,
          description: violation.description,
          nodes: violation.nodes.slice(0, 12).map((node) => ({
            target: node.target,
            failureSummary: node.failureSummary
          }))
        }))
      };
    });
  } catch (error) {
    return { available: false, error: String(error), violations: [] };
  }
}

async function fingerprintScreenshot(page, screenshotBuffer) {
  return page.evaluate(async (args) => {
    const binary = atob(args.base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
    const canvas = document.createElement("canvas");
    canvas.width = args.size;
    canvas.height = args.size;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Canvas 2D context unavailable for screenshot fingerprint");
    context.drawImage(bitmap, 0, 0, args.size, args.size);
    const rgba = context.getImageData(0, 0, args.size, args.size).data;
    const luma = new Uint8Array(args.size * args.size);
    for (let src = 0, dst = 0; src < rgba.length; src += 4, dst += 1) {
      luma[dst] = Math.round((rgba[src] * 0.2126) + (rgba[src + 1] * 0.7152) + (rgba[src + 2] * 0.0722));
    }
    let binaryLuma = "";
    const chunk = 32768;
    for (let offset = 0; offset < luma.length; offset += chunk) {
      binaryLuma += String.fromCharCode(...luma.subarray(offset, offset + chunk));
    }
    return {
      width: bitmap.width,
      height: bitmap.height,
      sampleSize: args.size,
      lumaBase64: btoa(binaryLuma)
    };
  }, { base64: screenshotBuffer.toString("base64"), size: fingerprintSize });
}

function compareFingerprint(current, expected) {
  if (!expected || !expected.lumaBase64 || !current || !current.lumaBase64) return { comparable: false, reason: "missing-fingerprint" };
  if (current.sampleSize !== expected.sampleSize) return { comparable: false, reason: "sample-size-mismatch" };
  const left = Buffer.from(current.lumaBase64, "base64");
  const right = Buffer.from(expected.lumaBase64, "base64");
  if (left.length !== right.length || left.length === 0) return { comparable: false, reason: "fingerprint-length-mismatch" };
  let total = 0;
  let changed = 0;
  for (let index = 0; index < left.length; index += 1) {
    const delta = Math.abs(left[index] - right[index]);
    total += delta;
    if (delta > 24) changed += 1;
  }
  return {
    comparable: true,
    meanDelta: total / left.length / 255,
    changedCellRatio: changed / left.length,
    sourceDimensionDelta: {
      width: Math.abs(Number(current.width) - Number(expected.width)),
      height: Math.abs(Number(current.height) - Number(expected.height))
    }
  };
}

function evaluateHardFailures(result, baselineEntry) {
  const failures = [];
  const budget = config.budgets;
  const metrics = result.metrics;
  if (!metrics || result.captureError) {
    failures.push("capture-failed");
    return failures;
  }
  if (metrics.visibleSelectorMatches < 1) failures.push("required-selector-not-visible");
  if (metrics.horizontalOverflowPx > budget.maximumHorizontalOverflowPx) failures.push("horizontal-overflow:" + metrics.horizontalOverflowPx);
  if (metrics.bodyHeight < budget.minimumBodyHeightPx) failures.push("body-too-short:" + metrics.bodyHeight);
  if (metrics.visibleTextCharacters < budget.minimumVisibleTextCharacters) failures.push("visible-text-too-short:" + metrics.visibleTextCharacters);
  if (metrics.brokenImages.length > budget.maximumBrokenImagesPerRoute) failures.push("broken-images:" + metrics.brokenImages.length);
  if (metrics.clippedCriticalText.length > budget.maximumCriticalClippedTextNodes) failures.push("critical-text-clipping:" + metrics.clippedCriticalText.length);
  if (typeof metrics.layoutShiftScore === "number" && metrics.layoutShiftScore > budget.maximumCumulativeLayoutShift) failures.push("layout-shift:" + metrics.layoutShiftScore.toFixed(4));
  if (result.failedStaticAssets.length > budget.maximumFailedStaticAssetsPerRoute) failures.push("failed-static-assets:" + result.failedStaticAssets.length);
  if (!result.expectedErrorState) {
    if (result.actionableConsoleErrors.length > budget.maximumConsoleErrorsPerRoute) failures.push("console-errors:" + result.actionableConsoleErrors.length);
    if (result.pageErrors.length > budget.maximumPageErrorsPerRoute) failures.push("page-errors:" + result.pageErrors.length);
  }
  if (baseline) {
    if (!baselineEntry) {
      failures.push("baseline-entry-missing");
    } else {
      const diff = result.baselineComparison;
      if (!diff || !diff.comparable) failures.push("baseline-not-comparable:" + (diff && diff.reason ? diff.reason : "unknown"));
      else {
        if (diff.meanDelta > budget.maximumPerceptualMeanDelta) failures.push("perceptual-mean-delta:" + diff.meanDelta.toFixed(5));
        if (diff.changedCellRatio > budget.maximumPerceptualChangedCellRatio) failures.push("perceptual-cell-ratio:" + diff.changedCellRatio.toFixed(5));
      }
    }
  }
  return failures;
}

async function captureRoute(browser, viewportName, viewport, routeDef) {
  const context = await browser.newContext({
    viewport,
    colorScheme: config.theme.testedColorScheme,
    reducedMotion: "reduce",
    locale: "en-US",
    timezoneId: "UTC",
    deviceScaleFactor: 1
  });
  const page = await context.newPage();
  page.setDefaultTimeout(routeTimeoutMs);
  page.setDefaultNavigationTimeout(routeTimeoutMs);

  const consoleErrors = [];
  const pageErrors = [];
  const failedStaticAssets = [];
  const externalBlocked = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  page.on("response", (response) => {
    try {
      const url = new URL(response.url());
      const type = response.request().resourceType();
      if (url.origin === baseOrigin && response.status() >= 400 && ["image", "font", "stylesheet", "script"].includes(type)) {
        failedStaticAssets.push({ url: url.href, status: response.status(), resourceType: type });
      }
    } catch {
      // Diagnostic only.
    }
  });

  await installObservationHooks(page);
  await addRouteIsolation(page, routeDef, externalBlocked);

  let routePath = routeDef.path || null;
  let metrics = null;
  let contrast = { available: false, violations: [] };
  let screenshotSha256 = null;
  let fingerprint = null;
  let screenshotRelativePath = null;
  let responseStatus = null;
  let captureError = null;

  try {
    routePath = await resolveRoutePath(page, routeDef);
    if (routeDef.loadingState) {
      const navigation = page.goto(new URL(routePath, baseUrl).href, { waitUntil: "load", timeout: routeTimeoutMs }).catch((error) => ({ navigationError: String(error) }));
      await page.waitForSelector(routeDef.selector, { state: "visible", timeout: 7000 });
      await disableMotionNoise(page);
      await page.waitForTimeout(150);
      metrics = await collectVisualMetrics(page, routeDef);
      contrast = await collectContrast(page);
      const viewportFolder = join(screenshotDir, viewportName);
      await mkdir(viewportFolder, { recursive: true });
      screenshotRelativePath = "screenshots/" + safeName(viewportName) + "/" + safeName(routeDef.id) + ".png";
      const screenshotBuffer = await page.screenshot({ path: join(outputDir, screenshotRelativePath), fullPage: true, animations: "disabled" });
      screenshotSha256 = sha256(screenshotBuffer);
      fingerprint = await fingerprintScreenshot(page, screenshotBuffer);
      const navResult = await navigation;
      if (navResult && typeof navResult.status === "function") responseStatus = navResult.status();
      await page.waitForSelector("[data-c14-p27-loaded='true']", { state: "attached", timeout: routeTimeoutMs }).catch(() => undefined);
    } else {
      const response = await page.goto(new URL(routePath, baseUrl).href, { waitUntil: "domcontentloaded", timeout: routeTimeoutMs });
      responseStatus = response ? response.status() : null;
      await page.waitForSelector(routeDef.selector, { state: "visible", timeout: routeTimeoutMs });
      await disableMotionNoise(page);
      await settle(page);
      metrics = await collectVisualMetrics(page, routeDef);
      contrast = await collectContrast(page);
      const viewportFolder = join(screenshotDir, viewportName);
      await mkdir(viewportFolder, { recursive: true });
      screenshotRelativePath = "screenshots/" + safeName(viewportName) + "/" + safeName(routeDef.id) + ".png";
      const screenshotBuffer = await page.screenshot({ path: join(outputDir, screenshotRelativePath), fullPage: true, animations: "disabled" });
      screenshotSha256 = sha256(screenshotBuffer);
      fingerprint = await fingerprintScreenshot(page, screenshotBuffer);
    }
  } catch (error) {
    captureError = String(error && error.stack ? error.stack : error);
  }

  const key = viewportName + "/" + routeDef.id;
  const baselineEntry = baseline && baseline.screenshots ? baseline.screenshots[key] || null : null;
  const baselineComparison = baselineEntry && fingerprint ? compareFingerprint(fingerprint, baselineEntry.fingerprint) : null;
  const result = {
    key,
    viewport: viewportName,
    viewportSize: viewport,
    routeId: routeDef.id,
    routePath,
    expectedErrorState: Boolean(routeDef.expectedErrorState),
    loadingState: Boolean(routeDef.loadingState),
    authFixture: Boolean(routeDef.authFixture),
    responseStatus,
    screenshotPath: screenshotRelativePath,
    screenshotSha256,
    fingerprint,
    metrics,
    contrast,
    consoleErrors,
    actionableConsoleErrors: actionableConsole(consoleErrors),
    pageErrors,
    failedStaticAssets,
    externalBlocked: externalBlocked.slice(0, 50),
    baselineComparison,
    captureError
  };
  result.hardFailures = evaluateHardFailures(result, baselineEntry);
  await context.close();
  return result;
}

await waitForBaseUrl();

const browser = await chromium.launch({
  headless: true,
  ignoreDefaultArgs: ["--enable-features=CDPScreenshotNewSurface"],
  args: ["--disable-dev-shm-usage"]
});

const browserVersion = await browser.version();
const results = [];
try {
  for (const [viewportName, viewport] of Object.entries(config.viewports)) {
    for (const routeDef of config.routes) {
      process.stdout.write("[c14-p27] " + viewportName + " " + routeDef.id + " ... ");
      const result = await captureRoute(browser, viewportName, viewport, routeDef);
      results.push(result);
      console.log(result.hardFailures.length ? "FAIL " + result.hardFailures.join(", ") : "PASS");
    }
  }
} finally {
  await browser.close();
}

const screenshots = {};
for (const result of results) {
  if (!result.fingerprint || !result.screenshotSha256) continue;
  screenshots[result.key] = {
    routePath: result.routePath,
    screenshotPath: result.screenshotPath,
    sha256: result.screenshotSha256,
    fingerprint: result.fingerprint
  };
}

const candidateManifest = {
  schemaVersion: "velmere.c14-p27.visual-baseline.v1",
  generatedFromSourceSha: sourceSha,
  baseSourceSha: config.baseSourceSha,
  browser: {
    engine: "chromium",
    version: browserVersion,
    playwright: require("playwright/package.json").version,
    ignoredDefaultArgument: "--enable-features=CDPScreenshotNewSurface"
  },
  theme: config.theme,
  viewports: config.viewports,
  fingerprint: {
    sampleSize: fingerprintSize,
    lumaMethod: "rec709",
    comparison: {
      maximumPerceptualMeanDelta: config.budgets.maximumPerceptualMeanDelta,
      maximumPerceptualChangedCellRatio: config.budgets.maximumPerceptualChangedCellRatio,
      changedCellThresholdLuma: 24
    }
  },
  screenshots
};

const hardFailures = results.flatMap((result) => result.hardFailures.map((failure) => ({ key: result.key, failure })));
const contrastRoutes = results.filter((result) => result.contrast && result.contrast.violations && result.contrast.violations.length > 0);
const totalContrastViolations = contrastRoutes.reduce((sum, result) => sum + result.contrast.violations.length, 0);
const maximumObservedOverflow = results.reduce((max, result) => Math.max(max, result.metrics ? result.metrics.horizontalOverflowPx : 0), 0);
const maximumObservedCls = results.reduce((max, result) => Math.max(max, result.metrics && typeof result.metrics.layoutShiftScore === "number" ? result.metrics.layoutShiftScore : 0), 0);
const baselineComparisons = results.filter((result) => result.baselineComparison && result.baselineComparison.comparable);
const maximumPerceptualMeanDelta = baselineComparisons.reduce((max, result) => Math.max(max, result.baselineComparison.meanDelta), 0);
const maximumPerceptualChangedCellRatio = baselineComparisons.reduce((max, result) => Math.max(max, result.baselineComparison.changedCellRatio), 0);

const summary = {
  schemaVersion: "velmere.c14-p27.visual-qualification-result.v1",
  sourceSha,
  baseSourceSha: config.baseSourceSha,
  mode: baseline ? "regression-compare" : "baseline-candidate",
  browserVersion,
  playwrightVersion: require("playwright/package.json").version,
  expectedScreenshotCount: Object.keys(config.viewports).length * config.routes.length,
  screenshotCount: Object.keys(screenshots).length,
  routeRows: results.length,
  viewports: config.viewports,
  theme: config.theme,
  maximumObservedOverflow,
  maximumObservedCls,
  maximumPerceptualMeanDelta,
  maximumPerceptualChangedCellRatio,
  totalContrastViolations,
  contrastViolationRoutes: contrastRoutes.map((result) => result.key),
  hardFailureCount: hardFailures.length,
  hardFailures,
  baselinePresent: Boolean(baseline),
  baselineSourceSha: baseline ? baseline.generatedFromSourceSha : null,
  verdict: hardFailures.length === 0 ? "PASS" : "FAIL"
};

const lines = [
  "# C14-P27 Visual Qualification",
  "",
  "- Source: " + sourceSha,
  "- Mode: " + summary.mode,
  "- Browser: Chromium " + browserVersion + " / Playwright " + summary.playwrightVersion,
  "- Matrix: " + summary.screenshotCount + "/" + summary.expectedScreenshotCount + " screenshots across desktop, tablet and mobile",
  "- Hard failures: " + summary.hardFailureCount,
  "- Max horizontal overflow: " + maximumObservedOverflow + "px",
  "- Max CLS: " + maximumObservedCls.toFixed(5),
  "- Contrast-rule violations (diagnostic, not auto-fail): " + totalContrastViolations,
  baseline ? "- Max perceptual mean delta: " + maximumPerceptualMeanDelta.toFixed(5) : "- Baseline comparison: not active yet; this run generated the candidate baseline.",
  "",
  "## Route matrix",
  "",
  "| Viewport | Route/state | Path | Screenshot | Result |",
  "| --- | --- | --- | --- | --- |",
  ...results.map((result) => "| " + result.viewport + " | " + result.routeId + " | " + (result.routePath || "unresolved") + " | " + (result.screenshotPath || "—") + " | " + (result.hardFailures.length ? "FAIL: " + result.hardFailures.join("; ") : "PASS") + " |"),
  "",
  "## Hard failures",
  "",
  ...(hardFailures.length ? hardFailures.map((entry) => "- " + entry.key + ": " + entry.failure) : ["- None."]),
  "",
  "## Truth boundary",
  "",
  "- Synthetic auth is browser-route interception only; no customer credential or production auth claim is made.",
  "- Error/loading fixture routes are gated by VELMERE_VISUAL_REGRESSION_FIXTURES=1 and are not public product states when the flag is absent.",
  "- Light mode is not claimed: the current source has no light/dark customer theme switch.",
  "- Color-contrast findings are recorded diagnostically and are not silently auto-fixed or redesign-triggering.",
  ""
];

await writeFile(join(outputDir, "RESULTS.json"), JSON.stringify(results, null, 2));
await writeFile(join(outputDir, "SUMMARY.json"), JSON.stringify(summary, null, 2));
await writeFile(join(outputDir, "SUMMARY.md"), lines.join("\n"));
await writeFile(join(outputDir, "BASELINE_MANIFEST.candidate.json"), JSON.stringify(candidateManifest, null, 2));

console.log(JSON.stringify(summary, null, 2));
if (hardFailures.length) process.exitCode = 1;
