"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import styles from "./ShieldProMonochromeGlobe.module.css";

type LandPoint = readonly [latitude: number, longitude: number, weight: number];
type CartesianLandPoint = readonly [x: number, y: number, z: number, weight: number];

const LAND_POINTS_URL = "/images/atelier/world-real-land-points-v4.json";
const LAND_POSTER_URL = "/images/atelier/world-orthographic-land-v6.webp";
const MAX_LAND_DATA_BYTES = 400_000;
const MAX_LAND_POINTS = 16_000;

function isLandPoint(value: unknown): value is LandPoint {
  return Array.isArray(value)
    && value.length === 3
    && value.every((entry) => typeof entry === "number" && Number.isFinite(entry))
    && value[0] >= -90
    && value[0] <= 90
    && value[1] >= -180
    && value[1] <= 180
    && value[2] >= 0
    && value[2] <= 4;
}

function decodeLandPoints(payload: unknown): CartesianLandPoint[] | null {
  if (!Array.isArray(payload) || payload.length < 1_000 || payload.length > MAX_LAND_POINTS) return null;
  const decoded: CartesianLandPoint[] = [];
  for (const value of payload) {
    if (!isLandPoint(value)) return null;
    const [latitude, longitude, weight] = value;
    const phi = latitude * (Math.PI / 180);
    const lambda = longitude * (Math.PI / 180);
    const cosPhi = Math.cos(phi);
    decoded.push([
      cosPhi * Math.sin(lambda),
      Math.sin(phi),
      cosPhi * Math.cos(lambda),
      weight,
    ]);
  }
  return decoded;
}

export default function ShieldProMonochromeGlobe() {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: true });
    if (!wrapper || !canvas || !context) return undefined;

    const controller = new AbortController();
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let points: CartesianLandPoint[] = [];
    let disposed = false;
    let inViewport = true;
    let documentVisible = !document.hidden;
    let reducedMotion = motionQuery.matches;
    let animationFrame: number | null = null;
    let lastPaintAt = 0;
    let yaw = -0.48;
    let canvasMetrics = { width: 0, height: 0, compact: false, pixelRatio: 1 };
    let oceanGradient: CanvasGradient | null = null;
    const navigatorCapacity = navigator as Navigator & { deviceMemory?: number };
    const constrainedDevice = (navigator.hardwareConcurrency || 4) <= 4 || (navigatorCapacity.deviceMemory ?? 4) <= 4;

    const cancelFrame = () => {
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
      animationFrame = null;
    };

    const resizeCanvas = () => {
      const rect = wrapper.getBoundingClientRect();
      const compact = rect.width < 620;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, compact ? 1.25 : 1.5);
      const width = Math.max(1, Math.round(rect.width * pixelRatio));
      const height = Math.max(1, Math.round(rect.height * pixelRatio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        context.imageSmoothingEnabled = false;
      }
      canvasMetrics = { width: rect.width, height: rect.height, compact, pixelRatio };
      const radius = Math.min(rect.width, rect.height) * 0.405;
      const centerX = rect.width * 0.5;
      const centerY = rect.height * 0.5;
      oceanGradient = context.createRadialGradient(
        centerX - radius * 0.32,
        centerY - radius * 0.28,
        radius * 0.06,
        centerX,
        centerY,
        radius,
      );
      oceanGradient.addColorStop(0, "rgba(31,31,31,0.98)");
      oceanGradient.addColorStop(0.58, "rgba(7,7,7,0.99)");
      oceanGradient.addColorStop(1, "rgba(0,0,0,1)");
    };

    const paint = (now: number) => {
      if (disposed || !points.length) return;
      if (!canvasMetrics.width || !canvasMetrics.height) resizeCanvas();
      const { width, height, compact } = canvasMetrics;
      context.clearRect(0, 0, width, height);
      const radius = Math.min(width, height) * 0.405;
      const centerX = width * 0.5;
      const floatOffset = reducedMotion ? 0 : Math.sin(now / 8_500) * radius * 0.009;
      const centerY = height * 0.5 + floatOffset;

      const ocean = oceanGradient ?? "rgba(7,7,7,0.99)";
      context.beginPath();
      context.arc(centerX, centerY, radius, 0, Math.PI * 2);
      context.fillStyle = ocean;
      context.fill();
      context.save();
      context.clip();

      context.lineWidth = 0.75;
      context.strokeStyle = "rgba(255,255,255,0.075)";
      for (const scale of [0.32, 0.64]) {
        context.beginPath();
        context.ellipse(centerX, centerY, radius, radius * scale, 0, 0, Math.PI * 2);
        context.stroke();
      }
      for (const scale of [0.34, 0.68]) {
        context.beginPath();
        context.ellipse(centerX, centerY, radius * scale, radius, 0, 0, Math.PI * 2);
        context.stroke();
      }

      const pitch = -0.16;
      const pitchCos = Math.cos(pitch);
      const pitchSin = Math.sin(pitch);
      const yawSin = Math.sin(yaw);
      const yawCos = Math.cos(yaw);
      const pointStep = compact ? 4 : 2;
      context.fillStyle = "#f2f2f2";
      for (let index = 0; index < points.length; index += pointStep) {
        const [baseX, y, baseZ, weight] = points[index];
        const x = baseX * yawCos + baseZ * yawSin;
        const z = baseZ * yawCos - baseX * yawSin;
        const projectedY = y * pitchCos - z * pitchSin;
        const projectedZ = y * pitchSin + z * pitchCos;
        if (projectedZ <= -0.015) continue;
        const alpha = Math.min(0.9, 0.25 + projectedZ * 0.54 + Math.max(0, weight) * 0.12);
        const dot = (compact ? 0.72 : 0.78) + projectedZ * (compact ? 0.42 : 0.58);
        context.globalAlpha = alpha;
        context.fillRect(
          centerX + x * radius - dot * 0.5,
          centerY - projectedY * radius - dot * 0.5,
          dot,
          dot,
        );
      }
      context.globalAlpha = 1;
      context.restore();

      context.beginPath();
      context.arc(centerX, centerY, radius, 0, Math.PI * 2);
      context.lineWidth = 1;
      context.strokeStyle = "rgba(255,255,255,0.22)";
      context.stroke();
    };

    const animate = (now: number) => {
      animationFrame = null;
      if (disposed || !inViewport || !documentVisible || reducedMotion) return;
      const targetFps = canvasMetrics.compact || constrainedDevice ? 20 : 30;
      if (now - lastPaintAt >= 1_000 / targetFps) {
        const delta = lastPaintAt ? Math.min(64, now - lastPaintAt) : 0;
        lastPaintAt = now;
        yaw += delta * 0.000026;
        paint(now);
      }
      animationFrame = window.requestAnimationFrame(animate);
    };

    const startOrPaint = () => {
      cancelFrame();
      if (!points.length || disposed) return;
      paint(window.performance.now());
      if (inViewport && documentVisible && !reducedMotion) {
        animationFrame = window.requestAnimationFrame(animate);
      }
    };

    const onResize = () => {
      resizeCanvas();
      startOrPaint();
    };
    resizeCanvas();
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(wrapper);
    const intersectionObserver = new IntersectionObserver((entries) => {
      inViewport = Boolean(entries[0]?.isIntersecting);
      startOrPaint();
    }, { rootMargin: "120px" });
    intersectionObserver.observe(wrapper);

    const onVisibilityChange = () => {
      documentVisible = !document.hidden;
      startOrPaint();
    };
    const onMotionChange = () => {
      reducedMotion = motionQuery.matches;
      startOrPaint();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    motionQuery.addEventListener("change", onMotionChange);

    void fetch(LAND_POINTS_URL, { signal: controller.signal, cache: "force-cache" })
      .then(async (response) => {
        if (!response.ok) throw new Error("land_points_unavailable");
        const source = await response.arrayBuffer();
        if (source.byteLength > MAX_LAND_DATA_BYTES) throw new Error("land_points_oversize");
        return JSON.parse(new TextDecoder().decode(source)) as unknown;
      })
      .then((payload) => {
        if (disposed) return;
        const decoded = decodeLandPoints(payload);
        if (!decoded) return;
        points = decoded;
        setReady(true);
        startOrPaint();
      })
      .catch(() => {
        // The bundled real-geography poster remains visible as a static,
        // monochrome fallback; no synthetic land shapes are substituted.
      });

    return () => {
      disposed = true;
      controller.abort();
      cancelFrame();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      motionQuery.removeEventListener("change", onMotionChange);
      context.clearRect(0, 0, canvas.width, canvas.height);
      oceanGradient = null;
    };
  }, []);

  return (
    <div
      ref={wrapperRef}
      className={styles.globe}
      data-globe-state={ready ? "ready" : "static-fallback"}
      data-globe-source="world-real-land-points-v4"
      data-globe-renderer="bounded-2d-canvas"
      aria-hidden="true"
    >
      <Image
        className={styles.fallback}
        src={LAND_POSTER_URL}
        alt=""
        fill
        loading="eager"
        sizes="(max-width: 900px) 43rem, 58vw"
      />
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}
