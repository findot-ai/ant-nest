// 개미굴 시뮬레이션: 브라우저 실험실(v0.4)의 모델을 줄여 옮긴 것.
// 1 tick = 게임 1시간. 계절 21일(겨울 7일). 군락은 3년차에서 시작한다.
export const W = 48, H = 64, SURF = 12, CM = 3
export const SKY = 0, SOIL = 1, TUN = 2, ROCK = 3
export const SEASONS = ['봄', '여름', '가을', '겨울']
export const SEASONS_EN = ['Spring', 'Summer', 'Autumn', 'Winter']
export type Lang = 'ko' | 'en'
const SEASON_T = [15, 25, 15, -3], SEASON_RAMP = [7, 1, -8, 0], T0 = 15
const DD: Record<Stage, number> = { egg: 18, larva: 30, pupa: 26 }
export const ROOMNAME: Record<RoomType, string> = { queen: '여왕방', brood: '육아방', store: '식량 창고', waste: '쓰레기 방' }
export const ROOMNAME_EN: Record<RoomType, string> = { queen: 'Queen', brood: 'Nursery', store: 'Storage', waste: 'Midden' }

export type Stage = 'egg' | 'larva' | 'pupa'
export type RoomType = 'queen' | 'brood' | 'store' | 'waste'
export type Chamber = { id: number; cx: number; cy: number; rx: number; ry: number; type: RoomType }
export type Brood = { st: Stage; n: number; dev: number; prot: number; room: number }
export type Cohort = { age: number; n: number; kind: 'w' | 'm' }
export type Ant = { x: number; y: number; kind: 'w' | 'm'; job: 'idle' | 'forage' | 'dig' | 'guard' | 'swarm'; st: 'in' | 'out'; tx: number; carry: 0 | 1 | 2; t: number; climb: number; up: number }
export type Threat = { k: 'spider' | 'centipede'; x: number; y: number; hp: number; hp0: number; life: number; tool?: string; trail: [number, number][]; alarmR: number; ate: number }
export type LogLine = { s: number; d: number; ko: string; en: string }
export type Tally = { explore: number; build: number; hunt: number; raise: number; bugs: number; fixed: number; mcp: number; skill: number; auto: number; plan: number; parallel: number }

export type World = {
  v: 3; seed: number; grid: number[]; chambers: Chamber[]; trees: { x: number; h: number; farm?: string }[]
  ep: number; day: number; tick: number; cohorts: Cohort[]; brood: Brood[]; carb: number; prot: number
  queen: { room: number; home: number; health: number }; deepest: number; tips: { x: number; y: number; dx: number; dy: number }[]
  digQueue: number; rain: number; threats: Threat[]; streak: Record<string, number>; log: LogLine[]
  today: Tally; total: Tally; dayKey: string
  instinct: number; trail: number; learned: Record<string, string>
}

export const epDays = (w: World) => ((w.ep - 1) % 4 === 3 ? 7 : 21)
export const season = (w: World) => (w.ep - 1) % 4
export const hour = (w: World) => w.tick % 24
export const isDay = (w: World) => { const h = hour(w); return h >= 6 && h < 19 }
export const workers = (w: World) => w.cohorts.filter(c => c.kind === 'w').reduce((a, c) => a + c.n, 0)
export const majors = (w: World) => w.cohorts.filter(c => c.kind === 'm').reduce((a, c) => a + c.n, 0)
export const bcount = (w: World, st: Stage) => w.brood.filter(b => b.st === st).reduce((a, b) => a + b.n, 0)
export const epName = (ep: number, lang: Lang = 'ko') => (lang === 'en' ? `Year ${Math.floor((ep - 1) / 4) + 1} ${SEASONS_EN[(ep - 1) % 4]}` : `${Math.floor((ep - 1) / 4) + 1}년차 ${SEASONS[(ep - 1) % 4]}`)
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)
export const idx = (x: number, y: number) => y * W + x
export const inb = (x: number, y: number) => x >= 0 && x < W && y >= 0 && y < H
export const layerOf = (y: number) => { const d = y - SURF; return d < 6 ? 0 : d < 22 ? 1 : d < 38 ? 2 : 3 }
const rnd = Math.random
export const emptyTally = (): Tally => ({ explore: 0, build: 0, hunt: 0, raise: 0, bugs: 0, fixed: 0, mcp: 0, skill: 0, auto: 0, plan: 0, parallel: 0 })

// ---------- 온도: T(z,t) = 12 + (계절평균−12)e^(−z/80) + 일교차·e^(−z/12)·sin(ωt − z/12) ----------
export function airMean(w: World) {
  const s = season(w)
  return SEASON_T[s]! + SEASON_RAMP[s]! * ((w.day - 1) / (epDays(w) - 1) - 0.5) + (w.rain > 0 ? -2 : 0)
}
export function tempAt(w: World, y: number) {
  const s = season(w), z = Math.max(0, (y - SURF) * CM), amp = s === 1 ? 6 : s === 3 ? 4 : 5.5
  const om = (2 * Math.PI) / 24
  return 12 + (airMean(w) - 12) * Math.exp(-z / 80) + amp * Math.exp(-z / 12) * Math.sin(om * (hour(w) - 9) - z / 12)
}
export function airT(w: World) { const s = season(w), amp = s === 1 ? 6 : s === 3 ? 4 : 5.5; return airMean(w) + amp * Math.sin(((2 * Math.PI) / 24) * (hour(w) - 9)) }
export function frostDepth(w: World) { let d = 0; for (let y = SURF; y < H; y++) { if (tempAt(w, y) < 0) d = (y - SURF + 1) * CM; else break } return d }

// ---------- 지형 ----------
export function chamberAt(w: World, x: number, y: number) {
  for (const c of w.chambers) if (((x - c.cx) / (c.rx + 0.4)) ** 2 + ((y - c.cy) / (c.ry + 0.4)) ** 2 <= 1) return c
  return null
}
function carve(w: World, x: number, y: number) {
  if (!inb(x, y) || y < SURF) return false
  const i = idx(x, y); if (w.grid[i] === ROCK) return false
  w.grid[i] = TUN; if (y > w.deepest) w.deepest = y; return true
}
function makeChamber(w: World, cx: number, cy: number, rx: number, ry: number, type: RoomType) {
  const id = w.chambers.length
  for (let y = cy - ry; y <= cy + ry; y++) for (let x = cx - rx; x <= cx + rx; x++)
    if (((x - cx) / (rx + 0.4)) ** 2 + ((y - cy) / (ry + 0.4)) ** 2 <= 1) carve(w, x, y)
  w.chambers.push({ id, cx, cy, rx, ry, type }); return id
}

export function newWorld(seed = Math.floor(rnd() * 90000) + 10000): World {
  const w: World = {
    v: 3, seed, grid: new Array(W * H).fill(SOIL), chambers: [], trees: [], ep: 1, day: 1, tick: 6,
    cohorts: [{ age: 60, n: 46, kind: 'w' }, { age: 25, n: 52, kind: 'w' }, { age: 8, n: 14, kind: 'w' }, { age: 40, n: 9, kind: 'm' }],
    brood: [], carb: 45, prot: 16, queen: { room: 0, home: 0, health: 100 }, deepest: SURF, tips: [], digQueue: 0, rain: 0,
    threats: [], streak: {}, log: [], today: emptyTally(), total: emptyTally(), dayKey: '', instinct: 0, trail: 0, learned: {},
  }
  for (let y = 0; y < SURF; y++) for (let x = 0; x < W; x++) w.grid[idx(x, y)] = SKY
  const nx = 16 + Math.floor(rnd() * 16)
  for (let k = 0; k < 9; k++) {
    const cx = 2 + Math.floor(rnd() * (W - 4)), cy = SURF + 10 + Math.floor(rnd() * (H - SURF - 14))
    if (Math.abs(cx - nx) < 9 && cy < SURF + 28) continue
    const r = 1 + Math.floor(rnd() * 2)
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r - 1; x <= cx + r + 1; x++)
      if (inb(x, y) && (x - cx) ** 2 / (r + 1) ** 2 + (y - cy) ** 2 / r ** 2 <= 1) w.grid[idx(x, y)] = ROCK
  }
  for (let y = H - 2; y < H; y++) for (let x = 0; x < W; x++) w.grid[idx(x, y)] = ROCK
  for (const x of [5 + Math.floor(rnd() * 6), W - 6 - Math.floor(rnd() * 6)]) w.trees.push({ x, h: 7 + Math.floor(rnd() * 3) })
  // 3년차 둥지: 세로 갱도 하나에 방이 층층이 (얕은 방은 길쭉, 깊은 방은 둥글게)
  for (let y = SURF; y <= SURF + 24; y++) { carve(w, nx, y); if (y < SURF + 3) carve(w, nx + 1, y) }
  const L: [number, number, RoomType, number, number][] = [[3, -1, 'store', 4, 1], [6, 1, 'waste', 2, 1], [10, -1, 'brood', 3, 1], [14, 1, 'brood', 3, 2], [18, -1, 'queen', 3, 2], [23, 1, 'brood', 3, 2]]
  for (const [d, dir, type, rx, ry] of L) {
    const y = SURF + d; let ex = nx
    for (let k = 0; k < 3; k++) { ex += dir; carve(w, ex, y) }
    const id = makeChamber(w, ex + dir * (rx + 1), y, rx, ry, type)
    if (type === 'queen') w.queen = { room: id, home: id, health: 100 }
  }
  w.tips.push({ x: nx, y: SURF + 24, dx: 0, dy: 1 }, { x: nx - 6, y: SURF + 10, dx: -1, dy: 0 })
  w.brood.push({ st: 'larva', n: 24, dev: 0.35, prot: 24 * 0.12, room: w.queen.room })
  say(w, '3년차 군락. 일개미 112, 병정 9, 애벌레 24마리가 함께 겨울을 났다.', 'A third-year colony: 112 workers, 9 majors and 24 larvae made it through winter.')
  say(w, '이제부터 당신의 AI 활용이 이 군락의 먹이이자 날씨다.', 'From now on, the way you use AI is this colony\'s food and weather.')
  return w
}

export function say(w: World, ko: string, en: string) {
  w.log.push({ s: season(w), d: w.day, ko, en })
  if (w.log.length > 30) w.log.shift()
}

// ---------- 굴착 ----------
function digStep(w: World) {
  if (!w.tips.length) { const c = w.chambers[Math.floor(rnd() * w.chambers.length)]!; w.tips.push({ x: c.cx + c.rx, y: c.cy, dx: 1, dy: 1 }) }
  const ti = Math.floor(rnd() * w.tips.length), t = w.tips[ti]!
  if (rnd() < 0.2) { const o = [[0, 1], [1, 0], [-1, 0], [1, 1], [-1, 1]][Math.floor(rnd() * 5)]!; t.dx = o[0]!; t.dy = o[1]! }
  const nx = t.x + t.dx, ny = t.y + t.dy
  if (ny < SURF + 3 || nx < 2 || nx > W - 3 || ny > H - 4 || w.grid[idx(nx, ny)] === ROCK) { t.dx = -t.dx || 1; t.dy = rnd() < 0.5 ? 1 : 0; return false }
  t.x = nx; t.y = ny; carve(w, nx, ny)
  if (rnd() < 0.09 && w.chambers.length < Math.min(18, 6 + Math.floor((workers(w) + majors(w)) / 40))) {
    const c = { brood: 0, store: 0, waste: 0 } as Record<string, number>
    for (const ch of w.chambers) c[ch.type] = (c[ch.type] ?? 0) + 1
    const type: RoomType = (c.store ?? 0) < 1 + Math.floor(w.carb / 120) ? 'store' : (c.waste ?? 0) < 1 + Math.floor(workers(w) / 200) ? 'waste' : 'brood'
    const rx = type === 'waste' ? 2 : 3, ry = type === 'waste' ? 1 : 2
    makeChamber(w, t.x + (t.dx >= 0 ? rx + 1 : -rx - 1), t.y, rx, ry, type)
    say(w, `지하 ${(t.y - SURF) * CM}cm에 ${ROOMNAME[type]}을 새로 팠다.`, `Dug a new ${ROOMNAME_EN[type].toLowerCase()} chamber ${(t.y - SURF) * CM}cm down.`)
    if (w.tips.length < 4) w.tips.push({ x: t.x, y: t.y, dx: -t.dx || 1, dy: 1 })
    return true
  }
  return false
}

// ---------- 시간 ----------
function broodHour(w: World) {
  const winter = season(w) === 3
  for (const b of w.brood) {
    const c = w.chambers[b.room] ?? w.chambers[w.queen.room]!
    const add = winter && b.st !== 'pupa' ? 0 : Math.max(0, tempAt(w, c.cy) - T0) / DD[b.st] / 24
    b.dev += add
    if (b.dev >= 1) {
      b.dev = 0
      if (b.st === 'egg') b.st = 'larva'
      else if (b.st === 'larva') b.st = 'pupa'
      else { emerge(w, b); b.n = 0 }
    }
  }
  w.brood = w.brood.filter(b => b.n > 0.05)
}
function emerge(w: World, b: Brood) {
  const sat = b.prot / Math.max(0.1, b.n) / 0.2
  const mf = workers(w) > 30 && sat > 0.5 ? clamp(0.03 + (sat - 0.6) * 0.12, 0, 0.25) : 0
  w.cohorts.push({ age: 0, n: b.n * (1 - mf), kind: 'w' })
  if (mf > 0) w.cohorts.push({ age: 0, n: b.n * mf, kind: 'm' })
  if (b.n > 1) say(w, `고치에서 새 일개미 ${Math.round(b.n * (1 - mf))}마리${mf > 0.02 ? `, 병정 ${Math.round(b.n * mf)}마리` : ''}가 깨어났다.`, `${Math.round(b.n * (1 - mf))} new workers${mf > 0.02 ? ` and ${Math.round(b.n * mf)} majors` : ''} hatched from their cocoons.`)
}
function relocateBrood(w: World) {
  const cands = w.chambers.filter(c => c.type === 'brood' || c.type === 'queen')
  if (!cands.length || season(w) === 3) return
  const score = (c: Chamber) => -Math.abs(tempAt(w, c.cy) - 26) - (c.type === 'brood' ? 0 : 1.5)
  let best = cands[0]!; for (const c of cands) if (score(c) > score(best)) best = c
  for (const b of w.brood) { const cur = w.chambers[b.room]; if (!cur || score(best) - score(cur) > 2) b.room = best.id }
}

function dayTick(w: World) {
  const s = season(w), Wn = workers(w), Mn = majors(w)
  // 본능 채집(기본 수입). AI 활용 이벤트는 따로 들어온다.
  // 자동화는 본능이 된다: 내가 없어도 개미들이 스스로 하는 일
  const inst = 1 + w.instinct * 0.1
  if (s !== 3 && w.rain <= 0) { w.carb += Wn * 0.028 * inst; w.prot += Wn * 0.004 * inst }
  w.trail *= 0.9
  const Tn = tempAt(w, w.chambers[w.queen.room]!.cy), q10 = Math.pow(2, (Tn - 20) / 10)
  w.carb -= (Wn * 0.03 + Mn * 0.045) * q10
  let starving = false; if (w.carb < 0) { w.carb = 0; starving = true }
  // 창고가 담을 수 있는 만큼만 남는다. 창고는 굴착(편집)으로 늘어난다.
  const stores = w.chambers.filter(c => c.type === 'store').length
  w.carb = Math.min(w.carb, 60 + stores * 90); w.prot = Math.min(w.prot, 30 + stores * 45)
  const larvae = bcount(w, 'larva')
  const need = larvae * 0.06 * Math.max(0.2, q10), fed = Math.min(w.prot, need); w.prot -= fed
  for (const b of w.brood) if (b.st === 'larva') b.prot += fed * (b.n / Math.max(0.1, larvae))
  if (fed < need * 0.6 && larvae > 3) for (const b of w.brood) if (b.st === 'egg') b.n *= 0.8
  const fT = Tn < 12 ? 0 : Tn < 22 ? (Tn - 12) / 10 : Tn < 30 ? 1 : 0
  const fP = clamp(w.prot / (5 + Wn * 0.05), 0, 1) * 0.7 + 0.3
  const fF = clamp(w.carb / (Wn * 0.6 + 10), 0.3, 1.6)
  const lay = s === 3 ? 0 : (3 + Math.min(30, Wn * 0.07)) * fT * fP * fF * (w.queen.health / 100)
  if (lay > 0.15) { w.prot = Math.max(0, w.prot - lay * 0.05); const br = w.chambers.find(c => c.type === 'brood'); w.brood.push({ st: 'egg', n: lay, dev: 0, prot: 0, room: br ? br.id : w.queen.room }) }
  for (const c of w.cohorts) {
    const L = c.kind === 'm' ? 180 : 140
    let h = (1 / L) * clamp(q10, 0.4, 1.8) * (s === 3 ? 0.3 : 1) + (starving ? 0.035 : 0)
    if (c.age > L * 1.6) h += 0.05
    c.n *= 1 - Math.min(0.2, h); c.age++
  }
  const merged: Cohort[] = []
  for (const c of w.cohorts) { const m = merged.find(x => x.kind === c.kind && Math.abs(x.age - c.age) < 4); if (m) { m.age = (m.age * m.n + c.age * c.n) / (m.n + c.n); m.n += c.n } else if (c.n > 0.05) merged.push({ ...c }) }
  w.cohorts = merged
  if (starving) say(w, '단물이 바닥났다. 굶는 개미가 생긴다.', 'The honeydew ran out. Ants are starving.')
  if (s === 3) {
    const r = w.chambers[w.queen.room]!
    if (tempAt(w, r.cy) < 0.5) { for (const c of w.cohorts) c.n *= 0.985; say(w, '동결선이 겨울방까지 내려왔다. 얼어 죽는 개미가 생긴다.', 'The frost line reached the winter chamber. Some ants froze.') }
  }
  w.day++
  if (w.day > epDays(w)) {
    w.ep++; w.day = 1
    const ns = season(w)
    if (ns === 3) {
      let deep = w.chambers[0]!; for (const c of w.chambers) if (c.type !== 'waste' && c.cy > deep.cy) deep = c
      w.queen.room = deep.id; for (const b of w.brood) b.room = deep.id
      for (const b of w.brood) if (b.st === 'egg') b.n = 0
      say(w, `겨울. 여왕과 애벌레를 지하 ${(deep.cy - SURF) * CM}cm 방으로 옮기고 모두 몸을 맞대 멈췄다.`, `Winter. The queen and larvae moved to the chamber ${(deep.cy - SURF) * CM}cm down, and everyone huddled still.`)
    } else if (ns === 0) { w.queen.room = w.queen.home; say(w, `${epName(w.ep)}. 땅이 데워지면 여왕이 다시 알을 낳는다.`, `${epName(w.ep, 'en')}. Once the soil warms, the queen lays again.`) }
    else say(w, `${epName(w.ep)}이 시작됐다.`, `${epName(w.ep, 'en')} begins.`)
  }
}

export function hourTick(w: World) {
  w.tick++
  broodHour(w)
  if (w.tick % 6 === 0) relocateBrood(w)
  if (w.rain > 0) w.rain--
  if (w.digQueue > 0 && season(w) !== 3) { const n = Math.min(3, w.digQueue); for (let k = 0; k < n; k++) digStep(w); w.digQueue -= n }
  else if (season(w) !== 3 && rnd() < 0.15) digStep(w)
  threatHour(w)
  if (w.tick % 24 === 0) dayTick(w)
}

// ---------- 천적 ----------
const entranceX = (w: World) => { for (let x = 0; x < W; x++) if (w.grid[idx(x, SURF)] === TUN) return x; return W / 2 }
function randTunnel(w: World) {
  for (let k = 0; k < 300; k++) { const x = 2 + Math.floor(rnd() * (W - 4)), y = SURF + 6 + Math.floor(rnd() * (H - SURF - 10)); if (w.grid[idx(x, y)] === TUN && !chamberAt(w, x, y)) return { x, y } }
  return { x: entranceX(w), y: SURF + 4 }
}
export function spawnSpider(w: World) {
  if (w.threats.some(t => t.k === 'spider')) return
  const ex = entranceX(w)
  w.threats.push({ k: 'spider', x: clamp(ex + (rnd() < 0.5 ? -4 : 4), 2, W - 3), y: SURF - 1, hp: 3, hp0: 3, life: 24 * 2, trail: [], alarmR: 0, ate: 0 })
  say(w, '오류가 났다. 채집 길목에 거미가 줄을 쳤다.', 'An error. A spider spun a web across the foraging trail.')
}
export function spawnCentipede(w: World, tool: string) {
  if (w.threats.some(t => t.k === 'centipede')) return
  const p = randTunnel(w), hp = 18 + (workers(w) + majors(w)) * 0.05
  w.threats.push({ k: 'centipede', x: p.x, y: p.y, hp, hp0: hp, life: 24 * 2, tool, trail: [], alarmR: 0, ate: 0 })
  say(w, `같은 오류(${tool})가 되풀이됐다. 지하 ${(p.y - SURF) * CM}cm 굴 벽을 뚫고 지네가 들어왔다.`, `The same error (${tool}) keeps coming back. A centipede broke in ${(p.y - SURF) * CM}cm down.`)
}
export function defeatCentipede(w: World, byFix: boolean) {
  const c = w.threats.find(t => t.k === 'centipede'); if (!c) return false
  c.life = 0; w.prot += 8
  const lost = c.ate > 1 ? Math.round(c.ate) : 0
  if (byFix) say(w, `버그를 잡았다. 수비대가 지네를 쓰러뜨렸고, 지네는 애벌레의 단백질이 된다.${lost ? ` (새끼 ${lost}마리를 잃음)` : ''}`, `Bug fixed. The defenders brought the centipede down, and it becomes protein for the larvae.${lost ? ` (${lost} brood lost)` : ''}`)
  else say(w, '수비대가 지네를 쓰러뜨렸다. 지네는 애벌레의 단백질이 된다.', 'The defenders brought the centipede down. It becomes protein for the larvae.')
  return true
}
function threatHour(w: World) {
  for (const t of w.threats) {
    t.life--
    if (t.k === 'centipede') {
      if (!t.alarmR) t.alarmR = 4; else t.alarmR = Math.min(30, t.alarmR + 2)
      // 새끼가 가장 많은 방을 노린다
      const rooms: Record<number, number> = {}; for (const b of w.brood) rooms[b.room] = (rooms[b.room] ?? 0) + b.n
      let tgt = w.chambers[w.queen.room]!, best = 0
      for (const id in rooms) if (rooms[id]! > best) { best = rooms[id]!; tgt = w.chambers[+id]! }
      t.trail.unshift([t.x, t.y]); if (t.trail.length > 4) t.trail.pop()
      step(w, t, tgt.cx, tgt.cy, 0.8)
      const here = chamberAt(w, t.x, t.y)
      if (here) for (const b of w.brood) if (b.room === here.id && b.n > 0.1) { const e = Math.min(b.n, 0.5); b.n -= e; t.ate += e; break }
      t.hp -= 0.15 * Math.min(40, majors(w) * 0.6 + workers(w) * 0.02)
      for (const c of w.cohorts) if (c.kind === 'w' && rnd() < 0.3) { c.n = Math.max(0, c.n - 0.15); break }
      if (t.hp <= 0) defeatCentipede(w, false)
      else if (t.life <= 0) say(w, `고치지 못한 지네가 굴을 빠져나갔다. 새끼 ${Math.round(t.ate)}마리를 잃었다.`, `The unfixed centipede slipped away. ${Math.round(t.ate)} brood were lost.`)
    } else if (t.k === 'spider' && t.life <= 0) say(w, '거미가 자리를 옮겼다.', 'The spider moved on.')
  }
  w.threats = w.threats.filter(t => t.life > 0)
}

// ---------- 움직임 (화면용 개미) ----------
const NB = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const
export function step(w: World, a: { x: number; y: number }, tx: number, ty: number, bias: number) {
  const opts: [number, number, number][] = []
  for (const [dx, dy] of NB) {
    const nx = a.x + dx, ny = a.y + dy
    if (!inb(nx, ny) || w.grid[idx(nx, ny)] !== TUN) continue
    let wt = 1; if (Math.abs(nx - tx) + Math.abs(ny - ty) < Math.abs(a.x - tx) + Math.abs(a.y - ty)) wt += bias * 5
    opts.push([dx, dy, wt])
  }
  if (!opts.length) return
  let s = 0; for (const o of opts) s += o[2]
  let v = rnd() * s; for (const o of opts) { v -= o[2]; if (v <= 0) { a.x += o[0]; a.y += o[1]; return } }
}

export function syncAnts(w: World, ants: Ant[]) {
  const tw = Math.min(70, Math.round(workers(w) / 4)), tm = Math.min(12, Math.round(majors(w) / 2))
  const cnt = { w: ants.filter(a => a.kind === 'w').length, m: ants.filter(a => a.kind === 'm').length }
  const q = w.chambers[w.queen.room]!
  while (cnt.w < tw) { ants.push({ x: q.cx, y: q.cy, kind: 'w', job: 'idle', st: 'in', tx: 0, carry: 0, t: 0, climb: 0, up: 0 }); cnt.w++ }
  while (cnt.m < tm) { ants.push({ x: q.cx, y: q.cy, kind: 'm', job: 'guard', st: 'in', tx: 0, carry: 0, t: 0, climb: 0, up: 0 }); cnt.m++ }
  for (const k of ['w', 'm'] as const) { const target = k === 'w' ? tw : tm; while ((k === 'w' ? cnt.w : cnt.m) > target) { const j = ants.findIndex(a => a.kind === k && a.st === 'in'); if (j < 0) break; ants.splice(j, 1); if (k === 'w') cnt.w--; else cnt.m-- } }
}

export function sendForager(w: World, ants: Ant[], carry: 1 | 2) {
  if (season(w) === 3) return
  const a = ants.find(x => x.kind === 'w' && x.st === 'in' && x.job === 'idle')
  if (!a) return
  const tree = w.trees[Math.floor(rnd() * w.trees.length)]!
  a.job = 'forage'; a.carry = 0; a.t = carry; a.tx = carry === 1 ? tree.x : 3 + Math.floor(rnd() * (W - 6)); a.climb = carry === 1 ? tree.h - 2 : 0; a.up = 0
}
export function sendDigger(w: World, ants: Ant[]) {
  const a = ants.find(x => x.kind === 'w' && x.st === 'in' && x.job === 'idle'); if (a) { a.job = 'dig'; a.t = 20 }
}

export function moveAnts(w: World, ants: Ant[]) {
  const s = season(w), cen = w.threats.find(t => t.k === 'centipede'), spider = w.threats.find(t => t.k === 'spider')
  const ex = entranceX(w), qr = w.chambers[w.queen.room]!
  for (const a of ants) {
    if (a.st === 'out') {
      // 나무에 오르내리기: up이 지금 높이, climb이 진딧물이 있는 높이
      if (!a.carry && a.x === a.tx) { if (a.up < a.climb) { a.up++; continue } a.carry = a.t as 1 | 2; continue }
      if (a.carry && a.up > 0) { a.up--; continue }
      const goal = a.carry ? ex : a.tx
      if (spider && a.x === spider.x && rnd() < 0.12) { const old = w.cohorts.filter(c => c.kind === 'w').sort((x, y) => y.age - x.age)[0]; if (old) old.n = Math.max(0, old.n - 1); say(w, '채집 개미 한 마리가 거미줄에 걸렸다.', 'A forager got caught in the web.'); a.st = 'in'; a.job = 'idle'; a.x = qr.cx; a.y = qr.cy; a.carry = 0; continue }
      if (a.x !== goal) a.x += Math.sign(goal - a.x)
      else { a.st = 'in'; a.y = SURF; a.job = 'idle'; a.carry = 0 }
      continue
    }
    if (w.grid[idx(a.x, a.y)] !== TUN) { a.x = qr.cx; a.y = qr.cy }
    if (s === 3) { step(w, a, qr.cx + Math.round((rnd() - 0.5) * qr.rx * 2), qr.cy, 0.8); continue }
    if (cen && (a.kind === 'm' || Math.abs(a.x - cen.x) + Math.abs(a.y - cen.y) <= cen.alarmR)) { a.job = 'swarm'; step(w, a, cen.x, cen.y, 0.97); continue }
    if (a.job === 'swarm') a.job = a.kind === 'm' ? 'guard' : 'idle'
    if (a.job === 'forage') { if (a.y <= SURF) { a.st = 'out'; a.y = SURF - 1 } else step(w, a, ex, SURF, 0.9); continue }
    if (a.job === 'dig') { const t = w.tips[0]; if (t) step(w, a, t.x, t.y, 0.8); if (--a.t <= 0) a.job = 'idle'; continue }
    if (a.job === 'guard') { step(w, a, ex + Math.round((rnd() - 0.5) * 3), SURF + 3, 0.6); continue }
    const rooms = w.chambers.filter(c => c.type !== 'waste'), r = rooms[(a.x * 7 + a.y) % rooms.length]!
    step(w, a, r.cx + Math.round((rnd() - 0.5) * r.rx * 2), r.cy, rnd() < 0.5 ? 0.6 : 0.1)
  }
}

// ---------- 외부 목초지(MCP 서버 하나 = 진딧물 나무 하나) ----------
export function farmFor(w: World, server: string) {
  const t = w.trees.find(x => x.farm === server)
  if (t) return t
  if (w.trees.length >= 7) return w.trees[Math.floor(rnd() * w.trees.length)]!
  for (let k = 0; k < 40; k++) {
    const x = 3 + Math.floor(rnd() * (W - 6))
    if (w.trees.some(o => Math.abs(o.x - x) < 5) || Math.abs(x - entranceX(w)) < 3) continue
    const nt = { x, h: 5 + Math.floor(rnd() * 3), farm: server }
    w.trees.push(nt)
    say(w, `새 외부 목초지를 찾았다: ${server}. 개미들이 그 나무의 진딧물을 치기 시작한다.`, `Found a new outside pasture: ${server}. The ants start herding the aphids on that tree.`)
    return nt
  }
  return w.trees[0]!
}
export function sendTo(w: World, ants: Ant[], x: number, h: number, carry: 1 | 2) {
  if (season(w) === 3) return
  const a = ants.find(o => o.kind === 'w' && o.st === 'in' && o.job === 'idle'); if (!a) return
  a.job = 'forage'; a.carry = 0; a.t = carry; a.tx = x; a.climb = Math.max(0, h - 2); a.up = 0
}
