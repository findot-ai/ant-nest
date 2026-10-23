# Ant Nest · 개미굴

**English** · [한국어](#한국어)

A colony of Japanese carpenter ants (*Camponotus japonicus*) lives beside your Claude Code session. While you are connected, 2 seconds is one game hour: seasons turn, brood grows with soil temperature, and the frost line creeps down in winter.

The colony's food and weather come from how you use AI. The mod never reads your code or conversation. It looks only at tool names and whether each call succeeded.

## How your AI use maps to the nest

| What you do in Claude Code | What happens in the nest |
|---|---|
| Explore: read files, search, web research | Foragers climb trees and bring back honeydew |
| Edit and write files | Digging: new tunnels and chambers. More storage rooms mean bigger reserves |
| Tests or builds pass | A successful hunt: protein, which grows majors (big-headed soldiers) |
| Delegate to a subagent | The queen lays extra eggs |
| Several agents at once, workflows, worktrees | An expedition files out of the nest |
| Use an MCP server (external tool) | Each server becomes an outside pasture: a new aphid tree the ants herd |
| Reuse a skill | The pheromone trail gets stronger and foraging speeds up |
| Set up automation: scheduled tasks, wakeups, triggers, background runs, headless sessions | Instinct: the colony earns more on its own, even when you are away |
| Plan: todo lists, plan mode | Blueprints: extra digging and a little food |
| An error | A spider spins a web on the foraging trail |
| The same tool fails 3 times in a row | A centipede breaks in. Alarm pheromone spreads and the ants swarm it |
| The failing tool succeeds again | Bug fixed: the centipede goes down and becomes protein |
| A test fails | Rain |
| A long conversation gets summarized | A mole passes and part of the storage caves in |
| An unfamiliar tool | The colony guesses its job from the name and remembers it |

Over time your usage pattern gives the colony a type: Scout, Builder, Hunter, Delegator, Herder (MCP-heavy), Trailblazer (skill-heavy) or Instinct (automation-heavy).

The colony never dies from your work. The queen can weaken, but idle days are just quiet days.

## Commands

- `/ant`: open the nest pane
- `/ant stats`: your usage so far, colony type, tools learned
- `/ant reset`: settle a new colony on fresh ground

Language follows your system locale. Change it under the plugin's settings (`language`: `auto`, `ko`, `en`).

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install ant-nest --marketplace findot-ai/ant-nest
```

Answer `y` to add the marketplace, then pick the user scope.

From a shell:

```
claude plugin install ant-nest --marketplace findot-ai/ant-nest
```

In the desktop app: click + next to the prompt box, then Plugins, Add marketplace with `findot-ai/ant-nest`, then Add plugin.

The desktop app draws the nest as pixel art in a side pane. A terminal draws it with half-block characters. On a narrow terminal the pane does not open by itself; use `/ant`.

---

## 한국어

Claude Code 옆에서 일본왕개미 군락이 살아 움직입니다. 접속해 있는 동안 2초가 게임 1시간이고, 계절이 바뀌고, 새끼가 땅속 온도에 따라 자라고, 겨울에는 동결선이 내려옵니다.

군락의 먹이와 날씨는 당신의 AI 활용입니다. 코드나 대화 내용은 읽지 않고, 도구 이름과 성공 여부만 봅니다.

## 내 AI 활용이 개미굴에 반영되는 방식

| Claude Code에서 한 일 | 개미굴에서 |
|---|---|
| 탐색: 파일 읽기, 검색, 웹 조사 | 채집 개미가 나무에 올라 단물을 가져온다 |
| 편집·작성 | 굴착, 새 방. 창고가 늘면 비축할 수 있는 양이 커진다 |
| 테스트·빌드 통과 | 사냥 성공, 단백질 (병정개미가 자란다) |
| 서브에이전트에 일을 맡김 | 여왕이 알을 더 낳는다 |
| 여러 에이전트 동시 실행, 워크플로, 워크트리 | 원정대가 줄지어 굴을 나선다 |
| MCP 서버(외부 도구) 사용 | 서버 하나가 바깥 목초지 하나: 개미가 치는 진딧물 나무가 새로 생긴다 |
| 스킬 재사용 | 페로몬 길이 짙어져 채집이 빨라진다 |
| 자동화 설정: 예약 작업, 깨우기, 트리거, 백그라운드 실행, 사람 없이 도는 세션 | 본능: 내가 없어도 군락이 스스로 버는 양이 늘어난다 |
| 계획: 할 일 목록, 계획 모드 | 설계도: 굴착이 조금 더, 먹이도 조금 |
| 오류 | 채집 길목에 거미줄 |
| 같은 도구가 3번 연속 오류 | 지네 침입. 경보 페로몬이 퍼지면 개미들이 몰려든다 |
| 실패했던 도구가 다시 성공 | 버그를 잡았다: 지네 격퇴, 단백질이 된다 |
| 테스트 실패 | 비 |
| 긴 대화가 요약됨 | 두더지가 지나가며 창고 한쪽이 무너진다 |
| 처음 보는 도구 | 이름으로 일을 짐작해 배우고 기억한다 |

쓰는 패턴이 쌓이면 군락 유형이 정해집니다: 정찰형, 건축형, 사냥형, 분업형, 목축형(MCP 위주), 길잡이형(스킬 위주), 본능형(자동화 위주).

일 때문에 군락이 전멸하지는 않습니다. 여왕은 약해질 수 있지만, 쉬는 날은 조용히 지나갈 뿐입니다.

## 명령

- `/ant`: 개미굴 창 열기
- `/ant stats`: 지금까지의 활용, 군락 유형, 배운 도구
- `/ant reset`: 새 땅에 새 군락

언어는 시스템 언어를 따릅니다. 플러그인 설정의 `language`(`auto`, `ko`, `en`)에서 바꿀 수 있습니다.

## 설치

Claude Code 터미널 입력창에서:

```
/plugin install ant-nest --marketplace findot-ai/ant-nest
```

마켓플레이스 추가를 물으면 `y`, 범위는 사용자(user)를 고릅니다.

셸에서:

```
claude plugin install ant-nest --marketplace findot-ai/ant-nest
```

데스크톱 앱에서는 입력창 옆 + → Plugins → Add marketplace에 `findot-ai/ant-nest`를 넣고 Add plugin을 누릅니다.

데스크톱 앱에서는 옆 창에 도트 그림으로, 터미널에서는 반 블록 문자로 그립니다. 터미널 폭이 좁으면 창이 자동으로 뜨지 않으니 `/ant`로 여세요.
