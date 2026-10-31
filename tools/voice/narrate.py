# 장면 시각에 맞춘 내레이션: 문장마다 음성을 만들고, 칸보다 길면 빠르게 다시 만든 뒤 한 트랙으로 합친다
import sys, subprocess, soundfile as sf, os, json
lang, out = sys.argv[1], sys.argv[2]
say = os.path.join(os.path.dirname(__file__), 'say_ko.py') if lang == 'ko' else os.path.join(os.path.dirname(__file__), 'say_en.py')
SEG = {
 'ko': [(0.3, 3.6, '클로드 코드 옆에서 개미를 키워요.'), (4.0, 2.5, '파일을 읽으면 채집,'), (6.6, 2.5, '코드를 고치면 굴착,'),
        (9.2, 2.3, '테스트가 통과하면 사냥,'), (11.6, 2.1, '오류가 나면 거미,'), (13.8, 3.0, '배포하면 결혼비행!'),
        (17.0, 2.9, '어제보다 얼마나 컸는지,'), (20.0, 3.1, '매주 에이아이 활용 리포트,'), (23.2, 2.5, '쓴 도구까지,'),
        (25.8, 2.3, '진짜 개미집 생물 도감.'), (28.3, 4.2, '무료, 토큰은 영. 당신의 개미굴은 어떻게 자랄까요?')],
 'en': [(0.3, 3.6, 'An ant colony lives next to Claude Code.'), (4.0, 2.5, 'Read a file, and foragers head out.'), (6.6, 2.5, 'Edit code, and they dig.'),
        (9.2, 2.3, 'Tests pass? A hunt.'), (11.6, 2.1, 'An error brings a spider.'), (13.8, 3.0, 'Ship it, and they fly.'),
        (17.0, 2.9, 'See how much it grew since yesterday,'), (20.0, 3.1, 'get a weekly report on how you use AI,'), (23.2, 2.5, 'which tools fed it,'),
        (25.8, 2.3, 'and a dex of real nest creatures.'), (28.3, 4.2, 'Free, zero tokens. What will your colony become?')],
}[lang]
os.makedirs(os.environ.get('VOICE_MODELS', 'media-out/tts') + f'/seg-{lang}', exist_ok=True)
parts = []; prev_end = 0.0
for i, (t, slot, text) in enumerate(SEG):
    f = os.environ.get('VOICE_MODELS', 'media-out/tts') + f'/seg-{lang}/{i}.wav'; speed = 1.05
    for _ in range(4):
        subprocess.run(['python3', say, f, str(speed), text], check=True, capture_output=True)
        d = sf.info(f).duration
        if d <= slot: break
        if speed >= 1.25: break
        speed = min(1.25, speed * d / slot * 1.03)
    t = max(t, prev_end + 0.12); prev_end = t + d   # 앞 문장이 길면 조금 늦게 시작
    parts.append((t, f, round(d, 2), round(speed, 2)))
print(json.dumps([(p[0], p[2], p[3]) for p in parts]))
inputs, filt = [], []
for i, (t, f, d, s) in enumerate(parts):
    inputs += ['-i', f]; filt.append(f'[{i}:a]aresample=44100,adelay={int(t*1000)}|{int(t*1000)}[a{i}]')
mix = ''.join(f'[a{i}]' for i in range(len(parts))) + f'amix=inputs={len(parts)}:normalize=0,loudnorm=I=-15:TP=-1.5[out]'
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', *inputs, '-filter_complex', ';'.join(filt) + ';' + mix, '-map', '[out]', '-ac', '2', out], check=True)
print('트랙', out)
