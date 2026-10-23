import { atom, read, update } from 'claude-code'
import type { Register, RenderChildren } from 'claude-code'

import {
  newWorld, hourTick, moveAnts, syncAnts, sendForager, sendDigger, spawnSpider, spawnCentipede, defeatCentipede, farmFor, sendTo,
  say, workers, majors, bcount, epName, epDays, hour, airT, season, seasonName, nextGeneration, colonyLevel, queenYears, SP, slaves, raiders, armyPhase, startRaid, capacity, isWinter,
} from './engine'
import { emptyProfile, scanTranscript, scanHistory, scanSettings, pickSetup } from './profile'
import { SPECIES, SPECIES_IDS } from './species'
import { GUESTS, RARITY_KO, RARITY_EN, guestById } from './guests'
import type { GuestId } from './guests'
import type { SpeciesId } from './species'
import type { World, Ant, Tally, Lang, LogLine } from './engine'
import { svg, raster, visibleRows } from './render'
import { W } from './engine'
import { classify, colonyType, isTestLike } from './usage'

const PANE = 'ant-nest'
// 접속 75초 = 게임 1시간, 접속 30분 = 게임 하루, 약 35시간 = 게임 1년. 한 세대(여왕 수명 5~10년)는 매일 쓰면 현실 약 3개월
const FRAME_MS = 500, FRAMES_PER_HOUR = 150
const view = atom({ plugin: 'ant-nest', key: 'view' } as const, { frame: 0 })
const tabAtom = atom({ plugin: 'ant-nest', key: 'tab' } as const, 'dash')


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
  const isWinterNow = () => isWinter(w)
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
    if (saved && saved.v === 4 && Array.isArray(saved.grid)) { w = saved; w.guests ??= []; w.dex ??= {}; w.newDex ??= []; w.lineage ??= []; say(w, '다시 접속했다. 개미들이 하던 일을 이어 간다.', 'You are back. The ants pick up where they left off.') }
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
    await $.command.register({ name: 'ant', description: '개미굴 / Ant nest — stats · dex(도감) · species · new <종> · gift(선물 코드) · adopt <code> · card(프로필 카드) · reset' })
    const opened = await $.ui.open({ id: PANE, title: T.title })
    paneNote = opened.isPlaced ? 'placed' : opened.reason
    $.clock.every(FRAME_MS, () => {
      frame++
      moveAnts(w, ants)
      if (frame % FRAMES_PER_HOUR === 0) {
        hourTick(w); hourGain = 0
        for (const id of w.newDex.splice(0)) { const g = guestById(id as GuestId); $.ui.toast(lang === 'en' ? `🐜 New in your dex: ${g.en} (${RARITY_EN[g.rarity]})` : `🐜 도감 등록: ${g.ko} (${RARITY_KO[g.rarity]})`) }
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
    if (arg === 'dex') {
      const rows = GUESTS.map(g => { const d = w.dex[g.id]; const host = g.hosts === 'all' ? (lang === 'en' ? 'any species' : '모든 종') : g.hosts.map(spName).join(', ')
        return d ? `✔ ${lang === 'en' ? g.en : g.ko} (${g.sci}) · ${lang === 'en' ? RARITY_EN[g.rarity] : RARITY_KO[g.rarity]} · ×${d.n} · ${lang === 'en' ? g.enDesc : g.koDesc}` : `？ ${'?'.repeat(4)} · ${lang === 'en' ? RARITY_EN[g.rarity] : RARITY_KO[g.rarity]} · ${lang === 'en' ? 'lives with' : '사는 곳'}: ${host}` })
      return { text: `${lang === 'en' ? 'Guest dex' : '개미집 손님 도감'} ${Object.keys(w.dex).length}/${GUESTS.length}\n${rows.join('\n')}` }
    }
    if (arg === 'gift') {
      const code = giftCode(w.species, w.gen, colonyLevel(w))
      return { text: lang === 'en' ? `Gift code for a queen of your bloodline (${spName(w.species)}, gen ${w.gen}, Lv${colonyLevel(w)}):\n${code}\nA friend runs /ant adopt ${code} to start a colony with her. No money, just ants.` : `내 혈통 여왕 선물 코드 (${spName(w.species)} · ${w.gen}대 · Lv${colonyLevel(w)}):\n${code}\n친구가 /ant adopt ${code} 를 입력하면 이 여왕으로 군락을 시작합니다. 돈은 오가지 않습니다.` }
    }
    if (arg.startsWith('adopt')) {
      const g = readGift(arg.slice(5).trim())
      if (!g) return { text: lang === 'en' ? 'That gift code is not valid.' : '올바른 선물 코드가 아닙니다.' }
      const dex = w.dex, total = w.total, learned = w.learned
      w = newWorld({ species: g.species, stage: 'found', farms: w.trees.filter(t => t.farm).map(t => t.farm!), trail: 0, instinct: 0, majorBias: 0, storeBias: 0, ko: '', en: '' }, 1, w.lineage)
      w.dex = dex; w.total = total; w.learned = learned; w.gift = arg.slice(5).trim()
      say(w, `선물받은 여왕이 첫 방을 팠다. ${g.gen}대째 혈통, 레벨 ${g.lv} 군락에서 왔다.`, `The gifted queen dug her first chamber. She comes from a generation-${g.gen}, level-${g.lv} colony.`)
      ants = []; syncAnts(w, ants); await $.store.set('world', w)
      return { text: lang === 'en' ? `Adopted a ${spName(g.species)} queen.` : `${spName(g.species)} 여왕을 입양했습니다.` }
    }
    if (arg === 'card') {
      await $.fs.write('ant-nest-card.svg', card(w, lang))
      return { text: lang === 'en' ? 'Wrote ant-nest-card.svg in this folder. Commit it to your GitHub profile repository and add:\n![My ant colony](ant-nest-card.svg)' : '이 폴더에 ant-nest-card.svg를 만들었습니다. GitHub 프로필 저장소에 올리고 README에 이 줄을 넣으세요:\n![내 개미 군락](ant-nest-card.svg)' }
    }
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
          // 사무라이개미: 위임은 곧 노예사냥. 습격대가 나가 있으면 전리품이 늘어난다
          if (SP(w).dulotic) { if (!startRaid(w, bk) && w.raid) w.raid.booty += 0.4 * bk }
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
    const { Box, Text, Button } = $.ui.resolve(e)
    await read($, view)
    const tab = await read($, tabAtom)
    const en = lang === 'en', sp = SP(w), pop = Math.round(workers(w) + majors(w)), hr = hour(w)  // h는 JSX 함수 이름이라 쓰지 않는다
    const clock = `${hr < 12 ? T.am : T.pm} ${hr % 12 === 0 ? 12 : hr % 12}${T.hourSuffix}`
    const bar = (v: number, max: number, n = 10) => { const k = Math.max(0, Math.min(n, Math.round((v / Math.max(1, max)) * n))); return '█'.repeat(k) + '░'.repeat(n - k) }
    let picture
    if (e.surface === 'terminal') {
      const { Raster } = $.ui.resolve(e as typeof e & { surface: 'terminal' })
      picture = <Raster key="nest" {...raster(w, ants)} />
    } else if (e.surface === 'desktop' || e.surface === 'mobile' || e.surface === 'vscode') {
      const { Svg } = $.ui.resolve(e as typeof e & { surface: 'desktop' })
      const pw = Math.round(Math.max(260, Math.min(900, (e.props.bodyColumns || 60) * 8 - 8)))
      picture = <Svg source={svg(w, ants, lang, pw)} alt={T.alt(pop)} width={pw} height={Math.round((pw * visibleRows(w)) / W)} />
    }
    // 위협 알림 띠
    const threats = w.threats.map(x => (x.k === 'centipede' ? (en ? `⚠ Centipede inside: make the failing ${x.tool} call succeed to drive it out` : `⚠ 지네 침입: 실패하던 ${x.tool}를 다시 성공시키면 물리칩니다`) : (en ? '⚠ Spider web on the trail: fix the error to cut it down' : '⚠ 길목에 거미줄: 오류를 고치면 걷어 냅니다')))
    if (w.raid) threats.push(en ? '⚔ The samurai raiders are out on a slave raid' : '⚔ 사무라이개미 습격대가 노예사냥을 나갔습니다')
    if (sp.bivouac) threats.push(armyPhase(w) === 'statary' ? (en ? '⛺ Statary phase: the queen lays in a burst' : '⛺ 정착기: 여왕이 한꺼번에 알을 낳습니다') : (en ? '🧭 Nomadic phase: the colony moves every night' : '🧭 유랑기: 밤마다 자리를 옮깁니다'))
    if (isWinterNow()) threats.push(en ? '❄ Winter: the ants are huddled deep. AI use is stored as reserves' : '❄ 겨울: 개미들이 깊은 방에서 멈춰 있습니다. 이 동안의 AI 활용은 비축으로 쌓입니다')

    const card = (title: string, body: RenderChildren) => (
      <Box flexDirection="column" borderStyle="round" borderDimColor paddingX={1} flexGrow={1} minWidth={26}>
        <Text size="caption" weight="semibold" dimColor>{title}</Text>
        {body}
      </Box>
    )
    const row = (label: string, value: string, b?: string) => (
      <Box justifyContent="space-between" gap={1}><Text size="footnote">{label}</Text><Text size="footnote" mono tabular>{b ? `${b} ` : ''}{value}</Text></Box>
    )
    const cap = capacity(w), t = w.today
    const usageRows: [string, number][] = [[T.exploreS, t.explore], [T.buildS, t.build], [T.huntS, t.hunt], [en ? 'Raise' : '육성', t.raise], [en ? 'Herd (MCP)' : '목축(MCP)', t.mcp], [en ? 'Trail (skill)' : '길(스킬)', t.skill], [en ? 'Instinct (auto)' : '본능(자동화)', t.auto], [en ? 'Expedition' : '원정(병렬)', t.parallel]]
    const umax = Math.max(5, ...usageRows.map(r => r[1]))

    const dashboard = (
      <Box flexDirection="row" flexWrap="wrap" gap={1}>
        {card(en ? 'Colony' : '군락', <Box flexDirection="column">
          {sp.dulotic ? row(en ? 'Samurai' : '사무라이', String(Math.round(raiders(w)))) : row(T.workers, String(Math.round(workers(w))))}
          {sp.dulotic ? row(en ? 'Slaves (wood ants)' : '노예(곰개미)', String(Math.round(slaves(w)))) : row(T.majors, String(Math.round(majors(w))))}
          {row(en ? 'Eggs · larvae · pupae' : '알 · 애벌레 · 고치', `${Math.round(bcount(w, 'egg'))} · ${Math.round(bcount(w, 'larva'))} · ${Math.round(bcount(w, 'pupa'))}`)}
          {row(en ? 'Rooms · depth' : '방 · 깊이', `${w.chambers.length} · ${(w.deepest - 12) * 3}cm`)}
        </Box>)}
        {card(en ? 'Stores' : '비축', <Box flexDirection="column">
          {row(sp.storeKo ? (en ? sp.storeEn! : sp.storeKo) : T.carb, `${Math.round(w.carb)}/${Math.round(cap.carb)}`, bar(w.carb, cap.carb))}
          {row(T.prot, `${Math.round(w.prot)}/${Math.round(cap.prot)}`, bar(w.prot, cap.prot))}
          {row(en ? 'Instinct (automation)' : '본능(자동화)', `Lv ${w.instinct.toFixed(1)}`, bar(w.instinct, 10))}
          {row(en ? 'Pheromone trail' : '페로몬 길', `${w.trail.toFixed(1)}`, bar(w.trail, 3))}
        </Box>)}
        {card(T.today, <Box flexDirection="column">
          {usageRows.filter(([, v], k) => v > 0 || k < 3).map(([label, v]) => row(label, String(v), bar(v, umax, 8)))}
          {row(en ? 'Bugs (fixed)' : '버그 (해결)', `${t.bugs} (${t.fixed})`)}
        </Box>)}
        {card(en ? 'Queen & line' : '여왕과 혈통', <Box flexDirection="column">
          {row(en ? 'Queen age' : '여왕 나이', `${queenYears(w).toFixed(1)}/${sp.life}${en ? 'y' : '년'}`, bar(queenYears(w), sp.life))}
          {row(en ? 'Generation · level' : '세대 · 레벨', `${T.gen(w.gen)} · Lv${colonyLevel(w)}`)}
          {row(en ? 'Colony type' : '군락 유형', colonyType(w.total, lang).split(':')[0]!)}
          {row(en ? 'Guest dex' : '손님 도감', `${Object.keys(w.dex).length}/${GUESTS.length}`)}
        </Box>)}
      </Box>
    )
    const history = (
      <Box flexDirection="column" gap={0}>
        {w.log.slice(-18).reverse().map((l, k) => (
          <Box gap={1}><Text size="caption" dimColor mono>{(en ? `${seasonName(w, l.s, 'en').slice(0, 6)} d${l.d}` : `${seasonName(w, l.s, 'ko')} ${l.d}일`).padEnd(8)}</Text><Text size="footnote" dimColor={k > 0}>{en ? l.en : l.ko}</Text></Box>
        ))}
      </Box>
    )
    const dex = (
      <Box flexDirection="column">
        <Text size="footnote" dimColor>{en ? `Found ${Object.keys(w.dex).length} of ${GUESTS.length}. Guests now visiting: ` : `${GUESTS.length}종 중 ${Object.keys(w.dex).length}종 발견. 지금 방문 중: `}{w.guests.length ? w.guests.map(g => (en ? guestById(g.id).en : guestById(g.id).ko)).join(', ') : (en ? 'none' : '없음')}</Text>
        {GUESTS.map(g => {
          const d = w.dex[g.id], r = en ? RARITY_EN[g.rarity] : RARITY_KO[g.rarity], stars = '★'.repeat(g.rarity) + '☆'.repeat(4 - g.rarity)
          const host = g.hosts === 'all' ? (en ? 'any species' : '모든 종') : g.hosts.map(spName).join(', ')
          return d
            ? <Box flexDirection="column" marginTop={1}><Text size="footnote" weight="semibold">✔ {en ? g.en : g.ko} <Text dimColor>{stars} {r} · ×{d.n}</Text></Text><Text size="caption" dimColor>{en ? g.enDesc : g.koDesc}</Text></Box>
            : <Box marginTop={1}><Text size="footnote" dimColor>？ ???? {stars} {r} · {en ? 'lives with' : '사는 곳'}: {host}</Text></Box>
        })}
      </Box>
    )
    const lineage = (
      <Box flexDirection="column" gap={1}>
        <Text size="footnote">{spName(w.species)} <Text dimColor>({sp.sci})</Text></Text>
        <Text size="caption" dimColor>{en ? sp.enDesc : sp.koDesc}</Text>
        <Text size="footnote">{en ? 'Starting analysis' : '시작 분석'}</Text>
        <Text size="caption" dimColor>{(en ? w.origin.en : w.origin.ko) || '-'}{w.gift ? ` · ${en ? 'adopted from gift' : '선물받은 여왕'} ${w.gift}` : ''}</Text>
        <Text size="footnote">{en ? 'Generations' : '세대 기록'}</Text>
        {w.lineage.length === 0 && <Text size="caption" dimColor>{en ? 'This is the first generation.' : '첫 세대입니다.'}</Text>}
        {w.lineage.map(l => <Text size="caption" dimColor>{T.gen(l.gen)} · {spName(l.species)} · {l.years}{en ? 'y' : '년'} · {en ? 'peak' : '최대'} {l.peak} · {l.ended === 'succession' ? (en ? 'carried on' : '계승') : (en ? 'scattered' : '소멸')}</Text>)}
        <Text size="caption" dimColor>{en ? 'Now' : '지금'}: {T.gen(w.gen)} · {en ? 'peak' : '최대'} {Math.round(w.peak)} · Lv{colonyLevel(w)}</Text>
      </Box>
    )
    const TABS: [string, string][] = [['dash', en ? 'Dashboard' : '대시보드'], ['log', en ? 'History' : '기록'], ['dex', en ? 'Dex' : '도감'], ['line', en ? 'Lineage' : '혈통']]
    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Box justifyContent="space-between" flexWrap="wrap" gap={1}>
            <Text size="heading" weight="bold">🐜 {pop} <Text size="footnote" dimColor>{en ? 'ants' : '마리'}</Text></Text>
            <Text size="footnote" dimColor>{when()} · {clock} · {airT(w).toFixed(0)}°C</Text>
          </Box>
          <Text size="caption" dimColor>{badge()}</Text>
        </Box>
        {picture}
        {threats.map(x => <Text size="footnote" color={x.startsWith('⚠') ? 'error' : 'warning'}>{x}</Text>)}
        <Box gap={1} flexWrap="wrap">
          {TABS.map(([k, label]) => <Button key={`tab-${k}`} label={label} variant={tab === k ? 'primary' : 'secondary'} onPress={() => update($, tabAtom, () => k)} />)}
        </Box>
        {tab === 'log' ? history : tab === 'dex' ? dex : tab === 'line' ? lineage : dashboard}
      </Box>
    )
  })
}

// ---------- 선물 코드: 종·세대·레벨에 검사 글자를 붙인다 (손으로 바꾸기 어렵게만) ----------
function chk(t: string) { let h = 7; for (const ch of t) h = (h * 31 + ch.charCodeAt(0)) % 1679616; return h.toString(36).toUpperCase().padStart(4, '0') }
function giftCode(sp: SpeciesId, gen: number, lv: number) { const body = `${SPECIES_IDS.indexOf(sp)}${gen.toString(36)}-${lv.toString(36)}`.toUpperCase(); return `ANT-${body}-${chk(body + 'nest')}` }
function readGift(code: string): { species: SpeciesId; gen: number; lv: number } | null {
  const m = /^ANT-(\d)([0-9A-Z]+)-([0-9A-Z]+)-([0-9A-Z]{4})$/.exec(code.toUpperCase())
  if (!m || chk(`${m[1]}${m[2]}-${m[3]}` + 'nest') !== m[4]) return null
  const species = SPECIES_IDS[+m[1]!]; if (!species) return null
  return { species, gen: parseInt(m[2]!, 36), lv: parseInt(m[3]!, 36) }
}

// ---------- 프로필 카드 SVG ----------
function card(w: World, lang: Lang) {
  const sp = SP(w), pop = Math.round(workers(w) + majors(w)), esc = (t: string) => t.replace(/[<>&"]/g, '')
  const name = esc(lang === 'en' ? sp.en : sp.ko), type = esc(colonyType(w.total, lang).split(':')[0]!)
  const dots = Array.from({ length: 22 }, (_, k) => `<rect x="${300 + (k * 37) % 160}" y="${66 + ((k * 23) % 48)}" width="5" height="3" fill="${k % 6 ? sp.body : sp.major}"/>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="140" viewBox="0 0 480 140" font-family="monospace" shape-rendering="crispEdges">
<rect width="480" height="140" rx="10" fill="#1f1914"/><rect y="52" width="480" height="88" rx="0" fill="#5a3d28"/><rect y="52" width="480" height="4" fill="#5f9a4a"/>
<rect x="296" y="62" width="168" height="58" rx="10" fill="#3a2818"/>${dots}
<text x="18" y="30" font-size="18" fill="#efe4d2">🐜 Ant Nest · ${name}</text>
<text x="18" y="46" font-size="11" fill="#a6978a">${esc(sp.sci)} · ${lang === 'en' ? `Gen ${w.gen}` : `${w.gen}대`} · Lv${colonyLevel(w)}</text>
<text x="18" y="80" font-size="26" fill="#ffe7b0">${pop}</text><text x="18" y="96" font-size="11" fill="#e8d8c0">${lang === 'en' ? 'ants' : '마리'} · ${type}</text>
<text x="18" y="118" font-size="11" fill="#e8d8c0">${lang === 'en' ? 'Bugs fixed' : '고친 버그'} ${w.total.fixed} · ${lang === 'en' ? 'Dex' : '도감'} ${Object.keys(w.dex).length}/${GUESTS.length}</text>
<text x="18" y="132" font-size="9" fill="#a6978a">github.com/findot-ai/ant-nest</text>
</svg>`
}
