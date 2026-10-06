import React from "react";

export function PersonaAvatar({ type, title }) {
  const palette = {
    planning: { shirt: "#2f9fbd", hair: "#173b41", accent: "#d99a24", skin: "#f1c19d" },
    production: { shirt: "#187565", hair: "#102b32", accent: "#d99a24", skin: "#d99f78" },
    finance: { shirt: "#9d5b3f", hair: "#3f2b24", accent: "#2f9fbd", skin: "#e7b58e" },
    operations: { shirt: "#173b41", hair: "#6f4937", accent: "#187565", skin: "#c98d68" },
  }[type];

  return (
    <svg className="persona-avatar" viewBox="0 0 160 160" role="img" aria-label={title}>
      <rect className="avatar-card-bg" x="8" y="8" width="144" height="144" rx="22" />
      <circle cx="80" cy="68" r="34" fill={palette.skin} />
      <path d="M47 66c4-26 19-40 43-38 19 2 31 14 33 36-15-7-32-9-48-6-11 2-20 5-28 8Z" fill={palette.hair} />
      <circle cx="68" cy="72" r="4" fill="#102b32" />
      <circle cx="92" cy="72" r="4" fill="#102b32" />
      <path d="M70 88c7 6 15 6 22 0" fill="none" stroke="#102b32" strokeLinecap="round" strokeWidth="4" />
      <path d="M42 137c4-24 19-36 38-36s34 12 38 36H42Z" fill={palette.shirt} />
      {type === "planning" && (
        <>
          <circle cx="40" cy="116" r="14" fill="#f1c19d" />
          <circle cx="120" cy="116" r="14" fill="#d99f78" />
          <path d="M26 140c2-12 8-18 14-18s12 6 14 18H26Z" fill="#173b41" />
          <path d="M106 140c2-12 8-18 14-18s12 6 14 18h-28Z" fill="#d99a24" />
          <path
            d="M112 36h22v18h-22zM117 44h12"
            fill="none"
            stroke={palette.accent}
            strokeLinecap="round"
            strokeWidth="4"
          />
        </>
      )}
      {type === "production" && (
        <>
          <path d="M46 54c5-21 17-31 34-31s29 10 34 31H46Z" fill={palette.accent} />
          <path d="M45 55h70" stroke="#102b32" strokeLinecap="round" strokeWidth="5" />
          <path
            d="M116 106h20v28h-20zM122 112h8M122 121h8M122 130h8"
            fill="none"
            stroke="#102b32"
            strokeLinecap="round"
            strokeWidth="4"
          />
        </>
      )}
      {type === "finance" && (
        <>
          <rect x="108" y="98" width="30" height="38" rx="6" fill="#f9faf6" stroke="#102b32" strokeWidth="4" />
          <path
            d="M115 108h16M116 119h4M124 119h4M132 119h1M116 128h4M124 128h4M132 128h1"
            stroke={palette.accent}
            strokeLinecap="round"
            strokeWidth="3"
          />
          <path d="M50 44c10-16 31-19 48-6" fill="none" stroke={palette.hair} strokeLinecap="round" strokeWidth="10" />
        </>
      )}
      {type === "operations" && (
        <>
          <path
            d="M47 73c0-23 14-42 33-42s33 19 33 42"
            fill="none"
            stroke={palette.accent}
            strokeLinecap="round"
            strokeWidth="7"
          />
          <rect x="39" y="68" width="12" height="22" rx="5" fill="#102b32" />
          <rect x="109" y="68" width="12" height="22" rx="5" fill="#102b32" />
          <path d="M116 91c-4 15-13 22-27 22" fill="none" stroke="#102b32" strokeLinecap="round" strokeWidth="4" />
          <circle cx="87" cy="113" r="4" fill="#102b32" />
        </>
      )}
    </svg>
  );
}
