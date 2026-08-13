# 方式 B:手動剪輯 + 真實素材

不倚賴 AI pipeline,適合 A 方式跑不動、或想要**非 AI 感真實質地**的週次。全免費工具即可完成,約 45–90 分鐘一支。

## 需要的工具

| 用途 | 建議工具 | 備註 |
|------|---------|------|
| 剪輯 | **CapCut**(Mac / iPad / iPhone / 網頁) | 直式模板齊全 |
| 或進階剪輯 | DaVinci Resolve(免費版) | 需要調色時 |
| 免費授權影片 | Pexels / Pixabay / Coverr | 商用可 |
| 免費授權圖片 | Unsplash / Pexels | 商用可 |
| 旁白 | edge-tts CLI | 免費、音質接近 Azure |
| BGM | Epidemic Sound(訂閱) / YouTube 音效庫(免費) | 挑「cinematic minimal piano」標籤 |

## 步驟

### 1. 生旁白(產出 voiceover.mp3)

在專案根目錄執行:

```bash
pip install edge-tts

edge-tts \
  --voice zh-TW-HsiaoChenNeural \
  --rate=-8% \
  --file samples/jimei-beauty-promo/script.txt \
  --write-media samples/jimei-beauty-promo/method_b_manual/voiceover.mp3 \
  --write-subtitles samples/jimei-beauty-promo/method_b_manual/voiceover.vtt
```

想試另一個嗓音,把 `zh-TW-HsiaoChenNeural` 換成 `zh-TW-HsiaoYuNeural`(較清亮)。

### 2. 找素材(每場 1 段直式短片,約 4–7 秒)

到 [Pexels 影片庫](https://www.pexels.com/videos/) 用下表關鍵字搜尋,勾「Vertical」直式,優先選 4K:

| 場 | 建議畫面 | Pexels 搜尋詞 | Unsplash 搜尋詞(靜圖) |
|---|---------|---------------|----------------------|
| S1 | 晨光女子側臉 | `woman waking morning warm light` | `woman morning bedroom natural light` |
| S2 | 保養特寫、鏡前 | `asian skincare closeup mirror` | `skincare porcelain vanity` |
| S3 | 診所簡約空間 | `minimalist spa interior beige` | `spa reception minimalist warm` |
| S4 | 會員卡 / App 畫面 | `elegant business card marble` + `minimalist app mockup` | 同左 |
| S5 | 女子自信淺笑 | `confident asian woman mirror soft light` | `woman smile beige portrait` |

**S4 進階建議**:如果診所已有會員 App / 網頁,直接錄 15 秒螢幕操作,比 stock 素材更有說服力。

**版權提醒**:Pexels / Unsplash / Pixabay 都是商用免授權,但要保留出處清單存底(對抗未來爭議)。

### 3. 剪輯(CapCut 示範,約 40 分鐘)

1. 建立新專案 → 選 **1080×1920 直式**
2. 拉入 5 段影片,總長 30 秒:
   - S1: 0.0–4.0(4 秒)
   - S2: 4.0–9.0(5 秒)
   - S3: 9.0–16.0(7 秒)
   - S4: 16.0–23.0(7 秒)
   - S5: 23.0–30.0(7 秒)
3. 匯入 `voiceover.mp3` 到音軌 1,對齊起點
4. BGM 到音軌 2,音量設 **-18 dB**(旁白為主)
5. 匯入 `../subtitles/reels_30s.srt` 生字幕:
   - 字體:思源宋體 / Noto Serif TC
   - 大小:60–72 pt
   - 顏色:#F5EFE6(米白)+ 深墨陰影
   - 位置:下三分之一安全區(避開 IG Reels 按鈕)
6. 轉場:
   - S1→S2、S2→S3、S3→S4、S4→S5 都用 **Dissolve 0.4 秒**
   - S3 場加**推近 zoom**(1.0 → 1.1)強化品牌 reveal
7. S5 結尾字卡(0:26–0:30):
   - 「己美 self」大標(思源宋體 96 pt)
   - 「己美self.com.tw」網址
   - 「立即註冊會員」CTA
8. 匯出:
   - 格式 MP4 / H.264
   - 幀率 30 fps
   - 位元率 15 Mbps
   - 音量正常化到 -14 LUFS

### 4. 品質檢查

- [ ] 字幕位置在下 20%~30%,IG Reels UI 不會蓋到
- [ ] 無療效宣稱字眼(「最」「保證」「永久」)
- [ ] 音量峰值 ≤ -3 dBFS
- [ ] 30 秒內出現一次 CTA(net at 尾聲)

## 檔案輸出建議路徑

```
~/Movies/jimei/jimei_reels_w1_b_20260709.mp4
```

再上傳 FB / IG 排程。
