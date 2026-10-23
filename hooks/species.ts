// 개미종: 실제 생태를 줄여 옮긴 값. 수명은 게임 한 세대를 현실 약 3개월로 맞추려고 압축했다.
export type Climate = 'temperate' | 'tropical' | 'desert'
export type SpeciesId = 'japonicus' | 'formica' | 'atta' | 'honeypot' | 'army' | 'samurai'
export type Species = {
  id: SpeciesId; ko: string; en: string; sci: string; koDesc: string; enDesc: string
  climate: Climate; life: number            // 여왕 수명(게임 년)
  devK: number; layK: number; majorK: number; storeK: number
  boost: Partial<Record<'explore' | 'build' | 'hunt' | 'raise' | 'mcp' | 'skill' | 'auto' | 'plan' | 'parallel', number>>
  body: string; major: string; flightPop: number
  storeKo?: string; storeEn?: string
}

export const SPECIES: Record<SpeciesId, Species> = {
  japonicus: {
    id: 'japonicus', ko: '일본왕개미', en: 'Japanese carpenter ant', sci: 'Camponotus japonicus',
    koDesc: '한국 숲의 큰 개미. 땅속 깊이 방을 층층이 파고, 단백질을 먹은 애벌레는 머리 큰 병정이 된다. 균형형.',
    enDesc: 'A large ant of Korean forests. Digs chambers deep underground; well-fed larvae grow into big-headed majors. Balanced.',
    climate: 'temperate', life: 8, devK: 1, layK: 1, majorK: 1, storeK: 1, boost: {}, body: '#140c08', major: '#3a2214', flightPop: 160,
  },
  formica: {
    id: 'formica', ko: '곰개미', en: 'Japanese wood ant', sci: 'Formica japonica',
    koDesc: '한국 어디서나 보이는 개미. 빨리 자라고 많이 낳지만 병정이 거의 없다. 처음 시작하기 좋다.',
    enDesc: 'The everyday ant of Korea. Grows fast and lays many eggs, but has almost no majors. A gentle start.',
    climate: 'temperate', life: 6, devK: 0.8, layK: 1.35, majorK: 0.2, storeK: 0.9, boost: { explore: 1.2, build: 1.2 }, body: '#262224', major: '#3a3436', flightPop: 120,
  },
  atta: {
    id: 'atta', ko: '잎꾼개미', en: 'Leafcutter ant', sci: 'Atta cephalotes',
    koDesc: '남미 열대의 농사꾼. 잎을 잘라 와 땅속에서 버섯을 키워 먹는다. 바깥 목초지(MCP 외부 도구)가 곧 잎 공급원이다.',
    enDesc: 'A farmer of the American tropics. Cuts leaves and grows fungus underground. Outside pastures (MCP tools) are its leaf supply.',
    climate: 'tropical', life: 10, devK: 1, layK: 1.5, majorK: 1.3, storeK: 1.3, boost: { mcp: 2.2, explore: 1.1 }, body: '#7a3416', major: '#9a4420', flightPop: 220,
    storeKo: '버섯 정원', storeEn: 'Fungus garden',
  },
  honeypot: {
    id: 'honeypot', ko: '꿀단지개미', en: 'Honeypot ant', sci: 'Myrmecocystus mexicanus',
    koDesc: '사막의 저장 전문가. 배에 꿀을 가득 채운 일개미가 천장에 매달려 살아 있는 창고가 된다. 자동화(본능)와 비축이 강하다.',
    enDesc: 'A desert storage expert. Workers swollen with honey hang from the ceiling as living pantries. Strong at automation and reserves.',
    climate: 'desert', life: 9, devK: 1.05, layK: 0.9, majorK: 0.3, storeK: 2.5, boost: { auto: 2, plan: 1.5 }, body: '#9a6a34', major: '#b07a3a', flightPop: 140,
    storeKo: '꿀단지 방', storeEn: 'Honey room',
  },
  army: {
    id: 'army', ko: '군대개미', en: 'Army ant', sci: 'Eciton burchellii',
    koDesc: '둥지 없이 떼로 이동하며 사냥하는 열대의 약탈자. 여러 에이전트를 한꺼번에 보내면 거대한 사냥 행렬이 된다.',
    enDesc: 'A tropical raider that hunts in swarms with no fixed nest. Send several agents at once and it becomes a huge raiding column.',
    climate: 'tropical', life: 5, devK: 0.85, layK: 1.6, majorK: 1.1, storeK: 0.7, boost: { parallel: 3, hunt: 1.5, build: 0.5 }, body: '#5e3018', major: '#7a3e1e', flightPop: 260,
  },
  samurai: {
    id: 'samurai', ko: '사무라이개미', en: 'Samurai ant', sci: 'Polyergus samurai',
    koDesc: '스스로 일하지 않고 곰개미의 고치를 훔쳐 와 일꾼으로 키운다. 일을 나눠 맡길수록(위임) 강해진다. 직접 채집은 서툴다.',
    enDesc: 'Does not work for itself: it steals wood ant cocoons and raises them as workers. The more you delegate, the stronger it gets. Poor at foraging itself.',
    climate: 'temperate', life: 7, devK: 1, layK: 0.8, majorK: 0.5, storeK: 1, boost: { raise: 3, parallel: 1.5, explore: 0.6 }, body: '#7c2412', major: '#962e16', flightPop: 120,
  },
}
export const SPECIES_IDS = Object.keys(SPECIES) as SpeciesId[]
