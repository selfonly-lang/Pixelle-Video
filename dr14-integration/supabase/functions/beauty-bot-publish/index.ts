// Supabase Edge Function: beauty-bot-publish
// Threads Graph API 發文 / Token 管理

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const THREADS_BASE = "https://graph.threads.net/v1.0";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const APP_ID = Deno.env.get("THREADS_APP_ID") ?? "";
const APP_SECRET = Deno.env.get("THREADS_APP_SECRET") ?? "";
const REDIRECT_URI = Deno.env.get("THREADS_REDIRECT_URI") ?? "https://self.com.tw/oauth/callback";

// ── Supabase admin client ────────────────────────────────

function adminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

// ── Threads API helpers ──────────────────────────────────

async function getStoredToken(): Promise<{ access_token: string; user_id: string } | null> {
  const db = adminClient();
  const { data } = await db
    .from("threads_secrets")
    .select("access_token, user_id")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  return data ?? null;
}

async function verifyToken(token: string): Promise<{ ok: boolean; user_id?: string; username?: string; error?: string }> {
  const res = await fetch(
    `${THREADS_BASE}/me?fields=id,username&access_token=${encodeURIComponent(token)}`,
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    return { ok: false, error: err?.error?.message ?? String(res.status) };
  }
  const data = await res.json();
  return { ok: true, user_id: data.id, username: data.username };
}

async function publishTextToThreads(
  text: string,
  accessToken: string,
  userId: string,
): Promise<{ success: boolean; post_id?: string; error?: string }> {
  // Step 1: Create media container
  const createRes = await fetch(`${THREADS_BASE}/${userId}/threads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ media_type: "TEXT", text, access_token: accessToken }),
  });
  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    return { success: false, error: err?.error?.message ?? `Create failed: ${createRes.status}` };
  }
  const { id: containerId } = await createRes.json();
  if (!containerId) return { success: false, error: "No container ID returned" };

  // Brief pause to let Threads process the container
  await new Promise(r => setTimeout(r, 2000));

  // Step 2: Publish the container
  const publishRes = await fetch(`${THREADS_BASE}/${userId}/threads_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: containerId, access_token: accessToken }),
  });
  if (!publishRes.ok) {
    const err = await publishRes.json().catch(() => ({}));
    return { success: false, error: err?.error?.message ?? `Publish failed: ${publishRes.status}` };
  }
  const { id: postId } = await publishRes.json();
  return { success: true, post_id: postId };
}

async function exchangeCodeForLongToken(code: string): Promise<{
  ok: boolean; access_token?: string; user_id?: string; username?: string; expires_at?: string; error?: string;
}> {
  // Step 1: short-lived token
  const shortRes = await fetch("https://graph.threads.net/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: APP_ID,
      client_secret: APP_SECRET,
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI,
      code: code.includes("code=") ? new URL(code.startsWith("http") ? code : `https://x.com?${code}`).searchParams.get("code") ?? code : code,
    }),
  });
  if (!shortRes.ok) {
    const err = await shortRes.json().catch(() => ({}));
    return { ok: false, error: err?.error_message ?? err?.error ?? `Short token failed: ${shortRes.status}` };
  }
  const shortData = await shortRes.json();
  const shortToken: string = shortData.access_token;
  const userId: string = String(shortData.user_id);

  // Step 2: exchange for 60-day long-lived token
  const longRes = await fetch(
    `${THREADS_BASE}/access_token?grant_type=th_exchange_token&client_secret=${APP_SECRET}&access_token=${encodeURIComponent(shortToken)}`,
  );
  if (!longRes.ok) {
    const err = await longRes.json().catch(() => ({}));
    return { ok: false, error: err?.error?.message ?? `Long token failed: ${longRes.status}` };
  }
  const longData = await longRes.json();
  const longToken: string = longData.access_token;
  const expiresIn: number = longData.expires_in ?? 5184000;
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  // Verify and get username
  const verify = await verifyToken(longToken);
  const username = verify.username;

  return { ok: true, access_token: longToken, user_id: userId, username, expires_at: expiresAt };
}

// ── Log post to history ──────────────────────────────────

async function logPostHistory(params: {
  title: string; topic: string; post_id?: string; success: boolean; error?: string;
}) {
  try {
    const db = adminClient();
    await db.from("beauty_post_history").insert({
      title: params.title,
      topic: params.topic,
      threads_post_id: params.post_id ?? null,
      success: params.success,
      error_message: params.error ?? null,
      published_at: new Date().toISOString(),
    });
  } catch {
    // non-fatal
  }
}

// ── Signal Brain (brain_signals integration) ─────────────

async function signalBrain(params: {
  title: string; topic: string; post_id?: string; success: boolean; error?: string;
}) {
  try {
    const db = adminClient();
    await db.from("brain_signals").insert({
      source_platform: "beautybot",
      source_neural: "medmedia_planning",
      signal_type: params.success ? "content_published" : "task_completed",
      title: params.success
        ? `BeautyBot 發文成功：${params.title}`
        : `BeautyBot 發文失敗：${params.title}`,
      data: {
        topic: params.topic,
        threads_post_id: params.post_id ?? null,
        success: params.success,
        error: params.error ?? null,
        platform: "threads",
        published_at: new Date().toISOString(),
      },
      strength: params.success ? 7 : 3,
      processed: false,
    });
  } catch {
    // non-fatal — 大腦訊號失敗不影響主流程
  }
}

// ── CORS headers ─────────────────────────────────────────

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

// ── Main handler ─────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const body = await req.json();
    const action: string = body.action ?? "publish_text";

    // ── status: return account info + today's quota ──────
    if (action === "status") {
      const cred = await getStoredToken();
      if (!cred) return jsonResponse({ connected: false });
      const verify = await verifyToken(cred.access_token);
      if (!verify.ok) return jsonResponse({ connected: false, error: verify.error });

      const db = adminClient();
      const today = new Date().toISOString().slice(0, 10);
      const { count } = await db
        .from("beauty_post_history")
        .select("id", { count: "exact", head: true })
        .eq("success", true)
        .gte("published_at", `${today}T00:00:00Z`);

      return jsonResponse({
        connected: true,
        username: verify.username,
        user_id: cred.user_id,
        today_count: count ?? 0,
        remaining: 250 - (count ?? 0),
      });
    }

    // ── verify: validate a token without saving ──────────
    if (action === "verify") {
      const token: string = body.access_token ?? "";
      if (!token) return jsonResponse({ ok: false, error: "access_token required" }, 400);
      const result = await verifyToken(token);
      return jsonResponse(result);
    }

    // ── save_token: store long-lived token ───────────────
    if (action === "save_token") {
      const token: string = body.access_token ?? "";
      const userId: string = body.user_id ?? "";
      const username: string = body.username ?? "";
      if (!token || !userId) return jsonResponse({ ok: false, error: "access_token and user_id required" }, 400);

      const db = adminClient();
      const { error } = await db.from("threads_secrets").insert({
        access_token: token,
        user_id: userId,
        username,
        created_at: new Date().toISOString(),
      });
      if (error) return jsonResponse({ ok: false, error: error.message }, 500);
      return jsonResponse({ ok: true });
    }

    // ── oauth_exchange: code → long-lived token → save ──
    if (action === "oauth_exchange") {
      const code: string = body.code ?? "";
      if (!code) return jsonResponse({ ok: false, error: "code required" }, 400);
      const result = await exchangeCodeForLongToken(code);
      if (!result.ok) return jsonResponse(result);

      // Auto-save to DB
      const db = adminClient();
      await db.from("threads_secrets").insert({
        access_token: result.access_token,
        user_id: result.user_id,
        username: result.username ?? "",
        expires_at: result.expires_at,
        created_at: new Date().toISOString(),
      });
      return jsonResponse(result);
    }

    // ── publish_text: publish text post to Threads ───────
    if (action === "publish_text") {
      const text: string = body.text ?? "";
      const title: string = body.title ?? text.slice(0, 30);
      const topic: string = body.topic ?? "醫美";

      if (!text) return jsonResponse({ success: false, error: "text required" }, 400);

      const cred = await getStoredToken();
      if (!cred) return jsonResponse({ success: false, error: "Threads not connected" }, 401);

      const result = await publishTextToThreads(text, cred.access_token, cred.user_id);
      await Promise.all([
        logPostHistory({ title, topic, post_id: result.post_id, success: result.success, error: result.error }),
        signalBrain({ title, topic, post_id: result.post_id, success: result.success, error: result.error }),
      ]);
      return jsonResponse(result);
    }

    // ── history: fetch recent post log ───────────────────
    if (action === "history") {
      const limit: number = Math.min(body.limit ?? 20, 50);
      const db = adminClient();
      const { data, error } = await db
        .from("beauty_post_history")
        .select("id, title, topic, threads_post_id, success, error_message, published_at")
        .order("published_at", { ascending: false })
        .limit(limit);
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ history: data });
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400);
  } catch (err: unknown) {
    return jsonResponse({ error: String(err) }, 500);
  }
});
