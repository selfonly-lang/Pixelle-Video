# Copyright (C) 2025 AIDC-AI
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#     http://www.apache.org/licenses/LICENSE-2.0
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
BeautyBot Pipeline - 醫美版 Threads 自動發文機器人

自動生成高互動率醫美主題貼文，導流至己美 self.com.tw 及 BeVenus 社群。
"""

from __future__ import annotations

import json
import random
from datetime import datetime, timedelta
from typing import Any, Optional
from pydantic import BaseModel


# ─────────────────────────────────────────────
# 主題分類 & 內容策略
# ─────────────────────────────────────────────

BEAUTY_TOPICS = {
    "玻尿酸": {
        "subtopics": ["臉部填充", "淚溝", "蘋果肌", "嘴唇豐唇", "鼻型雕塑"],
        "keywords": ["玻尿酸", "HA填充", "微整形", "自然美", "立即見效"],
    },
    "肉毒桿菌": {
        "subtopics": ["除皺", "國字臉瘦臉", "抬頭紋", "眉間紋", "魚尾紋"],
        "keywords": ["肉毒桿菌", "Botox", "除皺針", "瘦臉針", "不動聲色美"],
    },
    "雷射療程": {
        "subtopics": ["皮秒雷射", "飛梭雷射", "淨膚雷射", "脈衝光", "CO2雷射"],
        "keywords": ["雷射", "斑點", "膚質提升", "痘疤", "嫩白"],
    },
    "水光針": {
        "subtopics": ["全臉補水", "頸部保養", "手部嫩白", "私密保養"],
        "keywords": ["水光針", "深層補水", "玻璃肌", "光澤感", "肌膚回春"],
    },
    "埋線拉提": {
        "subtopics": ["臉部拉提", "頸部緊緻", "眉尾拉提", "蘋果肌重塑"],
        "keywords": ["埋線", "拉提", "緊緻", "不老神器", "童顏密碼"],
    },
    "醫美保養": {
        "subtopics": ["術後保養", "防曬重要性", "醫美前後注意事項", "保養品推薦"],
        "keywords": ["醫美保養", "術後照護", "醫美小知識", "保養秘訣", "護膚心得"],
    },
    "體雕塑身": {
        "subtopics": ["冷凍溶脂", "音波拉皮", "海芙超音波", "立塑"],
        "keywords": ["體雕", "溶脂", "緊緻曲線", "身材管理", "非侵入式"],
    },
    "植髮生髮": {
        "subtopics": ["FUE植髮", "PRP生長因子", "髮際線調整", "禿頭改善"],
        "keywords": ["植髮", "生髮", "髮量", "自信再現", "頭皮健康"],
    },
}

POST_FORMATS = {
    "知識分享": "專業科普，建立信任感，軟性導流",
    "Q&A問答": "解答常見疑問，互動率高",
    "前後對比": "視覺衝擊，吸引分享",
    "迷思破解": "打破錯誤觀念，彰顯專業",
    "選擇指南": "幫助讀者決策，提高轉換率",
    "心得分享": "第一人稱口吻，增加真實感",
    "限時優惠": "製造緊迫感，直接導購",
    "季節話題": "結合時事節氣，提升相關性",
}

HASHTAG_POOLS = {
    "通用": [
        "#醫美", "#微整形", "#醫美日記", "#美麗新生活", "#醫美推薦",
        "#台灣醫美", "#醫美保養", "#逆齡計畫", "#美麗從此開始",
        "#醫美知識", "#醫美體驗", "#自信美麗", "#美麗無齡限",
    ],
    "玻尿酸": ["#玻尿酸", "#HA填充", "#微整形", "#水潤肌", "#臉部雕塑"],
    "肉毒桿菌": ["#肉毒桿菌", "#Botox", "#瘦臉針", "#除皺", "#無齡感"],
    "雷射療程": ["#雷射", "#皮秒雷射", "#淨膚雷射", "#美白", "#斑點再見"],
    "水光針": ["#水光針", "#玻璃肌", "#補水", "#光澤肌", "#水嫩"],
    "埋線拉提": ["#埋線拉提", "#緊緻", "#童顏", "#拉提", "#不老秘方"],
    "醫美保養": ["#術後保養", "#醫美日常", "#保養心得", "#護膚", "#肌膚管理"],
    "體雕塑身": ["#體雕", "#溶脂", "#身材管理", "#曲線", "#非侵入式體雕"],
    "植髮生髮": ["#植髮", "#生髮", "#頭皮健康", "#髮量增加", "#自信髮型"],
}

CTA_TEMPLATES = [
    "✨ 想了解更多？來 **己美社群** 和千位美麗夥伴一起交流！\n👉 https://self.com.tw\n💬 加入 BeVenus 醫美版社群：https://m.facebook.com/groups/bevenus",
    "💡 有任何醫美疑問？免費諮詢、真實評價都在這裡！\n🔗 己美 self.com.tw — 台灣最大醫美評價平台\n👥 BeVenus 社群交流：https://m.facebook.com/groups/bevenus",
    "🌸 美麗不孤單！加入我們的醫美社群，分享你的蛻變故事\n✅ 己美 self.com.tw — 好評如潮，值得信賴\n💄 立即加入 BeVenus：https://m.facebook.com/groups/bevenus",
    "📌 收藏這篇！更多醫美乾貨、真實評價在 **己美**\n🏆 台灣醫美首選平台：https://self.com.tw\n🤝 BeVenus 醫美社群等你來：https://m.facebook.com/groups/bevenus",
    "💎 醫美前一定要看這個！\n🔍 搜尋醫師評價、比較療程，就上 己美 self.com.tw\n👩‍👧‍👦 加入姐妹圈 BeVenus：https://m.facebook.com/groups/bevenus",
]

VIRAL_HOOKS = [
    "你知道嗎？90% 的人做完這個療程都後悔沒早點做！",
    "醫美諮詢師不告訴你的 5 件事 🚨",
    "花了冤枉錢嗎？選對療程前必看清單 ✅",
    "這個迷思害了多少人！醫美真相大公開 👀",
    "為什麼素人做出來的效果比明星還自然？秘密在這裡！",
    "2025 最熱門療程排行榜出爐！你猜到第一名是什麼？",
    "做過{topic}的人都說：早知道就該這樣選！",
    "30歲後皮膚開始走下坡？這幾招讓你逆轉時光",
    "醫美小白必看！第一次諮詢前準備好這些問題",
    "為什麼同樣的療程，別人做完像換臉，你卻沒效果？",
]

ENGAGEMENT_QUESTIONS = [
    "你做過這個療程嗎？留言分享你的心得！💬",
    "你最想嘗試哪個部位？投票告訴我 👇",
    "有什麼想問的，都可以在留言區提問！",
    "tag 一個也在考慮這個療程的朋友！",
    "你覺得術前術後差距大嗎？說說你的看法！",
    "這個療程你猜價格是多少？猜猜看 💡",
    "你最擔心醫美的哪個部分？說出來一起討論！",
]

WEEKLY_SCHEDULE = {
    0: {"theme": "玻尿酸", "format": "知識分享", "tone": "專業教育"},      # 週一
    1: {"theme": "雷射療程", "format": "Q&A問答", "tone": "親切解答"},     # 週二
    2: {"theme": "肉毒桿菌", "format": "迷思破解", "tone": "專業破解"},    # 週三
    3: {"theme": "埋線拉提", "format": "選擇指南", "tone": "決策輔助"},    # 週四
    4: {"theme": "水光針", "format": "心得分享", "tone": "真實口碑"},      # 週五
    5: {"theme": "體雕塑身", "format": "前後對比", "tone": "視覺震撼"},    # 週六
    6: {"theme": "醫美保養", "format": "季節話題", "tone": "輕鬆互動"},    # 週日
}


# ─────────────────────────────────────────────
# Pydantic 回應模型
# ─────────────────────────────────────────────

class ThreadsPost(BaseModel):
    title: str
    body: str
    hashtags: list[str]
    cta: str
    engagement_question: str
    topic: str
    format: str
    estimated_reach: str
    best_post_time: str


class PostBatch(BaseModel):
    posts: list[ThreadsPost]
    week_summary: str


# ─────────────────────────────────────────────
# 提示詞生成
# ─────────────────────────────────────────────

def _build_post_prompt(
    topic: str,
    subtopic: str,
    post_format: str,
    tone: str,
    hook: str,
    custom_notes: str = "",
) -> str:
    topic_info = BEAUTY_TOPICS.get(topic, {})
    keywords = ", ".join(topic_info.get("keywords", []))

    return f"""你是台灣頂尖的醫美社群行銷專家，專門為「己美 self.com.tw」和「BeVenus 醫美社群」創作高互動率的 Threads 貼文。

# 任務
為以下主題創作一篇爆紅 Threads 貼文：

- **主題**：{topic} → 子主題：{subtopic}
- **發文格式**：{post_format}
- **語氣風格**：{tone}
- **開頭鉤子**：{hook}
- **關鍵字**：{keywords}
{f"- **特別備註**：{custom_notes}" if custom_notes else ""}

# 貼文要求
1. **標題**（吸睛開頭，勾住讀者，10-20字）
2. **正文**（300-500字，繁體中文，口語化但專業）
   - 段落分明，善用 emoji 增加視覺停頓
   - 包含實用資訊或故事性內容
   - 自然融入「己美 self.com.tw」或「BeVenus」品牌
3. **Hashtag** (8-12個，混合熱門和利基標籤)
4. **行動呼籲 CTA**（導流到 己美 self.com.tw 和 BeVenus 社群）
5. **互動問題**（鼓勵留言互動的問句）

# 輸出格式（JSON）
{{
  "title": "...",
  "body": "...",
  "hashtags": ["#...", "#...", ...],
  "cta": "...",
  "engagement_question": "...",
  "topic": "{topic}",
  "format": "{post_format}",
  "estimated_reach": "預估觸及說明",
  "best_post_time": "建議發文時間"
}}

注意：只輸出 JSON，不要其他說明文字。"""


def _build_weekly_plan_prompt(week_offset: int = 0) -> str:
    start_date = datetime.now() + timedelta(weeks=week_offset)
    week_start = start_date - timedelta(days=start_date.weekday())

    schedule_desc = []
    for day, plan in WEEKLY_SCHEDULE.items():
        date = week_start + timedelta(days=day)
        schedule_desc.append(
            f"- {date.strftime('%m/%d')} 週{'一二三四五六日'[day]}：{plan['theme']} × {plan['format']} ({plan['tone']})"
        )

    return f"""你是台灣醫美社群行銷策略師，為「己美 self.com.tw」規劃一週的 Threads 發文計畫。

# 本週排程
{chr(10).join(schedule_desc)}

# 任務
為每一天生成一篇完整的 Threads 貼文草稿（繁體中文），包含：
1. 吸睛標題
2. 300-400字正文（含emoji、段落分明）
3. 8-10個hashtag
4. 導流CTA到 self.com.tw 和 BeVenus
5. 互動問題

輸出 JSON 陣列，格式如下：
{{
  "posts": [
    {{
      "title": "...",
      "body": "...",
      "hashtags": [...],
      "cta": "...",
      "engagement_question": "...",
      "topic": "...",
      "format": "...",
      "estimated_reach": "...",
      "best_post_time": "..."
    }}
  ],
  "week_summary": "本週內容策略摘要"
}}

只輸出JSON，不要其他說明。"""


# ─────────────────────────────────────────────
# 主要 Pipeline 類別
# ─────────────────────────────────────────────

class BeautyBotPipeline:
    """醫美版 Threads 自動發文機器人核心 Pipeline"""

    def __init__(self, llm_service: Any):
        self.llm = llm_service

    async def generate_single_post(
        self,
        topic: str = "",
        subtopic: str = "",
        post_format: str = "",
        tone: str = "",
        custom_notes: str = "",
    ) -> dict:
        """生成單篇 Threads 貼文"""
        if not topic:
            topic = random.choice(list(BEAUTY_TOPICS.keys()))

        topic_info = BEAUTY_TOPICS.get(topic, {})
        if not subtopic:
            subtopic = random.choice(topic_info.get("subtopics", [topic]))
        if not post_format:
            post_format = random.choice(list(POST_FORMATS.keys()))
        if not tone:
            tone = "親切專業，口語化"

        hook = random.choice(VIRAL_HOOKS).format(topic=topic)

        prompt = _build_post_prompt(topic, subtopic, post_format, tone, hook, custom_notes)

        try:
            raw = await self.llm(prompt, temperature=0.85, max_tokens=1500)
            # 嘗試解析 JSON
            cleaned = raw.strip()
            if cleaned.startswith("```"):
                cleaned = "\n".join(cleaned.split("\n")[1:])
            if cleaned.endswith("```"):
                cleaned = "\n".join(cleaned.split("\n")[:-1])
            data = json.loads(cleaned)
        except (json.JSONDecodeError, Exception):
            # Fallback: 用模板生成
            data = self._fallback_post(topic, subtopic, post_format, hook)

        # 確保 hashtag 包含通用標籤
        if "hashtags" in data:
            base_tags = HASHTAG_POOLS.get("通用", [])[:3]
            topic_tags = HASHTAG_POOLS.get(topic, [])[:3]
            existing = set(data["hashtags"])
            for tag in base_tags + topic_tags:
                if tag not in existing and len(data["hashtags"]) < 12:
                    data["hashtags"].append(tag)

        # 確保有 CTA
        if not data.get("cta"):
            data["cta"] = random.choice(CTA_TEMPLATES)

        return data

    async def generate_weekly_plan(self, week_offset: int = 0) -> dict:
        """生成一週發文計畫（7篇）"""
        prompt = _build_weekly_plan_prompt(week_offset)
        try:
            raw = await self.llm(prompt, temperature=0.8, max_tokens=5000)
            cleaned = raw.strip()
            if cleaned.startswith("```"):
                cleaned = "\n".join(cleaned.split("\n")[1:])
            if cleaned.endswith("```"):
                cleaned = "\n".join(cleaned.split("\n")[:-1])
            data = json.loads(cleaned)
        except (json.JSONDecodeError, Exception):
            data = self._fallback_weekly_plan(week_offset)

        return data

    async def generate_topic_series(self, topic: str, count: int = 5) -> list[dict]:
        """針對特定主題生成系列貼文"""
        posts = []
        formats = list(POST_FORMATS.keys())
        topic_info = BEAUTY_TOPICS.get(topic, {})
        subtopics = topic_info.get("subtopics", [topic] * count)

        for i in range(min(count, len(subtopics))):
            post = await self.generate_single_post(
                topic=topic,
                subtopic=subtopics[i],
                post_format=formats[i % len(formats)],
            )
            posts.append(post)

        return posts

    def get_today_theme(self) -> dict:
        """取得今日建議主題（依星期輪替）"""
        weekday = datetime.now().weekday()
        return WEEKLY_SCHEDULE.get(weekday, WEEKLY_SCHEDULE[0])

    def get_all_topics(self) -> list[str]:
        return list(BEAUTY_TOPICS.keys())

    def get_subtopics(self, topic: str) -> list[str]:
        return BEAUTY_TOPICS.get(topic, {}).get("subtopics", [])

    def get_post_formats(self) -> dict[str, str]:
        return POST_FORMATS

    def format_post_for_display(self, post: dict) -> str:
        """將貼文格式化為可複製的完整文字"""
        lines = []
        if post.get("title"):
            lines.append(post["title"])
            lines.append("")
        if post.get("body"):
            lines.append(post["body"])
            lines.append("")
        if post.get("engagement_question"):
            lines.append(post["engagement_question"])
            lines.append("")
        if post.get("hashtags"):
            lines.append(" ".join(post["hashtags"]))
            lines.append("")
        if post.get("cta"):
            lines.append(post["cta"])
        return "\n".join(lines)

    def _fallback_post(self, topic: str, subtopic: str, post_format: str, hook: str) -> dict:
        """當 LLM 失敗時的備用貼文模板"""
        cta = random.choice(CTA_TEMPLATES)
        eq = random.choice(ENGAGEMENT_QUESTIONS)
        tags = (
            HASHTAG_POOLS.get("通用", [])[:4]
            + HASHTAG_POOLS.get(topic, [])[:4]
        )
        return {
            "title": hook,
            "body": (
                f"📌 關於 {topic} 中的「{subtopic}」，很多人都有疑問。\n\n"
                f"今天我們來聊聊這個話題 ✨\n\n"
                f"在台灣，{subtopic} 是相當受歡迎的醫美療程之一。"
                f"選擇合適的診所和醫師非常重要，建議一定要多做功課、看真實評價。\n\n"
                f"💡 **選擇重點**\n"
                f"✅ 確認醫師資歷與專長\n"
                f"✅ 了解療程原理與效果\n"
                f"✅ 術前術後注意事項\n"
                f"✅ 詢問費用與療程次數\n\n"
                f"🌸 醫美不是一時衝動，做好準備才能得到最好的結果！"
            ),
            "hashtags": tags,
            "cta": cta,
            "engagement_question": eq,
            "topic": topic,
            "format": post_format,
            "estimated_reach": "視帳號基礎粉絲數而定",
            "best_post_time": "晚上 8:00-10:00",
        }

    def _fallback_weekly_plan(self, week_offset: int) -> dict:
        """備用週計畫"""
        start = datetime.now() + timedelta(weeks=week_offset)
        week_start = start - timedelta(days=start.weekday())
        posts = []
        for day, plan in WEEKLY_SCHEDULE.items():
            date = week_start + timedelta(days=day)
            topic = plan["theme"]
            topic_info = BEAUTY_TOPICS.get(topic, {})
            subtopic = random.choice(topic_info.get("subtopics", [topic]))
            hook = random.choice(VIRAL_HOOKS).format(topic=topic)
            posts.append(
                self._fallback_post(topic, subtopic, plan["format"], hook)
                | {"scheduled_date": date.strftime("%Y-%m-%d")}
            )
        return {
            "posts": posts,
            "week_summary": "本週涵蓋玻尿酸、雷射、肉毒、拉提、水光、體雕、保養等七大主題，全面覆蓋醫美用戶興趣點。",
        }
