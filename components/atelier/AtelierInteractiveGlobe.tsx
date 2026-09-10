"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";

type AtelierFacility = {
  id: string;
  city: string;
  region: string;
  title: string;
  note: string;
  lat: number;
  lon: number;
  precision: "exact" | "country" | "routing";
};

type Props = {
  facilities: AtelierFacility[];
};

type LandShape = {
  lat: number;
  lon: number;
  latRadius: number;
  lonRadius: number;
  tilt?: number;
  weight?: number;
};

type LandDot = {
  lat: number;
  lon: number;
  weight: number;
};

type ProjectedDot = {
  key: string;
  x: number;
  y: number;
  z: number;
  alpha: number;
  r: number;
};

type ProjectedFacility = {
  facility: AtelierFacility;
  x: number;
  y: number;
  z: number;
  alpha: number;
  r: number;
};

const DEG = Math.PI / 180;

const LAND_SHAPES: LandShape[] = [
  { lat: 52, lon: -106, latRadius: 24, lonRadius: 43, tilt: -12, weight: 1 },
  { lat: 36, lon: -96, latRadius: 16, lonRadius: 30, tilt: 4, weight: 0.96 },
  { lat: 22, lon: -103, latRadius: 11, lonRadius: 16, tilt: -10, weight: 0.84 },
  { lat: 13, lon: -82, latRadius: 8, lonRadius: 20, tilt: 0, weight: 0.72 },
  { lat: -15, lon: -60, latRadius: 30, lonRadius: 23, tilt: -20, weight: 1 },
  { lat: -43, lon: -70, latRadius: 18, lonRadius: 9, tilt: -8, weight: 0.76 },
  { lat: 73, lon: -42, latRadius: 9, lonRadius: 19, tilt: 10, weight: 0.62 },
  { lat: 54, lon: -3, latRadius: 7, lonRadius: 7, tilt: 0, weight: 0.76 },
  { lat: 50, lon: 14, latRadius: 12, lonRadius: 22, tilt: 8, weight: 0.94 },
  { lat: 61, lon: 25, latRadius: 10, lonRadius: 20, tilt: 2, weight: 0.72 },
  { lat: 23, lon: 19, latRadius: 35, lonRadius: 29, tilt: -5, weight: 1 },
  { lat: -25, lon: 24, latRadius: 22, lonRadius: 18, tilt: 4, weight: 0.92 },
  { lat: 46, lon: 72, latRadius: 24, lonRadius: 60, tilt: 4, weight: 1 },
  { lat: 32, lon: 104, latRadius: 20, lonRadius: 35, tilt: -8, weight: 1 },
  { lat: 22, lon: 78, latRadius: 14, lonRadius: 16, tilt: -10, weight: 0.86 },
  { lat: 11, lon: 105, latRadius: 10, lonRadius: 16, tilt: 12, weight: 0.74 },
  { lat: 37, lon: 138, latRadius: 8, lonRadius: 6, tilt: 18, weight: 0.7 },
  { lat: -25, lon: 134, latRadius: 15, lonRadius: 28, tilt: 8, weight: 0.94 },
  { lat: -42, lon: 173, latRadius: 8, lonRadius: 7, tilt: 15, weight: 0.54 },
];

function seededNoise(lat: number, lon: number) {
  const value = Math.sin((lat * 12.9898 + lon * 78.233) * DEG) * 43758.5453;
  return value - Math.floor(value);
}

function shapeValue(lat: number, lon: number, shape: LandShape) {
  const tilt = (shape.tilt ?? 0) * DEG;
  const dLat = lat - shape.lat;
  const dLon = (lon - shape.lon) * Math.cos(Math.max(-70, Math.min(70, shape.lat)) * DEG);
  const rx = dLon * Math.cos(tilt) - dLat * Math.sin(tilt);
  const ry = dLon * Math.sin(tilt) + dLat * Math.cos(tilt);
  const value = (rx * rx) / (shape.lonRadius * shape.lonRadius) + (ry * ry) / (shape.latRadius * shape.latRadius);
  if (value > 1) return 0;
  return (1 - value) * (shape.weight ?? 1);
}

function isLand(lat: number, lon: number) {
  let value = 0;
  for (const shape of LAND_SHAPES) value = Math.max(value, shapeValue(lat, lon, shape));

  const carveNorthAtlantic = lat > 45 && lat < 68 && lon > -45 && lon < -8;
  const carveMediterranean = lat > 31 && lat < 39 && lon > -5 && lon < 34;
  const carveIndianOcean = lat > -18 && lat < 18 && lon > 52 && lon < 92;
  const carvePacificGap = lat > -10 && lat < 28 && lon > 145 && lon < 179;
  const carveAmazonEdge = lat < 2 && lat > -22 && lon > -82 && lon < -73;
  if (carveNorthAtlantic || carveMediterranean || carveIndianOcean || carvePacificGap || carveAmazonEdge) value *= 0.16;

  const noise = seededNoise(lat, lon);
  return value > 0.1 + noise * 0.13 ? Math.min(1, 0.48 + value) : 0;
}

function buildLandDots() {
  const dots: LandDot[] = [];
  for (let lat = -58; lat <= 80; lat += 2.65) {
    const rowOffset = Math.abs(Math.round(lat * 10)) % 2 ? 1.32 : 0;
    for (let lon = -178; lon <= 178; lon += 2.65) {
      const weight = isLand(lat, lon + rowOffset);
      if (weight > 0) dots.push({ lat, lon: lon + rowOffset, weight });
    }
  }
  return dots;
}

const LAND_DOTS = buildLandDots();

function project(lat: number, lon: number, yaw: number, pitch: number) {
  const phi = lat * DEG;
  const lambda = lon * DEG + yaw;

  const x = Math.cos(phi) * Math.sin(lambda);
  const y = Math.sin(phi);
  const z = Math.cos(phi) * Math.cos(lambda);

  const y2 = y * Math.cos(pitch) - z * Math.sin(pitch);
  const z2 = y * Math.sin(pitch) + z * Math.cos(pitch);

  return { x, y: y2, z: z2 };
}

export default function AtelierInteractiveGlobe({ facilities }: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ active: boolean; x: number; yaw: number; pitch: number }>({
    active: false,
    x: 0,
    yaw: -0.85,
    pitch: -0.13,
  });
  const [yaw, setYaw] = useState(-0.85);
  const pitch = -0.13;
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const delta = Math.min(32, now - last);
      last = now;

      if (!dragRef.current.active) {
        setYaw((value) => value + delta * 0.000021);
      }

      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const landDots = useMemo<ProjectedDot[]>(() => {
    return LAND_DOTS.map((dot, index) => {
      const p = project(dot.lat, dot.lon, yaw, pitch);
      const front = Math.max(0, p.z);
      return {
        key: `${index}`,
        x: 500 + p.x * 405,
        y: 500 - p.y * 405,
        z: p.z,
        alpha: Math.max(0.06, Math.min(0.82, 0.11 + front * 0.56)) * dot.weight,
        r: 1.2 + front * 1.35,
      };
    })
      .filter((dot) => dot.z > -0.22)
      .sort((a, b) => a.z - b.z);
  }, [yaw, pitch]);

  const projectedFacilities = useMemo<ProjectedFacility[]>(() => {
    return facilities
      .map((facility) => {
        const p = project(facility.lat, facility.lon, yaw, pitch);
        const front = Math.max(0, p.z);
        return {
          facility,
          x: 500 + p.x * 405,
          y: 500 - p.y * 405,
          z: p.z,
          alpha: Math.max(0.18, Math.min(1, 0.24 + p.z)),
          r: 8 + front * 5,
        };
      })
      .sort((a, b) => a.z - b.z);
  }, [facilities, yaw, pitch]);

  const activeFacility = projectedFacilities.find((point) => point.facility.id === activeId && point.z > -0.1);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    dragRef.current = { active: true, x: event.clientX, yaw, pitch };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    const nextYaw = dragRef.current.yaw + (event.clientX - dragRef.current.x) * 0.006;
    setYaw(nextYaw);
  };

  const releasePointer = (event: PointerEvent<HTMLDivElement>) => {
    dragRef.current.active = false;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch (ignoredError) { void ignoredError; }
  };

  return (
    <div
      ref={wrapRef}
      role="img"
      aria-label="Interactive Velmère atelier globe"
      className="relative h-full w-full overflow-hidden rounded-[1.55rem] border border-velmere-gold/[0.18] bg-[radial-gradient(circle_at_70%_20%,rgba(214,183,122,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.022),rgba(255,255,255,0.004))] shadow-[0_36px_130px_rgba(0,0,0,0.38)]"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={releasePointer}
      onPointerCancel={releasePointer}
      onPointerLeave={(event) => {
        if (dragRef.current.active) releasePointer(event);
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_56%_52%,rgba(214,183,122,0.12),transparent_31%),radial-gradient(circle_at_100%_50%,rgba(214,183,122,0.15),transparent_34%)]" />
      <div className="pointer-events-none absolute right-[-8%] top-[-9%] h-[118%] w-[58%] rounded-full border border-velmere-gold/[0.06]" />
      <div className="pointer-events-none absolute right-[-12%] top-[-17%] h-[136%] w-[70%] rounded-full border border-velmere-gold/[0.035]" />

      <svg viewBox="0 0 1000 1000" className="absolute left-1/2 top-1/2 h-[94%] max-h-[38rem] w-auto -translate-x-[38%] -translate-y-1/2 overflow-visible xl:h-[97%]">
        <defs>
          <radialGradient id="velmere-globe-core" cx="36%" cy="28%" r="73%">
            <stop offset="0%" stopColor="rgba(39,32,20,0.98)" />
            <stop offset="48%" stopColor="rgba(10,10,10,0.98)" />
            <stop offset="100%" stopColor="rgba(2,3,3,1)" />
          </radialGradient>
          <radialGradient id="velmere-node-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,242,203,0.95)" />
            <stop offset="42%" stopColor="rgba(220,190,126,0.28)" />
            <stop offset="100%" stopColor="rgba(220,190,126,0)" />
          </radialGradient>
          <linearGradient id="velmere-globe-shadow" x1="0%" x2="100%" y1="50%" y2="50%">
            <stop offset="0%" stopColor="rgba(0,0,0,0.46)" />
            <stop offset="32%" stopColor="rgba(0,0,0,0.16)" />
            <stop offset="76%" stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.045)" />
          </linearGradient>
          <clipPath id="velmere-globe-clip">
            <circle cx="500" cy="500" r="405" />
          </clipPath>
          <filter id="velmere-soft-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="9" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0.92  0 1 0 0 0.74  0 0 1 0 0.38  0 0 0 0.55 0"
              result="gold"
            />
            <feMerge>
              <feMergeNode in="gold" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <circle cx="500" cy="500" r="458" fill="rgba(214,183,122,0.035)" />
        <circle cx="500" cy="500" r="430" fill="none" stroke="rgba(214,183,122,0.075)" strokeWidth="1" />
        <circle cx="500" cy="500" r="405" fill="url(#velmere-globe-core)" stroke="rgba(214,183,122,0.24)" strokeWidth="2" />

        <g clipPath="url(#velmere-globe-clip)">
          <g opacity="0.18" stroke="rgba(214,183,122,0.42)" strokeWidth="1.2" fill="none">
            <ellipse cx="500" cy="500" rx="405" ry="78" />
            <ellipse cx="500" cy="500" rx="405" ry="186" />
            <ellipse cx="500" cy="500" rx="405" ry="295" />
            <ellipse cx="500" cy="500" rx="92" ry="405" />
            <ellipse cx="500" cy="500" rx="210" ry="405" />
            <ellipse cx="500" cy="500" rx="330" ry="405" />
          </g>

          <g>
            {landDots.map((dot) => (
              <circle
                key={dot.key}
                cx={dot.x}
                cy={dot.y}
                r={dot.r}
                fill="rgb(219,188,125)"
                opacity={dot.alpha}
              />
            ))}
          </g>

          <rect x="95" y="95" width="810" height="810" fill="url(#velmere-globe-shadow)" />
        </g>

        <circle cx="500" cy="500" r="407" fill="none" stroke="rgba(255,239,200,0.10)" strokeWidth="5" />
        <circle cx="500" cy="500" r="405" fill="none" stroke="rgba(214,183,122,0.26)" strokeWidth="1.2" />

        <g>
          {projectedFacilities.map((point) => {
            const active = point.facility.id === activeId;
            const visible = point.z > -0.16;
            if (!visible) return null;
            return (
              <g
                key={point.facility.id}
                transform={`translate(${point.x} ${point.y})`}
                opacity={point.z < 0 ? 0.36 : point.alpha}
                className="cursor-pointer"
                onMouseEnter={() => setActiveId(point.facility.id)}
                onMouseLeave={() => setActiveId(null)}
              >
                <circle r={active ? point.r * 4.7 : point.r * 3.5} fill="url(#velmere-node-glow)" opacity={active ? 0.95 : 0.66} />
                <circle r={active ? point.r * 2.25 : point.r * 1.72} fill="none" stroke="rgba(244,223,173,0.28)" strokeWidth="1" />
                <circle r={active ? point.r * 0.82 : point.r * 0.56} fill="rgba(255,239,198,0.96)" filter="url(#velmere-soft-glow)" />
              </g>
            );
          })}
        </g>

        {activeFacility ? (
          <g transform={`translate(${Math.min(760, Math.max(150, activeFacility.x + 22))} ${Math.max(120, activeFacility.y - 46)})`}>
            <rect x="0" y="0" width="230" height="58" rx="14" fill="rgba(3,4,5,0.88)" stroke="rgba(214,183,122,0.28)" />
            <text x="16" y="21" fill="rgba(214,183,122,0.92)" fontSize="11" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontWeight="700" letterSpacing="2">
              {activeFacility.facility.region.toUpperCase()}
            </text>
            <text x="16" y="42" fill="rgba(255,255,255,0.94)" fontSize="17" fontFamily="Inter, Arial, sans-serif" fontWeight="500">
              {activeFacility.facility.city}
            </text>
          </g>
        ) : null}
      </svg>

      <div className="pointer-events-none absolute bottom-4 right-4 rounded-full border border-velmere-gold/[0.18] bg-black/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-white/[0.58] backdrop-blur-md">
        Drag to rotate · slow orbit
      </div>
    </div>
  );
}
