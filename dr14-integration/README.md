# BeautyBot — dr14 Integration Package

將 BeautyBot 醫美貼文機器人整合進 ops.self.com.tw（Lovable / React / TypeScript）的完整套件。

## 目錄結構

```
dr14-integration/
├── src/
│   ├── types/beauty-bot.ts          # TypeScript 型別 + 常數
│   ├── lib/beauty-bot-api.ts        # Supabase Edge Function API 封裝
│   ├── pages/BeautyBot.tsx          # 主頁面（6 個 Tab）
│   └── components/beauty-bot/
│       ├── PostCard.tsx             # 單篇貼文顯示卡片
│       ├── PostGenerator.tsx        # 快速生成介面
│       ├── WeeklyPlan.tsx           # 週計畫排程
│       ├── SeriesPosts.tsx          # 系列貼文生成
│       ├── ThreadsConnect.tsx       # Threads OAuth 連接
│       ├── StrategyGuide.tsx        # 增粉策略 + 14 天日曆
│       └── BotSettings.tsx          # 設定顯示
├── supabase/
│   ├── functions/
│   │   ├── beauty-bot-generate/index.ts   # AI 生成貼文 Edge Function
│   │   └── beauty-bot-publish/index.ts    # Threads 發文 Edge Function
│   └── migrations/
│       └── 20240101000000_beauty_bot.sql  # DB Schema
```

## 整合步驟

### 1. 複製檔案到 dr14 repo

```bash
# 複製所有 src 檔案
cp -r dr14-integration/src/types/beauty-bot.ts       <dr14>/src/types/
cp -r dr14-integration/src/lib/beauty-bot-api.ts     <dr14>/src/lib/
cp -r dr14-integration/src/pages/BeautyBot.tsx       <dr14>/src/pages/
cp -r dr14-integration/src/components/beauty-bot/    <dr14>/src/components/

# 複製 Supabase Edge Functions
cp -r dr14-integration/supabase/functions/beauty-bot-generate/ \
      <dr14>/supabase/functions/
cp -r dr14-integration/supabase/functions/beauty-bot-publish/  \
      <dr14>/supabase/functions/
```

### 2. 執行資料庫 Migration

在 Supabase 控制台 SQL Editor 執行：

```bash
# 或透過 CLI
supabase db push --include-all
```

或直接複製 `supabase/migrations/20240101000000_beauty_bot.sql` 內容到 SQL Editor 執行。

### 3. 部署 Edge Functions

```bash
cd <dr14>
supabase functions deploy beauty-bot-generate
supabase functions deploy beauty-bot-publish
```

### 4. 設定 Edge Function 環境變數

在 Supabase 控制台 → Edge Functions → Settings → Secrets：

| 變數名稱 | 說明 |
|---------|------|
| `OPENAI_API_KEY` | 你的 OpenAI / 相容 API Key |
| `OPENAI_BASE_URL` | API 基礎 URL（預設 `https://api.openai.com/v1`）|
| `OPENAI_MODEL` | 模型名稱（預設 `gpt-4o-mini`）|
| `THREADS_APP_ID` | Meta App ID：`1854440058813609` |
| `THREADS_APP_SECRET` | Meta App Secret |
| `THREADS_REDIRECT_URI` | `https://self.com.tw/oauth/callback` |
| `SUPABASE_URL` | 自動注入 |
| `SUPABASE_SERVICE_ROLE_KEY` | 自動注入 |

### 5. 加入路由（React Router）

在 `src/App.tsx` 或路由設定中加入：

```tsx
import BeautyBot from '@/pages/BeautyBot';
import OAuthCallback from '@/pages/OAuthCallback';

// 在 routes 陣列中加入：
{ path: '/beauty-bot', element: <BeautyBot /> },
{ path: '/oauth/callback', element: <OAuthCallback /> },  // Threads OAuth 自動換碼
```

### 6. 加入側邊選單

在側邊欄導覽加入連結：

```tsx
import { Sparkles } from 'lucide-react';

<NavItem href="/beauty-bot" icon={<Sparkles />} label="BeautyBot 貼文機器人" />
```

## Threads OAuth 設定

1. 前往 [Meta for Developers](https://developers.facebook.com/) → 你的 App → Threads → OAuth 設定
2. 確認 Redirect URI 白名單加入你的部署網址（動態根據部署域名決定）：
   - 開發：`http://localhost:5173/oauth/callback`
   - 生產：`https://ops.self.com.tw/oauth/callback`（或你實際部署的域名）
3. 將 `/oauth/callback` 路由加入 App（見步驟 5）
4. 授權後 OAuthCallback 頁面會自動換取 Access Token，無需手動複製 Code

## 相依套件確認

確保 dr14 已安裝：

```bash
npm install @supabase/supabase-js lucide-react sonner
# shadcn/ui 元件（若未安裝）：
npx shadcn-ui@latest add card button badge select slider tabs textarea input label
```

## 功能說明

| Tab | 功能 |
|-----|------|
| 🖊️ 快速生成 | 選主題/格式，AI 即時生成一篇貼文，支援直接發文 |
| 📅 週計畫 | 生成 7 篇排程貼文，可下載 TXT，逐篇發文 |
| 🎯 系列貼文 | 同主題 2-5 篇連環貼文 |
| 📈 增粉策略 | 最佳發文時段、Hashtag 策略、14 天內容日曆 |
| 🔗 Threads 串接 | OAuth 授權、Token 管理、測試發文、發文歷史 |
| ⚙️ 設定 | CTA 模板、週主題排程顯示 |
