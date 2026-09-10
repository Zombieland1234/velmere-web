"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Info, AlertTriangle, XCircle } from "lucide-react";

export type RadarDimension = {
  key: string;
  label: string;
  score: number; // 0 - 100
  note?: string;
};

type VelmereAssuranceRadarProps = {
  dimensions: RadarDimension[];
  overallScore: number;
  tierLabel?: string;
  verifiedCount?: number;
  monitoredCount?: number;
  warningCount?: number;
  criticalCount?: number;
  isTraditional?: boolean;
};

export default function VelmereAssuranceRadar({
  dimensions,
  overallScore,
  tierLabel = "AAA",
  verifiedCount = 21,
  monitoredCount = 2,
  warningCount = 0,
  criticalCount = 0,
  isTraditional = false,
}: VelmereAssuranceRadarProps) {
  const [hoveredDimension, setHoveredDimension] = useState<RadarDimension | null>(null);

  // SVG Geometry Constants
  const size = 320;
  const center = size / 2;
  const radius = 100;
  const levels = [0.2, 0.4, 0.6, 0.8, 1.0];
  const totalAxes = dimensions.length || 6;
  const angleStep = (Math.PI * 2) / totalAxes;
  const angleOffset = -Math.PI / 2; // Start from top (12 o'clock)

  // Compute guideline rings
  const gridPolygons = useMemo(() => {
    return levels.map((lvl) => {
      const r = radius * lvl;
      const points = Array.from({ length: totalAxes }).map((_, i) => {
        const angle = angleOffset + i * angleStep;
        const x = center + r * Math.cos(angle);
        const y = center + r * Math.sin(angle);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      });
      return points.join(" ");
    });
  }, [totalAxes, angleOffset, angleStep, center, radius]);

  // Compute radial axis lines
  const axisLines = useMemo(() => {
    return dimensions.map((dim, i) => {
      const angle = angleOffset + i * angleStep;
      const x2 = center + radius * Math.cos(angle);
      const y2 = center + radius * Math.sin(angle);
      // Position label slightly outside the radius
      const labelDistance = radius + 28;
      const lx = center + labelDistance * Math.cos(angle);
      const ly = center + labelDistance * Math.sin(angle);
      return {
        key: dim.key,
        x1: center,
        y1: center,
        x2,
        y2,
        lx,
        ly,
        angle,
        dim,
      };
    });
  }, [dimensions, angleOffset, angleStep, center, radius]);

  // Compute data polygon points and vertex markers
  const { dataPolygonPoints, vertexPoints } = useMemo(() => {
    const vPts: { x: number; y: number; dim: RadarDimension }[] = [];
    const pts = dimensions.map((dim, i) => {
      const normScore = Math.max(10, Math.min(100, dim.score)) / 100;
      const r = radius * normScore;
      const angle = angleOffset + i * angleStep;
      const x = center + r * Math.cos(angle);
      const y = center + r * Math.sin(angle);
      vPts.push({ x, y, dim });
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return { dataPolygonPoints: pts.join(" "), vertexPoints: vPts };
  }, [dimensions, angleOffset, angleStep, center, radius]);

  return (
    <div className="relative rounded-2xl border border-white/10 bg-[#09090c] p-5 shadow-2xl overflow-hidden">
      {/* Background radial ambient glow */}
      <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-emerald-500/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 h-48 w-48 rounded-full bg-[#d4af37]/5 blur-3xl pointer-events-none" />

      {/* Header with Title and Big Score */}
      <div className="flex items-center justify-between pb-3 border-b border-white/5">
        <div>
          <span className="text-[10px] font-mono tracking-widest text-white/40 uppercase block">
            {isTraditional ? "Institutional Assurance Score" : "Velmère Sentinel Score"}
          </span>
          <span className="text-xs font-semibold text-white/80">Multi-Axial Security Posture</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-2xl font-bold tracking-tight text-emerald-400">
            {overallScore.toFixed(1)}
          </span>
          <span className="rounded bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-400">
            {tierLabel}
          </span>
        </div>
      </div>

      {/* Spider Radar SVG Container */}
      <div className="relative flex items-center justify-center my-2">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="w-full max-w-[290px] h-auto select-none"
          aria-label="Assurance Radar Chart"
        >
          <defs>
            {/* Hexagonal fill gradient */}
            <radialGradient id="radarFillGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
              <stop offset="80%" stopColor="#10b981" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#d4af37" stopOpacity="0.05" />
            </radialGradient>
            <filter id="radarGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Concentric Grid Polygons */}
          {gridPolygons.map((pts, idx) => (
            <polygon
              key={idx}
              points={pts}
              fill="none"
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth={idx === gridPolygons.length - 1 ? "1.2" : "0.75"}
              strokeDasharray={idx < gridPolygons.length - 1 ? "3 3" : undefined}
            />
          ))}

          {/* Axis Radial Lines */}
          {axisLines.map((axis) => (
            <line
              key={axis.key}
              x1={axis.x1}
              y1={axis.y1}
              x2={axis.x2}
              y2={axis.y2}
              stroke="rgba(255, 255, 255, 0.12)"
              strokeWidth="0.75"
            />
          ))}

          {/* Data Filled Polygon */}
          <polygon
            points={dataPolygonPoints}
            fill="url(#radarFillGrad)"
            stroke="#10b981"
            strokeWidth="1.75"
            strokeLinejoin="round"
            filter="url(#radarGlow)"
            className="transition-all duration-500 ease-out"
          />

          {/* Axis Labels */}
          {axisLines.map((axis) => {
            const isHovered = hoveredDimension?.key === axis.dim.key;
            return (
              <text
                key={axis.key}
                x={axis.lx}
                y={axis.ly}
                textAnchor="middle"
                dominantBaseline="central"
                className={`font-mono text-[9px] transition-all cursor-pointer ${
                  isHovered ? "fill-emerald-300 font-bold" : "fill-white/60 font-medium"
                }`}
                onMouseEnter={() => setHoveredDimension(axis.dim)}
                onMouseLeave={() => setHoveredDimension(null)}
              >
                {axis.dim.label}
              </text>
            );
          })}

          {/* Vertex Marker Points */}
          {vertexPoints.map((v) => {
            const isHovered = hoveredDimension?.key === v.dim.key;
            return (
              <g
                key={v.dim.key}
                className="cursor-pointer transition-transform"
                onMouseEnter={() => setHoveredDimension(v.dim)}
                onMouseLeave={() => setHoveredDimension(null)}
              >
                <circle
                  cx={v.x}
                  cy={v.y}
                  r={isHovered ? 5.5 : 3.5}
                  fill={isHovered ? "#d4af37" : "#10b981"}
                  stroke="#050507"
                  strokeWidth="1.5"
                />
              </g>
            );
          })}
        </svg>

        {/* Dynamic Tooltip on Hover */}
        {hoveredDimension && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 rounded-lg border border-emerald-500/30 bg-[#0c0c12]/95 px-2.5 py-1 text-center shadow-xl backdrop-blur pointer-events-none z-10">
            <span className="block font-mono text-[10px] text-white/50">{hoveredDimension.label}</span>
            <span className="font-mono text-xs font-bold text-emerald-400">
              {hoveredDimension.score}/100
            </span>
            {hoveredDimension.note && (
              <span className="block text-[9px] text-white/40">{hoveredDimension.note}</span>
            )}
          </div>
        )}
      </div>

      {/* Status Pill Metrics Row */}
      <div className="mt-2 grid grid-cols-4 gap-1.5 pt-3 border-t border-white/5">
        <div className="flex flex-col items-center justify-center rounded-lg bg-emerald-500/5 border border-emerald-500/15 py-1.5 px-1">
          <div className="flex items-center gap-1 text-emerald-400">
            <CheckCircle2 className="h-3 w-3" />
            <span className="font-mono text-xs font-bold">{verifiedCount}</span>
          </div>
          <span className="text-[8px] font-mono tracking-wider text-emerald-400/70 uppercase">Verified</span>
        </div>

        <div className="flex flex-col items-center justify-center rounded-lg bg-sky-500/5 border border-sky-500/15 py-1.5 px-1">
          <div className="flex items-center gap-1 text-sky-400">
            <Info className="h-3 w-3" />
            <span className="font-mono text-xs font-bold">{monitoredCount}</span>
          </div>
          <span className="text-[8px] font-mono tracking-wider text-sky-400/70 uppercase">Monitored</span>
        </div>

        <div className="flex flex-col items-center justify-center rounded-lg bg-amber-500/5 border border-amber-500/15 py-1.5 px-1">
          <div className="flex items-center gap-1 text-amber-400">
            <AlertTriangle className="h-3 w-3" />
            <span className="font-mono text-xs font-bold">{warningCount}</span>
          </div>
          <span className="text-[8px] font-mono tracking-wider text-amber-400/70 uppercase">Warning</span>
        </div>

        <div className="flex flex-col items-center justify-center rounded-lg bg-rose-500/5 border border-rose-500/15 py-1.5 px-1">
          <div className="flex items-center gap-1 text-rose-400">
            <XCircle className="h-3 w-3" />
            <span className="font-mono text-xs font-bold">{criticalCount}</span>
          </div>
          <span className="text-[8px] font-mono tracking-wider text-rose-400/70 uppercase">Critical</span>
        </div>
      </div>
    </div>
  );
}
