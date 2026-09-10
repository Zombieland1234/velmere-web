export default function SecurityAuditHeroArt() {
  return (
    <div className="audit-v4609-hero-art" aria-hidden="true" data-pass35-a35-visual-parity="security-audit-hero-art">
      <svg viewBox="0 0 760 390" role="presentation">
        <defs>
          <linearGradient id="auditGoldStroke" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f0d9a5" />
            <stop offset="0.36" stopColor="#b9822d" />
            <stop offset="0.68" stopColor="#e2bd71" />
            <stop offset="1" stopColor="#9c6a21" />
          </linearGradient>
          <linearGradient id="auditGoldFill" x1="0.1" y1="0" x2="0.9" y2="1">
            <stop offset="0" stopColor="#fffdf9" stopOpacity="0.98" />
            <stop offset="0.52" stopColor="#f8f0df" stopOpacity="0.78" />
            <stop offset="1" stopColor="#ead6aa" stopOpacity="0.42" />
          </linearGradient>
          <filter id="auditSoftShadow" x="-80%" y="-80%" width="260%" height="260%">
            <feDropShadow dx="0" dy="12" stdDeviation="10" floodColor="#8f601d" floodOpacity="0.2" />
          </filter>
        </defs>

        <g className="audit-v4609-wave-lines">
          <path d="M-30 310 C115 214 208 372 352 280 S596 126 820 210" />
          <path d="M-28 320 C118 226 216 382 360 288 S606 138 822 222" />
          <path d="M-22 331 C124 238 226 392 370 297 S616 151 826 235" />
          <path d="M-12 342 C136 252 240 402 384 307 S632 166 830 249" />
          <path d="M4 353 C150 268 256 411 400 318 S646 184 836 266" />
          <path d="M30 364 C172 286 278 418 421 331 S664 205 842 284" />
          <path d="M70 375 C202 307 310 421 449 346 S684 228 850 305" />
          <path d="M105 386 C232 329 342 421 477 362 S704 255 858 329" />
        </g>

        <g className="audit-v4609-orbits">
          <circle cx="482" cy="184" r="146" />
          <circle cx="482" cy="184" r="130" />
          <circle cx="482" cy="184" r="112" />
          <path d="M283 197 C327 82 430 19 547 49 C639 72 695 153 704 228" />
        </g>

        <g className="audit-v4609-speckles">
          <circle cx="301" cy="117" r="1.7" />
          <circle cx="335" cy="78" r="1.1" />
          <circle cx="609" cy="76" r="1.4" />
          <circle cx="657" cy="115" r="1.8" />
          <circle cx="698" cy="161" r="1.1" />
          <circle cx="277" cy="239" r="1.2" />
          <circle cx="634" cy="281" r="1.4" />
          <circle cx="724" cy="246" r="1.6" />
        </g>

        <g className="audit-v4609-shield-mark" filter="url(#auditSoftShadow)">
          <path
            d="M482 91 C519 119 552 130 583 137 V205 C583 264 545 311 482 340 C419 311 381 264 381 205 V137 C412 130 445 119 482 91 Z"
            fill="url(#auditGoldFill)"
            stroke="url(#auditGoldStroke)"
            strokeWidth="7"
          />
          <path
            d="M482 104 C516 129 546 139 570 145 V204 C570 253 539 294 482 322 C425 294 394 253 394 204 V145 C418 139 448 129 482 104 Z"
            fill="none"
            stroke="#f2dfb4"
            strokeOpacity="0.72"
            strokeWidth="2"
          />
          <path
            d="M435 213 L470 248 L535 171"
            fill="none"
            stroke="url(#auditGoldStroke)"
            strokeLinecap="square"
            strokeLinejoin="miter"
            strokeWidth="12"
          />
          <path
            d="M440 210 L470 240 L530 169"
            fill="none"
            stroke="#f4dfb2"
            strokeLinecap="square"
            strokeWidth="3"
            opacity="0.72"
          />
        </g>
      </svg>
    </div>
  );
}
