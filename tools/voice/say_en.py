# 무료 오프라인 영어 음성: espeak-ng 발음기호 + Piper(lessac) 모델. 사용: python3 say_en.py <출력.wav> <속도> <문장>
import os, sys, re, json, subprocess, numpy as np, onnxruntime as ort, soundfile as sf
D = os.environ.get('VOICE_MODELS', 'media-out/tts') + '/vits-piper-en_US-lessac-medium'
out, speed, text = sys.argv[1], float(sys.argv[2]), sys.argv[3]
cfg = json.load(open(f'{D}/en_US-lessac-medium.onnx.json')); m = cfg['phoneme_id_map']; sr = cfg['audio']['sample_rate']
sess = ort.InferenceSession(f'{D}/en_US-lessac-medium.onnx')
chunks = []
for s in [x.strip() for x in re.split(r'(?<=[.?!])\s+', text) if x.strip()]:
    ipa = subprocess.run(['espeak-ng', '-v', 'en-us', '-q', '--ipa'], input=s, capture_output=True, text=True).stdout.replace('\n', ' ').strip()
    ids = m['^'] + m['_']
    for ch in ipa:
        if ch in m: ids += m[ch] + m['_']
    ids += m['.'] + m['_'] + m['$']
    a = sess.run(None, {'input': np.array([ids], dtype=np.int64), 'input_lengths': np.array([len(ids)], dtype=np.int64), 'scales': np.array([0.667, 1.0 / speed, 0.8], dtype=np.float32)})[0].squeeze()
    chunks += [a, np.zeros(int(sr * 0.15), dtype=np.float32)]
a = np.concatenate(chunks); a = a / max(1e-6, np.abs(a).max()) * 0.9
sf.write(out, a, sr); print(out, round(len(a) / sr, 2), 's')
