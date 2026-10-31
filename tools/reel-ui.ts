// 실제 개미굴 창으로 만드는 릴스(9:16). 플러그인 테스트 도구로 창이 그리는 요소 트리(대시보드·리포트·도구 지도·도감)를
// 그대로 뽑아 브라우저에서 그리고, 그림 부분은 같은 엔진으로 움직여 영상으로 굽는다.
// 실행: bun tools/reel-ui.ts [출력 폴더] [ko|en]   (필요: claude CLI, Playwright와 Chromium, ffmpeg)
// 창의 내용·숫자·배치는 플러그인이 그린 그대로이고, 글꼴·색 같은 겉모습만 데스크톱 앱과 비슷하게 맞춘다.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { newWorld, DEFAULT_SETUP, hourTick, snapshot, emptyTally, moveAnts, syncAnts, sendForager, sendDigger, startFlight, spawnSpider, workers, majors, capacity } from '../hooks/engine'
import type { World, Ant } from '../hooks/engine'
import { svg } from '../hooks/render'

const ROOT = resolve(import.meta.dir, '..'), OUT = resolve(process.argv[2] ?? join(ROOT, 'media-out')), LANG = (process.argv[3] ?? 'ko') as 'ko' | 'en'
const FPS = 15, CHROME = process.env.CHROME
mkdirSync(OUT, { recursive: true })
const ko = LANG === 'ko'

// ---------- 1. 촬영용 군락: 게임 100일쯤, 어제보다 자란 모습 ----------
const ld = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const wk = () => { const d = new Date(); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const w: World = newWorld({ ...DEFAULT_SETUP, stage: 'young' })
for (let i = 0; i < 24 * 85; i++) { w.digQueue += 1; hourTick(w) }
const snap = snapshot(w)
for (let d = 0; d < 30 && snapshot(w).pop < snap.pop + 8; d++) for (let i = 0; i < 24; i++) { w.digQueue += 1; hourTick(w) }
w.threats = []; w.flight = 0; w.guests = []
// 비축은 넉넉하게(촬영용), 어제 대비는 늘어난 모습으로
{ const cap = capacity(w); w.carb = Math.round(cap.carb * 0.62); w.prot = Math.round(cap.prot * 0.55) }
snap.carb = w.carb - 9; snap.prot = w.prot - 6; snap.dex = 2
w.snap = snap; w.snapDate = ld(); w.today = Object.assign(emptyTally(), { explore: 18, build: 11, hunt: 4, bugs: 2, fixed: 2, mcp: 3, ship: 1 }); w.trail = 1.2; w.instinct = 1.5
w.week = Object.assign(emptyTally(), { explore: 96, build: 61, hunt: 22, ship: 6, raise: 4, parallel: 3, mcp: 14, skill: 5, plan: 7, auto: 1, bugs: 9, fixed: 7, other: 18 })
w.weekKey = wk(); w.weekSince = wk()
w.lastWeek = { key: 'last', tally: Object.assign(emptyTally(), { explore: 120, build: 70, hunt: 9, ship: 3, raise: 1, mcp: 6, skill: 1, plan: 2, bugs: 14, fixed: 8, other: 30 }) }
w.tools = { key: wk(), mcp: { GitHub: 8, 'Google Drive': 4, 'Claude Docs': 2 }, skill: { docs: 3, 'code-review': 2 }, compact: 2 }
w.dex = { cricket: { n: 3, first: '' }, lycaenid: { n: 1, first: '' }, rove: { n: 1, first: '' } }
w.log = w.log.slice(-12)

// ---------- 2. 실제 창의 요소 트리 뽑기: 임시 테스트를 만들어 claude plugin test로 돌린다 ----------
const DUMP = join(ROOT, 'tests', 'zz-reel-dump.test.tsx')
writeFileSync(DUMP, `import { expect, test } from 'claude-code/testing'
const PANE = { plugin: 'ant-nest', component: 'Pane', requestId: 'ant-nest', props: { title: '개미굴', isFocused: false, bodyColumns: 64, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} } } as const
const WORLD = ${JSON.stringify(w)}
test('reel dump', { options: { language: '${LANG}' } }, async ($, on) => {
  const store: Record<string, unknown> = { world: WORLD, seenVersion: '999' }
  on('command.register', () => ({ value: { command: 'ant' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {} }))
  on('clock.every', () => ({ value: undefined }))
  on('store.get', (_, e) => ({ value: store[(e as { key: string }).key] }))
  on('store.set', (_, e) => { const x = e as { key: string; value: unknown }; store[x.key] = x.value; return { value: undefined } })
  on('store.delete', () => ({ value: undefined }))
  on('store.keys', () => ({ value: Object.keys(store) }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('env.get', () => ({ value: undefined }))
  on('fs.list', () => { throw new Error('none') })
  on('fs.read', () => { throw new Error('none') })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const out: Record<string, unknown> = { dash: await ui.drawn() }
  for (const k of ['report', 'tools', 'dex']) { await ui.press({ key: 'tab-' + k }); out[k] = await ui.drawn() }
  console.log('TREE>>' + JSON.stringify(out) + '<<TREE')
  expect(out.dash).toBeDefined()
})
`)
const run = Bun.spawnSync(['claude', 'plugin', 'test'], { cwd: ROOT })
rmSync(DUMP)
const log = run.stdout.toString() + run.stderr.toString(), m = /TREE>>(.*?)<<TREE/s.exec(log)
if (!m) { console.error(log.slice(-2000)); throw new Error('창 트리를 뽑지 못했습니다') }
const trees = JSON.parse(m[1]!) as Record<string, unknown>

// ---------- 3. 브라우저에서 창 그리기 ----------
const FONT = join(OUT, '.NotoSansKR.ttf')
if (!existsSync(FONT)) { const r = await fetch('https://fonts.gstatic.com/s/notosanskr/v36/PbyxFmXiEBPT4ITbgNA5Cgms3VYcOA-vvnIzzg01eLQ.ttf').catch(() => null); if (r?.ok) writeFileSync(FONT, Buffer.from(await r.arrayBuffer())) }
const fontCss = existsSync(FONT) ? `@font-face{font-family:NK;src:url(data:font/ttf;base64,${readFileSync(FONT).toString('base64')});font-weight:100 900}` : ''

// 요소 트리를 HTML로: Box·Text·Button·Svg (데스크톱 앱의 밝은 테마에 맞춘 겉모습)
const RENDERER = `
const C = { success: '#2e8b46', error: '#c9412f', warning: '#b7791f', suggestion: '#2f6fd6' }
const col = c => C[c] || c
function el(n) {
  if (n == null || n === false) return document.createTextNode('')
  if (typeof n === 'string' || typeof n === 'number') return document.createTextNode(String(n))
  if (Array.isArray(n)) { const f = document.createDocumentFragment(); n.forEach(c => f.appendChild(el(c))); return f }
  const p = n.props || {}, kids = n.children || []
  let d
  if (n.type === 'Box') {
    d = document.createElement('div'); const s = d.style; s.display = 'flex'; s.flexDirection = p.flexDirection || 'row'
    if (p.gap) s.gap = (p.gap * 8) + 'px'; if (p.flexWrap) s.flexWrap = p.flexWrap; if (p.justifyContent) s.justifyContent = p.justifyContent
    if (p.alignItems) s.alignItems = p.alignItems; if (p.flexGrow) s.flexGrow = p.flexGrow; if (p.flexShrink !== undefined) s.flexShrink = p.flexShrink
    if (p.minWidth) s.minWidth = (p.minWidth * 8) + 'px'; if (p.width) s.width = (p.width * 8) + 'px'
    if (p.paddingX) { s.paddingLeft = s.paddingRight = (p.paddingX * 12) + 'px' }
    if (p.borderStyle) { s.border = '1px solid ' + (p.borderColor ? col(p.borderColor) : '#e3ded6'); s.borderRadius = '10px'; s.padding = '10px ' + ((p.paddingX || 0) * 12) + 'px' }
    if (p.backgroundColor) s.background = col(p.backgroundColor)
  } else if (n.type === 'Text') {
    d = document.createElement('span'); const s = d.style
    const sz = { heading: 22, footnote: 14, caption: 12.5 }[p.size] || 15; s.fontSize = sz + 'px'
    if (p.weight === 'bold' || p.bold) s.fontWeight = 700; else if (p.weight === 'semibold') s.fontWeight = 600
    if (p.mono) s.fontFamily = 'ui-monospace,Menlo,monospace'; if (p.tabular) s.fontVariantNumeric = 'tabular-nums'
    if (p.color) s.color = col(p.color); if (p.dimColor) s.color = '#8a837a'
    if (p.backgroundColor) { s.background = col(p.backgroundColor); s.whiteSpace = 'pre' }
    s.lineHeight = '1.45'
  } else if (n.type === 'Button') {
    d = document.createElement('span'); d.textContent = p.label; d.className = 'btn ' + (p.variant || 'secondary'); return d
  } else if (n.type === 'Svg') {
    d = document.createElement('div'); d.className = 'nest'; d.style.width = p.width + 'px'; d.style.height = p.height + 'px'; d.innerHTML = p.source; return d
  } else d = document.createElement('div')
  kids.forEach(c => d.appendChild(el(c)))
  return d
}
window.showTree = (t) => { const pane = document.getElementById('pane'); pane.innerHTML = ''; pane.appendChild(el(t)) }
window.setNest = (s) => { const n = document.querySelector('#pane .nest'); if (n) n.innerHTML = s }
`
const page = `<!doctype html><meta charset=utf-8><style>${fontCss}
*{box-sizing:border-box}body{margin:0;width:1080px;height:1920px;overflow:hidden;background:#f4efe6;font-family:NK,sans-serif;color:#1d1a16}
#top{position:absolute;top:96px;left:60px;right:60px;text-align:center;font-size:62px;font-weight:900;line-height:1.22;white-space:pre-line;letter-spacing:-1px}
#top b{color:#c47a12}
#win{position:absolute;top:420px;left:28px;width:1024px;height:1200px;border-radius:30px;background:#fff;box-shadow:0 18px 60px rgba(60,40,20,.18);overflow:hidden}
#cam{position:absolute;left:0;top:0;width:512px;transform-origin:0 0;padding:14px}
#pane{width:484px;font-size:14px}
#pane .btn{display:inline-block;padding:4px 12px;border-radius:9px;font-size:13px;font-weight:600;background:#f1ede6;color:#3a332b}
#pane .btn.primary{background:#1d1a16;color:#fff}
#pane .nest svg{display:block;width:100%;height:100%}
#chip{position:absolute;top:470px;left:50%;transform:translateX(-50%);background:#1d1a16;color:#fff;border-radius:999px;padding:16px 30px;font-size:36px;font-weight:700;white-space:nowrap;box-shadow:0 8px 24px rgba(0,0,0,.25);font-family:NK,monospace}
#chip:empty,#sub:empty,#top:empty,#end:empty{display:none}
#chip i{font-style:normal;color:#ffc86b}
#sub{position:absolute;bottom:120px;left:50px;right:50px;text-align:center;font-size:46px;font-weight:800;line-height:1.3}
#end{position:absolute;inset:420px 28px 300px;background:#1d1a16;color:#fff;border-radius:30px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:44px;text-align:center}
#end .big{font-size:76px;font-weight:900}#end .tag{font-size:40px;color:#ffc86b;font-weight:700}
#end code{font-size:24px;background:#2c2620;border:2px solid #ffc86b;border-radius:16px;padding:22px 24px;color:#ffe2a8;white-space:nowrap}#end .url{font-size:36px;color:#cfc4b4}
</style><div id=top></div><div id=win><div id=cam><div id=pane></div></div></div><div id=chip></div><div id=sub></div><div id=end></div><script>${RENDERER}</script>`

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright')
const browser = await chromium.launch({ executablePath: CHROME })
const pg = await browser.newPage({ viewport: { width: 1080, height: 1920 } })
await pg.setContent(page)
const file = join(OUT, `reel-ui-${LANG}.mp4`)
const ff = Bun.spawn(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-', '-r', '30', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '19', '-movflags', '+faststart', file], { stdin: 'pipe' })

// ---------- 4. 장면 ----------
type Cam = { zoom: number; x: number; y: number }
type Cap = { top?: string; chip?: string; sub?: string; end?: string }
const ants: Ant[] = []; syncAnts(w, ants)
let frame = 0, cur: Cam = { zoom: 2, x: 0, y: 0 }, tree = ''
const ease = (t: number) => t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
const nestW = (() => { const s = JSON.stringify(trees.dash); const mm = /"type":"Svg","props":\{[^}]*"width":(\d+)/.exec(s) ?? /"width":(\d+),"height":\d+\}/.exec(s); return mm ? +mm[1]! : 472 })()
async function scene(sec: number, t: string, to: Cam, cap: Cap | ((i: number, n: number) => Cap), each?: (i: number, n: number) => void, hourEvery = 60) {
  if (t !== tree) { await pg.evaluate((x: unknown) => (window as unknown as { showTree: (x: unknown) => void }).showTree(x), trees[t]); tree = t }
  const from = { ...cur }, n = Math.round(sec * FPS)
  for (let i = 0; i < n; i++) {
    each?.(i, n)
    if (frame % hourEvery === 0 && frame > 0) { hourTick(w); if (w.tick % 24 === 0) syncAnts(w, ants) }
    if (frame % 2 === 0) moveAnts(w, ants)
    const k = ease(Math.min(1, i / Math.max(1, n * 0.45))), z = from.zoom + (to.zoom - from.zoom) * k, x = from.x + (to.x - from.x) * k, y = from.y + (to.y - from.y) * k
    cur = { zoom: z, x, y }
    const c = typeof cap === 'function' ? cap(i, n) : cap
    await pg.evaluate(([s, z, x, y, c]: [string, number, number, number, Cap]) => {
      ;(window as unknown as { setNest: (s: string) => void }).setNest(s)
      const cam = document.getElementById('cam')!; cam.style.transform = `scale(${z}) translate(${-x}px, ${-y}px)`
      for (const k of ['top', 'chip', 'sub', 'end'] as const) { const e = document.getElementById(k)!; const v = c[k] ?? ''; if (e.dataset.v !== v) { e.innerHTML = v; e.dataset.v = v } }
    }, [svg(w, ants, LANG, nestW, frame * 0.5, (frame % hourEvery) / hourEvery), z, x, y, c] as [string, number, number, number, Cap])
    ff.stdin.write(await pg.screenshot({ type: 'jpeg', quality: 90 }))
    frame++
  }
}
const nestTop = 70, below = (px: number) => nestTop + px
const T = ko ? {
  hook: 'Claude Code 옆에서\n<b>개미</b>를 키웁니다', hookSub: 'AI로 일할수록 군락이 자란다',
  read: 'Read  src/app.ts', readS: '파일을 읽으면 → 채집을 나가고', edit: 'Edit  app.ts', editS: '코드를 고치면 → 굴을 파고',
  test: 'Bash  npm test <i>✓</i>', testS: '테스트가 통과하면 → 사냥', fail: 'Bash  npm test <i>✗</i>', failS: '오류가 나면 → 거미가 나타나고',
  ship: 'git commit', shipS: '배포하면 → 결혼비행', dash: '어제보다 얼마나 자랐는지', report: '매주 내 <b>AI 활용</b> 리포트',
  reportS: '덜 쓰는 것, 다음에 해 볼 것까지', tools: '어떤 도구가 군락을 먹였나', dex: '진짜 개미집 생물 도감',
  endBig: '당신의 개미굴은?', endTag: '무료 · 토큰 0 · 기록은 내 컴퓨터에만',
} : {
  hook: 'An <b>ant colony</b>\nnext to Claude Code', hookSub: 'It grows as you work with AI',
  read: 'Read  src/app.ts', readS: 'Read a file → foragers head out', edit: 'Edit  app.ts', editS: 'Edit code → they dig',
  test: 'Bash  npm test <i>✓</i>', testS: 'Tests pass → a hunt', fail: 'Bash  npm test <i>✗</i>', failS: 'An error → a spider shows up',
  ship: 'git commit', shipS: 'Ship it → a nuptial flight', dash: 'See how much it grew since yesterday', report: 'A weekly <b>AI use</b> report',
  reportS: 'What you use less, and what to try next', tools: 'Which tools fed the colony', dex: 'A dex of real ant-nest creatures',
  endBig: 'What will your colony be?', endTag: 'Free · zero tokens · stays on your computer',
}
const INSTALL = '/plugin install ant-nest --marketplace findot-ai/ant-nest'
const nestCam = (z: number): Cam => ({ zoom: z, x: (484 - 1024 / z) / 2 + 14, y: below(0) })

// 1) 첫 장면: 창 전체 → 그림으로 다가가기
await scene(1.5, 'dash', { zoom: 2, x: 0, y: 0 }, { top: T.hook, sub: T.hookSub })
await scene(2.5, 'dash', nestCam(2.1), { top: T.hook, sub: T.hookSub }, i => { if (i % 6 === 0) sendForager(w, ants, 1) })
// 2) 내 작업 → 개미굴
await scene(2.6, 'dash', nestCam(2.1), { chip: T.read, sub: T.readS }, i => { if (i % 5 === 0) sendForager(w, ants, 1) })
await scene(2.6, 'dash', nestCam(2.1), { chip: T.edit, sub: T.editS }, i => { if (i % 4 === 0) { w.digQueue += 3; sendDigger(w, ants) } }, 25)
await scene(2.4, 'dash', nestCam(2.1), { chip: T.test, sub: T.testS }, i => { if (i % 6 === 0) sendForager(w, ants, 2) })
spawnSpider(w)
await scene(2.2, 'dash', nestCam(2.6), { chip: T.fail, sub: T.failS })
w.threats = []; w.flight = 0; startFlight(w, 4)
await scene(3.2, 'dash', nestCam(2.6), { chip: T.ship, sub: T.shipS }, undefined, 110)
// 3) 창의 기능: 대시보드 → 리포트 → 도구 지도 → 도감
const side = below(Math.round(nestW * 1.0)) + 40
await scene(3, 'dash', { zoom: 2, x: 0, y: side }, { top: T.dash, sub: `${ko ? '일개미' : 'Workers'} ${Math.round(workers(w))} · ${ko ? '병정' : 'Majors'} ${Math.round(majors(w))}` })
await scene(3.2, 'report', { zoom: 2, x: 0, y: side }, { top: T.report, sub: T.reportS })
await scene(2.6, 'tools', { zoom: 2, x: 0, y: side }, { top: T.tools })
await scene(2.4, 'dex', { zoom: 2, x: 0, y: side }, { top: T.dex })
// 4) 끝: 설치 한 줄
await scene(4.5, 'dash', { zoom: 2, x: 0, y: 0 }, { end: `<div class=big>${T.endBig}</div><div class=tag>${T.endTag}</div><code>${INSTALL}</code><div class=url>github.com/findot-ai/ant-nest</div>` })

ff.stdin.end(); await ff.exited; await browser.close()
console.log('영상', file, `${(frame / FPS).toFixed(1)}초`)
