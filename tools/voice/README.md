# 무료 오프라인 내레이션 / Free offline narration

릴스 영상(`tools/reel-ui.ts`)에 입힐 목소리를 돈 들이지 않고 이 컴퓨터에서 만든다.
Free voiceover for the reel, made locally with no paid service.

- 한국어: Mimic3 KSS 음성(VITS, KSS 데이터셋) + espeak-ng 발음기호 · Korean: Mimic3 KSS voice with espeak-ng phonemes
- English: Piper `en_US-lessac-medium`
- 확인용 음성 인식: sherpa-onnx Korean zipformer

준비 / Setup
```
apt-get install espeak-ng && pip install onnxruntime soundfile sherpa-onnx numpy
B=https://github.com/k2-fsa/sherpa-onnx/releases/download
mkdir -p media-out/tts && cd media-out/tts
curl -L $B/tts-models/vits-mimic3-ko_KO-kss_low.tar.bz2 | tar xj
curl -L $B/tts-models/vits-piper-en_US-lessac-medium.tar.bz2 | tar xj
curl -L $B/asr-models/sherpa-onnx-zipformer-korean-2024-06-24.tar.bz2 | tar xj   # 선택: 발음 확인용
```

실행 / Run (저장소 루트에서)
```
python3 tools/voice/narrate.py ko media-out/narr-ko.wav
ffmpeg -i media-out/reel-ui-ko.mp4 -i media-out/narr-ko.wav -map 0:v -map 1:a -c:v copy -c:a aac -af apad -t 32.8 media-out/reel-ui-voice-ko.mp4
python3 tools/voice/asr_ko.py media-out/tts/seg-ko/*.wav   # 받아 적어 발음 확인
```
모델 폴더는 `VOICE_MODELS` 환경 변수로 바꿀 수 있다. 무료 음성이라 사람 목소리나 유료 AI 음성보다 기계음에 가깝다.
