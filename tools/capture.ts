// 홍보용 화면 자동 촬영: 실제 시뮬레이션 엔진과 그림 코드로 장면을 돌려 릴스·유튜브 영상과 브런치 이미지를 만든다.
// 실행: bun tools/capture.ts [출력 폴더]   (필요: Playwright와 Chromium, ffmpeg)
// Playwright를 전역으로 깔았다면 PLAYWRIGHT_MODULE=<경로>/playwright/index.mjs, 브라우저 경로는 CHROME=<경로>로 지정
// 실제 Claude Code 화면을 찍는 것이 아니라 플러그인과 같은 엔진·렌더러로 개미굴만 그린다.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  newWorld, DEFAULT_SETUP, hourTick, moveAnts, syncAnts, sendForager, sendDigger, spawnSpider, spawnCentipede, defeatCentipede,
  startFlight, workers, majors, SURF, W,
} from '../hooks/engine'
import type { World, Ant } from '../hooks/engine'
import { svg, visibleRows, guestIcon } from '../hooks/render'
import { GUESTS, RARITY_KO } from '../hooks/guests'

const OUT = resolve(process.argv[2] ?? 'media-out'), FPS = 15
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright')
const CHROME = process.env.CHROME
mkdirSync(OUT, { recursive: true })

// 한글 글꼴: Noto Sans KR (없으면 내려받고, 못 받으면 시스템 글꼴)
const FONT = join(OUT, '.NotoSansKR.ttf')
if (!existsSync(FONT)) {
  const r = await fetch('https://fonts.gstatic.com/s/notosanskr/v36/PbyxFmXiEBPT4ITbgNA5Cgms3VYcOA-vvnIzzg01eLQ.ttf').catch(() => null)
  if (r?.ok) writeFileSync(FONT, Buffer.from(await r.arrayBuffer()))
}
const fontCss = existsSync(FONT) ? `@font-face{font-family:NK;src:url(data:font/ttf;base64,${readFileSync(FONT).toString('base64')});font-weight:100 900}` : ''

const browser = await chromium.launch({ executablePath: CHROME })

// ---------- 군락 준비 ----------
function grown(days: number, stage: 'found' | 'young' | 'mature' = 'young') {
  const w = newWorld({ ...DEFAULT_SETUP, stage })
  for (let i = 0; i < 24 * days; i++) { w.digQueue += 1; hourTick(w) }
  w.threats = []; w.flight = 0; w.guests = []
  return w
}
const roomOf = (w: World, type: string) => w.chambers.find(c => c.type === type) ?? w.chambers[0]!

// ---------- 영상 ----------
type Cap = { top?: string; chip?: string; sub?: string; zoom?: number; y?: number; ox?: number; extra?: string }
const TEMPLATE = (Wd: number, Hd: number, vertical: boolean) => `<!doctype html><meta charset=utf-8><style>${fontCss}
*{box-sizing:border-box}body{margin:0;width:${Wd}px;height:${Hd}px;background:#120d09;color:#f6efe4;font-family:NK,'WenQuanYi Zen Hei',sans-serif;overflow:hidden}
#top{position:absolute;left:60px;right:60px;text-align:center;white-space:pre-line;font-weight:800;line-height:1.25;${vertical ? 'top:120px;font-size:66px' : 'top:40px;font-size:52px'}}
#chip{position:absolute;left:50%;transform:translateX(-50%);padding:16px 34px;border-radius:999px;background:#2a2018;border:3px solid #e3a33b;font-weight:700;white-space:nowrap;${vertical ? 'top:330px;font-size:40px' : 'top:120px;font-size:32px'}}
#chip:empty,#top:empty,#sub:empty,#extra:empty{display:none}
#stage{position:absolute;overflow:hidden;border-radius:28px;background:#000;${vertical ? 'top:440px;left:40px;width:1000px;height:1120px' : 'top:0;left:0;width:100%;height:100%;border-radius:0'}}
#nest{transform-origin:50% 0;transition:none}#nest svg{display:block}
#sub{position:absolute;left:50px;right:50px;text-align:center;font-weight:800;text-shadow:0 4px 0 #000,0 0 18px #000;${vertical ? 'bottom:170px;font-size:58px' : 'bottom:60px;font-size:46px'}}
#extra{position:absolute;left:40px;right:40px;${vertical ? 'top:440px;height:1120px' : 'top:0;bottom:0'};display:flex;align-items:center;justify-content:center}
.dex{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;padding:24px;background:rgba(18,13,9,.92);border-radius:28px;width:100%;height:100%;align-content:center}
.card{background:#f3ead8;color:#2a1a08;border-radius:22px;padding:14px 18px;text-align:center}.card svg{width:auto;height:150px}
.card b{display:block;font-size:28px}.card i{font-style:normal;font-size:24px;color:#9a6a2a}
.end{background:rgba(18,13,9,.94);border-radius:28px;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:40px;text-align:center}
.end code{font-size:25px;white-space:nowrap;background:#2a2018;border:2px solid #e3a33b;border-radius:16px;padding:22px 26px;color:#ffe2a8}
.end .big{font-size:78px;font-weight:900}.end .tag{font-size:42px;color:#e3a33b;font-weight:700}.end .url{font-size:38px;color:#cfc4b4}
</style><div id=stage><div id=nest></div></div><div id=top></div><div id=chip></div><div id=extra></div><div id=sub></div>`

async function video(name: string, Wd: number, Hd: number, vertical: boolean, script: (shot: Shot) => Promise<void>) {
  const page = await browser.newPage({ viewport: { width: Wd, height: Hd } })
  await page.setContent(TEMPLATE(Wd, Hd, vertical))
  const file = join(OUT, name)
  const ff = Bun.spawn(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-', '-r', '30', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', file], { stdin: 'pipe' })
  const nestW = vertical ? 1000 : Wd
  let frame = 0
  const shot: Shot = async (w, ants, sec, cap, o = {}) => {
    const n = Math.round(sec * FPS)
    for (let i = 0; i < n; i++) {
      o.each?.(i, n)
      if (o.timelapse) { for (let k = 0; k < o.timelapse; k++) { w.digQueue += 1; hourTick(w); if (w.tick % 24 === 0) syncAnts(w, ants) } }
      else if (frame % (o.hourEvery ?? 60) === 0 && frame > 0) { hourTick(w); if (w.tick % 24 === 0) syncAnts(w, ants) }
      if (frame % 2 === 0) moveAnts(w, ants)
      const phase = o.timelapse ? 0 : (frame % (o.hourEvery ?? 60)) / (o.hourEvery ?? 60)
      const c = typeof cap === 'function' ? cap(i, n) : cap
      await page.evaluate(([s, c, nw]: [string, Cap, number]) => {
        const nest = document.getElementById('nest')!; nest.innerHTML = s
        const z = c.zoom ?? 1; nest.style.transform = `translateY(${-(c.y ?? 0)}px) scale(${z})`; nest.style.transformOrigin = `${c.ox ?? 50}% 0`; nest.style.width = nw + 'px'
        for (const k of ['top', 'chip', 'sub'] as const) { const el = document.getElementById(k)!; if (el.textContent !== (c[k] ?? '')) el.textContent = c[k] ?? '' }
        const ex = document.getElementById('extra')!; if (ex.dataset.v !== (c.extra ?? '')) { ex.innerHTML = c.extra ?? ''; ex.dataset.v = c.extra ?? '' }
      }, [svg(w, ants, 'ko', nestW, frame * 0.5, phase), c, nestW] as [string, Cap, number])
      ff.stdin.write(await page.screenshot({ type: 'jpeg', quality: 90 }))
      frame++
    }
  }
  await script(shot)
  ff.stdin.end(); await ff.exited; await page.close()
  console.log('영상', file, `${(frame / FPS).toFixed(1)}초`)
}
type Shot = (w: World, ants: Ant[], sec: number, cap: Cap | ((i: number, n: number) => Cap), o?: { hourEvery?: number; timelapse?: number; each?: (i: number, n: number) => void }) => Promise<void>

const dexHtml = `<div class=dex>${GUESTS.map(g => `<div class=card>${guestIcon(g.id, true)}<b>${g.ko}</b><i>${'★'.repeat(g.rarity)}${'☆'.repeat(4 - g.rarity)} ${RARITY_KO[g.rarity]}</i></div>`).join('')}</div>`
const INSTALL = '/plugin install ant-nest --marketplace findot-ai/ant-nest'
const endHtml = `<div class=end><div class=big>당신의 개미굴은?</div><div class=tag>무료 · 토큰 0 · 오픈소스</div><code>${INSTALL}</code><div class=url>github.com/findot-ai/ant-nest</div></div>`

// 릴스·쇼츠 60초 (9:16) — 콘텐츠 문서의 숏폼 대본 순서
await video('reels-60s-ko.mp4', 1080, 1920, true, async shot => {
  const w = grown(90), ants: Ant[] = []; syncAnts(w, ants)
  const deepY = (y: number) => Math.max(0, (y - SURF - 6) * (1000 / W))
  await shot(w, ants, 3, { top: '회사에서 몰래\n개미를 키우고 있습니다', zoom: 1.6, y: 0 })
  await shot(w, ants, 5, { top: '먹이는 제 AI 활용입니다', sub: 'AI로 일할수록 군락이 자란다' })
  await shot(w, ants, 8, { top: '파일을 찾으면', chip: '📖 파일 읽기 · 검색', sub: '일개미가 먹이를 찾으러 나간다' }, { each: i => { if (i % 6 === 0) sendForager(w, ants, 1) } })
  const st = roomOf(w, 'brood')
  await shot(w, ants, 6, { top: '코드를 고치면', chip: '✏️ 코드 수정', sub: '굴이 깊어진다', y: deepY(st.cy) }, { hourEvery: 20, each: i => { if (i % 4 === 0) { w.digQueue += 3; sendDigger(w, ants) } } })
  spawnSpider(w)
  await shot(w, ants, 4, { top: '오류가 나면', chip: '❌ 테스트 실패', sub: '거미가 길목에 줄을 친다' })
  spawnCentipede(w, 'Bash')
  const cen = w.threats.find(t => t.k === 'centipede')
  await shot(w, ants, 4, () => ({ top: '같은 오류가 반복되면', chip: '❌❌❌ 같은 실패 3번', sub: '지네가 굴을 뚫고 들어온다', y: cen ? deepY(cen.y) : 0 }), { hourEvery: 30 })
  defeatCentipede(w, true); w.threats = []
  w.flight = 0; startFlight(w, 4)
  const ex = (() => { for (let x = 0; x < W; x++) if (w.grid[SURF * W + x] === 2) return x; return W / 2 })()
  await shot(w, ants, 8, { top: '배포하면', chip: '🚀 git commit · 배포', sub: '날개 달린 개미들이 결혼비행을 떠난다', zoom: 2.2, ox: (ex / W) * 100, y: 0 }, { hourEvery: 110 })
  const br = roomOf(w, 'brood'); w.guests = [{ id: 'cricket', x: br.cx + 1, y: br.cy + br.ry, days: 5 }]
  await shot(w, ants, 3, { top: '가끔은', chip: '🦗 생물 도감 등록', sub: '진짜 개미집 손님이 찾아온다', y: deepY(br.cy), zoom: 1.2 })
  await shot(w, ants, 5, { top: '실제 개미집 생물 8종', chip: '흔함부터 전설까지', extra: dexHtml })
  const g = newWorld({ ...DEFAULT_SETUP, stage: 'found' }), ga: Ant[] = []; syncAnts(g, ga)
  await shot(g, ga, 6, (i, n) => ({ top: '이렇게 자랍니다', chip: `게임 ${Math.round((i / n) * 150)}일`, sub: `일개미 ${Math.round(workers(g))} · 병정 ${Math.round(majors(g))} · 방 ${g.chambers.length}` }), { timelapse: 34 })
  await shot(g, ga, 7, { extra: endHtml })
})

// 유튜브 데브로그 B롤: 16:9 성장 타임랩스 20초 (글자 없음)
await video('timelapse-16x9.mp4', 1920, 1080, false, async shot => {
  const g = newWorld({ ...DEFAULT_SETUP, stage: 'found' }), ga: Ant[] = []; syncAnts(g, ga)
  await shot(g, ga, 20, { y: 0 }, { timelapse: 14 })
})

// ---------- 브런치 이미지 ----------
async function still(name: string, html: string, width: number, height?: number) {
  const page = await browser.newPage({ viewport: { width, height: height ?? 100 } })
  await page.setContent(`<!doctype html><meta charset=utf-8><style>${fontCss}body{margin:0;background:#120d09;font-family:NK,sans-serif}svg{display:block}</style>${html}`)
  await page.screenshot({ path: join(OUT, name), fullPage: !height })
  await page.close(); console.log('이미지', join(OUT, name))
}
{
  const w = grown(150), ants: Ant[] = []; syncAnts(w, ants)
  for (let i = 0; i < 40; i++) moveAnts(w, ants)
  const nestH = (wd: number) => Math.round((wd * visibleRows(w)) / W)
  await still('brunch-1-nest.png', svg(w, ants, 'ko', 1400, 0, 0.4), 1400)
  for (let i = 0; i < 6; i++) sendForager(w, ants, 1)
  for (let i = 0; i < 30; i++) moveAnts(w, ants)
  spawnSpider(w)
  await still('brunch-2-spider.png', svg(w, ants, 'ko', 1400, 3, 0.5), 1400, Math.round(nestH(1400) * 0.45))
  w.threats = []; startFlight(w, 4)
  await still('brunch-3-flight.png', svg(w, ants, 'ko', 1400, 5, 0.7), 1400, Math.round(nestH(1400) * 0.4))
  const br = roomOf(w, 'brood'); w.guests = [{ id: 'lycaenid', x: br.cx, y: br.cy + br.ry, days: 5 }]
  await still('brunch-4-creature.png', `<div style="width:1400px;height:${Math.round(nestH(1400) * 0.42)}px;overflow:hidden"><div style="transform:translateY(${-Math.max(0, (br.cy - SURF - 8) * (1400 / W))}px)">${svg(w, ants, 'ko', 1400, 0, 0)}</div></div>`, 1400, Math.round(nestH(1400) * 0.42))
  await still('brunch-5-dex.png', `<div style="width:1400px;padding:40px;display:grid;grid-template-columns:repeat(4,1fr);gap:24px;box-sizing:border-box">${GUESTS.map(g => `<div style="background:#f3ead8;border-radius:20px;padding:14px;text-align:center;color:#2a1a08">${guestIcon(g.id, true).replace('width="80" height="50"', 'width="100%"')}<b style="display:block;font-size:24px">${g.ko}</b><span style="font-size:19px;color:#9a6a2a">${'★'.repeat(g.rarity)}${'☆'.repeat(4 - g.rarity)} ${RARITY_KO[g.rarity]}</span></div>`).join('')}</div>`, 1400)
  const a = newWorld({ ...DEFAULT_SETUP, stage: 'found' })
  const label = (t: string) => `<div style="color:#f6efe4;font-size:34px;font-weight:800;text-align:center;padding:18px">${t}</div>`
  await still('brunch-6-before-after.png', `<div style="display:flex;gap:24px;padding:24px;width:1400px;box-sizing:border-box;align-items:flex-start"><div style="flex:1">${label('첫날: 여왕 혼자')}${svg(a, [], 'ko', 664, 0, 0.3)}</div><div style="flex:1">${label('게임 150일 뒤')}${svg(w, ants, 'ko', 664, 0, 0.3)}</div></div>`, 1400)
}
await browser.close()
