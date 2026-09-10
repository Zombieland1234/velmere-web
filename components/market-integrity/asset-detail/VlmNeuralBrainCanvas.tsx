"use client";

import { useEffect, useRef } from "react";
import { tokenVisualLabel } from "@/components/market-integrity/asset-detail/visuals";

type Props = {
  progress: number;
  symbol: string;
};

type NeuralNode = {
  x: number;
  y: number;
  z: number;
};

const STANDARD_NODE_COUNT = 62;
const CONSERVATIVE_NODE_COUNT = 42;
const STANDARD_FRAME_INTERVAL_MS = 1000 / 30;
const CONSERVATIVE_FRAME_INTERVAL_MS = 1000 / 24;

function createNodes(count: number): NeuralNode[] {
  const denominator = Math.max(1, count - 1);
  const golden = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: count }, (_, index) => {
    const y = 1 - (index / denominator) * 2;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * index;
    return {
      x: Math.cos(theta) * radius,
      y,
      z: Math.sin(theta) * radius,
    };
  });
}

export default function VlmNeuralBrainCanvas({ progress, symbol }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const progressRef = useRef(progress);
  const symbolRef = useRef(symbol);

  useEffect(() => {
    progressRef.current = progress;
    symbolRef.current = symbol;
  }, [progress, symbol]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const compactViewportQuery = window.matchMedia("(max-width: 640px)");
    const conservativeDevice = (navigator.hardwareConcurrency || 8) <= 4;
    const conservativeProfile = conservativeDevice || compactViewportQuery.matches;
    const nodes = createNodes(conservativeProfile ? CONSERVATIVE_NODE_COUNT : STANDARD_NODE_COUNT);
    const frameInterval = conservativeProfile ? CONSERVATIVE_FRAME_INTERVAL_MS : STANDARD_FRAME_INTERVAL_MS;

    let width = 260;
    let height = 260;
    let dpr = 1;
    let raf = 0;
    let lastFrameTime = -Infinity;
    let isIntersecting = true;
    let pageVisible = document.visibilityState !== "hidden";
    let reducedMotion = reducedMotionQuery.matches;
    let disposed = false;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(180, Math.floor(rect.width));
      height = Math.max(180, Math.floor(rect.height));
      const dprCap = conservativeProfile ? 1.5 : 2;
      dpr = Math.min(window.devicePixelRatio || 1, dprCap);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const project = (node: NeuralNode, time: number) => {
      const ry = time * 0.00042;
      const rx = 0.35 + Math.sin(time * 0.0002) * 0.08;
      const cosY = Math.cos(ry);
      const sinY = Math.sin(ry);
      const cosX = Math.cos(rx);
      const sinX = Math.sin(rx);
      const x1 = node.x * cosY - node.z * sinY;
      const z1 = node.x * sinY + node.z * cosY;
      const y1 = node.y * cosX - z1 * sinX;
      const z2 = node.y * sinX + z1 * cosX;
      const perspective = 1.9 / (2.35 - z2 * 0.52);
      const scale = Math.min(width, height) * 0.34;
      return {
        x: width / 2 + x1 * scale * perspective,
        y: height / 2 + y1 * scale * perspective,
        alpha: 0.28 + perspective * 0.36,
        size: Math.max(0.9, perspective * 1.8),
      };
    };

    const drawFrame = (time: number, animated: boolean) => {
      const animationTime = animated ? time : 0;
      ctx.clearRect(0, 0, width, height);
      const cx = width / 2;
      const cy = height / 2;
      const progressValue = progressRef.current;
      const glow = ctx.createRadialGradient(cx, cy, 6, cx, cy, Math.min(width, height) * 0.46);
      glow.addColorStop(0, `rgba(45,212,191,${0.18 + progressValue * 0.12})`);
      glow.addColorStop(0.48, "rgba(8,47,73,0.16)");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.sin(animationTime * 0.00035) * 0.08);
      for (let ring = 0; ring < 4; ring += 1) {
        ctx.beginPath();
        ctx.ellipse(
          0,
          0,
          72 + ring * 15,
          26 + ring * 6,
          ring * 0.62 + Math.sin(animationTime * 0.0003 + ring) * 0.18,
          0,
          Math.PI * 2,
        );
        ctx.strokeStyle = ring === 2 ? "rgba(250,204,21,0.105)" : "rgba(94,234,212,0.105)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.restore();

      const projected = nodes.map((node) => project(node, animationTime));
      for (let i = 0; i < projected.length; i += 1) {
        for (let j = i + 1; j < projected.length; j += 1) {
          const a = projected[i];
          const b = projected[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance > 46) continue;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(94,234,212,${Math.max(0.025, (1 - distance / 46) * 0.13)})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      projected.forEach((node, index) => {
        const phase = (animationTime * 0.0012 + index * 0.17) % 1;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.size + Math.sin(phase * Math.PI * 2) * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = index % 5 === 0
          ? `rgba(250,204,21,${0.35 + node.alpha * 0.45})`
          : `rgba(153,246,228,${0.28 + node.alpha * 0.52})`;
        ctx.fill();
      });

      for (let flow = 0; flow < 5; flow += 1) {
        const t = (animationTime * 0.00028 + flow * 0.18 + progressValue * 0.2) % 1;
        const angle = flow * 1.25 + animationTime * 0.00035;
        const start = 92 - t * 70;
        const x = cx + Math.cos(angle) * start;
        const y = cy + Math.sin(angle) * start * 0.68;
        ctx.beginPath();
        ctx.arc(x, y, 1.6 + t * 1.4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${0.08 + t * 0.72})`;
        ctx.fill();
      }

      const coreRadius = 24 + Math.sin(animationTime * 0.002) * 1.8;
      const core = ctx.createRadialGradient(cx - 10, cy - 12, 4, cx, cy, coreRadius * 1.55);
      core.addColorStop(0, "rgba(236,253,245,0.95)");
      core.addColorStop(0.32, "rgba(94,234,212,0.82)");
      core.addColorStop(0.72, "rgba(8,145,178,0.32)");
      core.addColorStop(1, "rgba(2,6,23,0.08)");
      ctx.beginPath();
      ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
      ctx.fillStyle = core;
      ctx.fill();

      const symbolText = tokenVisualLabel(symbolRef.current);
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `600 ${symbolText.length > 3 ? 9 : symbolText.length > 1 ? 12 : 16}px var(--font-mono), ui-monospace, monospace`;
      ctx.shadowColor = "rgba(8, 47, 73, 0.72)";
      ctx.shadowBlur = 8;
      ctx.fillStyle = "rgba(245, 255, 255, 0.92)";
      ctx.fillText(symbolText, cx, cy + 0.5);
      ctx.restore();
    };

    const stop = () => {
      if (!raf) return;
      window.cancelAnimationFrame(raf);
      raf = 0;
    };

    const shouldAnimate = () => !disposed && !reducedMotion && pageVisible && isIntersecting;

    const schedule = () => {
      if (!shouldAnimate() || raf) return;
      raf = window.requestAnimationFrame(loop);
    };

    const loop = (time: number) => {
      raf = 0;
      if (!shouldAnimate()) return;
      if (time - lastFrameTime >= frameInterval) {
        drawFrame(time, true);
        lastFrameTime = time;
      }
      schedule();
    };

    const renderCurrentState = () => {
      if (reducedMotion) {
        stop();
        drawFrame(0, false);
        return;
      }
      schedule();
    };

    const onVisibilityChange = () => {
      pageVisible = document.visibilityState !== "hidden";
      if (!pageVisible) stop();
      else renderCurrentState();
    };

    const onReducedMotionChange = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches;
      renderCurrentState();
    };

    const resizeObserver = new ResizeObserver(() => {
      resize();
      drawFrame(performance.now(), !reducedMotion);
      renderCurrentState();
    });
    resizeObserver.observe(canvas);

    const intersectionObserver = typeof IntersectionObserver === "undefined"
      ? null
      : new IntersectionObserver((entries) => {
          isIntersecting = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio > 0);
          if (!isIntersecting) stop();
          else renderCurrentState();
        }, { threshold: 0.01 });
    intersectionObserver?.observe(canvas);

    document.addEventListener("visibilitychange", onVisibilityChange);
    reducedMotionQuery.addEventListener("change", onReducedMotionChange);

    resize();
    drawFrame(performance.now(), !reducedMotion);
    renderCurrentState();

    return () => {
      disposed = true;
      stop();
      resizeObserver.disconnect();
      intersectionObserver?.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      reducedMotionQuery.removeEventListener("change", onReducedMotionChange);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="vlm-neural-brain-canvas"
      data-pass35-a37-neural-performance="lazy-visibility-reduced-motion-frame-capped"
      aria-hidden="true"
    />
  );
}
