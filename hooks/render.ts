import { W, H, SURF, CM, SKY, SOIL, TUN, ROCK, ROOMNAME, ROOMNAME_EN, SP, idx, layerOf, season, hour, chamberAt, frostDepth } from './engine'
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
// 같은 색 사각형을 path 하나로 묶어 글자 수를 줄인다. 층(layer)마다 그리는 순서를 지킨다.
const S = 6
class Painter {
  layers: Map<string, string[]>[] = []
  extra: string[][] = []
  constructor(n: number) { for (let k = 0; k < n; k++) { this.layers.push(new Map()); this.extra.push([]) } }
  rect(l: number, x: number, y: number, w: number, h: number, c: string) {
    if (w <= 0 || h <= 0) return
    const m = this.layers[l]!; let a = m.get(c); if (!a) { a = []; m.set(c, a) }
    a.push(`M${+x.toFixed(1)} ${+y.toFixed(1)}h${+w.toFixed(1)}v${+h.toFixed(1)}h${-w.toFixed(1)}z`)
  }
  raw(l: number, svg: string) { this.extra[l]!.push(svg) }
  out() {
    let o = ''
    this.layers.forEach((m, k) => { m.forEach((d, c) => { o += `<path fill="${c}" d="${d.join('')}"/>` }); o += this.extra[k]!.join('') })
    return o
  }
}
const hash = (x: number, y: number) => { let h = (x * 374761393 + y * 668265263) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return (h >>> 8) / 16777216 }
const SOILD = ['#4a3020', '#8e6339', '#6e5038', '#544b46'], SOILL = ['#644230', '#b5865a', '#8c6a4f', '#6c625c']
const L_BG = 0, L_TERR = 1, L_EDGE = 2, L_ITEM = 3, L_ANT = 4, L_FX = 5, L_TXT = 6

export function svg(w: World, ants: Ant[], lang: Lang = 'ko') {
  const sp = SP(w)
  const RN = { ...(lang === 'en' ? ROOMNAME_EN : ROOMNAME), ...(sp.storeKo ? { store: lang === 'en' ? sp.storeEn! : sp.storeKo } : {}) }
  const s = season(w), nt = night(w), h = hour(w), P = new Painter(7), WW = W * S, HH = H * S, GY = SURF * S
  const defs: string[] = []
  // 하늘
  const top = mix(w.rain > 0 ? '#6d7c86' : ['#8ec5d6', '#6fb3dc', '#c9b48e', '#aeb9c0'][s]!, '#0e1430', nt * 0.85)
  const bot = mix(w.rain > 0 ? '#a3adb0' : ['#e6efd8', '#d9eef2', '#ecd9b0', '#dfe5e8'][s]!, '#1e2440', nt * 0.75)
  defs.push(`<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bot}"/></linearGradient>`)
  P.raw(L_BG, `<rect width="${WW}" height="${GY}" fill="url(#sky)"/>`)
  if (nt > 0.5) for (let k = 0; k < 26; k++) P.rect(L_BG, Math.floor(hash(k, 1) * WW), Math.floor(hash(k, 2) * (GY - 30)), 1, 1, hash(k, 3) > 0.7 ? '#ffffff' : '#c8d0f0')
  // 해와 달: 시각에 따라 하늘을 가로지른다
  const dayP = (h - 6) / 13, nightP = ((h + 24 - 19) % 24) / 11
  if (w.rain <= 0) {
    if (dayP >= 0 && dayP <= 1) { const sx = dayP * (WW - 30) + 10, sy = 34 - Math.sin(dayP * Math.PI) * 26; P.rect(L_BG, sx, sy, 10, 10, s === 1 ? '#ffe27a' : '#fff0b0'); P.rect(L_BG, sx - 2, sy + 2, 14, 6, s === 1 ? '#ffe27a' : '#fff0b0'); P.rect(L_BG, sx + 2, sy - 2, 6, 14, s === 1 ? '#ffe27a' : '#fff0b0') }
    else if (nightP <= 1) { const mx = nightP * (WW - 30) + 10, my = 30 - Math.sin(nightP * Math.PI) * 20; P.rect(L_BG, mx, my, 8, 8, '#eef0d8'); P.rect(L_BG, mx + 3, my - 1, 6, 6, top) }
  }
  // 구름
  for (let k = 0; k < 3; k++) {
    const cx = ((hash(k, 9) * WW + w.tick * (0.3 + k * 0.15)) % (WW + 60)) - 30, cy = 12 + k * 14
    const cc = w.rain > 0 ? mix('#8a959c', '#000000', nt * 0.5) : mix('#ffffff', '#5a6080', nt * 0.7)
    P.rect(L_BG, cx, cy, 30, 6, cc); P.rect(L_BG, cx + 6, cy - 4, 16, 5, cc); P.rect(L_BG, cx + 4, cy + 6, 22, 2, mix(cc, '#000000', 0.08))
  }
  // 땅 위 풀
  const grass = s === 3 ? ['#e9eeec', '#ffffff'] : s === 2 ? ['#8f8340', '#a69a4c'] : s === 0 ? ['#6fae4e', '#8cc66a'] : ['#3f8a3e', '#56a24a']
  P.rect(L_TERR, 0, GY - 3, WW, 3, grass[0]!)
  for (let x = 0; x < WW; x += 3) { const hh = 2 + Math.floor(hash(x, 7) * 6); if (w.grid[idx(Math.floor(x / S), SURF)] === TUN) continue; P.rect(L_TERR, x, GY - 3 - hh, 2, hh, grass[hash(x, 8) > 0.5 ? 1 : 0]!) }
  if (s < 2) for (let k = 0; k < 10; k++) { const x = Math.floor(hash(k, 11) * WW); if (w.grid[idx(Math.floor(x / S), SURF)] === TUN) continue; P.rect(L_ITEM, x, GY - 9, 3, 3, s === 0 ? (k % 2 ? '#f4b6c8' : '#fff3a8') : '#f3d34a'); P.rect(L_ITEM, x + 1, GY - 6, 1, 3, grass[0]!) }
  // 나무: 둥근 수관을 줄마다 다른 폭으로
  const leaf = s === 0 ? ['#7fbf5c', '#a2d47c', '#5f9e46'] : s === 1 ? ['#2f7a3c', '#47944c', '#235f2e'] : s === 2 ? ['#c26f2a', '#dd9a3e', '#9a5322'] : ['#7a5a42', '#8d6a4e', '#5e4434']
  for (const t of w.trees) {
    const bx = t.x * S, trunkTop = GY - t.h * S
    P.rect(L_TERR, bx - 3, trunkTop, 7, t.h * S, mix('#5a3d29', '#000000', nt * 0.4)); P.rect(L_TERR, bx - 3, trunkTop, 2, t.h * S, mix('#704c33', '#000000', nt * 0.4))
    P.rect(L_TERR, bx + 4, trunkTop + 14, 8, 3, '#5a3d29'); P.rect(L_TERR, bx - 11, trunkTop + 8, 8, 3, '#5a3d29')
    const R = t.farm ? 3 : 4, cy = trunkTop - 2
    for (let r = -R; r <= R; r++) {
      const half = Math.round(Math.sqrt(R * R - r * r) * 1.3 + 0.5)
      for (let c = -half; c <= half; c++) {
        const shade = r < -R / 3 && c < 0 ? 1 : r > R / 3 || c > half - 2 ? 2 : 0
        P.rect(L_TERR, bx + c * 4 - 2, cy + r * 4, 4, 4, mix(leaf[shade]!, '#081020', nt * 0.45))
      }
    }
    if (s === 3) for (let c = -R; c <= R; c++) P.rect(L_ITEM, bx + c * 4 - 2, cy - R * 4 - 1, 4, 2, '#f4f7f6')
    if (s === 0) for (let k = 0; k < 6; k++) P.rect(L_ITEM, bx - 12 + Math.floor(hash(t.x, k) * 24), cy - 10 + Math.floor(hash(k, t.x) * 18), 3, 3, '#f8cdd8')
    if (s === 2 && t.x % 2 === 0) for (let k = 0; k < 4; k++) P.rect(L_ITEM, bx - 10 + k * 6, cy - 2 + (k % 2) * 6, 3, 3, '#e8642c')
    if (s !== 3) for (let k = 0; k < 4; k++) P.rect(L_ITEM, bx + (k % 2 ? 2 : -4), GY - (t.h - 2 - k) * S, 2, 2, '#7fd45a')
  }
  // 흙: 층마다 질감 패턴
  const bands = [[0, 6], [6, 22], [22, 38], [38, H - SURF]]
  bands.forEach(([a, b], l) => {
    defs.push(`<pattern id="soil${l}" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="${SOILC[l]}"/><path fill="${SOILD[l]}" d="M3 5h2v2h-2zM15 2h3v2h-3zM9 14h2v2h-2zM20 17h2v3h-2zM5 20h3v1h-3z"/><path fill="${SOILL[l]}" d="M11 4h1v1h-1zM18 10h2v1h-2zM2 12h1v2h-1zM14 21h2v1h-2z"/></pattern>`)
    P.raw(L_BG, `<rect x="0" y="${(SURF + a!) * S}" width="${WW}" height="${(b! - a!) * S}" fill="url(#soil${l})"/>`)
    if (l > 0) P.rect(L_BG, 0, (SURF + a!) * S, WW, 1, SOILD[l]!)
  })
  // 나무뿌리
  for (const t of w.trees) for (let k = 0; k < 3; k++) { let x = t.x * S, y = GY; for (let n = 0; n < 9; n++) { x += (k - 1) * 3 + (hash(t.x * 3 + k, n) - 0.5) * 6; y += 4; P.rect(L_BG, x, y, 2, 4, '#3b2a1c') } }
  // 바위와 굴: 칸마다 위아래 이웃을 보고 명암을 준다
  const at = (x: number, y: number) => (x < 0 || x >= W || y < 0 || y >= H ? SOIL : w.grid[idx(x, y)]!)
  for (let y = SURF; y < H; y++) {
    let x = 0
    while (x < W) {
      const c = at(x, y)
      if (c !== TUN && c !== ROCK) { x++; continue }
      const col = c === ROCK ? '#7c776f' : cellColor(w, x, y); let x2 = x + 1
      while (x2 < W && at(x2, y) === c && (c === ROCK || cellColor(w, x2, y) === col)) x2++
      P.rect(L_TERR, x * S, y * S, (x2 - x) * S, S, col)
      for (let k = x; k < x2; k++) {
        if (c === ROCK) {
          if (at(k, y - 1) !== ROCK) P.rect(L_EDGE, k * S, y * S, S, 2, '#a39d93')
          if (at(k, y + 1) !== ROCK) P.rect(L_EDGE, k * S, y * S + S - 2, S, 2, '#58534d')
          if (hash(k, y) > 0.8) P.rect(L_EDGE, k * S + 2, y * S + 2, 2, 1, '#69645d')
        } else {
          if (at(k, y - 1) === SOIL) P.rect(L_EDGE, k * S, y * S, S, 2, 'rgba(0,0,0,.35)')
          if (at(k, y + 1) === SOIL) P.rect(L_EDGE, k * S, y * S + S - 2, S, 2, 'rgba(255,220,170,.18)')
          if (at(k - 1, y) === SOIL) P.rect(L_EDGE, k * S, y * S, 1, S, 'rgba(0,0,0,.25)')
          if (at(k + 1, y) === SOIL) P.rect(L_EDGE, k * S + S - 1, y * S, 1, S, 'rgba(0,0,0,.25)')
        }
      }
      x = x2
    }
  }
  // 방 안쪽의 은은한 빛
  defs.push('<radialGradient id="glow"><stop offset="0" stop-color="#ffdca0" stop-opacity=".22"/><stop offset="1" stop-color="#ffdca0" stop-opacity="0"/></radialGradient>')
  for (const c of w.chambers) if (c.type !== 'waste') P.raw(L_EDGE, `<ellipse cx="${c.cx * S + S / 2}" cy="${c.cy * S + S / 2}" rx="${(c.rx + 1) * S}" ry="${(c.ry + 1) * S}" fill="url(#glow)"/>`)
  // 동결선
  const fd = frostDepth(w)
  if (fd > 0) { const yy = GY + (fd / CM) * S; P.rect(L_FX, 0, GY, WW, yy - GY, 'rgba(200,230,255,.16)'); for (let x = 0; x < WW; x += 8) P.rect(L_FX, x, yy, 5, 1, '#dcefff') }
  // 새끼: 방마다 알·애벌레·고치 모양을 달리
  const per: Record<number, { egg: number; larva: number; pupa: number }> = {}
  for (const b of w.brood) { const r = (per[b.room] ??= { egg: 0, larva: 0, pupa: 0 }); r[b.st] += b.n }
  for (const id in per) {
    const c = w.chambers[+id]; if (!c) continue
    const r = per[id]!, floor = (c.cy + c.ry) * S + S - 2, x0 = (c.cx - c.rx + 1) * S, span = (c.rx * 2 - 1) * S
    const nE = Math.min(12, Math.ceil(r.egg / 3)), nL = Math.min(8, Math.ceil(r.larva / 4)), nP = Math.min(8, Math.ceil(r.pupa / 4))
    for (let k = 0; k < nE; k++) P.rect(L_ITEM, x0 + ((k * 5) % span), floor - 3 - Math.floor(k / Math.max(1, span / 5)) * 2, 2, 2, '#fbf7ee')
    for (let k = 0; k < nL; k++) { const x = x0 + span - 6 - ((k * 7) % span), y = floor - 4 - (k % 2) * 3; P.rect(L_ITEM, x, y, 4, 3, '#f1e6cc'); P.rect(L_ITEM, x + 3, y, 1, 1, '#c9b48e') }
    for (let k = 0; k < nP; k++) { const x = x0 + ((k * 6 + 3) % span), y = floor - 6; P.rect(L_ITEM, x, y, 3, 5, '#d2aa74'); P.rect(L_ITEM, x, y + 4, 3, 1, '#a07e4e') }
  }
  // 창고와 쓰레기 방
  for (const c of w.chambers) {
    const floor = (c.cy + c.ry) * S + S - 2, x0 = (c.cx - c.rx) * S + 2, span = (c.rx * 2 + 1) * S - 4
    if (c.type === 'store' && sp.id === 'atta') {
      const n = Math.min(10, 2 + Math.round(w.carb / 30))
      for (let k = 0; k < n; k++) { const x = x0 + ((k * 7) % span), hh = 4 + (k % 3) * 2; P.rect(L_ITEM, x, floor - hh, 5, hh, '#e9e2c8'); P.rect(L_ITEM, x + 1, floor - hh, 3, 1, '#ffffff'); P.rect(L_ITEM, x, floor - 1, 5, 1, '#5d7a3a') }
    } else if (c.type === 'store' && sp.id === 'honeypot') {
      const n = Math.min(c.rx * 2, 1 + Math.round(w.carb / 40)), ceil = (c.cy - c.ry) * S + 1
      for (let k = 0; k < n; k++) { const x = x0 + 2 + ((k * 6) % (span - 4)); P.rect(L_ITEM, x + 1, ceil, 2, 2, sp.body); P.rect(L_ITEM, x, ceil + 2, 5, 5, '#e8a838'); P.rect(L_ITEM, x + 1, ceil + 3, 1, 1, '#fff0b8') }
    } else if (c.type === 'store') {
      const nC = Math.min(14, Math.round(w.carb / 20)), nP = Math.min(8, Math.round(w.prot / 15))
      for (let k = 0; k < nC; k++) { const x = x0 + ((k * 7) % span), y = floor - 3 - Math.floor((k * 7) / span) * 3; P.rect(L_ITEM, x, y, 3, 3, '#e8a838'); P.rect(L_ITEM, x, y, 1, 1, '#fff0b8') }
      for (let k = 0; k < nP; k++) P.rect(L_ITEM, x0 + span - 4 - ((k * 9) % span), floor - 3 - (k % 2) * 2, 4, 2, '#b2442c')
    } else if (c.type === 'waste') for (let k = 0; k < 6; k++) P.rect(L_ITEM, x0 + ((k * 5) % span), floor - 2 - (k % 2), 2, 2, k % 3 ? '#6d6258' : '#8a7e70')
  }
  // 개미: 머리·가슴·배 세 마디, 다리는 프레임마다 번갈아
  const flip = w.tick % 2
  for (const [i, a] of ants.entries()) {
    const f = a.f ?? 1, out = a.st === 'out', climbing = out && a.up > 0
    const body = a.job === 'swarm' ? '#2b0e07' : a.kind === 'm' ? sp.major : a.kind === 's' ? '#3b3638' : sp.body
    const leaf = sp.carry ?? '#e8a838'
    if (climbing) {
      const x = a.x * S + (i % 2 ? 4 : -2), y = GY - 6 - a.up * S
      P.rect(L_ANT, x + 1, y, 2, 2, body); P.rect(L_ANT, x + 1, y + 2, 2, 1, body); P.rect(L_ANT, x, y + 3, 4, 3, body)
      P.rect(L_ANT, x - 1, y + 1 + flip, 1, 1, body); P.rect(L_ANT, x + 4, y + 2 - flip, 1, 1, body)
      if (a.carry) P.rect(L_FX, x + 1, y - 2, 2, 2, a.carry === 2 ? '#c9472f' : leaf)
      continue
    }
    const y = out ? GY - 6 : a.y * S + 1, x = a.x * S
    const g = f > 0 ? x : x + 3, th = f > 0 ? x + 3 : x + 1, hd = f > 0 ? x + 5 : x - 1
    const big = a.kind === 'm'
    P.rect(L_ANT, g, y + 1, 3, 3, body); P.rect(L_ANT, th, y + 1, 2, 2, body)
    P.rect(L_ANT, big ? (f > 0 ? hd : hd - 1) : hd, big ? y - 1 : y, big ? 3 : 2, big ? 3 : 2, body)
    P.rect(L_ANT, f > 0 ? hd + (big ? 3 : 2) : hd - 1, y - 1, 1, 1, body)
    for (let k = 0; k < 3; k++) P.rect(L_ANT, x + 1 + k * 2 + ((k + flip) % 2), y + 4, 1, 1, body)
    if (a.job === 'swarm') P.rect(L_FX, hd, y - 2, 2, 1, '#ff5a3c')
    if (a.carry) P.rect(L_FX, f > 0 ? hd + 1 : hd - 2, y - 2, sp.carry ? 4 : 3, sp.carry ? 3 : 2, a.carry === 2 ? '#c9472f' : leaf)
  }
  // 여왕: 크고 날개 자국이 있다
  const q = w.chambers[w.queen.room]!, qx = q.cx * S - 6, qy = (q.cy + q.ry) * S - 3
  P.rect(L_ANT, qx, qy, 8, 5, '#140c08'); P.rect(L_ANT, qx + 1, qy, 6, 1, '#3a2418'); P.rect(L_ANT, qx + 8, qy + 1, 4, 3, '#5a2a14'); P.rect(L_ANT, qx + 12, qy, 3, 3, '#140c08')
  P.rect(L_ANT, qx + 9, qy - 2, 3, 2, 'rgba(230,220,200,.5)'); P.rect(L_ANT, qx + 15, qy - 1, 1, 1, '#140c08')
  for (let k = 0; k < 3; k++) P.rect(L_ANT, qx + 7 + k * 2 + ((k + flip) % 2), qy + 5, 1, 1, '#140c08')
  // 천적
  for (const t of w.threats) {
    if (t.k === 'spider') {
      const cx = t.x * S + 3, cy = GY - 22
      let lines = ''
      for (let k = 0; k < 8; k++) { const an = (k / 8) * Math.PI * 2; lines += `M${cx} ${cy}l${(Math.cos(an) * 13).toFixed(1)} ${(Math.sin(an) * 13).toFixed(1)}` }
      P.raw(L_FX, `<path d="${lines}" stroke="rgba(245,245,240,.6)" stroke-width=".6" fill="none"/><circle cx="${cx}" cy="${cy}" r="5" stroke="rgba(245,245,240,.45)" stroke-width=".6" fill="none"/><circle cx="${cx}" cy="${cy}" r="9" stroke="rgba(245,245,240,.35)" stroke-width=".6" fill="none"/><path d="M${cx} ${GY - 35}V${cy}" stroke="rgba(245,245,240,.5)" stroke-width=".5"/>`)
      P.rect(L_FX, cx - 2, cy - 1, 4, 4, '#1d1a17'); P.rect(L_FX, cx - 1, cy - 3, 2, 2, '#1d1a17'); P.rect(L_FX, cx - 1, cy + 1, 2, 1, '#c9472f')
      for (const d of [-1, 1]) for (let k = 0; k < 3; k++) P.rect(L_FX, cx + (d < 0 ? -5 : 2), cy - 1 + k * 2, 3, 1, '#1d1a17')
    } else {
      const segs: [number, number][] = [[t.x, t.y], ...t.trail]
      segs.forEach(([sx, sy], k) => {
        const x = sx * S, y = sy * S + 1
        P.rect(L_FX, x, y, 6, 4, k === 0 ? '#5e1d12' : k % 2 ? '#b5452c' : '#9c3a24'); P.rect(L_FX, x + 1, y, 4, 1, '#d8643f')
        P.rect(L_FX, x, y + 4 + flip, 1, 1, '#e0b35a'); P.rect(L_FX, x + 5, y + 5 - flip, 1, 1, '#e0b35a'); P.rect(L_FX, x, y - 1 - flip, 1, 1, '#e0b35a')
      })
      P.rect(L_FX, t.x * S - 2, t.y * S - 1, 2, 1, '#e0b35a'); P.rect(L_FX, t.x * S + 6, t.y * S - 1, 2, 1, '#e0b35a')
      P.raw(L_FX, `<circle cx="${t.x * S + 3}" cy="${t.y * S + 3}" r="${(t.alarmR * S * 0.55).toFixed(1)}" fill="none" stroke="rgba(255,90,60,.4)" stroke-dasharray="3 3"/>`)
      P.rect(L_TXT, t.x * S - 4, t.y * S - 7, 14, 3, '#2a1a12'); P.rect(L_TXT, t.x * S - 4, t.y * S - 7, Math.max(1, Math.round((14 * t.hp) / t.hp0)), 3, '#de6a4c')
    }
  }
  // 군대개미 비박: 일개미 몸이 엉겨 붙은 살아 있는 둥지
  if (sp.bivouac) { const c = w.chambers[w.queen.room]!; for (let k = 0; k < 90; k++) { const ax = (c.cx - c.rx) * S + hash(k, 31) * (c.rx * 2 + 1) * S, ay = (c.cy - c.ry) * S + hash(k, 32) * (c.ry * 2 + 1) * S; P.rect(L_ITEM, ax, ay, 3, 2, k % 5 ? sp.body : sp.major) } }
  // 사무라이개미 노예사냥 행렬: 나갈 때는 빈 턱, 돌아올 때는 곰개미 번데기를 물고
  if (w.raid) {
    const ex = w.grid.findIndex((g, i) => i >= SURF * W && i < (SURF + 1) * W && g === TUN) - SURF * W, back = w.raid.t <= 3
    for (let k = 0; k < 14; k++) {
      const prog = ((w.tick * 7 + k * 9) % 60) / 60, x = back ? WW - prog * (WW - ex * S) : ex * S + prog * (WW - ex * S), y = GY - 6
      P.rect(L_FX, x, y + 1, 3, 3, sp.body); P.rect(L_FX, x + (back ? -2 : 3), y + 1, 2, 2, sp.body); P.rect(L_FX, x + (back ? -3 : 5), y, 3, 3, sp.major)
      if (back) P.rect(L_FX, x - 5, y - 1, 3, 4, '#efe2c8')
    }
    P.rect(L_TERR, WW - 14, GY - 7, 14, 7, '#8a6a46'); P.rect(L_TERR, WW - 10, GY - 9, 8, 2, '#8a6a46')
  }
  // 결혼비행: 날개 달린 신여왕과 수개미가 하늘을 난다
  if (w.flight > 0) for (let k = 0; k < 14; k++) {
    const x = (hash(k, 21) * WW + w.tick * (2 + k % 3) + k * 13) % WW, y = 8 + ((hash(k, 22) * (GY - 30) + w.tick * 3 * (k % 2 ? 1 : -1)) % (GY - 30) + GY) % (GY - 30)
    P.rect(L_FX, x, y + 1, 4, 2, sp.body); P.rect(L_FX, x + 1, y - 2 + flip, 3, 2, 'rgba(235,240,255,.75)'); P.rect(L_FX, x + 4, y + 1, 1, 1, sp.body)
  }
  // 비와 눈
  if (w.rain > 0 && s !== 3) for (let k = 0; k < 50; k++) P.rect(L_FX, (k * 37 + w.tick * 13) % WW, (k * 23 + w.tick * 29) % (GY - 4), 1, 5, 'rgba(215,232,245,.75)')
  if (s === 3 && sp.climate === 'temperate') for (let k = 0; k < 40; k++) P.rect(L_FX, (k * 41 + w.tick * 3) % WW, (k * 19 + w.tick * 5) % (GY - 4), 2, 2, 'rgba(255,255,255,.85)')
  if (nt > 0) P.rect(L_FX, 0, 0, WW, GY, `rgba(8,10,28,${(nt * 0.22).toFixed(2)})`)
  // 글자: 배경 상자를 깔고, 겹치면 생략
  const boxes: [number, number, number, number][] = []
  const label = (text: string, cx: number, y: number, fg: string, bg: string) => {
    const wdt = text.length * 4.4 + 6, x = Math.max(2, Math.min(WW - wdt - 2, cx - wdt / 2))
    if (boxes.some(([bx, by, bw, bh]) => x < bx + bw && x + wdt > bx && y - 8 < by + bh && y + 2 > by)) return
    boxes.push([x, y - 8, wdt, 10])
    P.raw(L_TXT, `<rect x="${x.toFixed(1)}" y="${y - 8}" width="${wdt.toFixed(1)}" height="10" rx="2" fill="${bg}"/><text x="${(x + wdt / 2).toFixed(1)}" y="${y}" font-size="7.5" text-anchor="middle" fill="${fg}">${text.replace(/[<>&"]/g, '')}</text>`)
  }
  label(sp.bivouac ? (lang === 'en' ? 'Bivouac (living nest)' : '비박 (살아 있는 둥지)') : lang === 'en' ? 'Queen' : '여왕', q.cx * S + 3, (q.cy - q.ry) * S - 2, '#1a120a', '#e3a33b')
  for (const c of w.chambers) if (c.type !== 'queen') label(RN[c.type], c.cx * S + 3, (c.cy - c.ry) * S - 2, '#efe4d2', 'rgba(20,14,10,.72)')
  for (const t of w.trees) if (t.farm) label(t.farm.slice(0, 14), t.x * S, GY + 10, '#eaf5df', 'rgba(30,60,30,.8)')
  if (fd > 0) label(`${lang === 'en' ? 'Frost line' : '동결선'} ${fd}cm`, WW - 40, GY + (fd / CM) * S - 2, '#0b1a2a', 'rgba(220,240,255,.9)')
  // 깊이 눈금
  for (let d = 15; d < (H - SURF) * CM; d += 15) { const y = (SURF + d / CM) * S; P.rect(L_TXT, 0, y, 4, 1, 'rgba(255,255,255,.45)'); P.raw(L_TXT, `<text x="6" y="${y + 3}" font-size="6" fill="rgba(255,255,255,.55)">${d}cm</text>`) }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WW} ${HH}" width="${WW}" height="${HH}" shape-rendering="crispEdges" font-family="monospace"><defs>${defs.join('')}</defs>${P.out()}</svg>`
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
