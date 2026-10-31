# 무료 오프라인 한국어 음성: espeak-ng로 발음기호(IPA)를 만들고 Mimic3 KSS(VITS) 모델로 읽는다.
# 사용: python3 say_ko.py <출력.wav> <속도(1=보통, 클수록 빠름)> <문장>
import os, sys, subprocess, numpy as np, onnxruntime as ort, soundfile as sf
D = os.environ.get('VOICE_MODELS', 'media-out/tts') + '/vits-mimic3-ko_KO-kss_low'
out, speed, text = sys.argv[1], float(sys.argv[2]), sys.argv[3]
tok = {}
for line in open(f'{D}/tokens.txt', encoding='utf-8'):
    p = line.rstrip('\n').split(' '); tok[p[0] if p[0] else ' '] = int(p[-1])
sess = ort.InferenceSession(f'{D}/ko_KO-kss_low.onnx')
def ids_for(sentence):
    ipa = subprocess.run(['espeak-ng', '-v', 'ko', '-q', '--ipa'], input=sentence, capture_output=True, text=True).stdout
    ipa = ipa.replace('\n', ' ').strip()
    seq = [tok['^'], tok['_']]
    for wi, word in enumerate(ipa.split()):
        if wi: seq += [tok['#'], tok['_']]
        for ch in word:
            if ch in tok: seq += [tok[ch], tok['_']]
    seq += [tok['.'], tok['_'], tok['$']]
    return seq
chunks = []
import re
for s in [x.strip() for x in re.split(r'(?<=[.?!])\s+', text) if x.strip()]:
    ids = ids_for(s)
    audio = sess.run(None, {'input': np.array([ids], dtype=np.int64), 'input_lengths': np.array([len(ids)], dtype=np.int64),
                            'scales': np.array([0.667, 1.0 / speed, 0.8], dtype=np.float32)})[0].squeeze()
    chunks += [audio, np.zeros(int(22050 * 0.18), dtype=np.float32)]
a = np.concatenate(chunks); a = a / max(1e-6, np.abs(a).max()) * 0.9
sf.write(out, a, 22050)
print(out, round(len(a) / 22050, 2), 's')
