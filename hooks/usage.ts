// 도구 호출 하나를 AI 활용 갈래로 나눈다. 도구 이름과 몇 가지 플래그만 보고, 내용은 보지 않는다.
import type { Tally, Lang } from './engine'

export type Kind = 'explore' | 'build' | 'hunt' | 'raise' | 'mcp' | 'skill' | 'auto' | 'plan' | 'parallel' | 'other'
export type Use = { kind: Kind; server?: string; setup?: boolean; guessed?: boolean }

const TESTLIKE = /\b(test|pytest|jest|vitest|mocha|go test|cargo test|npm run (test|build|lint)|tsc|make|gradle|mvn)\b/
const EXPLORE = /^(Read|Grep|Glob|LS|LSP|WebSearch|WebFetch|NotebookRead|ToolSearch|ListMcpResourcesTool|ReadMcpResourceTool|ReadMcpResourceDirTool|SearchPlugins|SearchSkills|SearchMcpRegistry|ListSkills|ListPlugins|ListConnectors)$/
const BUILD = /^(Edit|Write|MultiEdit|NotebookEdit)$/
const AUTO_SETUP = /^(CronCreate|ScheduleWakeup|RemoteTrigger)$|create_trigger|send_later|update_trigger|watch_url/
const AUTO_RUN = /^(Monitor|PushNotification|CronList)$/
const PLAN = /^(TodoWrite|TaskCreate|TaskUpdate|EnterPlanMode|ExitPlanMode|ProposeGoal)$/
const PARALLEL = /^(Workflow|SendMessage|ListAgents|EnterWorktree)$|create_session|send_message/

export function classify(tool: string, input: Record<string, unknown>): Use {
  if (AUTO_SETUP.test(tool)) return { kind: 'auto', setup: true }
  if (AUTO_RUN.test(tool)) return { kind: 'auto' }
  const m = /^mcp__([^_]+(?:_[^_]+)*?)__/.exec(tool)
  if (m) return { kind: 'mcp', server: m[1]!.replace(/^plugin_[^_]+_/, '') }
  if (tool === 'Skill') return { kind: 'skill' }
  if (PLAN.test(tool)) return { kind: 'plan' }
  if (PARALLEL.test(tool) || ((tool === 'Agent' || tool === 'Task') && input.run_in_background === true)) return { kind: 'parallel' }
  if (tool === 'Agent' || tool === 'Task') return { kind: 'raise' }
  if (EXPLORE.test(tool)) return { kind: 'explore' }
  if (BUILD.test(tool)) return { kind: 'build' }
  if (tool === 'Bash') {
    if (input.run_in_background === true) return { kind: 'auto' }
    return TESTLIKE.test(String(input.command ?? '')) ? { kind: 'hunt' } : { kind: 'other' }
  }
  // 처음 보는 도구: 이름으로 짐작해 배운다
  if (/(read|get|list|search|fetch|query|find|view|lookup)/i.test(tool)) return { kind: 'explore', guessed: true }
  if (/(create|write|update|edit|add|set|post|publish|deploy|commit|upload)/i.test(tool)) return { kind: 'build', guessed: true }
  if (/(run|exec|test|check|verify|lint)/i.test(tool)) return { kind: 'hunt', guessed: true }
  return { kind: 'other', guessed: true }
}

export const isTestLike = (cmd: string) => TESTLIKE.test(cmd)

// 누적 활용 비중으로 군락 유형을 정한다
const TYPES: Record<string, { ko: string; en: string; koD: string; enD: string }> = {
  explore: { ko: '정찰형', en: 'Scout', koD: '넓게 찾아보고 먹이를 끌어오는 군락', enD: 'a colony that searches wide and hauls food home' },
  build: { ko: '건축형', en: 'Builder', koD: '굴과 방을 쉬지 않고 넓히는 군락', enD: 'a colony that never stops digging' },
  hunt: { ko: '사냥형', en: 'Hunter', koD: '검증으로 단백질을 모아 병정이 강한 군락', enD: 'a colony that verifies, feeds protein, and raises majors' },
  delegate: { ko: '분업형', en: 'Delegator', koD: '일을 나눠 맡겨 새끼가 많은 군락', enD: 'a colony that delegates and breeds fast' },
  mcp: { ko: '목축형', en: 'Herder', koD: '바깥 목초지(외부 도구)의 진딧물을 치는 군락', enD: 'a colony that herds aphids on outside pastures (external tools)' },
  skill: { ko: '길잡이형', en: 'Trailblazer', koD: '익힌 길(스킬)을 따라 효율이 높은 군락', enD: 'a colony that follows well-worn trails (skills)' },
  auto: { ko: '본능형', en: 'Instinct', koD: '자동화로 내가 없어도 굴러가는 군락', enD: 'a colony that runs itself through automation' },
}
export function colonyType(t: Tally, lang: Lang) {
  const score: Record<string, number> = {
    explore: t.explore * 0.5, build: t.build, hunt: t.hunt * 3, delegate: (t.raise + t.parallel) * 3,
    mcp: t.mcp * 1.5, skill: t.skill * 3, auto: t.auto * 4,
  }
  const tot = Object.values(score).reduce((a, b) => a + b, 0)
  if (tot < 15) return lang === 'en' ? 'Still forming (keep working)' : '아직 형성 중 (조금 더 써 보세요)'
  const [k] = Object.entries(score).sort((a, b) => b[1] - a[1])[0]!
  const ty = TYPES[k]!
  return lang === 'en' ? `${ty.en}: ${ty.enD}` : `${ty.ko}: ${ty.koD}`
}
