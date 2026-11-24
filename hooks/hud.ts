// What the two tab headers share: the size of the card, its colours and
// type, and the HUD dressing every card wears (a dark hull, a faint grid, a
// sweeping scan line, corner brackets). Animated with SMIL, which the desktop
// app runs in a drawn Svg.

export const W = 480
export const H = 178
export const VIOLET = '#a78bfa'
export const CYAN = '#22d3ee'
export const GREEN = '#4ade80'
export const AMBER = '#fbbf24'
export const INK = '#f4f7ff'
export const MUTED = '#8b9bc4'
export const SANS = `font-family="'Segoe UI Variable Display', 'Segoe UI', system-ui, -apple-system, sans-serif"`
export const MONO = `font-family="'Cascadia Mono', Consolas, 'Courier New', monospace"`

export const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// A number as a readout shows it: at least two digits.
export const digits = (n: number) => String(n).padStart(2, '0')

const bracket = (x: number, y: number, dx: number, dy: number, colour: string) =>
  `<path d="M${x},${y + dy * 14} V${y} H${x + dx * 14}" fill="none" stroke="${colour}" stroke-width="1.6" stroke-linecap="round"/>`

// The card every header is drawn on, in the accent colour of its tab, `h` units tall.
export const hull = (accent: string, inside: string, h = H) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${h}" width="${W * 3}" height="${h * 3}" preserveAspectRatio="xMinYMin meet">
  <defs>
    <linearGradient id="hull" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#070b18"/><stop offset="1" stop-color="#131a36"/></linearGradient>
    <radialGradient id="aura" cx="0.16" cy="0.62" r="0.7"><stop offset="0" stop-color="${accent}" stop-opacity="0.20"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient>
    <linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${accent}" stop-opacity="0"/><stop offset="0.5" stop-color="${accent}" stop-opacity="0.10"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></linearGradient>
    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20,0 H0 V20" fill="none" stroke="#ffffff" stroke-width="0.5" opacity="0.045"/></pattern>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <clipPath id="frame"><rect width="${W}" height="${h}" rx="14"/></clipPath>
  </defs>
  <g clip-path="url(#frame)">
    <rect width="${W}" height="${h}" fill="url(#hull)"/>
    <rect width="${W}" height="${h}" fill="url(#grid)"/>
    <rect width="${W}" height="${h}" fill="url(#aura)"/>
    <rect y="0" width="120" height="${h}" fill="url(#sweep)"><animate attributeName="x" values="-120;${W}" dur="5s" repeatCount="indefinite"/></rect>
    <rect width="${W}" height="2" fill="${accent}" opacity="0.8"/>
  </g>
  ${bracket(8, 10, 1, 1, accent)}${bracket(W - 8, 10, -1, 1, accent)}${bracket(8, h - 8, 1, -1, accent)}${bracket(W - 8, h - 8, -1, -1, accent)}
  ${inside}
</svg>`
