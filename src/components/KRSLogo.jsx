export default function KRSLogo({ size = 42, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="K R S Silvers Logo"
      style={{ filter: 'drop-shadow(0 2px 6px rgba(179, 134, 27, 0.25))' }}
    >
      <defs>
        {/* Gold Gradients */}
        <linearGradient id="krs-gold-outer" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F5DF9E" />
          <stop offset="35%" stopColor="#D4A32D" />
          <stop offset="70%" stopColor="#B3861B" />
          <stop offset="100%" stopColor="#8A6510" />
        </linearGradient>

        <linearGradient id="krs-gold-inner" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="25%" stopColor="#F7E6B5" />
          <stop offset="60%" stopColor="#C89B2B" />
          <stop offset="100%" stopColor="#9C7314" />
        </linearGradient>

        {/* Silver Ingot Gradients */}
        <linearGradient id="krs-silver-top" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="50%" stopColor="#E6EBF2" />
          <stop offset="100%" stopColor="#C8D2DE" />
        </linearGradient>

        <linearGradient id="krs-silver-face" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#E4E9F0" />
          <stop offset="50%" stopColor="#BAC5D3" />
          <stop offset="100%" stopColor="#95A2B3" />
        </linearGradient>

        <linearGradient id="krs-silver-side" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#8A98AB" />
          <stop offset="100%" stopColor="#6C7A8E" />
        </linearGradient>

        {/* Badge Background */}
        <linearGradient id="krs-badge-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#252D3A" />
          <stop offset="50%" stopColor="#181F2A" />
          <stop offset="100%" stopColor="#0E131B" />
        </linearGradient>
      </defs>

      {/* Outer Hexagonal Shield / Bullion Ingot Silhouette */}
      <rect
        x="6"
        y="6"
        width="88"
        height="88"
        rx="22"
        fill="url(#krs-badge-bg)"
        stroke="url(#krs-gold-outer)"
        strokeWidth="3"
      />

      {/* Inner Decorative Silver Ring */}
      <rect
        x="11"
        y="11"
        width="78"
        height="78"
        rx="17"
        fill="none"
        stroke="url(#krs-silver-top)"
        strokeWidth="0.8"
        strokeDasharray="4 2"
        opacity="0.6"
      />

      {/* Top Stylized Crown / Scales Finial */}
      <path
        d="M50 18 L53 23 L58 20 L55 26 L50 24 L45 26 L42 20 L47 23 Z"
        fill="url(#krs-gold-inner)"
      />
      <circle cx="50" cy="17" r="1.5" fill="#FFFFFF" />

      {/* Stacked Silver Bullion Bars */}
      {/* Lower Bar Base */}
      <g opacity="0.9">
        {/* Top facet */}
        <polygon points="28,52 50,42 72,52 50,62" fill="url(#krs-silver-top)" />
        {/* Left facet */}
        <polygon points="28,52 50,62 50,68 28,58" fill="url(#krs-silver-face)" />
        {/* Right facet */}
        <polygon points="50,62 72,52 72,58 50,68" fill="url(#krs-silver-side)" />
      </g>

      {/* Upper Bar (Overlapping) */}
      <g>
        {/* Top facet */}
        <polygon points="31,43 50,34 69,43 50,52" fill="url(#krs-silver-top)" />
        {/* Left facet */}
        <polygon points="31,43 50,52 50,57 31,48" fill="url(#krs-silver-face)" />
        {/* Right facet */}
        <polygon points="50,52 69,43 69,48 50,57" fill="url(#krs-silver-side)" />
      </g>

      {/* Ingot Bevel Highlights */}
      <line x1="31" y1="43" x2="50" y2="34" stroke="#FFFFFF" strokeWidth="1" opacity="0.8" />
      <line x1="50" y1="34" x2="69" y2="43" stroke="#FFFFFF" strokeWidth="0.6" opacity="0.6" />

      {/* KRS Royal Hallmark Letters */}
      <text
        x="50"
        y="80"
        textAnchor="middle"
        fontFamily="'Playfair Display', Georgia, serif"
        fontSize="17"
        fontWeight="800"
        letterSpacing="2.5"
        fill="url(#krs-gold-inner)"
        style={{ fontVariantCaps: 'small-caps' }}
      >
        KRS
      </text>

      {/* 999 Fine Silver Micro Stamp */}
      <text
        x="50"
        y="88"
        textAnchor="middle"
        fontFamily="'Inter', sans-serif"
        fontSize="5.5"
        fontWeight="700"
        letterSpacing="1.2"
        fill="#A6B3C3"
        opacity="0.9"
      >
        999.0 FINE
      </text>
    </svg>
  )
}
