import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import {
  newWorld, hourTick, moveAnts, syncAnts, sendForager, sendDigger, spawnSpider, spawnCentipede, defeatCentipede,
  say, workers, majors, bcount, epName, epDays, hour, airT, season,
} from './engine'
import type { World, Ant, Tally } from './engine'
import { svg, raster } from './render'

const PANE = 'ant-nest'
const FRAME_MS = 500, FRAMES_PER_HOUR = 4
const view = atom({ plugin: 'ant-nest', key: 'view' } as const, { frame: 0 })

// 내 AI 활용을 다섯 갈래로 나눈다. 내용은 보지 않고 도구 이름과 성공 여부만 쓴다.
const EXPLORE = /^(Read|Grep|Glob|LS|WebSearch|WebFetch|NotebookRead|ToolSearch)$|^mcp__.*(read|search|get|list|fetch|query)/i
const BUILD = /^(Edit|Write|MultiEdit|NotebookEdit)$/
const RAISE = /^(Agent|Task)$/
const TESTLIKE = /\b(test|pytest|jest|vitest|mocha|go test|cargo test|npm run (test|build|lint)|tsc|make|gradle|mvn)\b/

export const register: Register = on => {
  let w: World = newWorld()
  let ants: Ant[] = []
  let frame = 0, hourGain = 0, lastStatus = '', paneNote = '아직 열지 않음'

  const bump = (k: keyof Tally) => { w.today[k]++; w.total[k]++ }
  const gain = (n: number) => { const g = Math.max(0, Math.min(n, 30 - hourGain)); hourGain += g; return g }
  // 상태줄에 새로 쓸 글이 있으면 돌려준다
  const statusText = () => {
    const pop = Math.round(workers(w) + majors(w))
    const th = w.threats.map(t => (t.k === 'centipede' ? '⚠ 지네' : '⚠ 거미줄')).join(' ')
    const text = `🐜 ${pop}${th ? ' · ' + th : ''}`
    if (text === lastStatus) return undefined
    lastStatus = text; return text
  }

  on('session.start', async ($, e, next) => {
    const saved = (await $.store.get('world')) as World | undefined
    if (saved && saved.v === 1 && Array.isArray(saved.grid)) { w = saved; say(w, '다시 접속했다. 개미들이 하던 일을 이어 간다.') }
    else await $.store.set('world', w)
    ants = []; syncAnts(w, ants)
    await $.command.register({ name: 'ant', description: '개미굴 창 열기 (/ant reset: 새 군락, /ant stats: 활용 기록)' })
    const opened = await $.ui.open({ id: PANE, title: '개미굴' })
    paneNote = opened.isPlaced ? '표시됨' : `표시 안 됨: ${opened.reason}`
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
    const opened = await $.ui.open({ id: PANE, title: '개미굴' })
    paneNote = opened.isPlaced ? `표시됨 (${e.surface})` : `표시 안 됨 (${e.surface}): ${opened.reason}`
    return next(e)
  })

  // 창을 둘 수 없는 화면에서도 보이도록 입력창 위에 한 줄
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    await read($, view)
    const pop = Math.round(workers(w) + majors(w)), t = w.today
    const th = w.threats.map(x => (x.k === 'centipede' ? '⚠ 지네 침입' : '⚠ 거미줄')).join(' ')
    return (
      <Box flexDirection="column">
        <Box>
          <Text>🐜 {pop} · {epName(w.ep)} {Math.min(w.day, epDays(w))}일 · 채집 {t.explore} · 굴착 {t.build} · 사냥 {t.hunt} · 버그 {t.bugs}(해결 {t.fixed}){th ? ' · ' + th : ''} </Text>
          <Button key="open" label="개미굴 열기" onPress={() => { void $.ui.open({ id: PANE, title: '개미굴', focus: true }) }} />
        </Box>
        <Text dimColor>{w.log[w.log.length - 1] ?? ''}</Text>
      </Box>
    )
  })

  on('session.end', async ($, e, next) => { await $.store.set('world', w); return next(e) })

  on('command.run', { command: 'ant' }, async ($, e) => {
    const arg = e.args.trim()
    if (arg === 'reset') { w = newWorld(); ants = []; syncAnts(w, ants); await $.store.set('world', w); await $.ui.open({ id: PANE, title: '개미굴' }); return { text: '새 땅에 3년차 군락을 새로 앉혔습니다.' } }
    if (arg === 'stats') {
      const t = w.total
      return { text: `지금까지의 AI 활용 → 개미굴\n채집(탐색) ${t.explore} · 굴착(편집) ${t.build} · 사냥(테스트 통과) ${t.hunt} · 육성(위임) ${t.raise}\n버그 ${t.bugs}번 중 ${t.fixed}번 해결 · 현재 개미 ${Math.round(workers(w) + majors(w))}마리 · ${epName(w.ep)}` }
    }
    const opened = await $.ui.open({ id: PANE, title: '개미굴', focus: true })
    paneNote = opened.isPlaced ? '표시됨' : `표시 안 됨: ${opened.reason}`
    const surfaces = (await $.session.surfaces()).join(', ') || '없음'
    return { text: opened.isPlaced ? '개미굴을 열었습니다.' : `이 화면에는 창을 둘 수 없습니다 (${paneNote}). 연결된 화면: ${surfaces}. 입력창 위 줄과 상태줄로 보여 드립니다.` }
  })

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny !== undefined) return ran
    const tool = e.tool, failed = ran.isError === true
    const cmd = e.tool === 'Bash' ? e.command : ''
    if (failed) {
      bump('bugs')
      w.streak[tool] = (w.streak[tool] ?? 0) + 1
      if (TESTLIKE.test(cmd)) { w.rain = Math.max(w.rain, 6); say(w, '테스트가 실패했다. 굴 위로 비가 내린다.') }
      if (w.streak[tool]! >= 3) spawnCentipede(w, tool)
      else spawnSpider(w)
    } else {
      if ((w.streak[tool] ?? 0) > 0) {
        w.streak[tool] = 0
        const cen = w.threats.find(t => t.k === 'centipede' && t.tool === tool)
        if (cen && defeatCentipede(w, true)) { bump('fixed'); $.ui.toast('🐜 버그를 잡았다: 지네 격퇴, 단백질 +8') }
        const sp = w.threats.find(t => t.k === 'spider')
        if (sp) { sp.life = 0; bump('fixed'); say(w, '오류를 고쳤다. 경비 개미들이 거미줄을 끊어 냈다.') }
      }
      if (EXPLORE.test(tool)) { bump('explore'); w.carb += gain(2); sendForager(w, ants, 1) }
      else if (BUILD.test(tool)) { bump('build'); w.digQueue += 6; sendDigger(w, ants) }
      else if (RAISE.test(tool)) { bump('raise'); w.brood.push({ st: 'egg', n: 3, dev: 0, prot: 0, room: w.queen.room }); say(w, '일을 나눠 맡겼다. 여왕이 알을 더 낳았다.') }
      else if (tool === 'Bash' && TESTLIKE.test(cmd)) { bump('hunt'); w.prot += gain(5); sendForager(w, ants, 2); say(w, '테스트가 통과했다. 사냥조가 곤충을 끌고 돌아온다.') }
      else if (tool === 'Bash') { w.carb += gain(1) }
    }
    const st = statusText(); if (st) $.ui.status(st)
    return ran
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    await read($, view)
    const pop = Math.round(workers(w) + majors(w)), h = hour(w)
    const head = `ANT POP ${pop} · ${epName(w.ep)} ${Math.min(w.day, epDays(w))}일 · ${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}시 · ${airT(w).toFixed(0)}°C`
    const stats = `일개미 ${Math.round(workers(w))} · 병정 ${Math.round(majors(w))} · 알 ${Math.round(bcount(w, 'egg'))} · 애벌레 ${Math.round(bcount(w, 'larva'))} · 고치 ${Math.round(bcount(w, 'pupa'))} · 단물 ${Math.round(w.carb)} · 단백질 ${Math.round(w.prot)}`
    const t = w.today
    const usage = `오늘의 AI 활용 · 채집(탐색) ${t.explore} · 굴착(편집) ${t.build} · 사냥(테스트 통과) ${t.hunt} · 육성(위임) ${t.raise} · 버그 ${t.bugs} (해결 ${t.fixed})`
    let picture
    if (e.surface === 'terminal') {
      const { Raster } = $.ui.resolve(e as typeof e & { surface: 'terminal' })
      picture = <Raster key="nest" {...raster(w, ants)} />
    } else if (e.surface === 'desktop' || e.surface === 'mobile' || e.surface === 'vscode') {
      const { Svg } = $.ui.resolve(e as typeof e & { surface: 'desktop' })
      picture = <Svg source={svg(w, ants)} alt={`개미굴: 개미 ${pop}마리`} width={240} height={320} />
    }
    return (
      <Box flexDirection="column">
        <Text bold>{head}</Text>
        {picture}
        <Text dimColor>{stats}</Text>
        <Text>{usage}</Text>
        {w.log.slice(-3).map(l => <Text dimColor>{l}</Text>)}
        {season(w) === 3 && <Text dimColor>겨울: 개미들은 깊은 방에서 멈춰 있습니다. 이 동안의 AI 활용은 비축으로 쌓입니다.</Text>}
      </Box>
    )
  })
}
