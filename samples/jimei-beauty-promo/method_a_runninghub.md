# 方式 A:RunningHub 雲端 pipeline

不用本機 GPU,把 AI 圖 / AI 影片 workflow 都送到 RunningHub 跑。**30 秒直式影片估算成本:約 USD 3–8 / 次**(視是否啟用動態 video generation)。

## 首次設定(只做一次)

1. 註冊 [RunningHub](https://runninghub.ai) 帳號,到後台取 API key
2. 在你本機 `Pixelle-Video/` 資料夾:
   ```bash
   cp config.example.yaml config.yaml
   ```
3. 編輯 `config.yaml`,填入以下三處:
   ```yaml
   llm:
     api_key: "<你的 OpenAI / Qwen / DeepSeek key>"
     base_url: "https://api.openai.com/v1"       # 或對應廠商
     model: "gpt-4o-mini"

   comfyui:
     runninghub_api_key: "<RunningHub API KEY>"
     runninghub_concurrent_limit: 1              # 免費會員維持 1
     image:
       default_workflow: runninghub/image_flux.json
     video:
       default_workflow: runninghub/video_wan2.1_fusionx.json
   ```
4. `pip install -r requirements.txt` 或 `uv sync`(依你環境)

## 每次製作(約 5–15 分鐘)

1. `./start_web.sh` 啟動 Web UI(預設 http://127.0.0.1:8000)
2. 點「新增任務」→ 選**固定腳本 (Fixed Script)**
3. 貼入 `samples/jimei-beauty-promo/script.txt` 全部 5 行
4. `split_mode` 選 **line**(一行一段)
5. 模板選 `1080x1920/image_elegant.html`
6. Style prefix 依當週輪替(見下方庫)
7. TTS 選 `zh-TW-HsiaoChenNeural`,rate `-8%`
8. 送出,等待任務跑完
9. 完成後,mp4 在 `output/<task_id>/final.mp4`

## style_prefix 變化庫(對應 rotation_plan)

| 週次調性 | prompt_prefix |
|---------|--------------|
| 清晨米白 | `Premium beauty brand campaign, cinematic, cream and warm ivory palette, soft morning window light, 35mm film look, editorial photography, calm ritual mood, no text, no logos` |
| 秋冬暖棕 | `Premium beauty brand campaign, cinematic, warm terracotta and mocha palette, low warm golden hour light, 35mm film look, editorial photography, cozy elevated mood, no text, no logos` |
| 春夏清透 | `Premium beauty brand campaign, cinematic, soft pastel and pale sage palette, high-key morning light, airy and fresh, 35mm film look, editorial photography, no text, no logos` |
| 夜間儀式 | `Premium beauty brand campaign, cinematic, amber tungsten palette, low-key candle-lit ambience, warm shadows, 35mm film look, editorial photography, intimate mood, no text, no logos` |

輪流用,同一版連續兩次不重複。

## 常見狀況排除

- **429 too many requests**:免費會員併發只有 1,`runninghub_concurrent_limit` 保持 1
- **圖片出現臉部變形**:換 negative_prompt 或降 style_prefix 強度、重跑該幀
- **中文人物臉太西方**:prompt 加 `East Asian, natural Taiwanese features`
- **旁白對不上長度**:調整 `tts.rate`(-8% → -12% 拉長,或改 `+0%` 縮短)
