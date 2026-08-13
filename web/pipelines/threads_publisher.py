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

OAuth 取得 Access Token：
  Step 1: 使用者瀏覽 Authorization URL（generate_oauth_url）
  Step 2: 使用者授權後取得 code，貼回 exchange_code_for_token
  Step 3: 換取長效 Token（60 天），自動儲存

參考：https://developers.facebook.com/docs/threads
"""

from __future__ import annotations

import json
import time
import urllib.parse
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import httpx
from loguru import logger

THREADS_API_BASE = "https://graph.threads.net/v1.0"
THREADS_OAUTH_BASE = "https://threads.net/oauth/authorize"
THREADS_TOKEN_URL = "https://graph.threads.net/oauth/access_token"
THREADS_LONG_TOKEN_URL = "https://graph.threads.net/access_token"

# Threads 官方限制：每 24 小時最多 250 篇
DAILY_POST_LIMIT = 250
# 每次發文後最少等待秒數（避免觸發 spam 偵測）
MIN_POST_INTERVAL_SECONDS = 10

# 憑證儲存路徑（~/.pixelle/threads_*.json）
_CREDS_PATH = Path.home() / ".pixelle" / "threads_creds.json"
_APP_CREDS_PATH = Path.home() / ".pixelle" / "threads_app.json"


# ─────────────────────────────────────────────
# 資料結構
# ─────────────────────────────────────────────

@dataclass
class ThreadsAppCredentials:
    """Meta App 開發者憑證（App ID + App Secret）"""
    app_id: str = ""
    app_secret: str = ""
    redirect_uri: str = "https://self.com.tw/oauth/callback"

    @property
    def is_valid(self) -> bool:
        return bool(self.app_id and self.app_secret)

    def to_dict(self) -> dict:
        return {"app_id": self.app_id, "app_secret": self.app_secret, "redirect_uri": self.redirect_uri}

    @classmethod
    def from_dict(cls, d: dict) -> "ThreadsAppCredentials":
        return cls(
            app_id=d.get("app_id", ""),
            app_secret=d.get("app_secret", ""),
            redirect_uri=d.get("redirect_uri", "https://self.com.tw/oauth/callback"),
        )


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
# App 憑證儲存
# ─────────────────────────────────────────────

def load_app_credentials() -> ThreadsAppCredentials:
    """從本機讀取 Threads App 憑證（App ID / App Secret）"""
    try:
        if _APP_CREDS_PATH.exists():
            data = json.loads(_APP_CREDS_PATH.read_text(encoding="utf-8"))
            return ThreadsAppCredentials.from_dict(data)
    except Exception as e:
        logger.warning(f"Failed to load Threads app credentials: {e}")
    return ThreadsAppCredentials()


def save_app_credentials(app_creds: ThreadsAppCredentials) -> None:
    """儲存 App 憑證到本機"""
    try:
        _APP_CREDS_PATH.parent.mkdir(parents=True, exist_ok=True)
        _APP_CREDS_PATH.write_text(
            json.dumps(app_creds.to_dict(), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        logger.info(f"Threads app credentials saved to {_APP_CREDS_PATH}")
    except Exception as e:
        logger.error(f"Failed to save Threads app credentials: {e}")


# ─────────────────────────────────────────────
# OAuth 流程
# ─────────────────────────────────────────────

def generate_oauth_url(app_creds: Optional[ThreadsAppCredentials] = None) -> str:
    """
    產生 Threads OAuth 授權 URL。
    使用者用瀏覽器開啟此 URL → 授權 → 取得 code。
    """
    if app_creds is None:
        app_creds = load_app_credentials()
    if not app_creds.is_valid:
        raise ValueError("App ID 或 App Secret 未設定")

    params = {
        "client_id": app_creds.app_id,
        "redirect_uri": app_creds.redirect_uri,
        "scope": "threads_basic,threads_content_publish,threads_manage_insights",
        "response_type": "code",
        "state": "beautybot",
    }
    return f"{THREADS_OAUTH_BASE}?{urllib.parse.urlencode(params)}"


def exchange_code_for_token(
    code: str,
    app_creds: Optional[ThreadsAppCredentials] = None,
) -> dict:
    """
    將授權 code 換取短效 Access Token（1 小時）。

    Returns:
        {"ok": True, "access_token": "...", "user_id": "..."} on success
        {"ok": False, "error": "..."} on failure
    """
    if app_creds is None:
        app_creds = load_app_credentials()
    if not app_creds.is_valid:
        return {"ok": False, "error": "App 憑證未設定"}

    # 如果 code 是完整 redirect URL，自動抽取 code 參數
    if code.startswith("http") and "code=" in code:
        parsed = urllib.parse.urlparse(code)
        qs = urllib.parse.parse_qs(parsed.query)
        code = qs.get("code", [code])[0]

    try:
        resp = httpx.post(
            THREADS_TOKEN_URL,
            data={
                "client_id": app_creds.app_id,
                "client_secret": app_creds.app_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": app_creds.redirect_uri,
            },
            timeout=20,
        )
        data = resp.json()
        logger.debug(f"Short-lived token exchange response: {data}")
        if "error" in data:
            return {"ok": False, "error": data["error"].get("message", str(data["error"]))}
        if "access_token" not in data:
            return {"ok": False, "error": f"未取得 access_token，回應：{data}"}
        return {"ok": True, "access_token": data["access_token"], "user_id": str(data.get("user_id", ""))}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def exchange_short_for_long_token(
    short_token: str,
    app_creds: Optional[ThreadsAppCredentials] = None,
) -> dict:
    """
    將短效 Token（1 小時）換取長效 Token（60 天）。

    Returns:
        {"ok": True, "access_token": "...", "expires_in": 5183944} on success
        {"ok": False, "error": "..."} on failure
    """
    if app_creds is None:
        app_creds = load_app_credentials()
    if not app_creds.is_valid:
        return {"ok": False, "error": "App 憑證未設定"}
    try:
        resp = httpx.get(
            THREADS_LONG_TOKEN_URL,
            params={
                "grant_type": "th_exchange_token",
                "client_secret": app_creds.app_secret,
                "access_token": short_token,
            },
            timeout=20,
        )
        data = resp.json()
        logger.debug(f"Long-lived token exchange response: {data}")
        if "error" in data:
            return {"ok": False, "error": data["error"].get("message", str(data["error"]))}
        if "access_token" not in data:
            return {"ok": False, "error": f"未取得長效 Token，回應：{data}"}
        expires_in = data.get("expires_in", 0)
        expires_at = (datetime.now() + timedelta(seconds=expires_in)).isoformat()
        return {"ok": True, "access_token": data["access_token"], "expires_in": expires_in, "expires_at": expires_at}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def full_oauth_exchange(
    code: str,
    app_creds: Optional[ThreadsAppCredentials] = None,
) -> dict:
    """
    完整 OAuth 流程：code → 短效 token → 長效 token → 取得用戶資訊 → 儲存憑證

    Returns:
        {"ok": True, "username": "...", "user_id": "...", "expires_at": "..."} on success
        {"ok": False, "error": "..."} on failure
    """
    if app_creds is None:
        app_creds = load_app_credentials()

    # Step 1: 換短效 token
    step1 = exchange_code_for_token(code, app_creds)
    if not step1["ok"]:
        return {"ok": False, "error": f"換取 Token 失敗：{step1['error']}"}

    short_token = step1["access_token"]
    user_id_from_code = step1.get("user_id", "")

    # Step 2: 換長效 token
    step2 = exchange_short_for_long_token(short_token, app_creds)
    if not step2["ok"]:
        # 短效 token 也可以用，只是 60 分鐘後失效
        logger.warning(f"Long-lived token exchange failed: {step2['error']}, using short-lived")
        long_token = short_token
        expires_at = (datetime.now() + timedelta(hours=1)).isoformat()
    else:
        long_token = step2["access_token"]
        expires_at = step2.get("expires_at", "")

    # Step 3: 取得使用者資訊並儲存
    creds = ThreadsCredentials(
        access_token=long_token,
        user_id=user_id_from_code,
        token_expires_at=expires_at,
    )
    publisher = ThreadsPublisher(creds)
    verify = publisher.verify_token()
    if verify["ok"]:
        creds.username = verify["username"]
        creds.user_id = verify["user_id"]

    save_credentials(creds)
    logger.info(f"Full OAuth complete: @{creds.username} (expires {expires_at})")
    return {
        "ok": True,
        "username": creds.username,
        "user_id": creds.user_id,
        "expires_at": expires_at,
    }


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
