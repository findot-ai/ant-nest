// 개미집 생물(공생·기생 생물) 도감. 실제로 개미와 함께 사는 생물을 종별로 골랐다.
import type { SpeciesId } from './species'

export type GuestId = 'cricket' | 'rove' | 'lycaenid' | 'niphanda' | 'attaphila' | 'antbird' | 'silverfish' | 'gynandro'
export type Guest = {
  id: GuestId; ko: string; en: string; sci: string; rarity: 1 | 2 | 3 | 4
  hosts: SpeciesId[] | 'all'; koDesc: string; enDesc: string
  effect: 'drain' | 'brood' | 'honeydew' | 'none'; surface?: boolean
}
export const RARITY_KO = ['', '흔함', '드묾', '희귀', '전설'], RARITY_EN = ['', 'Common', 'Uncommon', 'Rare', 'Legendary']

export const GUESTS: Guest[] = [
  {
    id: 'cricket', ko: '개미집귀뚜라미', en: 'Ant cricket', sci: 'Myrmecophilus sp.', rarity: 1,
    hosts: ['japonicus', 'formica', 'samurai', 'honeypot', 'atta'],
    koDesc: '날개 없는 작은 귀뚜라미. 개미 냄새를 흉내 내 둥지에 섞여 살며 일개미에게 먹이를 얻어먹는다.',
    enDesc: 'A tiny wingless cricket that mimics the colony scent and begs food from workers.', effect: 'drain',
  },
  {
    id: 'rove', ko: '개미반날개', en: 'Myrmecophile rove beetle', sci: 'Staphylinidae', rarity: 2,
    hosts: ['japonicus', 'formica', 'samurai'],
    koDesc: '개미집에 숨어 사는 반날개. 개미 행세를 하며 이따금 알과 애벌레를 훔쳐 먹는다.',
    enDesc: 'A rove beetle that hides among the ants and now and then eats their eggs and larvae.', effect: 'brood',
  },
  {
    id: 'lycaenid', ko: '부전나비 애벌레', en: 'Blue butterfly caterpillar', sci: 'Lycaenidae', rarity: 2,
    hosts: ['formica', 'japonicus'],
    koDesc: '개미가 지켜 주는 대신 등에서 단물을 내어 주는 나비 애벌레.',
    enDesc: 'A caterpillar the ants guard in exchange for the honeydew it secretes.', effect: 'honeydew',
  },
  {
    id: 'niphanda', ko: '담흑부전나비 애벌레', en: 'Niphanda fusca caterpillar', sci: 'Niphanda fusca', rarity: 4,
    hosts: ['japonicus'],
    koDesc: '일본왕개미 둥지에서만 자라는 나비 애벌레. 개미의 냄새를 흉내 내 일개미에게 입으로 먹이를 받아먹는다.',
    enDesc: 'A butterfly caterpillar that grows only in Japanese carpenter ant nests, mimicking their scent to be mouth-fed by workers.', effect: 'drain',
  },
  {
    id: 'attaphila', ko: '잎꾼개미바퀴', en: 'Leafcutter ant roach', sci: 'Attaphila fungicola', rarity: 3,
    hosts: ['atta'],
    koDesc: '잎꾼개미 둥지에서만 사는 아주 작은 바퀴. 버섯 정원을 갉아 먹고, 결혼비행 때 신여왕에게 올라타 새 둥지로 옮겨 간다.',
    enDesc: 'A tiny roach found only in leafcutter nests. It grazes the fungus garden and hitches a ride on new queens to their new nests.', effect: 'drain',
  },
  {
    id: 'antbird', ko: '개미새', en: 'Antbird', sci: 'Thamnophilidae', rarity: 2,
    hosts: ['army'], surface: true,
    koDesc: '군대개미 사냥 행렬을 따라다니며, 개미를 피해 뛰쳐나온 곤충을 낚아채는 새.',
    enDesc: 'A bird that follows army ant raids and snaps up insects flushed out ahead of the swarm.', effect: 'none',
  },
  {
    id: 'silverfish', ko: '군대개미좀', en: 'Army ant silverfish', sci: 'Trichatelura manni', rarity: 3,
    hosts: ['army'],
    koDesc: '군대개미 비박에 섞여 살고, 군락이 자리를 옮길 때 행렬에 섞여 함께 이동하는 좀.',
    enDesc: 'A silverfish that lives in army ant bivouacs and runs along with the column when the colony moves.', effect: 'drain',
  },
  {
    id: 'gynandro', ko: '암수한몸 개미', en: 'Gynandromorph ant', sci: 'gynandromorph', rarity: 4, hosts: 'all',
    koDesc: '몸의 절반은 암컷, 절반은 수컷으로 태어난 아주 드문 개체.',
    enDesc: 'An extremely rare individual born half female and half male.', effect: 'none',
  },
]
export const guestById = (id: GuestId) => GUESTS.find(g => g.id === id)!
export const guestsFor = (sp: SpeciesId) => GUESTS.filter(g => g.hosts === 'all' || g.hosts.includes(sp))
