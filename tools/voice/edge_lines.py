# 자연스러운 무료 목소리(Microsoft Edge 음성, 계정 불필요)로 릴스 내레이션 문장을 하나씩 만들어 zip 하나로 묶는다.
# 내 컴퓨터에서 실행 (인터넷 필요):  pip install edge-tts  →  python edge_lines.py ko   (영어는 en)
# 만들어진 ant-nest-voice-ko.zip 을 Claude 대화에 올리면 장면 시각에 맞춰 영상에 입힌다.
import asyncio, sys, zipfile, io, edge_tts

LINES = {
    'ko': ('ko-KR-SunHiNeural', '+8%', ['클로드 코드 옆에서 개미를 키워요.', '파일을 읽으면 채집을 나가고,', '코드를 고치면 굴을 파고,', '테스트가 통과하면 사냥을 해요.',
           '오류가 나면 거미가 오고,', '배포하면 결혼비행을 떠나요.', '어제보다 얼마나 자랐는지,', '매주 AI 활용 리포트,', '어떤 도구를 썼는지,', '진짜 개미집 생물 도감까지.',
           '무료고, 토큰도 안 써요. 당신의 개미굴은 어떻게 자랄까요?']),
    'en': ('en-US-AvaNeural', '+5%', ['An ant colony lives next to Claude Code.', 'Read a file, and foragers head out.', 'Edit code, and they dig.', 'Tests pass? A hunt.',
           'An error brings a spider.', 'Ship it, and they fly.', 'See how much it grew since yesterday,', 'get a weekly report on how you use AI,', 'which tools fed it,',
           'and a dex of real nest creatures.', 'Free, zero tokens. What will your colony become?']),
}

async def main(lang: str, voice: str | None):
    v, rate, lines = LINES[lang]
    name = f'ant-nest-voice-{lang}.zip'
    with zipfile.ZipFile(name, 'w') as z:
        for i, text in enumerate(lines):
            buf = io.BytesIO()
            async for chunk in edge_tts.Communicate(text, voice or v, rate=rate).stream():
                if chunk['type'] == 'audio': buf.write(chunk['data'])
            z.writestr(f'{i:02d}.mp3', buf.getvalue()); print(f'{i:02d}', text)
    print('완료 / done:', name)

asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else 'ko', sys.argv[2] if len(sys.argv) > 2 else None))
