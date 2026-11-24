// The panel's one drawing, for surfaces that draw Svg (the desktop app): a
// header saying where AI Playground stands. The switches, the screenshots and
// the cherry-picking are all in the person's dashboard, a web page; the panel
// only links to it and hands its requests to Claude. Animated with SMIL.

import { AMBER, CYAN, GREEN, INK, MONO, MUTED, SANS, VIOLET, W, digits, hull } from './hud'

export type Deck = {
  // The person's dashboard has been made and is known to the panel.
  isLinked: boolean
  // Requests waiting in the dashboard for Claude; -1 when the panel cannot see them.
  waiting: number
  // Claude has been asked to do something and has not finished.
  isBusy: boolean
}

const H = 132
const CORE = { x: 64, y: 70 }

export const deckSvg = (deck: Deck) => {
  const colour = deck.isBusy ? AMBER : deck.isLinked ? VIOLET : MUTED
  const count = deck.waiting < 0 ? '··' : digits(deck.waiting)
  const line = !deck.isLinked
    ? 'NOT SET UP YET'
    : deck.isBusy
      ? 'CLAUDE IS WORKING IN THIS CHAT'
      : deck.waiting > 0
        ? `${digits(deck.waiting)} REQUEST${deck.waiting === 1 ? '' : 'S'} WAITING FOR CLAUDE`
        : deck.waiting === 0
          ? 'DASHBOARD LINKED · NOTHING WAITING'
          : 'DASHBOARD LINKED'
  return hull(
    VIOLET,
    `
  <text x="136" y="34" ${MONO} font-size="9.5" font-weight="700" letter-spacing="1.8" fill="${VIOLET}">SELF-IMPROVEMENT CHERRY PICKER</text>
  <text x="136" y="62" ${SANS} font-size="24" font-weight="800" fill="${INK}">AI Playground</text>
  <text x="136" y="84" ${MONO} font-size="9.5" font-weight="700" letter-spacing="1.2" fill="${deck.isBusy ? AMBER : deck.isLinked ? GREEN : MUTED}">${line}</text>
  <text x="136" y="108" ${SANS} font-size="11" fill="#c9d3ea">Switches, screenshots and cherry-picking are in your dashboard.</text>
  <g transform="translate(${CORE.x} ${CORE.y})">
    <circle r="44" fill="none" stroke="${VIOLET}" stroke-width="1" stroke-dasharray="2 8" opacity="0.5">
      <animateTransform attributeName="transform" type="rotate" values="0;360" dur="20s" repeatCount="indefinite"/>
    </circle>
    <circle r="35" fill="none" stroke="${CYAN}" stroke-width="1.2" stroke-dasharray="40 20" opacity="${deck.isLinked ? 0.55 : 0.2}">
      <animateTransform attributeName="transform" type="rotate" values="360;0" dur="${deck.isBusy ? 3 : 9}s" repeatCount="indefinite"/>
    </circle>
    <circle r="26" fill="${colour}" opacity="0.16" filter="url(#glow)">
      ${deck.isBusy ? `<animate attributeName="r" values="23;29;23" dur="0.9s" repeatCount="indefinite"/>` : ''}
    </circle>
    <circle r="21" fill="#120f2e" stroke="${colour}" stroke-width="1.5"/>
    <text y="4" text-anchor="middle" ${MONO} font-size="16" font-weight="700" fill="${INK}">${count}</text>
    <text y="14" text-anchor="middle" ${MONO} font-size="5.5" font-weight="700" letter-spacing="1" fill="${MUTED}">WAITING</text>
  </g>
  <rect x="${W - 12}" y="${H - 12}" width="0" height="0"/>`,
    H,
  )
}
