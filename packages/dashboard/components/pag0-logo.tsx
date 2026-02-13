interface Pag0LogoProps {
  size?: number;
  className?: string;
}

export function Pag0Logo({ size = 18, className }: Pag0LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Dark hexagonal base — main fill */}
      <path
        d="M16 1L3 8.5v15L16 31l13-7.5v-15L16 1z"
        fill="url(#hex-bg)"
      />
      {/* Top-left face highlight (light from above-left) */}
      <path
        d="M16 1L3 8.5v15L16 16z"
        fill="url(#hex-highlight)"
        opacity="0.12"
      />
      {/* Bottom-right face shadow (depth) */}
      <path
        d="M16 31l13-7.5v-15L16 16z"
        fill="#000"
        opacity="0.15"
      />
      {/* Outer border */}
      <path
        d="M16 1L3 8.5v15L16 31l13-7.5v-15L16 1z"
        fill="none"
        stroke="url(#hex-border)"
        strokeWidth="0.8"
      />
      {/* Inner bevel edge */}
      <path
        d="M16 3.5L5.5 9.5v13L16 28.5l10.5-6v-13L16 3.5z"
        fill="none"
        stroke="url(#hex-inner-bevel)"
        strokeWidth="0.4"
      />

      {/* Neural network — outer nodes */}
      <circle cx="7" cy="12" r="1.4" fill="#818cf8" opacity="0.6" />
      <circle cx="25" cy="12" r="1.4" fill="#818cf8" opacity="0.6" />
      <circle cx="7" cy="21" r="1.4" fill="#6366f1" opacity="0.5" />
      <circle cx="25" cy="21" r="1.4" fill="#6366f1" opacity="0.5" />

      {/* Connection lines — proxy relay paths */}
      <line x1="7" y1="12" x2="14" y2="16" stroke="#818cf8" strokeWidth="0.6" opacity="0.4" />
      <line x1="25" y1="12" x2="18" y2="16" stroke="#818cf8" strokeWidth="0.6" opacity="0.4" />
      <line x1="7" y1="21" x2="14" y2="16" stroke="#6366f1" strokeWidth="0.6" opacity="0.3" />
      <line x1="25" y1="21" x2="18" y2="16" stroke="#6366f1" strokeWidth="0.6" opacity="0.3" />

      {/* Flow path — back arc (behind the orb, dimmed) */}
      <path
        d="M8 17.5C10 20 13 21.5 16 20"
        stroke="url(#flow-dim)"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.35"
      />

      {/* Central AI core — glowing orb */}
      <circle cx="16" cy="16" r="5" fill="url(#core-glow)" />
      <circle cx="16" cy="16" r="3.5" fill="url(#core-fill)" opacity="0.85" />

      {/* Inner iris ring */}
      <circle cx="16" cy="16" r="2.2" fill="none" stroke="#818cf8" strokeWidth="0.4" opacity="0.3" />

      {/* Flow path — front arc (emerges from orb into arrowhead) */}
      <path
        d="M16 12C18.5 10.8 20.5 11.2 22.5 13"
        stroke="url(#flow-bright)"
        strokeWidth="0.9"
        strokeLinecap="round"
        opacity="0.7"
      />
      {/* Filled arrowhead — gradient from base to tip */}
      <path
        d="M24.5 15L21.7 13.8L23.3 12.2z"
        fill="url(#arrow-grad)"
        opacity="0.7"
      />

      {/* Entry trail glow */}
      <path
        d="M6.5 18C8 19.5 10.5 20.5 13 19.5"
        stroke="#818cf8"
        strokeWidth="0.6"
        strokeLinecap="round"
        opacity="0.2"
      />

      <defs>
        <linearGradient id="hex-bg" x1="3" y1="1" x2="29" y2="31" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0f0a1e" />
          <stop offset="0.5" stopColor="#1a1036" />
          <stop offset="1" stopColor="#0d0820" />
        </linearGradient>
        <linearGradient id="hex-border" x1="3" y1="1" x2="29" y2="31" gradientUnits="userSpaceOnUse">
          <stop stopColor="#818cf8" stopOpacity="0.6" />
          <stop offset="0.5" stopColor="#6366f1" stopOpacity="0.25" />
          <stop offset="1" stopColor="#7c3aed" stopOpacity="0.4" />
        </linearGradient>
        <linearGradient id="hex-highlight" x1="3" y1="1" x2="16" y2="16" gradientUnits="userSpaceOnUse">
          <stop stopColor="#c7d2fe" />
          <stop offset="1" stopColor="#6366f1" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="hex-inner-bevel" x1="5" y1="3" x2="27" y2="29" gradientUnits="userSpaceOnUse">
          <stop stopColor="#818cf8" stopOpacity="0.2" />
          <stop offset="0.5" stopColor="#6366f1" stopOpacity="0.05" />
          <stop offset="1" stopColor="#4f46e5" stopOpacity="0.15" />
        </linearGradient>
        <radialGradient id="core-glow" cx="16" cy="16" r="5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366f1" stopOpacity="0.25" />
          <stop offset="1" stopColor="#4f46e5" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="core-fill" cx="16" cy="15" r="3.5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3730a3" />
          <stop offset="0.6" stopColor="#2e1065" />
          <stop offset="1" stopColor="#1e1b4b" />
        </radialGradient>
        <linearGradient id="arrow-grad" x1="21.7" y1="13.8" x2="24.5" y2="15" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366f1" stopOpacity="0.3" />
          <stop offset="1" stopColor="#c7d2fe" />
        </linearGradient>
        <linearGradient id="flow-dim" x1="8" y1="17" x2="16" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#a5b4fc" />
          <stop offset="1" stopColor="#6366f1" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id="flow-bright" x1="16" y1="12" x2="24" y2="14" gradientUnits="userSpaceOnUse">
          <stop stopColor="#818cf8" stopOpacity="0.4" />
          <stop offset="1" stopColor="#e0e7ff" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function Pag0LogoMark({ size = 32, className }: Pag0LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path d="M16 1L3 8.5v15L16 31l13-7.5v-15L16 1z" fill="#0f0a1e" />
      <path d="M16 1L3 8.5v15L16 16z" fill="#c7d2fe" opacity="0.1" />
      <path d="M16 31l13-7.5v-15L16 16z" fill="#000" opacity="0.15" />
      <path d="M16 1L3 8.5v15L16 31l13-7.5v-15L16 1z" fill="none" stroke="#6366f1" strokeWidth="0.8" strokeOpacity="0.5" />
      <path d="M16 3.5L5.5 9.5v13L16 28.5l10.5-6v-13L16 3.5z" fill="none" stroke="#818cf8" strokeWidth="0.4" strokeOpacity="0.15" />
      <circle cx="7" cy="12" r="1.4" fill="#818cf8" opacity="0.6" />
      <circle cx="25" cy="12" r="1.4" fill="#818cf8" opacity="0.6" />
      <circle cx="7" cy="21" r="1.4" fill="#6366f1" opacity="0.5" />
      <circle cx="25" cy="21" r="1.4" fill="#6366f1" opacity="0.5" />
      <line x1="7" y1="12" x2="14" y2="16" stroke="#818cf8" strokeWidth="0.6" opacity="0.4" />
      <line x1="25" y1="12" x2="18" y2="16" stroke="#818cf8" strokeWidth="0.6" opacity="0.4" />
      <line x1="7" y1="21" x2="14" y2="16" stroke="#6366f1" strokeWidth="0.6" opacity="0.3" />
      <line x1="25" y1="21" x2="18" y2="16" stroke="#6366f1" strokeWidth="0.6" opacity="0.3" />
      <path d="M8 17.5C10 20 13 21.5 16 20" stroke="#a5b4fc" strokeWidth="1.2" strokeLinecap="round" opacity="0.3" />
      <circle cx="16" cy="16" r="5" fill="#6366f1" fillOpacity="0.15" />
      <circle cx="16" cy="16" r="3.5" fill="#2e1065" opacity="0.85" />
      <circle cx="16" cy="16" r="2.2" fill="none" stroke="#818cf8" strokeWidth="0.4" opacity="0.25" />
      <path d="M16 12C18.5 10.8 20.5 11.2 22.5 13" stroke="#c7d2fe" strokeWidth="0.9" strokeLinecap="round" opacity="0.6" />
      <defs>
        <linearGradient id="arrow-grad-m" x1="21.7" y1="13.8" x2="24.5" y2="15" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366f1" stopOpacity="0.3" />
          <stop offset="1" stopColor="#c7d2fe" />
        </linearGradient>
      </defs>
      <path d="M24.5 15L21.7 13.8L23.3 12.2z" fill="url(#arrow-grad-m)" opacity="0.6" />
    </svg>
  );
}
