import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import {
  newWorld, hourTick, moveAnts, syncAnts, sendForager, sendDigger, spawnSpider, spawnCentipede, defeatCentipede, farmFor, sendTo,
  say, workers, majors, bcount, epName, epDays, hour, airT, season, seasonName, nextGeneration, colonyLevel, queenYears, SP,
} from './engine'
import { emptyProfile, scanTranscript, scanHistory, scanSettings, pickSetup } from './profile'
import { SPECIES, SPECIES_IDS } from './species'
import type { SpeciesId } from './species'
import type { World, Ant, Tally, Lang, LogLine } from './engine'
import { svg, raster } from './render'
import { classify, colonyType, isTestLike } from './usage'

const PANE = 'ant-nest'
// 접속 75초 = 게임 1시간, 접속 30분 = 게임 하루, 약 35시간 = 게임 1년. 한 세대(여왕 수명 5~10년)는 매일 쓰면 현실 약 3개월
const FRAME_MS = 500, FRAMES_PER_HOUR = 150
const view = atom({ plugin: 'ant-nest', key: 'view' } as const, { frame: 0 })


// 화면 글자: 언어별 한 벌씩
const TXT = {
  ko: {
    title: '개미굴', day: '일', am: '오전', pm: '오후', hourSuffix: '시',
    workers: '일개미', majors: '병정', egg: '알', larva: '애벌레', pupa: '고치', carb: '단물', prot: '단백질',
    today: '오늘의 AI 활용', explore: '채집(탐색)', build: '굴착(편집)', hunt: '사냥(테스트 통과)', raise: '육성(위임)', bugs: '버그', fixed: '해결',
    exploreS: '채집', buildS: '굴착', huntS: '사냥', open: '개미굴 열기', centipede: '⚠ 지네', spider: '⚠ 거미줄', invasion: '⚠ 지네 침입',
    winter: '겨울: 개미들은 깊은 방에서 멈춰 있습니다. 이 동안의 AI 활용은 비축으로 쌓입니다.',
    opened: '개미굴을 열었습니다.', reset: '새 땅에 새 군락을 앉혔습니다.',
    level: 'Lv', gen: (n: number) => `${n}대`, queen: (y: number, life: number) => `여왕 ${y.toFixed(1)}/${life}년`, origin: '시작 분석', lineage: '이전 세대', speciesList: '개미종 (/ant new <종>으로 새 군락)', unknownSp: '그런 종은 없습니다.', succession: '🐜 새 세대가 시작됐다', collapse: '🐜 군락이 흩어졌다. 빈 땅에 새 여왕이 내려앉았다', fixedToast: '🐜 버그를 잡았다: 지네 격퇴, 단백질 +8',
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
    opened: 'Opened the ant nest.', reset: 'A new colony has settled on fresh ground.',
    level: 'Lv', gen: (n: number) => `Gen ${n}`, queen: (y: number, life: number) => `Queen ${y.toFixed(1)}/${life}y`, origin: 'Starting analysis', lineage: 'Past generations', speciesList: 'Species (start a new colony with /ant new <species>)', unknownSp: 'No such species.', succession: '🐜 A new generation begins', collapse: '🐜 The colony scattered. A new queen landed on the empty ground', fixedToast: '🐜 Bug fixed: centipede down, protein +8',
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
  const line = (l: LogLine) => (lang === 'en' ? `${seasonName(w, l.s, 'en')} d${l.d} · ${l.en}` : `${seasonName(w, l.s, 'ko')} ${l.d}일 · ${l.ko}`)
  const when = () => `${epName(w.ep, lang, w)} ${Math.min(w.day, epDays(w))}${T.day}`
  const spName = (id: SpeciesId) => (lang === 'en' ? SPECIES[id].en : SPECIES[id].ko)
  const badge = () => `${spName(w.species)} · ${T.gen(w.gen)} · ${T.level}${colonyLevel(w)} · ${T.queen(queenYears(w), SP(w).life)}`

  let w: World = newWorld()
  let ants: Ant[] = []
  let frame = 0, hourGain = 0, lastStatus = '', paneNote = '-'

  const bump = (k: keyof Tally) => { w.today[k]++; w.total[k]++ }
  const gain = (n: number) => { const g = Math.max(0, Math.min(n, 8 - hourGain)); hourGain += g; return g }
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
    if (saved && saved.v === 4 && Array.isArray(saved.grid)) { w = saved; say(w, '다시 접속했다. 개미들이 하던 일을 이어 간다.', 'You are back. The ants pick up where they left off.') }
    else {
      // 처음 설치: 이 컴퓨터의 Claude Code 기록을 로컬에서만 훑어 시작 군락을 정한다 (개수만 세고 원문은 남기지 않음)
      const p = emptyProfile()
      const home = (await $.env.get('CLAUDE_CONFIG_DIR')) ?? `${(await $.env.get('HOME')) ?? (await $.env.get('USERPROFILE')) ?? '.'}/.claude`
      try {
        const files: { path: string; mtime: number }[] = []
        for (const d of await $.fs.list(`${home}/projects`)) {
          if (d.kind !== 'dir') continue
          for (const f of await $.fs.list(`${home}/projects/${d.name}`)) if (f.name.endsWith('.jsonl') && f.size < 4_000_000) files.push({ path: `${home}/projects/${d.name}/${f.name}`, mtime: f.mtimeMs })
        }
        for (const f of files.sort((a, b) => b.mtime - a.mtime).slice(0, 15)) { try { scanTranscript(await $.fs.read(f.path), p) } catch { /* 건너뜀 */ } }
      } catch { /* 기록 폴더가 없으면 빈 분석 */ }
      try { scanHistory(await $.fs.read(`${home}/history.jsonl`), p) } catch { /* 없음 */ }
      for (const f of [`${home}/settings.json`, `${home}/../.claude.json`]) { try { scanSettings(await $.fs.read(f), p) } catch { /* 없음 */ } }
      try { p.skills = (await $.fs.list(`${home}/skills`)).filter(x => x.kind === 'dir').length } catch { /* 없음 */ }
      const setup = pickSetup(p)
      w = newWorld(setup)
      say(w, setup.ko, setup.en)
      await $.store.set('world', w)
    }
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
        if (w.over) { const succ = w.alates > 0; w = nextGeneration(w); ants = []; syncAnts(w, ants); $.ui.toast(succ ? T.succession : T.collapse); void $.store.set('world', w) }
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
    if (arg === 'species') return { text: `${T.speciesList}\n` + SPECIES_IDS.map(id => `${id} · ${spName(id)} (${SPECIES[id].sci}): ${lang === 'en' ? SPECIES[id].enDesc : SPECIES[id].koDesc}`).join('\n') }
    if (arg.startsWith('new')) {
      const id = arg.slice(3).trim() as SpeciesId
      if (id && !SPECIES[id]) return { text: T.unknownSp }
      w = newWorld({ species: id || w.species, stage: 'found', farms: w.trees.filter(t => t.farm).map(t => t.farm!), trail: 0, instinct: 0, majorBias: 0, storeBias: 0, ko: '', en: '' }, 1, w.lineage); ants = []; syncAnts(w, ants); await $.store.set('world', w); return { text: T.reset }
    }
    if (arg === 'reset') { await $.store.delete('world'); w = newWorld(); ants = []; syncAnts(w, ants); await $.store.set('world', w); await $.ui.open({ id: PANE, title: T.title }); return { text: T.reset } }
    if (arg === 'stats') return { text: `${badge()}\n${T.stats(w.total, Math.round(workers(w) + majors(w)), epName(w.ep, lang, w))}\n${T.type}: ${colonyType(w.total, lang)}\n${T.learned(Object.keys(w.learned).length)}\n${T.origin}: ${lang === 'en' ? w.origin.en : w.origin.ko}${w.lineage.length ? `\n${T.lineage}: ` + w.lineage.map(l => `${T.gen(l.gen)} ${spName(l.species)} ${l.years}y · peak ${l.peak}`).join(' / ') : ''}` }
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
      // 종마다 잘하는 일이 다르다 (잎꾼개미는 MCP, 꿀단지개미는 자동화, 군대개미는 병렬, 사무라이개미는 위임)
      const bk = use.kind === 'other' ? 1 : SP(w).boost[use.kind] ?? 1
      switch (use.kind) {
        case 'explore': bump('explore'); w.carb += gain(0.35 * bk * (1 + w.trail * 0.2)); sendForager(w, ants, 1); break
        case 'build': bump('build'); w.digQueue = Math.min(40, w.digQueue + (Math.random() < bk ? 1 : 0)); sendDigger(w, ants); break
        case 'hunt': bump('hunt'); w.prot += gain(1.5 * bk); sendForager(w, ants, 2); say(w, '테스트가 통과했다. 사냥조가 곤충을 끌고 돌아온다.', 'Tests passed. The hunting party drags an insect home.'); break
        case 'raise':
          bump('raise')
          if (w.species === 'samurai') { w.brood.push({ st: 'pupa', n: 0.5 * bk, dev: 0.5, prot: 0, room: w.queen.room }); say(w, '일을 나눠 맡겼다. 사무라이개미 원정대가 곰개미 고치를 훔쳐 왔다.', 'Work was delegated. The samurai raiders brought back stolen wood ant cocoons.') }
          else { w.brood.push({ st: 'egg', n: bk, dev: 0, prot: 0, room: w.queen.room }); say(w, '일을 나눠 맡겼다. 여왕이 알을 더 낳았다.', 'Work was delegated. The queen laid extra eggs.') }
          break
        case 'mcp': { bump('mcp'); const t = farmFor(w, use.server ?? 'mcp'); w.carb += gain(0.5 * bk); sendTo(w, ants, t.x, t.h, 1); break }
        case 'skill': {
          bump('skill'); const before = Math.floor(w.trail); w.trail = Math.min(3, w.trail + 0.3)
          if (Math.floor(w.trail) > before) say(w, '익힌 방법(스킬)을 다시 썼다. 페로몬 길이 짙어져 채집이 빨라진다.', 'A learned method (skill) was reused. The pheromone trail grows stronger and foraging speeds up.')
          break
        }
        case 'auto':
          bump('auto')
          if (use.setup) { w.instinct = Math.min(10, w.instinct + bk); say(w, '자동화를 걸어 두었다. 개미들이 스스로 하는 일(본능)이 늘었다.', 'Automation was set up. The ants now do more on instinct, even without you.') }
          else w.instinct = Math.min(10, w.instinct + 0.1 * bk)
          break
        case 'plan': bump('plan'); w.digQueue = Math.min(40, w.digQueue + 1); w.carb += gain(0.2 * bk); break
        case 'parallel':
          bump('parallel'); for (let k = 0; k < 4 * bk; k++) sendForager(w, ants, k === 0 || w.species === 'army' ? 2 : 1)
          w.prot += gain(0.5 * bk)
          w.brood.push({ st: 'egg', n: 1, dev: 0, prot: 0, room: w.queen.room })
          say(w, '여러 에이전트를 동시에 보냈다. 원정대가 줄지어 굴을 나선다.', 'Several agents went out at once. An expedition files out of the nest.')
          break
        default: if (tool === 'Bash') w.carb += gain(0.2)
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
      picture = <Svg source={svg(w, ants, lang)} alt={T.alt(pop)} width={288} height={384} />
    }
    return (
      <Box flexDirection="column">
        <Text bold>{head}</Text>
        <Text dimColor>{badge()}</Text>
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
