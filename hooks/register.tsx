import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import {
  newWorld, hourTick, moveAnts, syncAnts, sendForager, sendDigger, spawnSpider, spawnCentipede, defeatCentipede, farmFor, sendTo,
  say, workers, majors, bcount, epName, epDays, hour, airT, season, SEASONS, SEASONS_EN,
} from './engine'
import type { World, Ant, Tally, Lang, LogLine } from './engine'
import { svg, raster } from './render'
import { classify, colonyType, isTestLike } from './usage'

const PANE = 'ant-nest'
const FRAME_MS = 500, FRAMES_PER_HOUR = 4
const view = atom({ plugin: 'ant-nest', key: 'view' } as const, { frame: 0 })


// 화면 글자: 언어별 한 벌씩
const TXT = {
  ko: {
    title: '개미굴', day: '일', am: '오전', pm: '오후', hourSuffix: '시',
    workers: '일개미', majors: '병정', egg: '알', larva: '애벌레', pupa: '고치', carb: '단물', prot: '단백질',
    today: '오늘의 AI 활용', explore: '채집(탐색)', build: '굴착(편집)', hunt: '사냥(테스트 통과)', raise: '육성(위임)', bugs: '버그', fixed: '해결',
    exploreS: '채집', buildS: '굴착', huntS: '사냥', open: '개미굴 열기', centipede: '⚠ 지네', spider: '⚠ 거미줄', invasion: '⚠ 지네 침입',
    winter: '겨울: 개미들은 깊은 방에서 멈춰 있습니다. 이 동안의 AI 활용은 비축으로 쌓입니다.',
    opened: '개미굴을 열었습니다.', reset: '새 땅에 3년차 군락을 새로 앉혔습니다.', fixedToast: '🐜 버그를 잡았다: 지네 격퇴, 단백질 +8',
    noPane: (note: string, surfaces: string) => `이 화면에는 창을 둘 수 없습니다 (${note}). 연결된 화면: ${surfaces}. 입력창 위 줄과 상태줄로 보여 드립니다.`,
    none: '없음', alt: (n: number) => `개미굴: 개미 ${n}마리`,
    stats: (t: Tally, pop: number, ep: string) => `지금까지의 AI 활용 → 개미굴\n채집(탐색) ${t.explore} · 굴착(편집) ${t.build} · 사냥(테스트 통과) ${t.hunt} · 육성(위임) ${t.raise}\n목축(MCP 외부 도구) ${t.mcp} · 페로몬 길(스킬) ${t.skill} · 본능(자동화) ${t.auto} · 설계(계획) ${t.plan} · 원정대(병렬 에이전트) ${t.parallel}\n버그 ${t.bugs}번 중 ${t.fixed}번 해결 · 현재 개미 ${pop}마리 · ${ep}`,
    type: '군락 유형', learned: (n: number) => `처음 보고 이름으로 짐작해 배운 도구 ${n}개`, compact: '긴 대화가 요약됐다. 두더지가 지나가며 창고 한쪽이 무너졌다.',
    more: (t: Tally) => `목축 ${t.mcp} · 길 ${t.skill} · 본능 ${t.auto} · 설계 ${t.plan} · 원정 ${t.parallel}`,
  },
  en: {
    title: 'Ant Nest', day: '', am: 'AM', pm: 'PM', hourSuffix: '',
    workers: 'Workers', majors: 'Majors', egg: 'Eggs', larva: 'Larvae', pupa: 'Pupae', carb: 'Honeydew', prot: 'Protein',
    today: "Today's AI use", explore: 'Foraging (explore)', build: 'Digging (edit)', hunt: 'Hunting (tests pass)', raise: 'Raising (delegate)', bugs: 'Bugs', fixed: 'fixed',
    exploreS: 'Forage', buildS: 'Dig', huntS: 'Hunt', open: 'Open nest', centipede: '⚠ Centipede', spider: '⚠ Web', invasion: '⚠ Centipede inside',
    winter: 'Winter: the ants are huddled deep and still. AI use during this time is stored as reserves.',
    opened: 'Opened the ant nest.', reset: 'A new third-year colony has settled on fresh ground.', fixedToast: '🐜 Bug fixed: centipede down, protein +8',
    noPane: (note: string, surfaces: string) => `This screen cannot hold a pane (${note}). Attached surfaces: ${surfaces}. Showing the nest above the prompt and in the status line instead.`,
    none: 'none', alt: (n: number) => `Ant nest: ${n} ants`,
    stats: (t: Tally, pop: number, ep: string) => `Your AI use so far → the nest\nForaging (explore) ${t.explore} · Digging (edit) ${t.build} · Hunting (tests pass) ${t.hunt} · Raising (delegate) ${t.raise}\nHerding (MCP tools) ${t.mcp} · Trails (skills) ${t.skill} · Instinct (automation) ${t.auto} · Blueprints (plans) ${t.plan} · Expeditions (parallel agents) ${t.parallel}\n${t.fixed} of ${t.bugs} bugs fixed · ${pop} ants now · ${ep}`,
    type: 'Colony type', learned: (n: number) => `${n} unfamiliar tools learned by guessing from their names`, compact: 'The long conversation was summarized. A mole passed and part of the storage caved in.',
    more: (t: Tally) => `Herd ${t.mcp} · Trail ${t.skill} · Instinct ${t.auto} · Plan ${t.plan} · Expedition ${t.parallel}`,
  },
}

export const register: Register = (on, options) => {
  const pref = String(options.language ?? 'auto')
  const lang: Lang = pref === 'ko' || pref === 'en' ? pref : Intl.DateTimeFormat().resolvedOptions().locale.startsWith('ko') ? 'ko' : 'en'
  const T = TXT[lang]
  const line = (l: LogLine) => (lang === 'en' ? `${SEASONS_EN[l.s]} d${l.d} · ${l.en}` : `${SEASONS[l.s]} ${l.d}일 · ${l.ko}`)
  const when = () => `${epName(w.ep, lang)} ${Math.min(w.day, epDays(w))}${T.day}`

  let w: World = newWorld()
  let ants: Ant[] = []
  let frame = 0, hourGain = 0, lastStatus = '', paneNote = '-'

  const bump = (k: keyof Tally) => { w.today[k]++; w.total[k]++ }
  const gain = (n: number) => { const g = Math.max(0, Math.min(n, 30 - hourGain)); hourGain += g; return g }
  // 상태줄에 새로 쓸 글이 있으면 돌려준다
  const statusText = () => {
    const pop = Math.round(workers(w) + majors(w))
    const th = w.threats.map(t => (t.k === 'centipede' ? T.centipede : T.spider)).join(' ')
    const text = `🐜 ${pop}${th ? ' · ' + th : ''}`
    if (text === lastStatus) return undefined
    lastStatus = text; return text
  }

  on('session.start', async ($, e, next) => {
    const saved = (await $.store.get('world')) as World | undefined
    if (saved && saved.v === 3 && Array.isArray(saved.grid)) { w = saved; say(w, '다시 접속했다. 개미들이 하던 일을 이어 간다.', 'You are back. The ants pick up where they left off.') }
    else await $.store.set('world', w)
    ants = []; syncAnts(w, ants)
    // 사람 없이 돌아가는 세션(-p, SDK, 예약 실행)은 자동화다
    if (!e.isInteractive) { w.instinct = Math.min(10, w.instinct + 0.5); bump('auto') }
    await $.command.register({ name: 'ant', description: '개미굴 창 열기 / Open the ant nest (reset: 새 군락 new colony, stats: 활용 기록 usage log)' })
    const opened = await $.ui.open({ id: PANE, title: T.title })
    paneNote = opened.isPlaced ? 'placed' : opened.reason
    $.clock.every(FRAME_MS, () => {
      frame++
      moveAnts(w, ants)
      if (frame % FRAMES_PER_HOUR === 0) {
        hourTick(w); hourGain = 0
        if (w.tick % 24 === 0) { syncAnts(w, ants); void $.store.set('world', w) }
      }
      const st = statusText(); if (st) $.ui.status(st)
      void update($, view, () => ({ frame }))
    })
    return next(e)
  })

  on('session.attach', async ($, e, next) => {
    const opened = await $.ui.open({ id: PANE, title: T.title })
    paneNote = opened.isPlaced ? `placed (${e.surface})` : `${e.surface}: ${opened.reason}`
    return next(e)
  })

  // 창을 둘 수 없는 화면에서도 보이도록 입력창 위에 한 줄
  on('ui.render', { component: 'AbovePrompt' }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    await read($, view)
    const pop = Math.round(workers(w) + majors(w)), t = w.today
    const th = w.threats.map(x => (x.k === 'centipede' ? T.invasion : T.spider)).join(' ')
    const last = w.log[w.log.length - 1]
    return (
      <Box flexDirection="column">
        <Box>
          <Text>🐜 {pop} · {when()} · {T.exploreS} {t.explore} · {T.buildS} {t.build} · {T.huntS} {t.hunt} · {T.bugs} {t.bugs} ({T.fixed} {t.fixed}){th ? ' · ' + th : ''} </Text>
          <Button key="open" label={T.open} onPress={() => { void $.ui.open({ id: PANE, title: T.title, focus: true }) }} />
        </Box>
        <Text dimColor>{last ? line(last) : ''}</Text>
      </Box>
    )
  })

  on('session.end', async ($, e, next) => { await $.store.set('world', w); return next(e) })

  on('session.compact', async ($, e, next) => {
    w.carb *= 0.9
    say(w, '긴 대화가 요약됐다. 두더지가 지나가며 창고 한쪽이 무너졌다.', 'The long conversation was summarized. A mole passed and part of the storage caved in.')
    return next(e)
  })

  on('command.run', { command: 'ant' }, async ($, e) => {
    const arg = e.args.trim()
    if (arg === 'reset') { w = newWorld(); ants = []; syncAnts(w, ants); await $.store.set('world', w); await $.ui.open({ id: PANE, title: T.title }); return { text: T.reset } }
    if (arg === 'stats') return { text: `${T.stats(w.total, Math.round(workers(w) + majors(w)), epName(w.ep, lang))}\n${T.type}: ${colonyType(w.total, lang)}\n${T.learned(Object.keys(w.learned).length)}` }
    const opened = await $.ui.open({ id: PANE, title: T.title, focus: true })
    paneNote = opened.isPlaced ? 'placed' : opened.reason
    const surfaces = (await $.session.surfaces()).join(', ') || T.none
    return { text: opened.isPlaced ? T.opened : T.noPane(paneNote, surfaces) }
  })

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny !== undefined) return ran
    const tool = e.tool, failed = ran.isError === true
    const input = e as unknown as Record<string, unknown>
    const cmd = e.tool === 'Bash' ? e.command : ''
    if (failed) {
      bump('bugs')
      w.streak[tool] = (w.streak[tool] ?? 0) + 1
      if (isTestLike(cmd)) { w.rain = Math.max(w.rain, 6); say(w, '테스트가 실패했다. 굴 위로 비가 내린다.', 'A test failed. Rain falls over the nest.') }
      if (w.streak[tool]! >= 3) spawnCentipede(w, tool)
      else spawnSpider(w)
    } else {
      if ((w.streak[tool] ?? 0) > 0) {
        w.streak[tool] = 0
        const cen = w.threats.find(t => t.k === 'centipede' && t.tool === tool)
        if (cen && defeatCentipede(w, true)) { bump('fixed'); $.ui.toast(T.fixedToast) }
        const sp = w.threats.find(t => t.k === 'spider')
        if (sp) { sp.life = 0; bump('fixed'); say(w, '오류를 고쳤다. 경비 개미들이 거미줄을 끊어 냈다.', 'Error fixed. The guards cut the web down.') }
      }
      const use = classify(tool, input)
      if (use.guessed && !w.learned[tool] && use.kind !== 'other') {
        w.learned[tool] = use.kind
        say(w, `처음 보는 도구(${tool})를 만났다. 이름으로 짐작해 일을 나눴다.`, `Met an unfamiliar tool (${tool}). The colony guessed its job from the name.`)
      }
      switch (use.kind) {
        case 'explore': bump('explore'); w.carb += gain(2 * (1 + w.trail * 0.2)); sendForager(w, ants, 1); break
        case 'build': bump('build'); w.digQueue += 6; sendDigger(w, ants); break
        case 'hunt': bump('hunt'); w.prot += gain(5); sendForager(w, ants, 2); say(w, '테스트가 통과했다. 사냥조가 곤충을 끌고 돌아온다.', 'Tests passed. The hunting party drags an insect home.'); break
        case 'raise': bump('raise'); w.brood.push({ st: 'egg', n: 3, dev: 0, prot: 0, room: w.queen.room }); say(w, '일을 나눠 맡겼다. 여왕이 알을 더 낳았다.', 'Work was delegated. The queen laid extra eggs.'); break
        case 'mcp': { bump('mcp'); const t = farmFor(w, use.server ?? 'mcp'); w.carb += gain(3); sendTo(w, ants, t.x, t.h, 1); break }
        case 'skill': {
          bump('skill'); const before = Math.floor(w.trail); w.trail = Math.min(3, w.trail + 0.3)
          if (Math.floor(w.trail) > before) say(w, '익힌 방법(스킬)을 다시 썼다. 페로몬 길이 짙어져 채집이 빨라진다.', 'A learned method (skill) was reused. The pheromone trail grows stronger and foraging speeds up.')
          break
        }
        case 'auto':
          bump('auto')
          if (use.setup) { w.instinct = Math.min(10, w.instinct + 1); say(w, '자동화를 걸어 두었다. 개미들이 스스로 하는 일(본능)이 늘었다.', 'Automation was set up. The ants now do more on instinct, even without you.') }
          else w.instinct = Math.min(10, w.instinct + 0.1)
          break
        case 'plan': bump('plan'); w.digQueue += 2; w.carb += gain(1); break
        case 'parallel':
          bump('parallel'); for (let k = 0; k < 4; k++) sendForager(w, ants, k === 0 ? 2 : 1)
          w.brood.push({ st: 'egg', n: 2, dev: 0, prot: 0, room: w.queen.room })
          say(w, '여러 에이전트를 동시에 보냈다. 원정대가 줄지어 굴을 나선다.', 'Several agents went out at once. An expedition files out of the nest.')
          break
        default: if (tool === 'Bash') w.carb += gain(1)
      }
    }
    const st = statusText(); if (st) $.ui.status(st)
    return ran
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    await read($, view)
    const pop = Math.round(workers(w) + majors(w)), h = hour(w)
    const clock = `${h < 12 ? T.am : T.pm} ${h % 12 === 0 ? 12 : h % 12}${T.hourSuffix}`
    const head = `ANT POP ${pop} · ${when()} · ${clock} · ${airT(w).toFixed(0)}°C`
    const stats = `${T.workers} ${Math.round(workers(w))} · ${T.majors} ${Math.round(majors(w))} · ${T.egg} ${Math.round(bcount(w, 'egg'))} · ${T.larva} ${Math.round(bcount(w, 'larva'))} · ${T.pupa} ${Math.round(bcount(w, 'pupa'))} · ${T.carb} ${Math.round(w.carb)} · ${T.prot} ${Math.round(w.prot)}`
    const t = w.today
    const usage = `${T.today} · ${T.explore} ${t.explore} · ${T.build} ${t.build} · ${T.hunt} ${t.hunt} · ${T.raise} ${t.raise} · ${T.bugs} ${t.bugs} (${T.fixed} ${t.fixed})`
    let picture
    if (e.surface === 'terminal') {
      const { Raster } = $.ui.resolve(e as typeof e & { surface: 'terminal' })
      picture = <Raster key="nest" {...raster(w, ants)} />
    } else if (e.surface === 'desktop' || e.surface === 'mobile' || e.surface === 'vscode') {
      const { Svg } = $.ui.resolve(e as typeof e & { surface: 'desktop' })
      picture = <Svg source={svg(w, ants, lang)} alt={T.alt(pop)} width={240} height={320} />
    }
    return (
      <Box flexDirection="column">
        <Text bold>{head}</Text>
        {picture}
        <Text dimColor>{stats}</Text>
        <Text>{usage}</Text>
        <Text dimColor>{T.more(t)} · {T.type}: {colonyType(w.total, lang)}</Text>
        {w.log.slice(-3).map(l => <Text dimColor>{line(l)}</Text>)}
        {season(w) === 3 && <Text dimColor>{T.winter}</Text>}
      </Box>
    )
  })
}
