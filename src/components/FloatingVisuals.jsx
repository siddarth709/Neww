import React from "react";

export function FloatingVisuals({ variant = "dashboard" }) {
  return (
    <div className={`floating-visuals floating-${variant}`} aria-hidden="true">
      <svg className="float-svg float-orbit" viewBox="0 0 180 180" fill="none">
        <circle cx="90" cy="90" r="57" stroke="currentColor" strokeOpacity=".35" strokeDasharray="3 8" />
        <circle cx="90" cy="90" r="31" stroke="currentColor" strokeOpacity=".22" />
        <circle cx="90" cy="33" r="5" fill="currentColor" />
        <circle cx="144" cy="110" r="4" fill="currentColor" opacity=".65" />
        <circle cx="39" cy="122" r="3" fill="currentColor" opacity=".5" />
      </svg>
      <svg className="float-svg float-network" viewBox="0 0 240 160" fill="none">
        <path d="M22 111 77 54 132 103 194 42 220 72" stroke="currentColor" strokeOpacity=".34" strokeWidth="1.2" />
        <path d="M77 54 102 128M132 103 194 42M132 103 220 72" stroke="currentColor" strokeOpacity=".18" />
        <circle cx="22" cy="111" r="5" fill="currentColor" opacity=".7" />
        <circle cx="77" cy="54" r="6" fill="currentColor" opacity=".9" />
        <circle cx="132" cy="103" r="5" fill="currentColor" opacity=".75" />
        <circle cx="194" cy="42" r="6" fill="currentColor" opacity=".9" />
        <circle cx="220" cy="72" r="4" fill="currentColor" opacity=".65" />
        <circle cx="102" cy="128" r="3" fill="currentColor" opacity=".45" />
      </svg>
      <svg className="float-svg float-cube" viewBox="0 0 90 90" fill="none">
        <path d="m45 8 29 16v34L45 75 16 58V24L45 8Z" stroke="currentColor" strokeOpacity=".5" />
        <path d="m16 24 29 17 29-17M45 41v34" stroke="currentColor" strokeOpacity=".35" />
      </svg>
      <svg className="float-svg float-shield" viewBox="0 0 100 120" fill="none">
        <path d="M50 7 85 20v31c0 25-14 43-35 56C29 94 15 76 15 51V20L50 7Z" stroke="currentColor" strokeWidth="2" strokeOpacity=".4" />
        <path d="m32 58 11 11 24-26" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="float-particle p1" /><div className="float-particle p2" /><div className="float-particle p3" />
    </div>
  );
}

export function AssuranceIllustration() {
  return (
    <div className="assurance-illustration" aria-hidden="true">
      <svg viewBox="0 0 620 300" fill="none">
        <defs>
          <linearGradient id="assureStroke" x1="80" y1="60" x2="520" y2="250" gradientUnits="userSpaceOnUse">
            <stop stopColor="currentColor" stopOpacity=".2" /><stop offset=".5" stopColor="#35d6a0" stopOpacity=".85" /><stop offset="1" stopColor="#7c6cff" stopOpacity=".5" />
          </linearGradient>
        </defs>
        <path d="M24 215C92 155 119 238 181 171s98-63 148-10 102 34 137-25 67-53 130-83" stroke="url(#assureStroke)" strokeWidth="2" />
        <path d="M24 239C91 177 126 260 184 196s91-58 143-12 105 31 139-27 67-50 130-76" stroke="currentColor" strokeOpacity=".12" />
        <g stroke="currentColor" strokeOpacity=".45">
          <rect x="76" y="93" width="42" height="42" rx="8"/><rect x="281" y="112" width="42" height="42" rx="8"/><rect x="474" y="50" width="42" height="42" rx="8"/>
        </g>
        <g fill="currentColor">
          <circle cx="97" cy="114" r="4"/><circle cx="302" cy="133" r="4"/><circle cx="495" cy="71" r="4"/>
          <circle cx="177" cy="174" r="5"/><circle cx="425" cy="139" r="4"/>
        </g>
        <path d="M323 133 425 139 495 71" stroke="currentColor" strokeOpacity=".22" strokeDasharray="4 6"/>
      </svg>
      <div className="assurance-copy"><span>MODEL PROVENANCE</span><strong>Every artifact leaves evidence.</strong><small>Hash · Verify · Audit</small></div>
    </div>
  );
}
