# Copyright (C) 2025 AIDC-AI
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#     http://www.apache.org/licenses/LICENSE-2.0

"""
BeautyBot Page - 醫美版 Threads 自動發文機器人

幫助醫美品牌/個人在 Threads 上持續發文、增粉、導流到
己美 self.com.tw 及 BeVenus 醫美社群。
"""

import sys
from pathlib import Path

_script_dir = Path(__file__).resolve().parent
_project_root = _script_dir.parent.parent
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))

import json
from datetime import datetime, timedelta

import streamlit as st
from loguru import logger

from web.state.session import init_session_state, init_i18n, get_pixelle_video
from web.utils.async_helpers import run_async
from web.pipelines.beauty_bot import (
    BeautyBotPipeline,
    BEAUTY_TOPICS,
    POST_FORMATS,
    WEEKLY_SCHEDULE,
    CTA_TEMPLATES,
)
from web.pipelines.threads_publisher import (
    ThreadsPublisher,
    ThreadsCredentials,
    load_credentials,
    save_credentials,
    clear_credentials,
    load_post_history,
    count_posts_today,
    DAILY_POST_LIMIT,
)

st.set_page_config(
    page_title="BeautyBot 醫美發文機器人 - Pixelle",
    page_icon="💄",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# ─────────────────────────────────────────────
# 全域樣式
# ─────────────────────────────────────────────
STYLE = """
<style>
.beauty-hero {
    background: linear-gradient(135deg, #f8bbd9 0%, #e1bee7 40%, #bbdefb 100%);
    border-radius: 16px;
    padding: 2rem 2.5rem;
    margin-bottom: 1.5rem;
    text-align: center;
}
.beauty-hero h1 { font-size: 2rem; margin: 0 0 .5rem; color: #4a148c; }
.beauty-hero p  { font-size: 1rem; color: #555; margin: 0; }
.post-card {
    background: #fff;
    border: 1px solid #f0e6f6;
    border-radius: 12px;
    padding: 1.25rem 1.5rem;
    margin-bottom: 1rem;
    box-shadow: 0 2px 8px rgba(156,39,176,.08);
}
.post-card .post-title { font-size: 1.1rem; font-weight: 700; color: #6a1b9a; margin-bottom: .5rem; }
.tag-chip {
    display: inline-block;
    background: #f3e5f5;
    color: #7b1fa2;
    border-radius: 20px;
    padding: 2px 10px;
    font-size: .78rem;
    margin: 2px;
}
.cta-box {
    background: linear-gradient(90deg, #e8f5e9, #e3f2fd);
    border-left: 4px solid #66bb6a;
    border-radius: 8px;
    padding: .75rem 1rem;
    font-size: .9rem;
    margin-top: .75rem;
}
.metric-pill {
    background: #ede7f6;
    border-radius: 20px;
    padding: 4px 12px;
    font-size: .8rem;
    color: #512da8;
    margin-right: .5rem;
}
.schedule-row { border-bottom: 1px solid #f3e5f5; padding: .5rem 0; }
</style>
"""


# ─────────────────────────────────────────────
# 工具函數
# ─────────────────────────────────────────────

def get_bot(pixelle_video) -> BeautyBotPipeline:
    if "beauty_bot" not in st.session_state:
        st.session_state.beauty_bot = BeautyBotPipeline(pixelle_video.llm)
    return st.session_state.beauty_bot


def get_publisher() -> ThreadsPublisher:
    """取得（或重建）ThreadsPublisher 實例"""
    creds = load_credentials()
    return ThreadsPublisher(creds)


def threads_connected() -> bool:
    """快速判斷是否已設定 Threads 憑證"""
    return load_credentials().is_valid


def render_publish_button(post: dict, key_suffix: str):
    """在貼文卡片底部渲染「直接發文到 Threads」按鈕"""
    bot = st.session_state.get("beauty_bot")
    if not bot:
        return

    connected = threads_connected()
    today_count = count_posts_today()
    remaining = DAILY_POST_LIMIT - today_count

    col_btn, col_stat = st.columns([2, 1])
    with col_stat:
        if connected:
            st.caption(f"📊 今日已發 {today_count} 篇 · 剩餘 {remaining} 篇")
        else:
            st.caption("⚠️ 尚未連接 Threads")

    with col_btn:
        disabled = not connected or remaining <= 0
        label = "🚀 直接發文到 Threads" if connected else "🔗 請先設定 Threads 帳號"
        if st.button(label, key=f"publish_{key_suffix}", disabled=disabled, use_container_width=True):
            publisher = get_publisher()
            with st.spinner("發文中... ⏳"):
                result = publisher.publish_post_dict(post, bot.format_post_for_display)
            if result.success:
                st.success(f"✅ 發文成功！貼文 ID：`{result.post_id}`")
                st.markdown(f"[🔗 查看貼文]({result.url})", unsafe_allow_html=False)
            else:
                st.error(f"❌ 發文失敗：{result.error}")


def render_post_card(post: dict, index: int = 0, show_copy: bool = True):
    """渲染單篇貼文卡片"""
    bot = st.session_state.get("beauty_bot")

    with st.container():
        st.markdown(f'<div class="post-card">', unsafe_allow_html=True)

        # 頂部 meta
        col_meta1, col_meta2, col_meta3 = st.columns(3)
        with col_meta1:
            st.markdown(f'<span class="metric-pill">🏷️ {post.get("topic","—")}</span>'
                        f'<span class="metric-pill">📋 {post.get("format","—")}</span>',
                        unsafe_allow_html=True)
        with col_meta2:
            st.markdown(f'<span class="metric-pill">⏰ {post.get("best_post_time","—")}</span>',
                        unsafe_allow_html=True)
        with col_meta3:
            st.markdown(f'<span class="metric-pill">📈 {post.get("estimated_reach","—")}</span>',
                        unsafe_allow_html=True)

        st.markdown("---")

        # 標題
        st.markdown(f'<div class="post-title">💬 {post.get("title","")}</div>',
                    unsafe_allow_html=True)

        # 正文
        st.markdown(post.get("body", ""), unsafe_allow_html=False)

        # 互動問題
        if post.get("engagement_question"):
            st.info(f"💡 {post['engagement_question']}")

        # Hashtags
        if post.get("hashtags"):
            tags_html = "".join(
                f'<span class="tag-chip">{t}</span>' for t in post["hashtags"]
            )
            st.markdown(tags_html, unsafe_allow_html=True)

        # CTA
        if post.get("cta"):
            st.markdown(f'<div class="cta-box">{post["cta"]}</div>',
                        unsafe_allow_html=True)

        st.markdown("</div>", unsafe_allow_html=True)

        # 複製全文 + 直接發文
        if show_copy and bot:
            full_text = bot.format_post_for_display(post)
            st.text_area(
                "📋 複製全文",
                value=full_text,
                height=200,
                key=f"copy_post_{index}_{id(post)}",
            )

        # 直接發文到 Threads
        render_publish_button(post, key_suffix=f"{index}_{id(post)}")


# ─────────────────────────────────────────────
# 頁面各分頁
# ─────────────────────────────────────────────

def tab_single(pixelle_video):
    """單篇貼文生成"""
    st.subheader("🖊️ 快速生成單篇貼文")
    st.caption("選擇主題和格式，AI 幫你寫出高互動率的 Threads 貼文")

    bot = get_bot(pixelle_video)
    today_theme = bot.get_today_theme()

    with st.form("single_post_form"):
        col1, col2 = st.columns(2)
        with col1:
            topics = bot.get_all_topics()
            default_idx = topics.index(today_theme["theme"]) if today_theme["theme"] in topics else 0
            topic = st.selectbox("📌 主題分類", topics, index=default_idx)

            subtopics = bot.get_subtopics(topic)
            subtopic = st.selectbox("🔍 子主題", ["（AI自動選擇）"] + subtopics)
            if subtopic == "（AI自動選擇）":
                subtopic = ""

        with col2:
            formats = list(POST_FORMATS.keys())
            default_fmt_idx = formats.index(today_theme["format"]) if today_theme["format"] in formats else 0
            post_format = st.selectbox(
                "📝 發文格式",
                formats,
                index=default_fmt_idx,
                help="\n".join(f"**{k}**：{v}" for k, v in POST_FORMATS.items()),
            )
            tone = st.text_input("🎨 語氣風格", value=today_theme.get("tone", "親切專業，口語化"))

        custom_notes = st.text_area(
            "💭 特別備註（選填）",
            placeholder="例：近期有玻尿酸優惠活動，請在貼文中自然提及...",
            height=80,
        )

        submitted = st.form_submit_button("✨ 生成貼文", type="primary", use_container_width=True)

    if submitted:
        with st.spinner("AI 正在創作專屬貼文... ✍️"):
            try:
                post = run_async(
                    bot.generate_single_post(
                        topic=topic,
                        subtopic=subtopic,
                        post_format=post_format,
                        tone=tone,
                        custom_notes=custom_notes,
                    )
                )
                st.session_state.last_single_post = post
                st.success("✅ 貼文生成完成！")
            except Exception as e:
                st.error(f"生成失敗：{e}")
                logger.exception("BeautyBot single post generation failed")

    if "last_single_post" in st.session_state:
        render_post_card(st.session_state.last_single_post, index=0)


def tab_weekly(pixelle_video):
    """一週發文計畫"""
    st.subheader("📅 一週發文計畫")
    st.caption("一鍵生成 7 篇涵蓋不同主題的發文，每天都有話題！")

    bot = get_bot(pixelle_video)

    # 顯示預設排程
    st.markdown("##### 📋 本週主題排程預覽")
    week_start = datetime.now() - timedelta(days=datetime.now().weekday())
    cols = st.columns(7)
    day_names = "一二三四五六日"
    for i, (day, plan) in enumerate(WEEKLY_SCHEDULE.items()):
        date = week_start + timedelta(days=day)
        with cols[i]:
            is_today = date.date() == datetime.now().date()
            border = "border: 2px solid #9c27b0;" if is_today else ""
            today_marker = '<div style="font-size:.7rem;color:#e91e63;">今天</div>' if is_today else ""
            st.markdown(
                f'<div style="background:#f8f0fd;border-radius:8px;padding:.5rem;text-align:center;{border}">'
                f'<div style="font-size:.75rem;color:#888;">週{day_names[i]}</div>'
                f'<div style="font-size:.8rem;font-weight:700;color:#6a1b9a;">{date.strftime("%m/%d")}</div>'
                f'<div style="font-size:.75rem;">{plan["theme"]}</div>'
                f'<div style="font-size:.7rem;color:#aaa;">{plan["format"]}</div>'
                f'{today_marker}'
                f"</div>",
                unsafe_allow_html=True,
            )

    st.divider()

    col_btn, col_opt = st.columns([2, 1])
    with col_opt:
        week_offset = st.number_input("偏移週數（0=本週）", min_value=0, max_value=4, value=0)
    with col_btn:
        generate_weekly = st.button(
            "🚀 生成本週 7 篇貼文", type="primary", use_container_width=True
        )

    if generate_weekly:
        with st.spinner("AI 正在規劃整週內容... 需要約 30-60 秒 ⏳"):
            try:
                plan = run_async(bot.generate_weekly_plan(week_offset=week_offset))
                st.session_state.weekly_plan = plan
                st.success(f"✅ 成功生成 {len(plan.get('posts', []))} 篇貼文！")
            except Exception as e:
                st.error(f"生成失敗：{e}")
                logger.exception("BeautyBot weekly plan generation failed")

    if "weekly_plan" in st.session_state:
        plan = st.session_state.weekly_plan

        if plan.get("week_summary"):
            st.info(f"📊 **本週策略摘要**：{plan['week_summary']}")

        posts = plan.get("posts", [])
        for i, post in enumerate(posts):
            day_label = f"週{'一二三四五六日'[i % 7]}" if i < 7 else f"第 {i+1} 篇"
            with st.expander(f"📌 {day_label} — {post.get('title', '未命名')[:40]}", expanded=(i == 0)):
                render_post_card(post, index=i + 100)

        # 匯出為純文字
        if posts:
            all_text = []
            for i, post in enumerate(posts):
                all_text.append(f"=== 第 {i+1} 篇 ({post.get('topic','')}/{post.get('format','')}) ===")
                bot_inst = get_bot(pixelle_video)
                all_text.append(bot_inst.format_post_for_display(post))
                all_text.append("")

            st.download_button(
                "💾 下載全週貼文（TXT）",
                data="\n".join(all_text),
                file_name=f"beauty_posts_{datetime.now().strftime('%Y%m%d')}.txt",
                mime="text/plain",
                use_container_width=True,
            )


def tab_series(pixelle_video):
    """主題系列貼文"""
    st.subheader("🎯 主題系列貼文")
    st.caption("針對單一主題深度耕耘，建立帳號主題性")

    bot = get_bot(pixelle_video)

    with st.form("series_form"):
        col1, col2 = st.columns(2)
        with col1:
            topic = st.selectbox("主題", list(BEAUTY_TOPICS.keys()))
        with col2:
            count = st.slider("生成篇數", min_value=2, max_value=5, value=3)

        submitted = st.form_submit_button("🎯 生成系列貼文", type="primary", use_container_width=True)

    if submitted:
        with st.spinner(f"生成 {count} 篇 {topic} 系列貼文..."):
            try:
                posts = run_async(bot.generate_topic_series(topic=topic, count=count))
                st.session_state.series_posts = posts
                st.success(f"✅ 已生成 {len(posts)} 篇 {topic} 系列貼文！")
            except Exception as e:
                st.error(f"生成失敗：{e}")

    if "series_posts" in st.session_state:
        for i, post in enumerate(st.session_state.series_posts):
            with st.expander(f"第 {i+1} 篇：{post.get('title','')[:40]}", expanded=(i == 0)):
                render_post_card(post, index=i + 200)


def tab_strategy(pixelle_video):
    """流量策略與增粉技巧"""
    st.subheader("📈 增粉 & 導流策略指南")

    col1, col2 = st.columns(2)

    with col1:
        st.markdown("#### 🔥 Threads 醫美帳號增粉策略")
        strategies = [
            ("⏰ **最佳發文時段**", "早上 7-9 點、中午 12-13 點、晚上 8-10 點"),
            ("📊 **發文頻率**", "每天 1-2 篇，保持穩定節奏"),
            ("🎯 **內容比例**", "60% 知識科普 + 30% 互動話題 + 10% 優惠推廣"),
            ("🔗 **Hashtag 策略**", "3-5 個大眾標籤 + 5-7 個利基標籤，每篇不超過 12 個"),
            ("💬 **互動技巧**", "前 30 分鐘主動回覆留言，提升演算法排名"),
            ("🤝 **跨平台導流**", "Threads 內容精選發至 Facebook BeVenus 社群"),
            ("📱 **限時動態搭配**", "Threads 貼文發布後同步更新 IG Stories"),
            ("🌟 **UGC 激勵**", "鼓勵用戶在己美平台留下評價並分享至 Threads"),
        ]
        for title, desc in strategies:
            with st.container():
                st.markdown(f"{title}")
                st.caption(desc)

    with col2:
        st.markdown("#### 🎯 導流到己美 & BeVenus")
        st.markdown(
            """
**📌 己美 self.com.tw 導流方法**
- 每篇貼文結尾放置 self.com.tw 連結
- 提及「在己美查詢真實評價」作為信任背書
- 使用「己美推薦」作為帳號標籤
- 故事型貼文：分享在己美找到好醫師的經歷

**👥 BeVenus 醫美社群導流方法**
- 邀請讀者「加入 BeVenus，與萬人一起交流」
- 每週一篇「社群精選話題」從 BeVenus 取材再發布
- 舉辦「在 BeVenus 發文參加抽獎」活動
- 使用 Facebook 社群連結在貼文底部固定曝光
"""
        )

    st.divider()
    st.markdown("#### 📊 內容日曆規劃建議")

    calendar_data = []
    week_start = datetime.now() - timedelta(days=datetime.now().weekday())
    day_names = "一二三四五六日"
    for i in range(14):  # 兩週
        date = week_start + timedelta(days=i)
        plan = WEEKLY_SCHEDULE.get(i % 7, WEEKLY_SCHEDULE[0])
        calendar_data.append(
            {
                "日期": date.strftime("%m/%d"),
                "星期": f"週{day_names[i % 7]}",
                "主題": plan["theme"],
                "格式": plan["format"],
                "語氣": plan["tone"],
                "導流目標": "self.com.tw + BeVenus",
            }
        )

    import pandas as pd
    df = pd.DataFrame(calendar_data)
    st.dataframe(df, use_container_width=True, hide_index=True)


def tab_threads(pixelle_video):
    """Threads 帳號串接與發文歷史"""
    st.subheader("🔗 Threads 帳號串接")

    creds = load_credentials()

    # ── 連線狀態 ────────────────────────────────
    if creds.is_valid:
        today_count = count_posts_today()
        remaining = DAILY_POST_LIMIT - today_count
        conn_col1, conn_col2, conn_col3 = st.columns(3)
        with conn_col1:
            st.metric("帳號", f"@{creds.username}" if creds.username else creds.user_id)
        with conn_col2:
            st.metric("今日已發", f"{today_count} 篇")
        with conn_col3:
            st.metric("今日剩餘", f"{remaining} 篇")
        st.success("✅ Threads 帳號已連接，可直接發文！")
    else:
        st.warning("⚠️ 尚未連接 Threads 帳號。請依照下方步驟取得 Access Token 後輸入。")

    st.divider()

    # ── 設定表單 ────────────────────────────────
    with st.expander("🔑 設定 Threads Access Token", expanded=not creds.is_valid):
        st.markdown("""
**如何取得 Threads Access Token？**

1. 前往 [Meta for Developers](https://developers.facebook.com/) 建立 App
2. 新增 **Threads API** 產品
3. 在 Threads API → Graph API Explorer 產生 **User Access Token**
   - 需勾選權限：`threads_basic`、`threads_content_publish`
4. 建議使用 [長期 Token 工具](https://developers.facebook.com/tools/explorer/) 延長至 60 天
5. 複製 Token 貼入下方
""")

        with st.form("threads_creds_form"):
            new_token = st.text_input(
                "Access Token",
                value=creds.access_token,
                type="password",
                placeholder="貼入你的 Threads Access Token...",
            )
            submitted = st.form_submit_button("💾 儲存並驗證", type="primary", use_container_width=True)

        if submitted and new_token.strip():
            test_creds = ThreadsCredentials(access_token=new_token.strip())
            publisher = ThreadsPublisher(test_creds)
            with st.spinner("驗證 Token 中..."):
                result = publisher.verify_token()
            if result["ok"]:
                test_creds.user_id = result["user_id"]
                test_creds.username = result["username"]
                save_credentials(test_creds)
                st.success(f"✅ 驗證成功！帳號：@{result['username']} (ID: {result['user_id']})")
                st.rerun()
            else:
                st.error(f"❌ 驗證失敗：{result['error']}")

        if creds.is_valid:
            if st.button("🗑️ 清除憑證", use_container_width=True):
                clear_credentials()
                st.rerun()

    st.divider()

    # ── 快速測試發文 ─────────────────────────────
    if creds.is_valid:
        with st.expander("🧪 測試發文", expanded=False):
            st.caption("發一則測試貼文確認串接正常（會真實發出到你的 Threads 帳號）")
            test_text = st.text_area(
                "測試貼文內容",
                value="🌸 BeautyBot 測試發文 — 醫美資訊自動化上線！\n\n更多醫美資訊 👉 https://self.com.tw",
                height=100,
            )
            if st.button("📤 發送測試貼文", type="secondary"):
                publisher = get_publisher()
                with st.spinner("發文中..."):
                    result = publisher.publish_text(test_text)
                if result.success:
                    st.success(f"✅ 測試成功！貼文 ID：`{result.post_id}`")
                    st.markdown(f"[🔗 查看貼文]({result.url})")
                else:
                    st.error(f"❌ 失敗：{result.error}")

    st.divider()

    # ── 發文歷史 ─────────────────────────────────
    st.markdown("#### 📋 發文歷史（最近 20 筆）")
    history = load_post_history()
    if not history:
        st.info("尚無發文記錄")
    else:
        import pandas as pd
        rows = []
        for h in history[:20]:
            rows.append({
                "時間": h.published_at[:16].replace("T", " "),
                "標題": h.title[:30],
                "主題": h.topic,
                "狀態": "✅ 成功" if h.success else f"❌ {h.error[:20]}",
                "貼文 ID": h.post_id or "-",
            })
        st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)


def tab_settings(pixelle_video):
    """機器人設定"""
    st.subheader("⚙️ 機器人設定")

    with st.expander("🔗 導流連結設定", expanded=True):
        col1, col2 = st.columns(2)
        with col1:
            st.text_input("己美官網", value="https://self.com.tw", disabled=True)
        with col2:
            st.text_input("BeVenus 社群", value="https://m.facebook.com/groups/bevenus", disabled=True)
        st.caption("如需修改導流連結，請聯絡管理員更新 beauty_bot.py 中的 CTA_TEMPLATES")

    with st.expander("📝 CTA 模板預覽", expanded=False):
        for i, cta in enumerate(CTA_TEMPLATES):
            st.markdown(f"**模板 {i+1}：**")
            st.code(cta, language=None)

    with st.expander("🗓️ 週排程設定", expanded=False):
        st.caption("目前採用固定週輪播主題排程（週一至週日）")
        day_names = "一二三四五六日"
        for day, plan in WEEKLY_SCHEDULE.items():
            st.markdown(
                f"- **週{day_names[day]}**：{plan['theme']} × {plan['format']} — {plan['tone']}"
            )

    with st.expander("📖 使用說明", expanded=False):
        st.markdown(
            """
### 如何使用 BeautyBot？

1. **快速生成** — 選主題 → 點生成 → 複製或直接發文到 Threads
2. **週計畫** — 一次生成 7 篇，批量備稿或逐篇發布
3. **系列貼文** — 深耕單一主題，建立帳號定位
4. **策略指南** — 學習增粉技巧和導流方法
5. **Threads 串接** — 設定 Access Token 後可一鍵直接發文

### 直接發文流程

```
設定 → 輸入 Threads Access Token → 驗證成功
  ↓
快速生成 → AI 生成貼文 → 點「直接發文到 Threads」
  ↓
Threads 帳號自動發出貼文 ✅
```

### 注意事項
- 生成的內容僅供參考，請根據實際情況調整
- 醫療資訊請務必由專業醫師確認後再發布
- Threads Access Token 儲存在本機，不會上傳至任何伺服器
- Threads 每 24 小時最多發 250 篇
"""
        )


# ─────────────────────────────────────────────
# 主頁面
# ─────────────────────────────────────────────

def main():
    init_session_state()
    init_i18n()

    st.markdown(STYLE, unsafe_allow_html=True)

    # Hero Banner
    st.markdown(
        """
<div class="beauty-hero">
  <h1>💄 BeautyBot 醫美發文機器人</h1>
  <p>AI 自動生成高互動率 Threads 貼文 · 增粉導流 · 連結己美 self.com.tw 及 BeVenus 醫美社群</p>
</div>
""",
        unsafe_allow_html=True,
    )

    # Threads 連線狀態橫幅
    if threads_connected():
        creds = load_credentials()
        today_count = count_posts_today()
        st.success(
            f"🔗 Threads 已連線 @{creds.username or creds.user_id} · "
            f"今日已發 {today_count}/{DAILY_POST_LIMIT} 篇",
        )
    else:
        st.info("💡 尚未連接 Threads 帳號，前往「🔗 Threads 串接」分頁完成設定後即可直接發文。")

    # 今日主題提示
    from web.pipelines.beauty_bot import BeautyBotPipeline, WEEKLY_SCHEDULE
    today_weekday = datetime.now().weekday()
    today_plan = WEEKLY_SCHEDULE.get(today_weekday, WEEKLY_SCHEDULE[0])
    day_names = "一二三四五六日"
    st.info(
        f"📅 今天是週{day_names[today_weekday]}，建議主題：**{today_plan['theme']}** × **{today_plan['format']}** （{today_plan['tone']}）"
    )

    # 確認 LLM 已設定
    from pixelle_video.config import config_manager
    if not config_manager.validate():
        st.warning(
            "⚠️ 尚未設定 LLM 服務，請先至「Home」頁面完成設定，才能使用 AI 生成功能。"
        )
        st.stop()

    pixelle_video = get_pixelle_video()

    # 分頁
    tab1, tab2, tab3, tab4, tab5, tab6 = st.tabs(
        ["🖊️ 快速生成", "📅 週計畫", "🎯 系列貼文", "📈 增粉策略", "🔗 Threads 串接", "⚙️ 設定"]
    )

    with tab1:
        tab_single(pixelle_video)
    with tab2:
        tab_weekly(pixelle_video)
    with tab3:
        tab_series(pixelle_video)
    with tab4:
        tab_strategy(pixelle_video)
    with tab5:
        tab_threads(pixelle_video)
    with tab6:
        tab_settings(pixelle_video)

    # Footer
    st.divider()
    st.markdown(
        "<div style='text-align:center;color:#aaa;font-size:.8rem;'>"
        "BeautyBot · 己美 <a href='https://self.com.tw' target='_blank'>self.com.tw</a> · "
        "BeVenus <a href='https://m.facebook.com/groups/bevenus' target='_blank'>Facebook 社群</a>"
        "</div>",
        unsafe_allow_html=True,
    )


if __name__ == "__main__":
    main()
