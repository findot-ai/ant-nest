# 만든 한국어 음성을 무료 음성 인식(sherpa-onnx zipformer)으로 다시 받아 적어 발음을 확인한다
import os, sys, numpy as np, soundfile as sf, sherpa_onnx
D = os.environ.get('VOICE_MODELS', 'media-out/tts') + '/sherpa-onnx-zipformer-korean-2024-06-24'
r = sherpa_onnx.OfflineRecognizer.from_transducer(encoder=f'{D}/encoder-epoch-99-avg-1.int8.onnx', decoder=f'{D}/decoder-epoch-99-avg-1.int8.onnx', joiner=f'{D}/joiner-epoch-99-avg-1.int8.onnx', tokens=f'{D}/tokens.txt', num_threads=4)
for f in sys.argv[1:]:
    a, sr = sf.read(f, dtype='float32')
    if sr != 16000:
        import math; n = int(len(a) * 16000 / sr); a = np.interp(np.linspace(0, len(a) - 1, n), np.arange(len(a)), a).astype(np.float32); sr = 16000
    s = r.create_stream(); s.accept_waveform(sr, a); r.decode_stream(s); print(f, '→', s.result.text)
