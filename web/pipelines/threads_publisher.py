# Copyright (C) 2025 AIDC-AI
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#     http://www.apache.org/licenses/LICENSE-2.0

"""
Threads Publisher — Meta Threads API 串接

透過 Meta Threads Graph API 直接發文到 Threads 帳號。

API 流程（文字貼文）：
  Step 1: POST /{user_id}/threads  → 取得 creation_id（container）
  Step 2: POST /{user_id}/threads_publish → 正式發文，取得 post_id

參考：https://developers.facebook.com/docs/threads
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import httpx
from loguru import logger

THREADS_API_BASE = "https://graph.threads.net/v1.0"

# Threads 官方限制：每 24 小時最多 250 篇
DAILY_POST_LIMIT = 250
# 每次發文後最少等待秒數（避免觸發 spam 偵測）
MIN_POST_INTERVAL_SECONDS = 10

# 憑證儲存路徑（~/.pixelle/threads_creds.json）
_CREDS_PATH = Path.home() / ".pixelle" / "threads_creds.json"


# ─────────────────────────────────────────────
# 資料結構
# ─────────────────────────────────────────────

@dataclass
class ThreadsCredentials:
    access_token: str = ""
    user_id: str = ""           # Threads user ID（數字字串）
    username: str = ""          # @username（顯示用）
    token_expires_at: str = ""  # ISO 格式到期時間

    @property
    def is_valid(self) -> bool:
        return bool(self.access_token and self.user_id)

    def to_dict(self) -> dict:
        return {
            "access_token": self.access_token,
            "user_id": self.user_id,
            "username": self.username,
            "token_expires_at": self.token_expires_at,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "ThreadsCredentials":
        return cls(**{k: d.get(k, "") for k in ["access_token", "user_id", "username", "token_expires_at"]})


@dataclass
class PostResult:
    success: bool
    post_id: str = ""
    error: str = ""
    published_at: str = field(default_factory=lambda: datetime.now().isoformat())
    permalink: str = ""

    @property
    def url(self) -> str:
        if self.post_id:
            return f"https://www.threads.net/post/{self.post_id}"
        return ""


@dataclass
class PostHistoryItem:
    post_id: str
    title: str
    topic: str
    published_at: str
    success: bool
    error: str = ""


# ─────────────────────────────────────────────
# 憑證儲存
# ─────────────────────────────────────────────

def load_credentials() -> ThreadsCredentials:
    """從本機讀取 Threads 憑證"""
    try:
        if _CREDS_PATH.exists():
            data = json.loads(_CREDS_PATH.read_text(encoding="utf-8"))
            return ThreadsCredentials.from_dict(data)
    except Exception as e:
        logger.warning(f"Failed to load Threads credentials: {e}")
    return ThreadsCredentials()


def save_credentials(creds: ThreadsCredentials) -> None:
    """儲存 Threads 憑證到本機"""
    try:
        _CREDS_PATH.parent.mkdir(parents=True, exist_ok=True)
        _CREDS_PATH.write_text(
            json.dumps(creds.to_dict(), ensure_ascii=False, indent=2),
            encoding="utf-8"
        )
        logger.info(f"Threads credentials saved to {_CREDS_PATH}")
    except Exception as e:
        logger.error(f"Failed to save Threads credentials: {e}")


def clear_credentials() -> None:
    """清除儲存的憑證"""
    try:
        if _CREDS_PATH.exists():
            _CREDS_PATH.unlink()
    except Exception as e:
        logger.warning(f"Failed to clear credentials: {e}")


# ─────────────────────────────────────────────
# 發文歷史
# ─────────────────────────────────────────────

_HISTORY_PATH = Path.home() / ".pixelle" / "threads_history.json"


def load_post_history() -> list[PostHistoryItem]:
    try:
        if _HISTORY_PATH.exists():
            data = json.loads(_HISTORY_PATH.read_text(encoding="utf-8"))
            return [PostHistoryItem(**item) for item in data]
    except Exception:
        pass
    return []


def append_post_history(item: PostHistoryItem) -> None:
    history = load_post_history()
    history.insert(0, item)
    history = history[:100]  # 只保留最近 100 筆
    try:
        _HISTORY_PATH.parent.mkdir(parents=True, exist_ok=True)
        _HISTORY_PATH.write_text(
            json.dumps([h.__dict__ for h in history], ensure_ascii=False, indent=2),
            encoding="utf-8"
        )
    except Exception as e:
        logger.warning(f"Failed to save post history: {e}")


def count_posts_today() -> int:
    """統計今日已發文數（24小時內）"""
    history = load_post_history()
    cutoff = datetime.now() - timedelta(hours=24)
    return sum(
        1 for h in history
        if h.success and datetime.fromisoformat(h.published_at) > cutoff
    )


# ─────────────────────────────────────────────
# Threads API Client
# ─────────────────────────────────────────────

class ThreadsPublisher:
    """Meta Threads Graph API 發文客戶端"""

    def __init__(self, creds: Optional[ThreadsCredentials] = None):
        self.creds = creds or load_credentials()
        self._last_post_time: float = 0.0

    # ── 驗證 ──────────────────────────────────

    def verify_token(self) -> dict:
        """
        驗證 Access Token 並取得使用者資訊。
        成功回傳 {"ok": True, "username": "...", "user_id": "..."}
        失敗回傳 {"ok": False, "error": "..."}
        """
        if not self.creds.access_token:
            return {"ok": False, "error": "Access Token 為空"}
        try:
            resp = httpx.get(
                f"{THREADS_API_BASE}/me",
                params={
                    "fields": "id,username,threads_profile_picture_url",
                    "access_token": self.creds.access_token,
                },
                timeout=10,
            )
            data = resp.json()
            if "error" in data:
                return {"ok": False, "error": data["error"].get("message", "Unknown error")}
            return {
                "ok": True,
                "username": data.get("username", ""),
                "user_id": data.get("id", ""),
            }
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def refresh_user_info(self) -> bool:
        """重新取得並儲存使用者資訊"""
        result = self.verify_token()
        if result["ok"]:
            self.creds.username = result["username"]
            self.creds.user_id = result["user_id"]
            save_credentials(self.creds)
            return True
        return False

    # ── 發文（同步） ───────────────────────────

    def publish_text(self, text: str) -> PostResult:
        """
        發布純文字貼文到 Threads（同步版本）

        Step 1: 建立 container
        Step 2: 發布 container
        """
        if not self.creds.is_valid:
            return PostResult(success=False, error="尚未設定 Threads 憑證，請先在「設定」頁面輸入 Access Token")

        # 每日限額檢查
        today_count = count_posts_today()
        if today_count >= DAILY_POST_LIMIT:
            return PostResult(success=False, error=f"已達每日發文上限（{DAILY_POST_LIMIT} 篇）")

        # 最小間隔保護
        elapsed = time.time() - self._last_post_time
        if elapsed < MIN_POST_INTERVAL_SECONDS:
            wait = MIN_POST_INTERVAL_SECONDS - elapsed
            time.sleep(wait)

        # 文字長度限制：Threads 最多 500 字元
        if len(text) > 500:
            text = text[:497] + "..."

        try:
            # Step 1: 建立 media container
            create_resp = httpx.post(
                f"{THREADS_API_BASE}/{self.creds.user_id}/threads",
                params={
                    "media_type": "TEXT",
                    "text": text,
                    "access_token": self.creds.access_token,
                },
                timeout=30,
            )
            create_data = create_resp.json()
            logger.debug(f"Threads create container response: {create_data}")

            if "error" in create_data:
                err = create_data["error"]
                return PostResult(success=False, error=f"建立貼文失敗：{err.get('message', err)}")

            creation_id = create_data.get("id")
            if not creation_id:
                return PostResult(success=False, error="未取得 creation_id，建立 container 失敗")

            # Threads API 建議等待 30 秒（影片/圖片需要處理），文字貼文可縮短
            time.sleep(1)

            # Step 2: 發布
            publish_resp = httpx.post(
                f"{THREADS_API_BASE}/{self.creds.user_id}/threads_publish",
                params={
                    "creation_id": creation_id,
                    "access_token": self.creds.access_token,
                },
                timeout=30,
            )
            publish_data = publish_resp.json()
            logger.debug(f"Threads publish response: {publish_data}")

            if "error" in publish_data:
                err = publish_data["error"]
                return PostResult(success=False, error=f"發布失敗：{err.get('message', err)}")

            post_id = publish_data.get("id", "")
            self._last_post_time = time.time()
            logger.info(f"Threads post published: {post_id}")
            return PostResult(success=True, post_id=post_id)

        except httpx.TimeoutException:
            return PostResult(success=False, error="API 請求逾時，請稍後再試")
        except httpx.NetworkError as e:
            return PostResult(success=False, error=f"網路錯誤：{e}")
        except Exception as e:
            logger.exception("Unexpected error publishing to Threads")
            return PostResult(success=False, error=f"未預期錯誤：{e}")

    def publish_post_dict(self, post: dict, formatter) -> PostResult:
        """
        將 BeautyBot 生成的 post dict 格式化後發布。
        formatter: BeautyBotPipeline.format_post_for_display
        """
        full_text = formatter(post)
        result = self.publish_text(full_text)

        # 記錄到歷史
        append_post_history(PostHistoryItem(
            post_id=result.post_id,
            title=post.get("title", "")[:50],
            topic=post.get("topic", ""),
            published_at=result.published_at,
            success=result.success,
            error=result.error,
        ))
        return result

    # ── 查詢 ──────────────────────────────────

    def get_post_insights(self, post_id: str) -> dict:
        """取得貼文互動數據（觸及、按讚、回覆等）"""
        if not self.creds.is_valid:
            return {}
        try:
            resp = httpx.get(
                f"{THREADS_API_BASE}/{post_id}/insights",
                params={
                    "metric": "views,likes,replies,reposts,quotes,shares",
                    "access_token": self.creds.access_token,
                },
                timeout=10,
            )
            return resp.json()
        except Exception as e:
            logger.warning(f"Failed to get insights for {post_id}: {e}")
            return {}

    def get_quota_status(self) -> dict:
        """查詢今日剩餘發文配額"""
        if not self.creds.is_valid:
            return {}
        try:
            resp = httpx.get(
                f"{THREADS_API_BASE}/{self.creds.user_id}/threads_publishing_limit",
                params={
                    "fields": "config,quota_usage",
                    "access_token": self.creds.access_token,
                },
                timeout=10,
            )
            return resp.json()
        except Exception as e:
            logger.warning(f"Failed to get quota status: {e}")
            return {}
