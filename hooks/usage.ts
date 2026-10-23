// 도구 호출 하나를 AI 활용 갈래로 나눈다. 도구 이름과 몇 가지 플래그만 보고, 내용은 보지 않는다.
import type { Tally, Lang } from './engine'

export type Kind = 'explore' | 'build' | 'hunt' | 'raise' | 'mcp' | 'skill' | 'auto' | 'plan' | 'parallel' | 'ship' | 'other'
export type Use = { kind: Kind; server?: string; setup?: boolean; guessed?: boolean; verify?: boolean }

// 검증: 빌드·검사·테스트, 서버 응답 확인
const TESTLIKE = /\b(test|pytest|jest|vitest|mocha|go test|cargo test|npm run (test|build|lint|check|typecheck)|pnpm (test|build|lint)|yarn (test|build|lint)|tsc|eslint|make|gradle|mvn|curl|wget|Invoke-WebRequest|Invoke-RestMethod|lighthouse|playwright)\b/i
// 출시: 커밋·푸시·PR·배포·게시
const SHIPLIKE = /\b(git (commit|push|tag)|gh (pr (create|merge)|release create)|firebase deploy|vercel( deploy| --prod)|netlify deploy|npm publish|wrangler (deploy|publish)|fly deploy|docker push|eas (build|submit)|gcloud (app|run) deploy)\b/i
// 브라우저로 화면을 확인하는 도구 (스크린샷, 이동, 클릭, 페이지 읽기, 스크립트 실행)
const BROWSER_SERVER = /(browser|chrome|playwright|puppeteer|preview|computer)/i
const BROWSER_TOOL = /(screenshot|snapshot|navigate|click|evaluate|read_page|get_page_text|console|network|form_input|find|scroll|javascript|tabs_|resize|hover|preview_)/i
const EXPLORE = /^(Read|Grep|Glob|LS|LSP|WebSearch|WebFetch|NotebookRead|ToolSearch|ListMcpResourcesTool|ReadMcpResourceTool|ReadMcpResourceDirTool|SearchPlugins|SearchSkills|SearchMcpRegistry|ListSkills|ListPlugins|ListConnectors)$/
const BUILD = /^(Edit|Write|MultiEdit|NotebookEdit)$/
const AUTO_SETUP = /^(CronCreate|ScheduleWakeup|RemoteTrigger)$|create_trigger|send_later|update_trigger|watch_url/
const AUTO_RUN = /^(Monitor|PushNotification|CronList)$/
const PLAN = /^(TodoWrite|TaskCreate|TaskUpdate|EnterPlanMode|ExitPlanMode|ProposeGoal)$/
const PARALLEL = /^(Workflow|SendMessage|ListAgents|EnterWorktree)$|create_session|send_message/

export function classify(tool: string, input: Record<string, unknown>): Use {
  if (AUTO_SETUP.test(tool)) return { kind: 'auto', setup: true }
  if (AUTO_RUN.test(tool)) return { kind: 'auto' }
  const m = /^mcp__([^_]+(?:_[^_]+)*?)__(.*)$/.exec(tool)
  if (m) {
    const server = m[1]!.replace(/^plugin_[^_]+_/, ''), name = m[2] ?? ''
    if (BROWSER_SERVER.test(server) && BROWSER_TOOL.test(name)) return { kind: 'hunt', verify: true }
    return { kind: 'mcp', server }
  }
  if (tool === 'Skill') return { kind: 'skill' }
  // 스킬 문서를 직접 읽어 적용한 것도 스킬 사용으로 본다
  if (tool === 'Read' && /[\\/]skills[\\/].*SKILL\.md$/i.test(String(input.file_path ?? ''))) return { kind: 'skill' }
  if (PLAN.test(tool)) return { kind: 'plan' }
  if (PARALLEL.test(tool) || ((tool === 'Agent' || tool === 'Task') && input.run_in_background === true)) return { kind: 'parallel' }
  if (tool === 'Agent' || tool === 'Task') return { kind: 'raise' }
  if (EXPLORE.test(tool)) return { kind: 'explore' }
  if (BUILD.test(tool)) return { kind: 'build' }
  // Bash와 PowerShell은 같은 규칙: 출시 → 검증 → 백그라운드 실행(자동화) → 그 밖
  if (tool === 'Bash' || tool === 'PowerShell') {
    const cmd = String(input.command ?? '')
    if (SHIPLIKE.test(cmd)) return { kind: 'ship' }
    if (TESTLIKE.test(cmd)) return { kind: 'hunt', verify: true }
    if (input.run_in_background === true) return { kind: 'auto' }
    return { kind: 'other' }
  }
  // 처음 보는 도구: 이름으로 짐작해 배운다
  if (/(read|get|list|search|fetch|query|find|view|lookup)/i.test(tool)) return { kind: 'explore', guessed: true }
  if (/(create|write|update|edit|add|set|post|publish|deploy|commit|upload)/i.test(tool)) return { kind: 'build', guessed: true }
  if (/(run|exec|test|check|verify|lint)/i.test(tool)) return { kind: 'hunt', guessed: true }
  return { kind: 'other', guessed: true }
}

export const isTestLike = (cmd: string) => TESTLIKE.test(cmd) && !/\b(curl|wget|Invoke-WebRequest|Invoke-RestMethod)\b/i.test(cmd)

// 누적 활용 비중으로 군락 유형을 정한다
const TYPES: Record<string, { ko: string; en: string; koD: string; enD: string }> = {
  explore: { ko: '정찰형', en: 'Scout', koD: '넓게 찾아보고 먹이를 끌어오는 군락', enD: 'a colony that searches wide and hauls food home' },
  build: { ko: '건축형', en: 'Builder', koD: '굴과 방을 쉬지 않고 넓히는 군락', enD: 'a colony that never stops digging' },
  hunt: { ko: '사냥형', en: 'Hunter', koD: '검증으로 단백질을 모아 병정이 강한 군락', enD: 'a colony that verifies, feeds protein, and raises majors' },
  maker: { ko: '제작형', en: 'Maker', koD: '만들고 바로 확인하고 내보내는 군락', enD: 'a colony that builds, checks right away, and ships' },
  delegate: { ko: '분업형', en: 'Delegator', koD: '일을 나눠 맡겨 새끼가 많은 군락', enD: 'a colony that delegates and breeds fast' },
  mcp: { ko: '목축형', en: 'Herder', koD: '바깥 목초지(외부 도구)의 진딧물을 치는 군락', enD: 'a colony that herds aphids on outside pastures (external tools)' },
  skill: { ko: '길잡이형', en: 'Trailblazer', koD: '익힌 길(스킬)을 따라 효율이 높은 군락', enD: 'a colony that follows well-worn trails (skills)' },
  auto: { ko: '본능형', en: 'Instinct', koD: '자동화로 내가 없어도 굴러가는 군락', enD: 'a colony that runs itself through automation' },
}
export function colonyType(t: Tally, lang: Lang) {
  const score: Record<string, number> = {
    explore: t.explore * 0.5, build: t.build, hunt: t.hunt * 1.5, delegate: (t.raise + t.parallel) * 3,
    mcp: t.mcp * 1.5, skill: t.skill * 3, auto: t.auto * 4,
  }
  // 편집과 검증이 둘 다 많고 출시까지 하면 제작형
  if (t.build >= 10 && t.hunt >= t.build * 0.4) score.maker = (t.build + t.hunt * 1.5) * 0.8 + (t.ship ?? 0) * 4
  const tot = Object.values(score).reduce((a, b) => a + b, 0)
  if (tot < 15) return lang === 'en' ? 'Still forming (keep working)' : '아직 형성 중 (조금 더 써 보세요)'
  const [k] = Object.entries(score).sort((a, b) => b[1] - a[1])[0]!
  const ty = TYPES[k]!
  return lang === 'en' ? `${ty.en}: ${ty.enD}` : `${ty.ko}: ${ty.koD}`
}

// ---------- AI 활용 리포트: 갈래별 비중, 잘하는 점, 덜 쓰는 점, 다음에 해 볼 것 ----------
export type Report = { total: number; rows: { key: string; label: string; n: number; pct: number; diff?: number }[]; good: string[]; gaps: string[]; tips: string[]; type: string }
const LABEL: Record<string, [string, string]> = {
  explore: ['탐색 (읽기·검색·조사)', 'Explore (read, search, research)'], build: ['편집·작성', 'Edit & write'], hunt: ['검증 (테스트·빌드·브라우저 확인)', 'Verify (tests, builds, browser checks)'],
  ship: ['출시 (커밋·배포)', 'Ship (commit, deploy)'], raise: ['위임 (서브에이전트)', 'Delegate (subagents)'], parallel: ['병렬 에이전트', 'Parallel agents'],
  mcp: ['외부 도구 (MCP)', 'External tools (MCP)'], skill: ['스킬', 'Skills'], plan: ['계획', 'Planning'], auto: ['자동화 (예약·백그라운드)', 'Automation (scheduled, background)'],
  other: ['기타 (일반 명령 등)', 'Other (plain commands, etc.)'],
}
export function buildReport(t: Tally, prev: Tally | undefined, lang: Lang): Report {
  const en = lang === 'en', keys = Object.keys(LABEL)
  const get = (x: Tally | undefined, k: string) => (x ? ((x as Record<string, number>)[k] ?? 0) : 0)
  const total = keys.reduce((a, k) => a + get(t, k), 0)
  const rows = keys.map(k => ({ key: k, label: LABEL[k]![en ? 1 : 0], n: get(t, k), pct: total ? Math.round((get(t, k) / total) * 100) : 0, diff: prev ? get(t, k) - get(prev, k) : undefined }))
  const good: string[] = [], gaps: string[] = [], tips: string[] = []
  const build = get(t, 'build'), hunt = get(t, 'hunt'), ship = get(t, 'ship')
  if (build >= 5 && hunt >= build * 0.5) good.push(en ? `You verify what you build: ${hunt} checks for ${build} edits.` : `만든 것을 바로 확인합니다: 편집 ${build}번에 검증 ${hunt}번.`)
  if (ship > 0) good.push(en ? `You carried work all the way to release ${ship} times.` : `작업을 출시(커밋·배포)까지 ${ship}번 끝까지 가져갔습니다.`)
  if (get(t, 'mcp') >= 5) good.push(en ? 'You connect outside services instead of copying by hand.' : '외부 서비스를 연결해서 씁니다. 손으로 옮기는 일을 줄이고 있습니다.')
  if (t.fixed > 0) good.push(en ? `You fixed ${t.fixed} of ${t.bugs} errors.` : `오류 ${t.bugs}번 중 ${t.fixed}번을 고쳤습니다.`)
  const share = (k: string) => (total ? get(t, k) / total : 0)
  if (total >= 20) {
    if (share('raise') + share('parallel') < 0.03) { gaps.push(en ? 'Delegation and parallel agents are rare.' : '나눠 맡기기(위임·병렬)가 거의 없습니다.'); tips.push(en ? 'For big jobs, try: "split the research across two agents and give me only the results."' : '큰 작업은 "조사는 에이전트 둘에게 나눠서, 나는 결과만"처럼 맡겨 보세요.') }
    if (get(t, 'skill') < 2) { gaps.push(en ? 'Skills are barely used.' : '스킬을 거의 쓰지 않습니다.'); tips.push(en ? 'Call installed skills by name, like /skill-name.' : '설치한 스킬을 /스킬이름 처럼 이름으로 불러 보세요.') }
    if (get(t, 'plan') === 0) { gaps.push(en ? 'No planning before big tasks.' : '큰 작업 전에 계획을 세우지 않습니다.'); tips.push(en ? 'Start big tasks in plan mode so the steps are agreed first.' : '큰 작업은 계획 모드로 시작해 순서를 먼저 정해 보세요.') }
    if (get(t, 'auto') === 0) { gaps.push(en ? 'Nothing is automated yet.' : '반복 작업을 맡겨 둔 자동화가 없습니다.'); tips.push(en ? 'Schedule a recurring job, like a monthly summary. Your colony\'s instinct grows.' : '"매월 1일에 지난달 요약 보내줘" 같은 예약 실행을 걸어 보세요. 군락의 본능이 커집니다.') }
    if (share('build') < 0.08) { gaps.push(en ? 'Few edits, so the nest widens slowly. The colony digs on its own with spare food, at half the efficiency.' : '편집이 적어 굴이 더디게 넓어집니다. 군락이 남는 먹이로 직접 파지만 효율은 절반입니다.'); tips.push(en ? 'Ask Claude to write or change files directly instead of only explaining.' : '설명만 받기보다 파일을 직접 만들거나 고치게 시켜 보세요.') }
    if (share('hunt') < 0.08) { gaps.push(en ? 'Few checks, so protein is short. The colony hunts on its own, at half the efficiency.' : '검증이 적어 단백질이 모자랍니다. 군락이 직접 사냥하지만 효율은 절반입니다.'); tips.push(en ? 'After each change, ask for a test run or a browser check.' : '바꿀 때마다 테스트 실행이나 브라우저 화면 확인까지 시켜 보세요.') }
    if (build >= 10 && hunt < build * 0.3) { gaps.push(en ? 'Edits often go unchecked.' : '편집에 비해 확인이 적습니다.'); tips.push(en ? 'Ask for a test or a browser check after each change.' : '바꿀 때마다 테스트나 화면 확인까지 시켜 보세요.') }
  }
  return { total, rows, good, gaps, tips, type: colonyType(t, lang) }
}
