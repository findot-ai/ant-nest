import { W, H, SURF, CM, SKY, SOIL, TUN, ROCK, ROOMNAME, ROOMNAME_EN, idx, layerOf, season, hour, chamberAt, frostDepth } from './engine'
import type { World, Ant, Lang } from './engine'

const SOILC = ['#563a26', '#a47646', '#805e44', '#625852']
const ROOMC: Record<string, string> = { queen: '#805838', brood: '#705038', store: '#684e30', waste: '#463c34' }
const TUNC = '#4a3424'
const SKYC = ['#a9cfd1', '#8fc1d8', '#cdba9a', '#b8c3c9']
const LEAF = [['#8fc46a', '#a9d47e'], ['#3f7f45', '#4f9552'], ['#c4782f', '#d9913d'], ['#5a4030', '#5a4030']]

function night(w: World) { const h = hour(w); return h < 5 || h >= 20 ? 1 : h < 7 ? (7 - h) / 2 : h >= 18 ? (h - 17) / 3 : 0 }
function mix(a: string, b: string, m: number) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16)
  const c = [16, 8, 0].map(sh => Math.round(((pa >> sh) & 255) * (1 - m) + ((pb >> sh) & 255) * m))
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('')
}

// 땅속 한 칸의 기본 색 (터미널과 SVG가 같은 규칙을 쓴다)
export function cellColor(w: World, x: number, y: number) {
  const c = w.grid[idx(x, y)]
  if (c === SKY) return mix(w.rain > 0 ? '#78878f' : SKYC[season(w)]!, '#18203a', night(w) * 0.8)
  if (c === ROCK) return '#78746e'
  if (c === SOIL) return SOILC[layerOf(y)]!
  const ch = chamberAt(w, x, y)
  return ch ? ROOMC[ch.type]! : TUNC
}

type Sprite = { x: number; y: number; c: string }
function sprites(w: World, ants: Ant[]): Sprite[] {
  const out: Sprite[] = []
  const rooms: Record<number, number> = {}
  for (const b of w.brood) rooms[b.room] = (rooms[b.room] ?? 0) + b.n
  for (const id in rooms) {
    const c = w.chambers[+id]; if (!c) continue
    const n = Math.min(c.rx * 2, Math.ceil(rooms[id]! / 8))
    for (let k = 0; k < n; k++) out.push({ x: c.cx - c.rx + 1 + (k % (c.rx * 2 - 1)), y: c.cy + (k % 2), c: '#f3ece0' })
  }
  for (const c of w.chambers) if (c.type === 'store') { const n = Math.min(c.rx * 2 - 1, Math.round(w.carb / 25)); for (let k = 0; k < n; k++) out.push({ x: c.cx - c.rx + 1 + k, y: c.cy + c.ry, c: k % 3 === 2 && w.prot > 10 ? '#c9472f' : '#e2a33a' }) }
  for (const a of ants) out.push({ x: a.x, y: a.st === 'out' ? SURF - 1 - a.up : a.y, c: a.job === 'swarm' ? '#ff5a3c' : a.kind === 'm' ? '#3a2214' : '#120b07' })
  const q = w.chambers[w.queen.room]!
  out.push({ x: q.cx, y: q.cy, c: '#e3a33b' })
  for (const t of w.threats) {
    if (t.k === 'centipede') { for (const [x, y] of t.trail) out.push({ x, y, c: '#b5452c' }); out.push({ x: t.x, y: t.y, c: '#e06030' }) }
    else out.push({ x: t.x, y: t.y, c: '#e8e4da' })
  }
  return out
}

// ---------- 데스크톱·모바일: SVG ----------
const S = 5
export function svg(w: World, ants: Ant[], lang: Lang = 'ko') {
  const RN = lang === 'en' ? ROOMNAME_EN : ROOMNAME
  const s = season(w), nt = night(w), parts: string[] = []
  const r = (x: number, y: number, ww: number, hh: number, c: string) => parts.push(`<rect x="${x}" y="${y}" width="${ww}" height="${hh}" fill="${c}"/>`)
  r(0, 0, W * S, SURF * S, cellColor(w, 0, 0))
  for (const t of w.trees) {
    r(t.x * S - 2, (SURF - t.h) * S, 5, t.h * S, mix('#4a3324', '#000000', nt * 0.4))
    const lc = LEAF[s]!
    for (let k = 0; k < 9; k++) r((t.x - 3 + (k % 3) * 2) * S - 2, (SURF - t.h - 2 + Math.floor(k / 3) * 1.4) * S, 2 * S, 1.6 * S, lc[k % 2]!)
    if (s !== 3) for (let k = 0; k < 3; k++) r(t.x * S - 3, (SURF - t.h + 3 + k) * S, 2, 2, '#6fae4a')
    if (t.farm) parts.push(`<text x="${t.x * S}" y="${SURF * S - 4}" font-size="6" text-anchor="middle" fill="#1a2a12">${t.farm.slice(0, 14).replace(/[<>&"]/g, '')}</text>`)
  }
  for (let l = 0; l < 4; l++) { const y0 = l === 0 ? SURF : SURF + [0, 6, 22, 38][l]!, y1 = l === 3 ? H : SURF + [6, 22, 38][l]!; r(0, y0 * S, W * S, (y1 - y0) * S, SOILC[l]!) }
  r(0, SURF * S - 2, W * S, 3, s === 3 ? '#eef2f1' : s === 2 ? '#9a8a3e' : '#5f9a4a')
  // 굴과 바위: 같은 색이 이어지는 가로 구간을 한 사각형으로
  for (let y = SURF; y < H; y++) {
    let x = 0
    while (x < W) {
      const c = w.grid[idx(x, y)]
      if (c !== TUN && c !== ROCK) { x++; continue }
      const col = cellColor(w, x, y); let x2 = x + 1
      while (x2 < W && (w.grid[idx(x2, y)] === TUN || w.grid[idx(x2, y)] === ROCK) && cellColor(w, x2, y) === col) x2++
      r(x * S, y * S, (x2 - x) * S, S, col); x = x2
    }
  }
  const fd = frostDepth(w)
  if (fd > 0) { const yy = SURF * S + (fd / CM) * S; r(0, SURF * S, W * S, yy - SURF * S, 'rgba(200,230,255,.18)'); r(0, yy, W * S, 1, '#dcefff'); parts.push(`<text x="${W * S - 3}" y="${yy - 2}" font-size="7" text-anchor="end" fill="#dcefff">${lang === 'en' ? 'Frost line' : '동결선'} ${fd}cm</text>`) }
  // 새끼·먹이
  for (const sp of sprites(w, []).filter(p => p.c === '#f3ece0' || p.c === '#e2a33a' || p.c === '#c9472f')) r(sp.x * S + 1, sp.y * S + 1, 3, 3, sp.c)
  // 개미
  for (const a of ants) {
    const y = a.st === 'out' ? (SURF - 1 - a.up) * S + 1 : a.y * S + 1, x = a.x * S
    const body = a.job === 'swarm' ? '#2a0d06' : a.kind === 'm' ? '#3a2214' : '#120b07'
    r(x, y + 1, 3, 2, body); r(x + 3, y, a.kind === 'm' ? 3 : 2, a.kind === 'm' ? 3 : 2, body)
    if (a.job === 'swarm') r(x + 3, y - 1, 2, 1, '#ff5a3c')
    if (a.carry) r(x + 4, y - 2, 2, 2, a.carry === 2 ? '#c9472f' : '#e2a33a')
  }
  const q = w.chambers[w.queen.room]!
  r(q.cx * S - 4, q.cy * S + 1, 6, 3, '#120b07'); r(q.cx * S + 2, q.cy * S + 1, 3, 3, '#7a3b1f'); r(q.cx * S + 5, q.cy * S + 1, 3, 3, '#120b07')
  // 천적
  for (const t of w.threats) {
    if (t.k === 'spider') {
      const x = t.x * S, y = (SURF - 4) * S
      for (let k = 0; k < 4; k++) { r(x - 6 + k * 4, y - 2, 1, 16, 'rgba(245,245,240,.55)'); r(x - 7, y + k * 4, 16, 1, 'rgba(245,245,240,.55)') }
      r(x, y + 5, 4, 4, '#1d1a17'); r(x + 1, y + 6, 2, 1, '#c9472f')
    } else {
      for (const [x, y] of t.trail) r(x * S, y * S + 1, 5, 3, '#b5452c')
      r(t.x * S, t.y * S + 1, 5, 3, '#6e2316')
      parts.push(`<circle cx="${t.x * S + 2}" cy="${t.y * S + 2}" r="${t.alarmR * S * 0.6}" fill="none" stroke="rgba(222,106,76,.35)"/>`)
      r(t.x * S - 2, t.y * S - 4, 9, 2, '#de6a4c'); r(t.x * S - 2, t.y * S - 4, Math.max(1, Math.round((9 * t.hp) / t.hp0)), 1, '#2a1a12')
    }
  }
  if (w.rain > 0 && s !== 3) for (let k = 0; k < 40; k++) r((k * 37 + w.tick * 13) % (W * S), (k * 23 + w.tick * 29) % (SURF * S - 4), 1, 4, 'rgba(215,232,245,.8)')
  for (const c of w.chambers) if (c.type !== 'queen') parts.push(`<text x="${c.cx * S}" y="${(c.cy - c.ry) * S - 1}" font-size="7" text-anchor="middle" fill="#efe4d2">${RN[c.type]}</text>`)
  parts.push(`<text x="${q.cx * S}" y="${(q.cy - q.ry) * S - 1}" font-size="7" text-anchor="middle" fill="#e3a33b">${lang === 'en' ? 'Queen' : '여왕'}</text>`)
  for (let d = 15; d < (H - SURF) * CM; d += 15) { const y = (SURF + d / CM) * S; parts.push(`<rect x="0" y="${y}" width="4" height="1" fill="rgba(255,255,255,.4)"/><text x="6" y="${y + 3}" font-size="6" fill="rgba(255,255,255,.5)">${d}cm</text>`) }
  if (nt > 0) r(0, 0, W * S, SURF * S, `rgba(10,12,24,${(nt * 0.18).toFixed(2)})`)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W * S} ${H * S}" width="${W * S}" height="${H * S}" shape-rendering="crispEdges" font-family="monospace">${parts.join('')}</svg>`
}

// ---------- 터미널: 반 블록(▀) 한 글자에 위아래 두 칸 ----------
export function raster(w: World, ants: Ant[]) {
  const px: string[] = new Array(W * H)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) px[idx(x, y)] = cellColor(w, x, y)
  for (const t of w.trees) for (let y = SURF - t.h; y < SURF; y++) px[idx(t.x, y)] = '#4a3324'
  for (const sp of sprites(w, ants)) if (sp.x >= 0 && sp.x < W && sp.y >= 0 && sp.y < H) px[idx(sp.x, sp.y)] = sp.c
  const rows = H / 2, words = new Uint32Array(W * rows * 3)
  for (let ry = 0; ry < rows; ry++) for (let x = 0; x < W; x++) {
    const o = (ry * W + x) * 3
    words[o] = 0x2580; words[o + 1] = parseInt(px[idx(x, ry * 2)]!.slice(1, 7), 16); words[o + 2] = parseInt(px[idx(x, ry * 2 + 1)]!.slice(1, 7), 16)
  }
  const bytes = new Uint8Array(words.buffer) as Uint8Array & { toBase64: () => string }
  return { cells: bytes.toBase64(), columns: W, rows }
}
