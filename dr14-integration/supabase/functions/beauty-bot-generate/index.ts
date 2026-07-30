// Supabase Edge Function: beauty-bot-generate
// AI 生成醫美 Threads 貼文內容 — 接上大腦 (Anthropic Claude)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = Deno.env.get("BEAUTY_BOT_MODEL") ?? "claude-haiku-4-5-20251001";

// ── 資料定義 ────────────────────────────────────

const BEAUTY_TOPICS: Record<string, { subtopics: string[]; keywords: string[] }> = {
  玻尿酸: { subtopics: ["臉部填充","淚溝","蘋果肌","嘴唇豐唇","鼻型雕塑"], keywords: ["玻尿酸","HA填充","微整形","自然美","立即見效"] },
  肉毒桿菌: { subtopics: ["除皺","國字臉瘦臉","抬頭紋","眉間紋","魚尾紋"], keywords: ["肉毒桿菌","Botox","除皺針","瘦臉針","不動聲色美"] },
  雷射療程: { subtopics: ["皮秒雷射","飛梭雷射","淨膚雷射","脈衝光","CO2雷射"], keywords: ["雷射","斑點","膚質提升","痘疤","嫩白"] },
  水光針: { subtopics: ["全臉補水","頸部保養","手部嫩白","私密保養"], keywords: ["水光針","深層補水","玻璃肌","光澤感","肌膚回春"] },
  埋線拉提: { subtopics: ["臉部拉提","頸部緊緻","眉尾拉提","蘋果肌重塑"], keywords: ["埋線","拉提","緊緻","不老神器","童顏密碼"] },
  醫美保養: { subtopics: ["術後保養","防曬重要性","醫美前後注意事項","保養品推薦"], keywords: ["醫美保養","術後照護","醫美小知識","保養秘訣","護膚心得"] },
  體雕塑身: { subtopics: ["冷凍溶脂","音波拉皮","海芙超音波","立塑"], keywords: ["體雕","溶脂","緊緻曲線","身材管理","非侵入式"] },
  植髮生髮: { subtopics: ["FUE植髮","PRP生長因子","髮際線調整","禿頭改善"], keywords: ["植髮","生髮","髮量","自信再現","頭皮健康"] },
};

const POST_FORMATS = ["知識分享","Q&A問答","迷思破解","選擇指南","心得分享","限時優惠","季節話題","前後對比"];

const CTA_TEMPLATES = [
  "✨ 想了解更多？來 己美社群 和千位美麗夥伴一起交流！\n👉 https://self.com.tw\n💬 加入 BeVenus：https://m.facebook.com/groups/bevenus",
  "💡 有任何醫美疑問？免費諮詢、真實評價都在這裡！\n🔗 己美 self.com.tw\n👥 BeVenus 社群：https://m.facebook.com/groups/bevenus",
  "🌸 美麗不孤單！加入醫美社群，分享你的蛻變故事\n✅ 己美 self.com.tw\n💄 加入 BeVenus：https://m.facebook.com/groups/bevenus",
  "📌 收藏這篇！更多醫美乾貨在 己美\n🏆 台灣醫美首選：https://self.com.tw\n🤝 BeVenus 等你：https://m.facebook.com/groups/bevenus",
  "💎 醫美前一定要看這個！\n🔍 搜尋醫師評價就上 https://self.com.tw\n👩‍👧‍👦 加入姐妹圈：https://m.facebook.com/groups/bevenus",
];

const VIRAL_HOOKS = [
  "你知道嗎？90% 的人做完這個療程都後悔沒早點做！",
  "醫美諮詢師不告訴你的 5 件事 🚨",
  "花了冤枉錢嗎？選對療程前必看清單 ✅",
  "這個迷思害了多少人！醫美真相大公開 👀",
  "2025 最熱門療程排行榜出爐！",
];

const WEEKLY_SCHEDULE: Record<number, { theme: string; format: string; tone: string }> = {
  0: { theme: "玻尿酸", format: "知識分享", tone: "專業教育" },
  1: { theme: "雷射療程", format: "Q&A問答", tone: "親切解答" },
  2: { theme: "肉毒桿菌", format: "迷思破解", tone: "專業破解" },
  3: { theme: "埋線拉提", format: "選擇指南", tone: "決策輔助" },
  4: { theme: "水光針", format: "心得分享", tone: "真實口碑" },
  5: { theme: "體雕塑身", format: "前後對比", tone: "視覺震撼" },
  6: { theme: "醫美保養", format: "季節話題", tone: "輕鬆互動" },
};

// ── 工具函數 ────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildSinglePrompt(topic: string, subtopic: string, format: string, tone: string, customNotes: string): string {
  const topicInfo = BEAUTY_TOPICS[topic] ?? { keywords: [] };
  const keywords = topicInfo.keywords.join("、");
  const hook = pick(VIRAL_HOOKS);
  return `你是台灣頂尖的醫美社群行銷專家，為「己美 self.com.tw」和「BeVenus 醫美社群」創作高互動率 Threads 貼文。

主題：${topic} → 子主題：${subtopic}
發文格式：${format}
語氣風格：${tone}
開頭鉤子：${hook}
關鍵字：${keywords}
${customNotes ? `特別備註：${customNotes}` : ""}

【合規鐵律】輸出不得含：治療/修復/再生/消炎/根治/永久有效/保證/無副作用/100%有效

請生成一篇爆紅 Threads 貼文，輸出 JSON（只輸出 JSON，不要其他說明）：
{
  "title": "吸睛開頭10-20字",
  "body": "300-500字正文，含emoji段落分明",
  "hashtags": ["#...", "#...", ...8-12個],
  "cta": "導流到 self.com.tw 及 BeVenus 的行動呼籲",
  "engagement_question": "鼓勵留言互動的問句",
  "topic": "${topic}",
  "format": "${format}",
  "estimated_reach": "預估觸及說明",
  "best_post_time": "建議發文時間"
}`;
}

async function callClaude(prompt: string): Promise<string> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const res = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.content?.[0]?.text ?? "";
}

function parseJSON(raw: string): unknown {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) cleaned = cleaned.split("\n").slice(1).join("\n");
  if (cleaned.endsWith("```")) cleaned = cleaned.split("\n").slice(0, -1).join("\n");
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) return JSON.parse(match[0]);
  return JSON.parse(cleaned.trim());
}

function fallbackPost(topic: string, format: string): object {
  return {
    title: `關於 ${topic}，你一定要知道的事！`,
    body: `📌 今天聊聊 ${topic} 的重要知識。\n\n在台灣，${topic} 是非常受歡迎的醫美療程之一，選擇合適的診所和醫師非常重要。\n\n💡 選擇重點：\n✅ 確認醫師資歷\n✅ 了解療程原理\n✅ 術前術後注意事項\n\n🌸 做好準備才能得到最好的效果！`,
    hashtags: ["#醫美", "#台灣醫美", "#醫美日記", `#${topic}`, "#自信美麗"],
    cta: pick(CTA_TEMPLATES),
    engagement_question: "你做過這個療程嗎？留言分享你的心得！💬",
    topic,
    format,
    estimated_reach: "視帳號粉絲基礎而定",
    best_post_time: "晚上 8:00-10:00",
  };
}

// ── CORS ────────────────────────────────────────

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

// ── 主要處理器 ──────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const body = await req.json();
    const action: string = body.action ?? "single";

    if (action === "single") {
      const topics = Object.keys(BEAUTY_TOPICS);
      const topic: string = body.topic && topics.includes(body.topic) ? body.topic : pick(topics);
      const topicInfo = BEAUTY_TOPICS[topic];
      const subtopic: string = body.subtopic || pick(topicInfo.subtopics);
      const format: string = body.post_format || pick(POST_FORMATS);
      const tone: string = body.tone || "親切專業，口語化";
      const customNotes: string = body.custom_notes ?? "";

      const prompt = buildSinglePrompt(topic, subtopic, format, tone, customNotes);
      let post: unknown;
      try {
        const raw = await callClaude(prompt);
        post = parseJSON(raw);
      } catch {
        post = fallbackPost(topic, format);
      }

      const p = post as Record<string, unknown>;
      if (!p.cta) p.cta = pick(CTA_TEMPLATES);

      return new Response(JSON.stringify({ post }), {
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    if (action === "weekly") {
      const weekOffset: number = body.week_offset ?? 0;
      const now = new Date();
      now.setDate(now.getDate() + weekOffset * 7);
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (weekStart.getDay() === 0 ? 6 : weekStart.getDay() - 1));

      // Parallel generation — all 7 days at once, ~5s instead of ~35s
      const posts = await Promise.all(
        Array.from({ length: 7 }, async (_, day) => {
          const plan = WEEKLY_SCHEDULE[day];
          const topicInfo = BEAUTY_TOPICS[plan.theme] ?? { subtopics: [plan.theme], keywords: [] };
          const subtopic = pick(topicInfo.subtopics);
          const prompt = buildSinglePrompt(plan.theme, subtopic, plan.format, plan.tone, "");
          const date = new Date(weekStart);
          date.setDate(date.getDate() + day);
          const scheduled_date = date.toISOString().slice(0, 10);
          try {
            const raw = await callClaude(prompt);
            const p = parseJSON(raw) as Record<string, unknown>;
            if (!p.cta) p.cta = pick(CTA_TEMPLATES);
            p.scheduled_date = scheduled_date;
            return p;
          } catch {
            return { ...fallbackPost(plan.theme, plan.format), scheduled_date };
          }
        }),
      );

      return new Response(
        JSON.stringify({ posts, week_summary: "本週涵蓋7大醫美主題，全面覆蓋用戶興趣。" }),
        { headers: { "Content-Type": "application/json", ...CORS } },
      );
    }

    if (action === "series") {
      const topic: string = body.topic ?? pick(Object.keys(BEAUTY_TOPICS));
      const count: number = Math.min(body.count ?? 3, 5);
      const topicInfo = BEAUTY_TOPICS[topic] ?? { subtopics: [topic], keywords: [] };
      const posts: unknown[] = [];

      for (let i = 0; i < count; i++) {
        const subtopic = topicInfo.subtopics[i % topicInfo.subtopics.length];
        const format = POST_FORMATS[i % POST_FORMATS.length];
        const prompt = buildSinglePrompt(topic, subtopic, format, "親切專業", "");
        try {
          const raw = await callClaude(prompt);
          const p = parseJSON(raw) as Record<string, unknown>;
          if (!p.cta) p.cta = pick(CTA_TEMPLATES);
          posts.push(p);
        } catch {
          posts.push(fallbackPost(topic, format));
        }
      }

      return new Response(JSON.stringify({ posts }), {
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  } catch (err: unknown) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }
});
