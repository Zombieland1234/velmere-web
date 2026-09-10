"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import PremiumAmbientGlobe from "@/components/ui/PremiumAmbientGlobe";

type NodeKind = "core" | "jacket" | "tee" | "drape" | "archive" | "square";

type NeuralNode = {
  key: string;
  kind: NodeKind;
  x: number;
  y: number;
  z: number;
};

const nodes: NeuralNode[] = [
  { key: "core", kind: "core", x: 0, y: 0, z: 0 },
  { key: "clothing", kind: "jacket", x: -1.8, y: -0.7, z: 0.5 },
  { key: "archive", kind: "archive", x: 1.35, y: -1.05, z: -0.35 },
  { key: "drops", kind: "tee", x: 1.75, y: 0.6, z: 0.45 },
  { key: "square", kind: "square", x: -1.15, y: 1.15, z: -0.7 },
  { key: "drape", kind: "drape", x: 0.1, y: -1.75, z: 0.9 },
  { key: "atelier", kind: "jacket", x: -2.3, y: 0.55, z: -0.35 },
  { key: "access", kind: "archive", x: 2.25, y: -0.05, z: -0.85 },
  { key: "signal", kind: "tee", x: -0.25, y: 1.75, z: 0.75 },
];

const connections = [
  [0, 1],
  [0, 2],
  [0, 3],
  [0, 4],
  [0, 5],
  [1, 6],
  [2, 7],
  [3, 8],
  [4, 8],
  [5, 2],
] as const;

function drawApparelNode(ctx: CanvasRenderingContext2D, kind: NodeKind, x: number, y: number, size: number, alpha: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = `rgba(245,240,232,${alpha})`;
  ctx.lineWidth = Math.max(1, size * 0.045);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  if (kind === "core") {
    const gradient = ctx.createRadialGradient(0, 0, size * 0.12, 0, 0, size * 0.72);
    gradient.addColorStop(0, "rgba(255,255,240,0.95)");
    gradient.addColorStop(0.45, "rgba(212,175,55,0.72)");
    gradient.addColorStop(1, "rgba(212,175,55,0.02)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(212,175,55,0.9)";
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.48, 0, Math.PI * 2);
    ctx.stroke();
  } else if (kind === "jacket") {
    ctx.beginPath();
    ctx.moveTo(-size * 0.42, -size * 0.26);
    ctx.lineTo(-size * 0.68, size * 0.06);
    ctx.lineTo(-size * 0.46, size * 0.48);
    ctx.lineTo(-size * 0.12, size * 0.28);
    ctx.lineTo(0, -size * 0.08);
    ctx.lineTo(size * 0.12, size * 0.28);
    ctx.lineTo(size * 0.46, size * 0.48);
    ctx.lineTo(size * 0.68, size * 0.06);
    ctx.lineTo(size * 0.42, -size * 0.26);
    ctx.lineTo(size * 0.18, -size * 0.42);
    ctx.lineTo(0, -size * 0.16);
    ctx.lineTo(-size * 0.18, -size * 0.42);
    ctx.closePath();
    ctx.stroke();
  } else if (kind === "tee") {
    ctx.beginPath();
    ctx.moveTo(-size * 0.18, -size * 0.42);
    ctx.lineTo(-size * 0.66, -size * 0.16);
    ctx.lineTo(-size * 0.44, size * 0.08);
    ctx.lineTo(-size * 0.22, -size * 0.02);
    ctx.lineTo(-size * 0.2, size * 0.48);
    ctx.lineTo(size * 0.2, size * 0.48);
    ctx.lineTo(size * 0.22, -size * 0.02);
    ctx.lineTo(size * 0.44, size * 0.08);
    ctx.lineTo(size * 0.66, -size * 0.16);
    ctx.lineTo(size * 0.18, -size * 0.42);
    ctx.quadraticCurveTo(0, -size * 0.18, -size * 0.18, -size * 0.42);
    ctx.stroke();
  } else if (kind === "drape") {
    ctx.beginPath();
    ctx.moveTo(-size * 0.44, -size * 0.36);
    ctx.bezierCurveTo(-size * 0.1, -size * 0.52, size * 0.2, -size * 0.4, size * 0.42, -size * 0.1);
    ctx.bezierCurveTo(size * 0.2, size * 0.08, size * 0.36, size * 0.34, size * 0.1, size * 0.5);
    ctx.bezierCurveTo(-size * 0.18, size * 0.36, -size * 0.2, size * 0.04, -size * 0.48, -size * 0.02);
    ctx.bezierCurveTo(-size * 0.32, -size * 0.12, -size * 0.28, -size * 0.26, -size * 0.44, -size * 0.36);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.roundRect(-size * 0.46, -size * 0.32, size * 0.92, size * 0.64, size * 0.14);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-size * 0.28, -size * 0.08);
    ctx.lineTo(size * 0.28, -size * 0.08);
    ctx.moveTo(-size * 0.28, size * 0.08);
    ctx.lineTo(size * 0.16, size * 0.08);
    ctx.stroke();
  }

  ctx.restore();
}

export default function NeuralBrainVisual() {
  const t = useTranslations("Home.neuralBrain");
  const reducedMotion = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const rotationRef = useRef({ x: -0.22, y: 0.45 });
  const dragRef = useRef<{ active: boolean; x: number; y: number }>({ active: false, x: 0, y: 0 });
  const touchDisabledRef = useRef(false);
  const velocityRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  const visibleRef = useRef(false);
  const [activeNode, setActiveNode] = useState("core");
  const activeNodeRef = useRef("core");

  useEffect(() => {
    activeNodeRef.current = activeNode;
  }, [activeNode]);

  const translatedNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        title: t(`nodes.${node.key}.title`),
        body: t(`nodes.${node.key}.body`),
      })),
    [t],
  );

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrapper || !canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;
    const ctx: CanvasRenderingContext2D = context;

    let width = 0;
    let height = 0;
    let projected: Array<{ key: string; x: number; y: number; z: number; size: number }> = [];
    const lowPowerMode = Boolean(
      reducedMotion ||
      window.matchMedia?.("(max-width: 767px), (pointer: coarse)").matches ||
      (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
    );

    const resize = () => {
      const rect = wrapper.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    touchDisabledRef.current = window.matchMedia?.("(pointer: coarse)").matches ?? false;

    const observer = new ResizeObserver(resize);
    observer.observe(wrapper);
    resize();

    const visibilityObserver = new IntersectionObserver(([entry]) => {
      visibleRef.current = Boolean(entry?.isIntersecting);
      if (visibleRef.current && rafRef.current === null) {
        rafRef.current = requestAnimationFrame(draw);
      }
    }, { threshold: 0.12 });
    visibilityObserver.observe(wrapper);

    function project(node: NeuralNode, time: number) {
      const rx = rotationRef.current.x + Math.sin(time * 0.00035 + node.z) * 0.04;
      const ry = rotationRef.current.y + (reducedMotion ? 0 : time * 0.00009);
      const cosY = Math.cos(ry);
      const sinY = Math.sin(ry);
      const cosX = Math.cos(rx);
      const sinX = Math.sin(rx);
      const x1 = node.x * cosY - node.z * sinY;
      const z1 = node.x * sinY + node.z * cosY;
      const y1 = node.y * cosX - z1 * sinX;
      const z2 = node.y * sinX + z1 * cosX;
      const scale = Math.min(width, height) * 0.124;
      const perspective = 1 / (1 + (z2 + 2.4) * 0.16);
      return {
        key: node.key,
        x: width / 2 + x1 * scale * perspective,
        y: height / 2 + y1 * scale * perspective,
        z: z2,
        size: (node.kind === "core" ? 48 : 31) * perspective,
      };
    }

    function draw(time = 0) {
      if (!visibleRef.current) {
        rafRef.current = null;
        return;
      }
      if (!dragRef.current.active && !lowPowerMode) {
        rotationRef.current.y += velocityRef.current.x;
        rotationRef.current.x += velocityRef.current.y;
        velocityRef.current.x *= 0.955;
        velocityRef.current.y *= 0.94;
        if (Math.abs(velocityRef.current.x) < 0.00025) velocityRef.current.x = 0.00032;
        if (Math.abs(velocityRef.current.y) < 0.00018) velocityRef.current.y = Math.sin(time * 0.0004) * 0.00018;
      }
      ctx.clearRect(0, 0, width, height);

      const bg = ctx.createRadialGradient(width * 0.55, height * 0.48, 20, width * 0.55, height * 0.48, Math.max(width, height) * 0.72);
      bg.addColorStop(0, "rgba(212,175,55,0.22)");
      bg.addColorStop(0.32, "rgba(255,255,255,0.05)");
      bg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      projected = translatedNodes.map((node) => project(node, time)).sort((a, b) => a.z - b.z);

      ctx.save();
      ctx.globalAlpha = 0.26;
      for (let i = 0; i < 12; i += 1) {
        const y = (height * 0.16) + i * (height * 0.062);
        ctx.strokeStyle = "rgba(255,255,255,0.055)";
        ctx.beginPath();
        ctx.moveTo(width * 0.12, y);
        ctx.bezierCurveTo(width * 0.3, y - 18, width * 0.7, y + 18, width * 0.9, y);
        ctx.stroke();
      }
      ctx.restore();

      for (const [from, to] of connections) {
        const a = projected.find((item) => item.key === translatedNodes[from].key);
        const b = projected.find((item) => item.key === translatedNodes[to].key);
        if (!a || !b) continue;
        const pulse = (Math.sin(time * 0.002 + from) + 1) / 2;
        ctx.strokeStyle = `rgba(245,240,232,${0.1 + pulse * 0.16})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();

        const bx = a.x + (b.x - a.x) * ((time * 0.00024 + from * 0.12) % 1);
        const by = a.y + (b.y - a.y) * ((time * 0.00024 + from * 0.12) % 1);
        ctx.fillStyle = "rgba(212,175,55,0.85)";
        ctx.beginPath();
        ctx.arc(bx, by, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const item of projected) {
        const source = translatedNodes.find((node) => node.key === item.key);
        if (!source) continue;
        const isActive = item.key === activeNodeRef.current;
        ctx.shadowBlur = isActive ? 28 : 14;
        ctx.shadowColor = isActive ? "rgba(212,175,55,0.58)" : "rgba(245,240,232,0.2)";
        drawApparelNode(ctx, source.kind, item.x, item.y, item.size, isActive ? 0.98 : 0.56);
        ctx.shadowBlur = 0;
        ctx.fillStyle = isActive ? "rgba(212,175,55,0.95)" : "rgba(245,240,232,0.55)";
        ctx.beginPath();
        ctx.arc(item.x, item.y, Math.max(2.5, item.size * 0.08), 0, Math.PI * 2);
        ctx.fill();
      }

      rafRef.current = lowPowerMode ? null : requestAnimationFrame(draw);
    }

    const pointerDown = (event: PointerEvent) => {
      if (touchDisabledRef.current || event.pointerType === "touch") return;
      dragRef.current = { active: true, x: event.clientX, y: event.clientY };
      canvas.setPointerCapture(event.pointerId);
    };

    const pointerMove = (event: PointerEvent) => {
      if (touchDisabledRef.current || event.pointerType === "touch" || !dragRef.current.active) return;
      const dx = event.clientX - dragRef.current.x;
      const dy = event.clientY - dragRef.current.y;
      dragRef.current.x = event.clientX;
      dragRef.current.y = event.clientY;
      const nextY = dx * 0.008;
      const nextX = dy * 0.006;
      rotationRef.current.y += nextY;
      rotationRef.current.x += nextX;
      velocityRef.current.x = nextY * 0.42;
      velocityRef.current.y = nextX * 0.36;
      if (rafRef.current === null) rafRef.current = requestAnimationFrame(draw);
    };

    const pointerUp = (event: PointerEvent) => {
      if (touchDisabledRef.current || event.pointerType === "touch") return;
      dragRef.current.active = false;
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch (ignoredError) { void ignoredError; }
      const rect = canvas.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      const nearest = projected
        .map((item) => ({ item, distance: Math.hypot(item.x - px, item.y - py) }))
        .sort((a, b) => a.distance - b.distance)[0];
      if (nearest && nearest.distance < Math.max(52, nearest.item.size * 1.2)) {
        setActiveNode(nearest.item.key);
      }
    };

    if (lowPowerMode) {
      visibleRef.current = true;
      rafRef.current = requestAnimationFrame(draw);
    } else {
      rafRef.current = requestAnimationFrame(draw);
    }

    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("pointermove", pointerMove);
    canvas.addEventListener("pointerup", pointerUp);
    canvas.addEventListener("pointercancel", pointerUp);

    return () => {
      observer.disconnect();
      visibilityObserver.disconnect();
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointercancel", pointerUp);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [reducedMotion, translatedNodes]);

  const active = translatedNodes.find((node) => node.key === activeNode) ?? translatedNodes[0];

  return (
    <div className="mx-auto min-w-0 w-full max-w-[520px] space-y-3 overflow-visible md:max-w-[720px] lg:max-w-[820px]">
      <div
        ref={wrapperRef}
        className="home-neural-visual mobile-scroll-safe-canvas relative mx-auto aspect-square w-full max-w-full overflow-hidden rounded-[2rem] border border-white/[0.10] bg-[#050505] md:aspect-[4/3] md:h-auto"
      >
        <PremiumAmbientGlobe className="home-neural-visual__globe" tone="gold" />
        <canvas
          ref={canvasRef}
          aria-label={t("aria")}
          className="absolute inset-0 h-full w-full touch-pan-y pointer-events-none md:pointer-events-auto md:touch-none md:cursor-grab md:active:cursor-grabbing"
        />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.045),transparent_32%,rgba(212,175,55,0.06))]" />
        <div className="pointer-events-none absolute inset-x-8 bottom-8 h-px bg-gradient-to-r from-transparent via-[#d4af37]/[0.60] to-transparent" />
      </div>
      <motion.div
        key={active.key}
        initial={reducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto w-full max-w-[36rem] rounded-2xl border border-white/[0.10] bg-[#1A1A1C]/[0.88] p-4 text-center shadow-2xl shadow-black/[0.30] md:p-4 lg:text-left"
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#d4af37]">{active.title}</p>
        <p className="mt-2 text-[11px] leading-5 text-white/[0.50]">{active.body}</p>
      </motion.div>
    </div>
  );
}
