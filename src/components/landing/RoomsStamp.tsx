/** A printed "Sonora Rooms" stamp: a skewed diamond label with small words on its edges. */
export function RoomsStamp({ className = "" }: { className?: string }) {
  const ink = "#2f80ed";
  return (
    <svg viewBox="0 0 280 170" className={`transition-transform duration-700 ease-[var(--ease-soft)] hover:-rotate-3 ${className}`} aria-hidden="true">
      <g transform="rotate(-14 140 85)" fill="none" stroke={ink}>
        <polygon points="18,92 128,28 262,70 152,136" strokeWidth="2" />
        <polygon points="30,92 129,35 249,71 151,128" strokeWidth="1" />
      </g>
      <g transform="rotate(-14 140 85)" fill={ink} textAnchor="middle">
        <text x="142" y="80" fontSize="27" fontWeight="600" letterSpacing="-0.8" style={{ fontFamily: "var(--font-body)" }}>
          Sonora
        </text>
        <text x="142" y="106" fontSize="27" fontWeight="600" letterSpacing="-0.8" style={{ fontFamily: "var(--font-body)" }}>
          Rooms
        </text>
        <g fontSize="10" style={{ fontFamily: "var(--font-source-serif)" }}>
          <text x="96" y="52" transform="rotate(-28 96 52)">night</text>
          <text x="205" y="58" transform="rotate(16 205 58)">calm</text>
          <text x="66" y="110" transform="rotate(16 66 110)">focus</text>
          <text x="196" y="122" transform="rotate(-28 196 122)">nostalgia</text>
        </g>
        <circle cx="142" cy="124" r="5" fill="none" stroke={ink} />
      </g>
    </svg>
  );
}
