// 설치 시점 분석: 이 컴퓨터의 Claude Code 기록을 로컬에서만 훑어 시작 군락을 정한다.
// 남기는 것은 갈래별 개수뿐이고, 프롬프트 원문은 저장하지도 내보내지도 않는다.
import { classify } from './usage'
import type { Kind } from './usage'
import type { Setup, Stage0 } from './engine'
import { SPECIES } from './species'
import type { SpeciesId } from './species'

export type Profile = {
  calls: number; sessions: number; kinds: Record<Kind, number>
  prompts: number; words: { debug: number; research: number; plan: number; automate: number; build: number }
  mcpServers: string[]; skills: number; hooks: number
}
export const emptyProfile = (): Profile => ({
  calls: 0, sessions: 0, kinds: { explore: 0, build: 0, hunt: 0, raise: 0, mcp: 0, skill: 0, auto: 0, plan: 0, parallel: 0, ship: 0, other: 0 },
  prompts: 0, words: { debug: 0, research: 0, plan: 0, automate: 0, build: 0 }, mcpServers: [], skills: 0, hooks: 0,
})

const WORDS: [keyof Profile['words'], RegExp][] = [
  ['debug', /(bug|fix|error|fail|debug|test|버그|오류|에러|고쳐|수정|테스트)/i],
  ['research', /(research|search|find|analy[sz]e|compare|조사|찾아|분석|비교|리서치)/i],
  ['plan', /(plan|spec|design|doc|outline|기획|정리|문서|설계|계획)/i],
  ['automate', /(automat|cron|schedule|workflow|hook|pipeline|자동화|예약|매일|반복)/i],
  ['build', /(build|implement|create|make|add|refactor|만들|구현|추가|개발|리팩)/i],
]

// 대화 기록 한 파일: 도구 이름과 사용자 프롬프트의 키워드 갈래만 센다
export function scanTranscript(text: string, p: Profile, countSession = true) {
  if (countSession) p.sessions++
  const toolRe = /"type":"tool_use","id":"[^"]*","name":"([^"]+)"(?:,"input":(\{[^{}]{0,200}))?/g
  for (let m; (m = toolRe.exec(text)); ) {
    const input: Record<string, unknown> = {}
    if (m[2]?.includes('"run_in_background":true')) input.run_in_background = true
    const cmd = /"command":"([^"]{0,120})/.exec(m[2] ?? ''); if (cmd) input.command = cmd[1]
    p.kinds[classify(m[1]!, input).kind]++; p.calls++
    const srv = /^mcp__([^_]+(?:_[^_]+)*?)__/.exec(m[1]!)
    if (srv) { const name = srv[1]!.replace(/^plugin_[^_]+_/, ''); if (!p.mcpServers.includes(name) && name !== 'claude-code-remote') p.mcpServers.push(name) }
  }
  const userRe = /"role":"user","content":"((?:[^"\\]|\\.){1,2000})"/g
  for (let m; (m = userRe.exec(text)); ) countWords(m[1]!, p)
}
export function scanHistory(text: string, p: Profile) {
  const re = /"display":"((?:[^"\\]|\\.){1,2000})"/g
  for (let m; (m = re.exec(text)); ) countWords(m[1]!, p)
}
function countWords(t: string, p: Profile) {
  p.prompts++
  for (const [k, re] of WORDS) if (re.test(t)) p.words[k]++
}
export function scanSettings(text: string, p: Profile) {
  try {
    const j = JSON.parse(text) as { mcpServers?: Record<string, unknown>; hooks?: Record<string, unknown[]>; projects?: Record<string, { mcpServers?: Record<string, unknown> }> }
    const add = (o?: Record<string, unknown>) => { for (const k of Object.keys(o ?? {})) if (!p.mcpServers.includes(k)) p.mcpServers.push(k) }
    add(j.mcpServers); for (const pr of Object.values(j.projects ?? {})) add(pr.mcpServers)
    for (const v of Object.values(j.hooks ?? {})) p.hooks += Array.isArray(v) ? v.length : 0
  } catch { /* 읽을 수 없는 설정은 건너뛴다 */ }
}

// 분석 결과로 시작 규모·종·초기 자원을 정한다
export function pickSetup(p: Profile): Setup {
  const k = p.kinds
  const stage: Stage0 = p.calls < 80 ? 'found' : p.calls < 1500 ? 'young' : 'mature'
  const special: [SpeciesId, number][] = [['atta', k.mcp * 1.5], ['honeypot', (k.auto + p.hooks * 5) * 4], ['army', k.parallel * 3], ['samurai', k.raise * 3]]
  const base = k.explore * 0.5 + k.build + k.hunt * 2 + 1
  const [bestId, bestScore] = special.sort((a, b) => b[1] - a[1])[0]!
  const species: SpeciesId = p.calls < 80 ? 'formica' : bestScore > base * 0.35 ? bestId : 'japonicus'
  const wsum = Math.max(1, p.prompts)
  const majorBias = Math.min(0.12, (p.words.debug / wsum) * 0.25 + (k.hunt / Math.max(1, p.calls)) * 0.5)
  const storeBias = Math.min(0.6, (p.words.plan / wsum) * 1.2)
  const trail = Math.min(3, p.skills * 0.3 + k.skill * 0.05)
  const instinct = Math.min(4, p.hooks * 0.5 + k.auto * 0.05 + (p.words.automate / wsum) * 3)
  const top = (Object.entries(k) as [Kind, number][]).filter(([n]) => n !== 'other').sort((a, b) => b[1] - a[1]).slice(0, 3)
  const KO: Record<string, string> = { explore: '탐색', build: '편집', hunt: '테스트', raise: '위임', mcp: 'MCP', skill: '스킬', auto: '자동화', plan: '계획', parallel: '병렬 에이전트' }
  const EN: Record<string, string> = { explore: 'exploring', build: 'editing', hunt: 'testing', raise: 'delegating', mcp: 'MCP tools', skill: 'skills', auto: 'automation', plan: 'planning', parallel: 'parallel agents' }
  const stageKo = { found: '여왕 혼자 창업', young: '2년차 군락', mature: '3년차 군락' }[stage]
  const stageEn = { found: 'a founding queen', young: 'a second-year colony', mature: 'a third-year colony' }[stage]
  const sp = SPECIES[species]
  const ko = p.calls === 0
    ? `분석할 기록이 없어 ${sp.ko} ${stageKo}으로 시작합니다.`
    : `지난 기록: 대화 ${p.sessions}개, 도구 호출 ${p.calls}번, 프롬프트 ${p.prompts}개. 많이 쓴 것: ${top.map(([n, c]) => `${KO[n]} ${c}`).join(', ')}. MCP 서버 ${p.mcpServers.length}개, 스킬 ${p.skills}개, 훅 ${p.hooks}개 → ${sp.ko} ${stageKo}으로 시작합니다.`
  const en = p.calls === 0
    ? `No history to analyze, so you start with ${stageEn} of ${sp.en.toLowerCase()}s.`
    : `Your history: ${p.sessions} conversations, ${p.calls} tool calls, ${p.prompts} prompts. Most used: ${top.map(([n, c]) => `${EN[n]} ${c}`).join(', ')}. ${p.mcpServers.length} MCP servers, ${p.skills} skills, ${p.hooks} hooks → you start with ${stageEn} of ${sp.en.toLowerCase()}s.`
  return { species, stage, farms: p.mcpServers.slice(0, 4), trail, instinct, majorBias, storeBias, ko, en }
}
