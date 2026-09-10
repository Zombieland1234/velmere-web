"use client";

import React from "react";

interface VelmereLuxuryShieldProps {
  className?: string;
  size?: number;
  glow?: boolean;
  dimmed?: boolean;
  animated?: boolean;
}

/**
 * 100% Synthetic VELMÈRE Luxury Shield Crest — Variant 3 Cyber-Circuit Edition.
 * Faithfully modeled 1:1 on the canonical shield artwork.
 * Pure mathematical SVG vector geometry & CSS lighting.
 * Zero raster dependencies, zero network requests, zero personal data.
 * Flawless infinite crispness on Retina/4K displays.
 */
export default function VelmereLuxuryShield({
  className = "",
  size = 440,
  glow = true,
  dimmed = true,
  animated = true,
}: VelmereLuxuryShieldProps) {
  return (
    <div
      className={`vlm-luxury-shield-container relative inline-flex items-center justify-center select-none pointer-events-none ${
        dimmed ? "opacity-75" : "opacity-100"
      } ${className}`.trim()}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {/* 1. Atmospheric Deep Sapphire & Cyan Ambient Aura */}
      {glow && (
        <>
          <div
            className="absolute inset-[-10%] rounded-full pointer-events-none"
            style={{
              background:
                "radial-gradient(circle at 50% 50%, rgba(2, 132, 199, 0.22) 0%, rgba(30, 58, 138, 0.12) 45%, transparent 70%)",
              filter: "blur(40px)",
              animation: animated ? "vlmShieldPulse 6s ease-in-out infinite alternate" : "none",
            }}
          />
          <div
            className="absolute bottom-[-5%] w-[60%] h-[30%] rounded-full pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse at 50% 50%, rgba(56, 189, 248, 0.35) 0%, transparent 70%)",
              filter: "blur(25px)",
            }}
          />
        </>
      )}

      {/* 2. Floating Animated Core Wrapper */}
      <div
        className="vlm-shield-core-wrapper relative flex items-center justify-center w-full h-full"
        style={{
          animation: animated ? "vlmShieldFloat 7s ease-in-out infinite alternate" : "none",
        }}
      >
        <svg
          viewBox="0 0 400 400"
          className="vlm-shield-image w-full h-full overflow-visible select-none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Chrome Bevel Gradient for Outer Faceted Rim */}
            <linearGradient id="vlm-v3-tech-rim" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f8fafc" />
              <stop offset="28%" stopColor="#64748b" />
              <stop offset="55%" stopColor="#0f172a" />
              <stop offset="82%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#020617" />
            </linearGradient>

            {/* Micro Cyber-Circuit Pattern for Left Sapphire Plate */}
            <pattern id="vlm-v3-dense-circuits" width="12" height="12" patternUnits="userSpaceOnUse">
              <path
                d="M 12 0 L 0 0 0 12 M 6 6 L 6 12 M 6 6 L 12 6"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="0.6"
                strokeOpacity="0.25"
              />
              <circle cx="6" cy="6" r="1" fill="#38bdf8" fillOpacity="0.45" />
            </pattern>

            {/* Intense Neon Glow Filter */}
            <filter id="vlm-v3-neon-intense" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3" result="blur1" />
              <feGaussianBlur stdDeviation="8" result="blur2" />
              <feMerge>
                <feMergeNode in="blur2" />
                <feMergeNode in="blur1" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Secondary Inner Orbit (Rotating Counter-Pulse Grid) */}
          <ellipse
            cx="200"
            cy="210"
            rx="155"
            ry="55"
            transform="rotate(-28 200 210)"
            fill="none"
            stroke="#0284c7"
            strokeWidth="0.75"
            strokeDasharray="4 8"
            strokeOpacity="0.45"
            className={animated ? "animate-spin" : ""}
            style={{ transformOrigin: "200px 210px", animationDuration: "40s" }}
          />

          {/* Orbit Back Segment (Behind Shield Core) */}
          <path
            d="M 48 250 C 35 208, 80 156, 200 134 C 302 116, 364 135, 368 168"
            fill="none"
            stroke="#0284c7"
            strokeWidth="1.5"
            strokeDasharray="8 4"
            filter="url(#vlm-v3-neon-intense)"
            opacity="0.7"
          />

          {/* Outer Heavy Faceted Chrome Rim */}
          <path
            d="M 200,66 C 162,79 124,96 102,106 C 98,150 96,194 106,236 C 118,284 160,324 200,344 C 240,324 282,284 294,236 C 304,194 302,150 298,106 C 276,96 238,79 200,66 Z"
            fill="url(#vlm-v3-tech-rim)"
            stroke="#38bdf8"
            strokeWidth="1.5"
            strokeOpacity="0.6"
            filter="drop-shadow(0 14px 28px rgba(0,0,0,0.9))"
          />

          {/* Recessed Obsidian Inner Cavity */}
          <path
            d="M 200,78 C 166,90 134,105 116,114 C 112,152 110,190 120,226 C 130,268 166,306 200,324 C 234,306 270,268 280,226 C 290,190 288,152 284,114 C 266,105 234,90 200,78 Z"
            fill="#050811"
          />

          {/* Left Sapphire Face with Cyber-Circuits */}
          <path
            d="M 200,80 L 118,115 C 114,152 113,188 122,224 C 132,264 168,302 200,320 Z"
            fill="url(#vlm-v3-dense-circuits)"
          />

          {/* Center Vertical Split Glowing Line */}
          <line
            x1="200"
            y1="80"
            x2="200"
            y2="320"
            stroke="#38bdf8"
            strokeWidth="1.5"
            filter="url(#vlm-v3-neon-intense)"
          />

          {/* Chiseled Monogram V with Tech Underglow */}
          <g filter="drop-shadow(0 6px 18px rgba(2,132,199,0.7))">
            {/* Serifs */}
            <polygon points="146,160 178,160 172,166 148,166" fill="#f8fafc" />
            <polygon points="222,160 254,160 250,166 226,166" fill="#f8fafc" />
            {/* Left Stem */}
            <polygon points="158,166 174,166 200,248 193,248" fill="#ffffff" />
            <polygon points="174,166 184,166 200,248" fill="#38bdf8" />
            {/* Right Stem */}
            <polygon points="218,166 226,166 200,248" fill="#94a3b8" />
            <polygon points="226,166 242,166 207,248 200,248" fill="#0f172a" />
          </g>

          {/* Primary Orbit Front Swept Arc (In Front of Shield) */}
          <path
            d="M 48 250 C 66 298, 158 298, 258 254 C 318 226, 362 193, 368 168"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2.5"
            filter="url(#vlm-v3-neon-intense)"
          />
          <path
            d="M 48 250 C 66 298, 158 298, 258 254 C 318 226, 362 193, 368 168"
            fill="none"
            stroke="#ffffff"
            strokeWidth="0.9"
          />

          {/* Sparkling Diamond Energy Nodes */}
          <g transform="translate(132, 282)">
            <circle cx="0" cy="0" r="5" fill="#38bdf8" filter="url(#vlm-v3-neon-intense)" />
            <circle cx="0" cy="0" r="2" fill="#ffffff" />
            <line x1="-10" y1="0" x2="10" y2="0" stroke="#ffffff" strokeWidth="1.5" />
            <line x1="0" y1="-10" x2="0" y2="10" stroke="#ffffff" strokeWidth="1.5" />
          </g>
          <g transform="translate(326, 202)">
            <circle cx="0" cy="0" r="4.5" fill="#38bdf8" filter="url(#vlm-v3-neon-intense)" />
            <circle cx="0" cy="0" r="1.8" fill="#ffffff" />
            <line x1="-8" y1="0" x2="8" y2="0" stroke="#ffffff" strokeWidth="1.2" />
            <line x1="0" y1="-8" x2="0" y2="8" stroke="#ffffff" strokeWidth="1.2" />
          </g>

          {/* Intense Quantum Lens Flare Spike at Bottom Tip */}
          <g transform="translate(200, 344)">
            <circle cx="0" cy="0" r="8" fill="#ffffff" filter="url(#vlm-v3-neon-intense)" />
            <line x1="-60" y1="0" x2="60" y2="0" stroke="#ffffff" strokeWidth="2" filter="url(#vlm-v3-neon-intense)" />
            <line x1="0" y1="-15" x2="0" y2="35" stroke="#38bdf8" strokeWidth="3" filter="url(#vlm-v3-neon-intense)" />
          </g>
        </svg>

        {/* Laser Sweep Shine Effect */}
        <div className="vlm-shield-shine-sweep pointer-events-none" />
      </div>
    </div>
  );
}
