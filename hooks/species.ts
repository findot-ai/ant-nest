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
  succession: 'found' | 'adopt' | 'fission'   // 새 여왕이 창업 / 기존 군락이 젊은 여왕을 받아들임 / 군락이 둘로 갈라짐
  dulotic?: boolean; bivouac?: boolean; tournaments?: boolean; carry?: string
}

export const SPECIES: Record<SpeciesId, Species> = {
  japonicus: {
    id: 'japonicus', ko: '일본왕개미', en: 'Japanese carpenter ant', sci: 'Camponotus japonicus',
    koDesc: '한국 숲의 큰 개미. 땅속 깊이 방을 층층이 파고, 단백질을 먹은 애벌레는 머리 큰 병정이 된다. 균형형.',
    enDesc: 'A large ant of Korean forests. Digs chambers deep underground; well-fed larvae grow into big-headed majors. Balanced.',
    climate: 'temperate', life: 8, devK: 1, layK: 1, majorK: 1, storeK: 1, boost: {}, body: '#140c08', major: '#3a2214', flightPop: 160, succession: 'found',
  },
  formica: {
    id: 'formica', ko: '곰개미', en: 'Japanese wood ant', sci: 'Formica japonica',
    koDesc: '한국 어디서나 보이는 개미. 빨리 자라고 병정이 거의 없다. 결혼비행 뒤 젊은 여왕을 받아들여 여왕을 여럿 두기 때문에, 여왕이 죽어도 군락이 이어진다.',
    enDesc: 'The everyday ant of Korea. Grows fast with almost no majors. It adopts young queens after the nuptial flight, so the colony carries on when a queen dies.',
    climate: 'temperate', life: 6, devK: 0.8, layK: 1.35, majorK: 0.2, storeK: 0.9, boost: { explore: 1.2, build: 1.2 }, body: '#262224', major: '#3a3436', flightPop: 120, succession: 'adopt',
  },
  atta: {
    id: 'atta', ko: '잎꾼개미', en: 'Leafcutter ant', sci: 'Atta cephalotes',
    koDesc: '남미 열대의 농사꾼. 여왕이 입속 주머니에 버섯 균을 담아 와 첫 정원을 차리고, 일개미가 잘라 온 잎으로 버섯을 키워 먹는다. 바깥 목초지(MCP 외부 도구)가 곧 잎 공급원이다.',
    enDesc: 'A farmer of the American tropics. The queen carries a pellet of fungus in her mouth pouch to start the first garden; workers cut leaves to feed it. Outside pastures (MCP tools) are its leaf supply.',
    climate: 'tropical', life: 10, devK: 1, layK: 1.5, majorK: 1.3, storeK: 1.3, boost: { mcp: 2.2, explore: 1.1 }, body: '#7a3416', major: '#9a4420', flightPop: 220,
    storeKo: '버섯 정원', storeEn: 'Fungus garden', succession: 'found', carry: '#5fae3a',
  },
  honeypot: {
    id: 'honeypot', ko: '꿀단지개미', en: 'Honeypot ant', sci: 'Myrmecocystus mexicanus',
    koDesc: '사막의 저장 전문가. 배에 꿀을 채운 일개미(꿀단지)가 천장에 매달려 살아 있는 창고가 된다. 이웃 군락과 과시 싸움(토너먼트)을 벌이고, 한쪽이 훨씬 약하면 습격해 새끼와 꿀단지를 빼앗는다. 자동화(본능)와 비축이 강하다.',
    enDesc: 'A desert storage expert. Honey-filled workers (repletes) hang from the ceiling as living pantries. Colonies hold display tournaments with neighbors, and when one side is much weaker it is raided for brood and repletes. Strong at automation and reserves.',
    climate: 'desert', life: 9, devK: 1.05, layK: 0.9, majorK: 0.3, storeK: 2.5, boost: { auto: 2, plan: 1.5 }, body: '#9a6a34', major: '#b07a3a', flightPop: 140,
    storeKo: '꿀단지 방', storeEn: 'Honey room', succession: 'found', tournaments: true,
  },
  army: {
    id: 'army', ko: '군대개미', en: 'Army ant', sci: 'Eciton burchellii',
    koDesc: '굴을 파지 않고 몸을 엮어 살아 있는 둥지(비박)를 만드는 열대의 약탈자. 정착기(약 20일)에만 알을 낳고 유랑기(약 14일)에는 매일 사냥 행렬을 낸다. 여왕은 날개가 없어 결혼비행 대신 군락이 둘로 갈라진다. 여러 에이전트를 한꺼번에 보내면 거대한 사냥 행렬이 된다.',
    enDesc: 'A tropical raider that digs no nest: workers link their bodies into a living bivouac. The queen lays only in the statary phase (about 20 days); in the nomadic phase (about 14 days) the colony raids every day. Queens are wingless, so colonies split instead of flying. Send several agents at once for a huge raiding column.',
    climate: 'tropical', life: 5, devK: 0.85, layK: 1.6, majorK: 1.1, storeK: 0.7, boost: { parallel: 3, hunt: 1.5, build: 0.5 }, body: '#5e3018', major: '#7a3e1e', flightPop: 260, succession: 'fission', bivouac: true,
  },
  samurai: {
    id: 'samurai', ko: '사무라이개미', en: 'Samurai ant', sci: 'Polyergus samurai',
    koDesc: '노예사냥개미. 사무라이개미는 채집도 육아도 하지 않는다. 정찰병이 곰개미 둥지를 찾으면 떼 지어 쳐들어가 번데기를 훔쳐 오고, 거기서 깨어난 곰개미가 노예로 모든 일을 한다. 노예는 새로 생기지 않으니 습격을 멈추면 군락이 굶는다. 일을 나눠 맡길수록(위임) 강해진다.',
    enDesc: 'A slave-making ant. Samurai workers neither forage nor nurse. Scouts find a wood ant nest, the colony raids it for pupae, and the wood ants that hatch do all the work as slaves. Slaves never breed, so if the raids stop, the colony starves. The more you delegate, the stronger it gets.',
    climate: 'temperate', life: 7, devK: 1, layK: 0.8, majorK: 0.5, storeK: 1, boost: { raise: 3, parallel: 1.5, explore: 0.6 }, body: '#7c2412', major: '#962e16', flightPop: 120, succession: 'found', dulotic: true,
  },
}
export const SPECIES_IDS = Object.keys(SPECIES) as SpeciesId[]
