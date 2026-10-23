// 개미굴 시뮬레이션: 브라우저 실험실(v0.4)의 모델을 줄여 옮긴 것.
// 1 tick = 게임 1시간. 계절 21일(겨울 7일). 시작 규모와 종은 설치 시점의 사용 패턴으로 정한다.
import { SPECIES } from './species'
import type { SpeciesId, Species } from './species'
import { guestsFor, guestById, RARITY_KO, RARITY_EN } from './guests'
import type { GuestId } from './guests'
export const W = 48, H = 64, SURF = 12, CM = 3
export const SKY = 0, SOIL = 1, TUN = 2, ROCK = 3
export const SEASONS = ['봄', '여름', '가을', '겨울']
export const SEASONS_EN = ['Spring', 'Summer', 'Autumn', 'Winter']
export type Lang = 'ko' | 'en'
const CLIMATE = { temperate: { t: [15, 25, 15, -3], ramp: [7, 1, -8, 0] }, tropical: { t: [26, 27, 26, 24], ramp: [0, 0, 0, 0] }, desert: { t: [20, 31, 21, 6], ramp: [6, 1, -7, 0] } }
const T0 = 15
export const YEAR_DAYS = 70
const DD: Record<Stage, number> = { egg: 18, larva: 30, pupa: 26 }
export const ROOMNAME: Record<RoomType, string> = { queen: '여왕방', brood: '육아방', store: '식량 창고', waste: '쓰레기 방' }
export const ROOMNAME_EN: Record<RoomType, string> = { queen: 'Queen', brood: 'Nursery', store: 'Storage', waste: 'Midden' }

export type Stage = 'egg' | 'larva' | 'pupa'
export type RoomType = 'queen' | 'brood' | 'store' | 'waste'
export type Chamber = { id: number; cx: number; cy: number; rx: number; ry: number; type: RoomType }
export type Brood = { st: Stage; n: number; dev: number; prot: number; room: number; slave?: boolean }
export type Cohort = { age: number; n: number; kind: 'w' | 'm' | 's' }   // s = 훔쳐 온 노예 일개미(사무라이개미)
export type Ant = { x: number; y: number; kind: 'w' | 'm' | 's'; job: 'idle' | 'forage' | 'dig' | 'guard' | 'swarm'; st: 'in' | 'out'; tx: number; carry: 0 | 1 | 2; t: number; climb: number; up: number; f?: number }
export type Threat = { k: 'spider' | 'centipede'; x: number; y: number; hp: number; hp0: number; life: number; tool?: string; trail: [number, number][]; alarmR: number; ate: number }
export type Lineage = { gen: number; species: SpeciesId; years: number; peak: number; fixed: number; ended: 'succession' | 'collapse' }
export type Origin = { stage: Stage0; ko: string; en: string }
export type Stage0 = 'found' | 'young' | 'mature'
export type Setup = { species: SpeciesId; stage: Stage0; farms: string[]; trail: number; instinct: number; majorBias: number; storeBias: number; ko: string; en: string }
export type LogLine = { s: number; d: number; ko: string; en: string }
export type Tally = { explore: number; build: number; hunt: number; raise: number; bugs: number; fixed: number; mcp: number; skill: number; auto: number; plan: number; parallel: number }

export type World = {
  v: 4; over?: boolean; guests: { id: GuestId; x: number; y: number; days: number }[]; dex: Record<string, { n: number; first: string }>; newDex: string[]; gift?: string; raid?: { t: number; booty: number } | null; raidDay?: number; seed: number; species: SpeciesId; gen: number; lineage: Lineage[]; peak: number; flownYear: number; alates: number; flight: number; origin: Origin; grid: number[]; chambers: Chamber[]; trees: { x: number; h: number; farm?: string }[]
  ep: number; day: number; tick: number; cohorts: Cohort[]; brood: Brood[]; carb: number; prot: number
  queen: { room: number; home: number; health: number; age: number }; deepest: number; tips: { x: number; y: number; dx: number; dy: number }[]
  digQueue: number; rain: number; threats: Threat[]; streak: Record<string, number>; log: LogLine[]
  today: Tally; total: Tally; dayKey: string
  instinct: number; trail: number; learned: Record<string, string>
}

export const epDays = (w: World) => ((w.ep - 1) % 4 === 3 ? 7 : 21)
export const season = (w: World) => (w.ep - 1) % 4
export const SP = (w: World): Species => SPECIES[w.species] ?? SPECIES.japonicus
// 겨울잠: 온대·사막 종만 겨울에 멈춘다 (열대는 건기일 뿐)
export const isWinter = (w: World) => season(w) === 3 && SP(w).climate !== 'tropical'
export const SEASONS_TROP = ['우기 초', '우기', '건기 초', '건기'], SEASONS_TROP_EN = ['Early wet', 'Wet season', 'Early dry', 'Dry season']
export const seasonName = (w: World, s: number, lang: Lang) => (SP(w).climate === 'tropical' ? (lang === 'en' ? SEASONS_TROP_EN : SEASONS_TROP) : lang === 'en' ? SEASONS_EN : SEASONS)[s]!
export const queenYears = (w: World) => w.queen.age / YEAR_DAYS
export const hour = (w: World) => w.tick % 24
export const isDay = (w: World) => { const h = hour(w); return h >= 6 && h < 19 }
export const workers = (w: World) => w.cohorts.filter(c => c.kind !== 'm').reduce((a, c) => a + c.n, 0)
export const slaves = (w: World) => w.cohorts.filter(c => c.kind === 's').reduce((a, c) => a + c.n, 0)
export const raiders = (w: World) => w.cohorts.filter(c => c.kind === 'w').reduce((a, c) => a + c.n, 0)
// 군대개미: 정착기 20일(산란) + 유랑기 14일
export const armyPhase = (w: World) => (w.queen.age % 34 < 20 ? 'statary' : 'nomadic')
export const majors = (w: World) => w.cohorts.filter(c => c.kind === 'm').reduce((a, c) => a + c.n, 0)
export const bcount = (w: World, st: Stage) => w.brood.filter(b => b.st === st).reduce((a, b) => a + b.n, 0)
export const epName = (ep: number, lang: Lang = 'ko', w?: World) => { const sn = w ? seasonName(w, (ep - 1) % 4, lang) : (lang === 'en' ? SEASONS_EN : SEASONS)[(ep - 1) % 4]; return lang === 'en' ? `Year ${Math.floor((ep - 1) / 4) + 1} ${sn}` : `${Math.floor((ep - 1) / 4) + 1}년차 ${sn}` }
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)
export const idx = (x: number, y: number) => y * W + x
export const inb = (x: number, y: number) => x >= 0 && x < W && y >= 0 && y < H
export const layerOf = (y: number) => { const d = y - SURF; return d < 6 ? 0 : d < 22 ? 1 : d < 38 ? 2 : 3 }
const rnd = Math.random
export const emptyTally = (): Tally => ({ explore: 0, build: 0, hunt: 0, raise: 0, bugs: 0, fixed: 0, mcp: 0, skill: 0, auto: 0, plan: 0, parallel: 0 })

// ---------- 온도: T(z,t) = 12 + (계절평균−12)e^(−z/80) + 일교차·e^(−z/12)·sin(ωt − z/12) ----------
export function airMean(w: World) {
  const s = season(w)
  const C = CLIMATE[SP(w).climate]
  return C.t[s]! + C.ramp[s]! * ((w.day - 1) / (epDays(w) - 1) - 0.5) + (w.rain > 0 ? -2 : 0)
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
// 새 방이 기존 방과 겹치지 않는지 (가장자리 2칸 여유)
function roomFree(w: World, cx: number, cy: number, rx: number, ry: number) {
  if (cx - rx < 2 || cx + rx > W - 3 || cy - ry < SURF + 3 || cy + ry > H - 4) return false
  return w.chambers.every(c => Math.abs(c.cx - cx) > c.rx + rx + 2 || Math.abs(c.cy - cy) > c.ry + ry + 2)
}
function makeChamber(w: World, cx: number, cy: number, rx: number, ry: number, type: RoomType) {
  const id = w.chambers.length
  for (let y = cy - ry; y <= cy + ry; y++) for (let x = cx - rx; x <= cx + rx; x++)
    if (((x - cx) / (rx + 0.4)) ** 2 + ((y - cy) / (ry + 0.4)) ** 2 <= 1) carve(w, x, y)
  w.chambers.push({ id, cx, cy, rx, ry, type }); return id
}

export const DEFAULT_SETUP: Setup = { species: 'japonicus', stage: 'mature', farms: [], trail: 0, instinct: 0, majorBias: 0, storeBias: 0, ko: '', en: '' }

export function newWorld(setup: Setup = DEFAULT_SETUP, gen = 1, lineage: Lineage[] = []): World {
  const seed = Math.floor(rnd() * 90000) + 10000, st = setup.stage
  const sp0 = SPECIES[setup.species]
  const cohorts: Cohort[] = sp0.dulotic
    ? (st === 'found' ? [{ age: 10, n: 20, kind: 's' }] : st === 'young' ? [{ age: 20, n: 14, kind: 'w' }, { age: 20, n: 30, kind: 's' }] : [{ age: 40, n: 36, kind: 'w' }, { age: 30, n: 80, kind: 's' }])
    : sp0.bivouac
      ? (st === 'mature' ? [{ age: 30, n: 200, kind: 'w' }, { age: 30, n: 16, kind: 'm' }] : [{ age: 20, n: 70, kind: 'w' }, { age: 20, n: 4, kind: 'm' }])
      : st === 'found' ? [{ age: 5, n: 6, kind: 'w' }]
    : st === 'young' ? [{ age: 30, n: 22, kind: 'w' }, { age: 10, n: 16, kind: 'w' }]
      : [{ age: 60, n: 46, kind: 'w' }, { age: 25, n: 52, kind: 'w' }, { age: 8, n: 14, kind: 'w' }, { age: 40, n: 9, kind: 'm' }]
  const w: World = {
    v: 4, seed, species: setup.species, gen, lineage, peak: 0, flownYear: -1, alates: 0, flight: 0,
    origin: { stage: st, ko: setup.ko, en: setup.en },
    grid: new Array(W * H).fill(SOIL), chambers: [], trees: [], ep: 1, day: 1, tick: 6,
    cohorts, brood: [], carb: st === 'found' ? 20 : st === 'young' ? 30 : 45, prot: st === 'found' ? 8 : 16,
    queen: { room: 0, home: 0, health: 100, age: st === 'found' ? 0 : st === 'young' ? YEAR_DAYS : YEAR_DAYS * 2 },
    deepest: SURF, tips: [], digQueue: 0, rain: 0,
    threats: [], streak: {}, log: [], today: emptyTally(), total: emptyTally(), dayKey: '',
    instinct: setup.instinct, trail: setup.trail, learned: {}, guests: [], dex: {}, newDex: [],
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
  // 둥지: 세로 갱도 하나에 방이 층층이 (얕은 방은 길쭉, 깊은 방은 둥글게). 창업 군락은 얕은 첫 방 하나.
  const L: [number, number, RoomType, number, number][] = sp0.bivouac ? [[3, 1, 'queen', 5, 2]] : st === 'found' ? [[7, 1, 'queen', 2, 1]]
    : st === 'young' ? [[3, -1, 'store', 3, 1], [8, 1, 'brood', 3, 1], [12, -1, 'queen', 3, 2]]
      : [[3, -1, 'store', 4, 1], [6, 1, 'waste', 2, 1], [10, -1, 'brood', 3, 1], [14, 1, 'brood', 3, 2], [18, -1, 'queen', 3, 2], [23, 1, 'brood', 3, 2]]
  const depth = L[L.length - 1]![0] + 1
  for (let y = SURF; y <= SURF + depth; y++) { carve(w, nx, y); if (y < SURF + 3) carve(w, nx + 1, y) }
  for (const [d, dir, type, rx, ry] of L) {
    const y = SURF + d; let ex = nx
    for (let k = 0; k < 3; k++) { ex += dir; carve(w, ex, y) }
    const id = makeChamber(w, ex + dir * (rx + 1), y, rx, ry, type)
    if (type === 'queen') { w.queen.room = id; w.queen.home = id }
  }
  w.tips.push({ x: nx, y: SURF + depth, dx: 0, dy: 1 }, { x: nx - 4, y: SURF + 3, dx: -1, dy: 0 })
  const sp = SPECIES[setup.species]
  if (sp.bivouac) {
    w.brood.push({ st: 'larva', n: 30, dev: 0.3, prot: 3, room: w.queen.room })
    say(w, `${gen > 1 ? `${gen}대째. 갈라져 나온 ` : ''}${sp.ko} 군락. 굴을 파지 않고 일개미들이 몸을 엮어 살아 있는 둥지(비박)를 만들었다.`, `${gen > 1 ? `Generation ${gen}, split off from the old colony. ` : ''}An army ant colony. Instead of digging, the workers link their bodies into a living nest, a bivouac.`)
  } else if (sp.dulotic && st === 'found') {
    w.brood.push({ st: 'pupa', n: 10, dev: 0.3, prot: 0, room: w.queen.room, slave: true })
    say(w, `${gen > 1 ? `${gen}대째. ` : ''}${sp.ko} 여왕이 곰개미 둥지에 숨어들어 그 여왕을 죽이고, 남은 곰개미 20마리를 자기 일꾼으로 삼았다.`, `${gen > 1 ? `Generation ${gen}. ` : ''}A samurai queen slipped into a wood ant nest, killed its queen, and took the 20 remaining wood ants as her workers.`)
  } else if (sp.dulotic) {
    w.brood.push({ st: 'pupa', n: 12, dev: 0.3, prot: 0, room: w.queen.room, slave: true })
    say(w, `${sp.ko} 군락. 사무라이개미 ${st === 'young' ? 14 : 36}마리는 싸움만 하고, 훔쳐 온 곰개미 ${st === 'young' ? 30 : 80}마리가 노예로 모든 일을 한다.`, `A samurai ant colony: ${st === 'young' ? 14 : 36} samurai do nothing but fight, while ${st === 'young' ? 30 : 80} stolen wood ants do all the work as slaves.`)
  } else if (st === 'found') {
    w.brood.push({ st: 'egg', n: 8, dev: 0.2, prot: 0, room: w.queen.room })
    if (sp.id === 'atta') say(w, '여왕이 입속 주머니에 담아 온 버섯 균으로 첫 정원을 차렸다.', 'The queen started the first garden with the fungus pellet she carried in her mouth pouch.')
    say(w, `${gen > 1 ? `${gen}대째. ` : ''}결혼비행을 마친 ${sp.ko} 여왕이 첫 방을 팠다. 첫 일개미 6마리와 알 8개.`, `${gen > 1 ? `Generation ${gen}. ` : ''}A ${sp.en.toLowerCase()} queen, back from her mating flight, dug her first chamber. Six first workers and eight eggs.`)
  } else if (st === 'young') {
    w.brood.push({ st: 'larva', n: 12, dev: 0.3, prot: 12 * (0.1 + setup.majorBias), room: w.queen.room })
    say(w, `2년차 ${sp.ko} 군락. 일개미 38마리와 애벌레 12마리가 겨울을 났다.`, `A second-year ${sp.en.toLowerCase()} colony: 38 workers and 12 larvae made it through winter.`)
  } else {
    w.brood.push({ st: 'larva', n: 24, dev: 0.35, prot: 24 * (0.12 + setup.majorBias), room: w.queen.room })
    say(w, `3년차 ${sp.ko} 군락. 일개미 112, 병정 9, 애벌레 24마리가 함께 겨울을 났다.`, `A third-year ${sp.en.toLowerCase()} colony: 112 workers, 9 majors and 24 larvae made it through winter.`)
  }
  w.carb *= 1 + setup.storeBias
  for (const f of setup.farms.slice(0, 4)) farmFor(w, f)
  say(w, '이제부터 당신의 AI 활용이 이 군락의 먹이이자 날씨다.', 'From now on, the way you use AI is this colony\'s food and weather.')
  return w
}

// 여왕이 죽으면: 결혼비행을 보낸 적이 있으면 신여왕이 다음 세대를 잇고, 없으면 빈 땅에 새 군락이 선다
export function nextGeneration(w: World): World {
  const succ = w.alates > 0
  const lineage = [...w.lineage, { gen: w.gen, species: w.species, years: Math.round(queenYears(w) * 10) / 10, peak: Math.round(w.peak), fixed: w.total.fixed, ended: succ ? 'succession' : 'collapse' } as Lineage]
  const nw = newWorld({ ...DEFAULT_SETUP, species: w.species, stage: succ && SP(w).succession === 'fission' ? 'young' : 'found', farms: w.trees.filter(t => t.farm).map(t => t.farm!), instinct: w.instinct * 0.5 }, succ ? w.gen + 1 : 1, lineage)
  nw.total = { ...w.total }; nw.learned = w.learned; nw.dex = w.dex
  return nw
}

export function colonyLevel(w: World) {
  let score = (w.gen - 1) * 10 + w.peak / 20 + queenYears(w) * 3 + w.total.fixed
  for (const l of w.lineage) score += l.peak / 20 + l.years * 3 + (l.ended === 'succession' ? 10 : 0)
  return Math.floor(Math.sqrt(Math.max(0, score) * 2)) + 1
}


export function say(w: World, ko: string, en: string) {
  w.log.push({ s: season(w), d: w.day, ko, en })
  if (w.log.length > 30) w.log.shift()
}

// ---------- 굴착 ----------
function digStep(w: World) {
  if (SP(w).bivouac) return false
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
    const cx = t.x + (t.dx >= 0 ? rx + 1 : -rx - 1)
    if (!roomFree(w, cx, t.y, rx, ry)) return false
    makeChamber(w, cx, t.y, rx, ry, type)
    say(w, `지하 ${(t.y - SURF) * CM}cm에 ${ROOMNAME[type]}을 새로 팠다.`, `Dug a new ${ROOMNAME_EN[type].toLowerCase()} chamber ${(t.y - SURF) * CM}cm down.`)
    if (w.tips.length < 4) w.tips.push({ x: t.x, y: t.y, dx: -t.dx || 1, dy: 1 })
    return true
  }
  return false
}

// ---------- 시간 ----------

function broodHour(w: World) {
  const winter = isWinter(w)
  for (const b of w.brood) {
    const c = w.chambers[b.room] ?? w.chambers[w.queen.room]!
    const add = winter && b.st !== 'pupa' ? 0 : Math.max(0, tempAt(w, c.cy) - T0) / (DD[b.st] * SP(w).devK) / 24
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
  if (b.slave) {
    w.cohorts.push({ age: 0, n: b.n, kind: 's' })
    if (b.n > 1) say(w, `훔쳐 온 번데기에서 곰개미 ${Math.round(b.n)}마리가 깨어나 노예로 일을 시작했다.`, `${Math.round(b.n)} wood ants hatched from the stolen pupae and went to work as slaves.`)
    return
  }
  const sat = b.prot / Math.max(0.1, b.n) / 0.2
  const mf = workers(w) > 30 && sat > 0.5 ? clamp((0.03 + (sat - 0.6) * 0.12) * SP(w).majorK, 0, 0.3) : 0
  w.cohorts.push({ age: 0, n: b.n * (1 - mf), kind: 'w' })
  if (mf > 0) w.cohorts.push({ age: 0, n: b.n * mf, kind: 'm' })
  if (b.n > 1) say(w, `고치에서 새 일개미 ${Math.round(b.n * (1 - mf))}마리${mf > 0.02 ? `, 병정 ${Math.round(b.n * mf)}마리` : ''}가 깨어났다.`, `${Math.round(b.n * (1 - mf))} new workers${mf > 0.02 ? ` and ${Math.round(b.n * mf)} majors` : ''} hatched from their cocoons.`)
}
function relocateBrood(w: World) {
  const cands = w.chambers.filter(c => c.type === 'brood' || c.type === 'queen')
  if (!cands.length || isWinter(w)) return
  const score = (c: Chamber) => -Math.abs(tempAt(w, c.cy) - 26) - (c.type === 'brood' ? 0 : 1.5)
  let best = cands[0]!; for (const c of cands) if (score(c) > score(best)) best = c
  for (const b of w.brood) { const cur = w.chambers[b.room]; if (!cur || score(best) - score(cur) > 2) b.room = best.id }
}

function dayTick(w: World) {
  const s = season(w), Wn = workers(w), Mn = majors(w)
  // 본능 채집(기본 수입). AI 활용 이벤트는 따로 들어온다.
  // 자동화는 본능이 된다: 내가 없어도 개미들이 스스로 하는 일
  const inst = 1 + w.instinct * 0.1
  // 사무라이개미는 노예만 일한다. 군대개미 유랑기에는 매일 사냥한다
  const labor = SP(w).dulotic ? slaves(w) : Wn, nomad = SP(w).bivouac && armyPhase(w) === 'nomadic' ? 1.5 : 1
  if (!isWinter(w) && w.rain <= 0) { w.carb += labor * 0.028 * inst; w.prot += labor * 0.004 * inst * nomad }
  w.trail *= 0.9
  const Tn = tempAt(w, w.chambers[w.queen.room]!.cy), q10 = Math.pow(2, (Tn - 20) / 10)
  w.carb -= (Wn * 0.03 + Mn * 0.045) * q10
  let starving = false; if (w.carb < 0) { w.carb = 0; starving = true }
  // 창고가 담을 수 있는 만큼만 남는다. 창고는 굴착(편집)으로 늘어난다.
  const stores = w.chambers.filter(c => c.type === 'store').length
  const sk = SP(w).storeK; w.carb = Math.min(w.carb, (60 + stores * 90) * sk); w.prot = Math.min(w.prot, (30 + stores * 45) * sk)
  const larvae = bcount(w, 'larva')
  const need = larvae * 0.06 * Math.max(0.2, q10), fed = Math.min(w.prot, need); w.prot -= fed
  for (const b of w.brood) if (b.st === 'larva') b.prot += fed * (b.n / Math.max(0.1, larvae))
  if (fed < need * 0.6 && larvae > 3) for (const b of w.brood) if (b.st === 'egg') b.n *= 0.8
  const fT = Tn < 12 ? 0 : Tn < 22 ? (Tn - 12) / 10 : Tn < 30 ? 1 : 0
  const fP = clamp(w.prot / (5 + Wn * 0.05), 0, 1) * 0.7 + 0.3
  const fF = clamp(w.carb / (Wn * 0.6 + 10), 0.3, 1.6)
  const armyK = SP(w).bivouac ? (armyPhase(w) === 'statary' ? (w.queen.age % 34 < 7 ? 3 : 0.2) : 0) : 1
  // 늙은 여왕은 수명의 70%를 넘기면서 산란이 줄어든다
  const qy = queenYears(w), life = SP(w).life, old = qy > life * 0.7 ? clamp(1 - (qy - life * 0.7) / (life * 0.3), 0.1, 1) : 1
  const lay = s === 3 && isWinter(w) ? 0 : (3 + Math.min(30, Wn * 0.07)) * fT * fP * fF * old * armyK * SP(w).layK * (w.queen.health / 100)
  if (lay > 0.15) { w.prot = Math.max(0, w.prot - lay * 0.05); const br = w.chambers.find(c => c.type === 'brood'); w.brood.push({ st: 'egg', n: lay, dev: 0, prot: 0, room: br ? br.id : w.queen.room }) }
  for (const c of w.cohorts) {
    const L = c.kind === 'm' ? 180 : 140
    let h = (1 / L) * clamp(q10, 0.4, 1.8) * (isWinter(w) ? 0.3 : 1) + (starving ? 0.035 : 0)
    if (c.age > L * 1.6) h += 0.05
    c.n *= 1 - Math.min(0.2, h); c.age++
  }
  const merged: Cohort[] = []
  for (const c of w.cohorts) { const m = merged.find(x => x.kind === c.kind && Math.abs(x.age - c.age) < 4); if (m) { m.age = (m.age * m.n + c.age * c.n) / (m.n + c.n); m.n += c.n } else if (c.n > 0.05) merged.push({ ...c }) }
  w.cohorts = merged
  if (starving) say(w, '단물이 바닥났다. 굶는 개미가 생긴다.', 'The honeydew ran out. Ants are starving.')
  if (isWinter(w)) {
    const r = w.chambers[w.queen.room]!
    if (tempAt(w, r.cy) < 0.5) { for (const c of w.cohorts) c.n *= 0.985; say(w, '동결선이 겨울방까지 내려왔다. 얼어 죽는 개미가 생긴다.', 'The frost line reached the winter chamber. Some ants froze.') }
  }
  guestDay(w)
  // 여왕의 나이, 결혼비행, 수명
  w.queen.age++
  const pop = workers(w) + majors(w); if (pop > w.peak) w.peak = pop
  const year = Math.floor((w.ep - 1) / 4)
  if (SP(w).bivouac && w.queen.age % 34 === 0) say(w, '정착기. 비박에 머물며 여왕이 한꺼번에 알을 낳는다.', 'Statary phase. The colony stays put and the queen lays in a burst.')
  if (SP(w).bivouac && w.queen.age % 34 === 20) say(w, '유랑기. 밤마다 자리를 옮기며 낮에는 사냥 행렬을 낸다.', 'Nomadic phase. The colony moves every night and raids by day.')
  if (SP(w).tournaments && s < 2 && pop > 50 && rnd() < 0.05) tournament(w, pop)
  if (SP(w).succession === 'fission' && (s === 2 || s === 3) && w.day === 5 && pop >= SP(w).flightPop && queenYears(w) >= 1.5 && w.flownYear !== year) {
    for (const c of w.cohorts) c.n *= 0.5
    w.alates = 1; w.flownYear = year; w.flight = 12
    say(w, '군락이 둘로 갈라졌다. 날개 없는 처녀 여왕이 일개미 절반을 데리고 떠났다. 날개 달린 수개미들만 날아올랐다.', 'The colony split in two. A wingless virgin queen left with half the workers; only the winged males took to the air.')
  } else if (SP(w).succession !== 'fission' && s === 1 && w.day === 5 && pop >= SP(w).flightPop && queenYears(w) >= 1.5 && w.flownYear !== year) {
    const n = Math.round(pop * 0.05)
    w.alates += n; w.flownYear = year; w.flight = 24; w.carb = Math.max(0, w.carb - n * 0.5); w.prot = Math.max(0, w.prot - n * 0.3)
    say(w, `결혼비행. 날개 달린 신여왕과 수개미 ${n}마리가 하늘로 날아올랐다. 이 군락의 다음 세대가 될 수 있다.`, `Nuptial flight. ${n} winged queens and males took to the sky. One of them may carry this colony on.`)
  }
  if (queenYears(w) >= SP(w).life * 0.85 && !w.over && w.day === 1) say(w, '여왕이 많이 늙었다. 알을 거의 낳지 못한다.', 'The queen has grown very old. She barely lays now.')
  if (queenYears(w) >= SP(w).life && SP(w).succession === 'adopt' && w.alates > 0) {
    // 곰개미: 결혼비행 뒤 받아들인 젊은 여왕이 있어 군락이 그대로 이어진다
    w.lineage.push({ gen: w.gen, species: w.species, years: Math.round(queenYears(w) * 10) / 10, peak: Math.round(w.peak), fixed: w.total.fixed, ended: 'succession' })
    w.gen++; w.queen.age = 0; w.queen.health = 100; w.alates = 0; w.peak = pop
    say(w, `늙은 여왕이 죽었다. 결혼비행 뒤 받아들인 젊은 여왕이 군락을 그대로 잇는다. ${w.gen}대째.`, `The old queen has died. A young queen adopted after the nuptial flight carries the colony on. Generation ${w.gen}.`)
  } else if (queenYears(w) >= SP(w).life || (pop < 1 && w.brood.length === 0)) {
    w.over = true
    say(w, w.alates > 0 ? '여왕이 죽었다. 결혼비행을 떠났던 신여왕 하나가 다음 세대를 연다.' : '여왕이 죽고 군락이 흩어졌다.', w.alates > 0 ? 'The queen has died. One of the queens from the nuptial flight begins the next generation.' : 'The queen has died and the colony scattered.')
  }
  w.day++
  if (w.day > epDays(w)) {
    w.ep++; w.day = 1
    const ns = season(w)
    if (ns === 3 && SP(w).climate !== 'tropical') {
      let deep = w.chambers[0]!; for (const c of w.chambers) if (c.type !== 'waste' && c.cy > deep.cy) deep = c
      w.queen.room = deep.id; for (const b of w.brood) b.room = deep.id
      for (const b of w.brood) if (b.st === 'egg') b.n = 0
      say(w, `겨울. 여왕과 애벌레를 지하 ${(deep.cy - SURF) * CM}cm 방으로 옮기고 모두 몸을 맞대 멈췄다.`, `Winter. The queen and larvae moved to the chamber ${(deep.cy - SURF) * CM}cm down, and everyone huddled still.`)
    } else if (ns === 0) { w.queen.room = w.queen.home; say(w, `${epName(w.ep, 'ko', w)}. 땅이 데워지면 여왕이 다시 알을 낳는다.`, `${epName(w.ep, 'en', w)}. Once the soil warms, the queen lays again.`) }
    else say(w, `${epName(w.ep, 'ko', w)}이 시작됐다.`, `${epName(w.ep, 'en', w)} begins.`)
  }
}

export function hourTick(w: World) {
  w.tick++
  broodHour(w)
  if (w.tick % 6 === 0) relocateBrood(w)
  if (w.rain > 0) w.rain--
  if (w.flight > 0) w.flight--
  raidHour(w)
  if (w.digQueue > 0 && !isWinter(w)) { const n = Math.min(3, w.digQueue); for (let k = 0; k < n; k++) digStep(w); w.digQueue -= n }
  else if (!isWinter(w) && rnd() < 0.15) digStep(w)
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
  const tw = Math.min(70, Math.round(raiders(w) / 4)), tm = Math.min(12, Math.round(majors(w) / 2)), ts = Math.min(60, Math.round(slaves(w) / 4))
  const cnt = { w: ants.filter(a => a.kind === 'w').length, m: ants.filter(a => a.kind === 'm').length, s: ants.filter(a => a.kind === 's').length }
  const q = w.chambers[w.queen.room]!
  while (cnt.w < tw) { ants.push({ x: q.cx, y: q.cy, kind: 'w', job: 'idle', st: 'in', tx: 0, carry: 0, t: 0, climb: 0, up: 0 }); cnt.w++ }
  while (cnt.s < ts) { ants.push({ x: q.cx, y: q.cy, kind: 's', job: 'idle', st: 'in', tx: 0, carry: 0, t: 0, climb: 0, up: 0 }); cnt.s++ }
  while (cnt.m < tm) { ants.push({ x: q.cx, y: q.cy, kind: 'm', job: 'guard', st: 'in', tx: 0, carry: 0, t: 0, climb: 0, up: 0 }); cnt.m++ }
  for (const k of ['w', 'm', 's'] as const) { const target = { w: tw, m: tm, s: ts }[k]; while (cnt[k] > target) { const j = ants.findIndex(a => a.kind === k && a.st === 'in'); if (j < 0) break; ants.splice(j, 1); cnt[k]-- } }
}

export function sendForager(w: World, ants: Ant[], carry: 1 | 2) {
  if (isWinter(w)) return
  const a = ants.find(x => x.kind === (SP(w).dulotic ? 's' : 'w') && x.st === 'in' && x.job === 'idle')
  if (!a) return
  const tree = w.trees[Math.floor(rnd() * w.trees.length)]!
  a.job = 'forage'; a.carry = 0; a.t = carry; a.tx = carry === 1 ? tree.x : 3 + Math.floor(rnd() * (W - 6)); a.climb = carry === 1 ? tree.h - 2 : 0; a.up = 0
}
export function sendDigger(w: World, ants: Ant[]) {
  const a = ants.find(x => x.kind === (SP(w).dulotic ? 's' : 'w') && x.st === 'in' && x.job === 'idle'); if (a) { a.job = 'dig'; a.t = 20 }
}

export function moveAnts(w: World, ants: Ant[]) {
  const s = season(w), cen = w.threats.find(t => t.k === 'centipede'), spider = w.threats.find(t => t.k === 'spider')
  const ex = entranceX(w), qr = w.chambers[w.queen.room]!
  for (const a of ants) {
    const ox = a.x
    moveOne(a)
    if (a.x !== ox) a.f = a.x > ox ? 1 : -1
  }
  function moveOne(a: Ant) {
    if (a.st === 'out') {
      // 나무에 오르내리기: up이 지금 높이, climb이 진딧물이 있는 높이
      if (!a.carry && a.x === a.tx) { if (a.up < a.climb) { a.up++; return } a.carry = a.t as 1 | 2; return }
      if (a.carry && a.up > 0) { a.up--; return }
      const goal = a.carry ? ex : a.tx
      if (spider && a.x === spider.x && rnd() < 0.12) { const old = w.cohorts.filter(c => c.kind === 'w').sort((x, y) => y.age - x.age)[0]; if (old) old.n = Math.max(0, old.n - 1); say(w, '채집 개미 한 마리가 거미줄에 걸렸다.', 'A forager got caught in the web.'); a.st = 'in'; a.job = 'idle'; a.x = qr.cx; a.y = qr.cy; a.carry = 0; return }
      if (a.x !== goal) a.x += Math.sign(goal - a.x)
      else { a.st = 'in'; a.y = SURF; a.job = 'idle'; a.carry = 0 }
      return
    }
    if (w.grid[idx(a.x, a.y)] !== TUN) { a.x = qr.cx; a.y = qr.cy }
    if (isWinter(w)) { step(w, a, qr.cx + Math.round((rnd() - 0.5) * qr.rx * 2), qr.cy, 0.8); return }
    if (cen && (a.kind === 'm' || Math.abs(a.x - cen.x) + Math.abs(a.y - cen.y) <= cen.alarmR)) { a.job = 'swarm'; step(w, a, cen.x, cen.y, 0.97); return }
    if (a.job === 'swarm') a.job = a.kind === 'm' ? 'guard' : 'idle'
    if (a.job === 'forage') { if (a.y <= SURF) { a.st = 'out'; a.y = SURF - 1 } else step(w, a, ex, SURF, 0.9); return }
    if (a.job === 'dig') { const t = w.tips[0]; if (t) step(w, a, t.x, t.y, 0.8); if (--a.t <= 0) a.job = 'idle'; return }
    if (a.job === 'guard') { step(w, a, ex + Math.round((rnd() - 0.5) * 3), SURF + 3, 0.6); return }
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
  if (isWinter(w)) return
  const a = ants.find(o => o.kind === (SP(w).dulotic ? 's' : 'w') && o.st === 'in' && o.job === 'idle'); if (!a) return
  a.job = 'forage'; a.carry = 0; a.t = carry; a.tx = x; a.climb = Math.max(0, h - 2); a.up = 0
}

// ---------- 사무라이개미 노예사냥: 정찰병이 곰개미 둥지를 찾으면 떼 지어 번데기를 훔쳐 온다 ----------
export function startRaid(w: World, mult: number) {
  // 하루에 한 번까지: 같은 곰개미 둥지는 털린 뒤 2~3주 동안 지상 활동을 멈춘다
  const today = Math.floor(w.tick / 24)
  if (!SP(w).dulotic || w.raid || isWinter(w) || w.raidDay === today) return false
  const r = raiders(w); if (r < 5) return false
  w.raidDay = today
  w.raid = { t: 6, booty: Math.min(12, r * 0.05 * mult) }
  say(w, `정찰병이 곰개미 둥지를 찾아냈다. 사무라이개미 ${Math.round(r)}마리가 떼 지어 출격한다.`, `A scout found a wood ant nest. ${Math.round(r)} samurai march out in a column.`)
  return true
}
function raidHour(w: World) {
  const s = season(w)
  // 본능 습격: 여름 무렵 오후 4시쯤, 이틀에 한 번꼴
  if (SP(w).dulotic && !w.raid && hour(w) === 16 && (s === 1 || (s === 0 && w.day > 14) || (s === 2 && w.day < 8)) && rnd() < 0.5) startRaid(w, 1)
  if (!w.raid) return
  if (--w.raid.t > 0) return
  const n = Math.max(0.5, w.raid.booty), lost = raiders(w) * 0.02
  w.brood.push({ st: 'pupa', n, dev: 0.3, prot: 0, room: w.queen.room, slave: true })
  for (const c of w.cohorts) if (c.kind === 'w') { c.n = Math.max(0, c.n - lost); break }
  say(w, `습격대가 곰개미 번데기 ${Math.round(n)}개를 물고 돌아왔다.`, `The raiders came home carrying ${Math.round(n)} wood ant pupae.`)
  w.raid = null
}

// ---------- 꿀단지개미 토너먼트: 과시 싸움 끝에 한쪽이 훨씬 약하면 습격당한다 ----------
function tournament(w: World, pop: number) {
  const rival = pop * (0.4 + rnd() * 1.3)
  if (pop > rival * 1.6) {
    const n = rival * 0.08
    w.brood.push({ st: 'pupa', n, dev: 0.4, prot: 0, room: w.queen.room }); w.carb += rival * 0.1
    say(w, `이웃 군락과 토너먼트를 벌였다. 우리가 훨씬 커서 그 군락을 습격해 새끼 ${Math.round(n)}마리와 꿀단지를 데려왔다.`, `A tournament with a neighbor colony. We were far larger, so we raided it and carried off ${Math.round(n)} brood and its repletes.`)
  } else if (rival > pop * 1.6) {
    w.carb *= 0.55; for (const b of w.brood) b.n *= 0.5
    if (rnd() < 0.12) {
      w.over = true
      say(w, '토너먼트에서 밀렸다. 이웃 군락이 쳐들어와 여왕을 죽이고 새끼와 꿀단지를 빼앗아 갔다.', 'We lost the tournament. The neighbors raided us, killed the queen, and took the brood and repletes.')
    } else say(w, '토너먼트에서 밀렸다. 이웃 군락이 쳐들어와 새끼 절반과 꿀단지를 빼앗아 갔다. 여왕은 살아남았다.', 'We lost the tournament. The neighbors raided us and took half the brood and our repletes. The queen survived.')
  } else say(w, '이웃 군락과 다리를 세우고 몸을 부풀리는 과시 싸움(토너먼트)을 벌였다. 승부가 나지 않아 서로 물러났다.', 'A display tournament with a neighbor colony: stilt-walking and puffing up. Neither side gave way.')
}

// ---------- 개미집 손님: 종마다 함께 사는 생물이 희귀도에 따라 찾아온다. 도감은 세대를 넘어 이어진다 ----------
const GUEST_P = [0, 0.07, 0.025, 0.01, 0.003]
function guestDay(w: World) {
  const pop = workers(w) + majors(w), calls = Object.values(w.today).reduce((a, b) => a + b, 0)
  const boost = (pop > 80 ? 1 : pop > 25 ? 0.6 : 0.25) * (calls > 30 ? 1.6 : calls > 5 ? 1.2 : 1)
  for (const g of w.guests) {
    g.days--
    const def = guestById(g.id)
    if (def.effect === 'drain') w.carb = Math.max(0, w.carb - 0.6)
    else if (def.effect === 'brood') { const b = w.brood.find(x => x.n > 1); if (b) b.n -= 0.5 }
    else if (def.effect === 'honeydew') w.carb += 1.2
  }
  w.guests = w.guests.filter(g => g.days > 0)
  if (isWinter(w) || w.guests.length >= 3) return
  for (const def of guestsFor(w.species)) {
    if (w.guests.some(g => g.id === def.id) || rnd() > GUEST_P[def.rarity]! * boost) continue
    let x = 0, y = 0
    if (def.surface) { const t = w.trees[Math.floor(rnd() * w.trees.length)]!; x = t.x; y = SURF - t.h + 2 }
    else { const c = w.chambers[Math.floor(rnd() * w.chambers.length)]!; x = c.cx + Math.floor((rnd() - 0.5) * c.rx); y = c.cy + c.ry }
    w.guests.push({ id: def.id, x, y, days: 4 + Math.floor(rnd() * 6) })
    const d = w.dex[def.id]
    if (!d) { w.dex[def.id] = { n: 1, first: epName(w.ep, 'ko', w) }; w.newDex.push(def.id) } else d.n++
    say(w, `손님이 찾아왔다: ${def.ko} (${RARITY_KO[def.rarity]}). ${def.koDesc}`, `A guest arrived: ${def.en} (${RARITY_EN[def.rarity]}). ${def.enDesc}`)
    break
  }
}
