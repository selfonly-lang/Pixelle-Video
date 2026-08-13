// Supabase Edge Function: beauty-bot-scheduler
// 自動排程中樞 — 佇列處理、自動補稿、Token 健康檢查、大腦整合

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const GENERATE_URL = `${SUPABASE_URL}/functions/v1/beauty-bot-generate`;
const PUBLISH_URL  = `${SUPABASE_URL}/functions/v1/beauty-bot-publish`;

// CST = UTC+8
const CST_MS = 8 * 60 * 60 * 1000;

const WEEKLY_SCHEDULE: Record<number, { theme: string; format: string; tone: string }> = {
  0: { theme: "玻尿酸",  format: "知識分享",  tone: "專業教育" },
  1: { theme: "雷射療程", format: "Q&A問答",   tone: "親切解答" },
  2: { theme: "肉毒桿菌", format: "迷思破解",  tone: "專業破解" },
  3: { theme: "埋線拉提", format: "選擇指南",  tone: "決策輔助" },
  4: { theme: "水光針",   format: "心得分享",  tone: "真實口碑" },
  5: { theme: "體雕塑身", format: "前後對比",  tone: "視覺震撼" },
  6: { theme: "醫美保養", format: "季節話題",  tone: "輕鬆互動" },
};

// Taiwan peak posting slots (CST hours → UTC)
const SLOT_HOURS_UTC = [0, 4, 11]; // 08:00, 12:00, 19:00 CST

// ── Helpers ─────────────────────────────────────────────────────────────────

function adminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

function nowCST(): Date {
  return new Date(Date.now() + CST_MS);
}

function getNextSlot(): string {
  const nowUtc = Date.now();
  const todayCST = nowCST();

  for (const utcHour of SLOT_HOURS_UTC) {
    const candidate = new Date(Date.UTC(
      todayCST.getFullYear(),
      todayCST.getMonth(),
      todayCST.getDate(),
      utcHour, 0, 0, 0,
    ));
    // Shift the date-components: CST midnight is UTC-8 the previous day
    // Actually compute by taking today CST date at each CST slot hour:
    const cstSlotHour = (utcHour + 8) % 24;
    const slotCST = new Date(todayCST);
    slotCST.setHours(cstSlotHour, 0, 0, 0);
    const slotUtc = new Date(slotCST.getTime() - CST_MS);
    if (slotUtc.getTime() > nowUtc + 5 * 60 * 1000) {
      return slotUtc.toISOString();
    }
  }
  // All today's slots passed → tomorrow 08:00 CST
  const tomorrow = new Date(todayCST);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(8, 0, 0, 0);
  return new Date(tomorrow.getTime() - CST_MS).toISOString();
}

function formatPost(post: Record<string, unknown>): string {
  const parts: string[] = [];
  if (post.title) parts.push(post.title as string);
  if (post.body)  parts.push(post.body as string);
  if (post.engagement_question) parts.push("\n" + post.engagement_question);
  if (Array.isArray(post.hashtags)) parts.push("\n" + (post.hashtags as string[]).join(" "));
  if (post.cta) parts.push("\n" + post.cta);
  return parts.join("\n\n");
}

async function callFn(url: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function signalBrain(params: {
  signal_type: string; title: string; data: Record<string, unknown>; strength?: number;
}) {
  try {
    await adminClient().from("brain_signals").insert({
      source_platform: "beautybot",
      source_neural:   "medmedia_planning",
      signal_type:     params.signal_type,
      title:           params.title,
      data:            params.data,
      strength:        params.strength ?? 5,
      processed:       false,
    });
  } catch { /* non-fatal */ }
}

// ── Core: process queue ──────────────────────────────────────────────────────

async function processQueue(): Promise<{ processed: number; generated: number; errors: string[] }> {
  const db = adminClient();
  const now = new Date().toISOString();
  const errors: string[] = [];
  let processed = 0;
  let generated = 0;

  // Fetch up to 3 posts due now (respect Threads container rate limit)
  const { data: duePosts } = await db
    .from("beauty_post_queue")
    .select("*")
    .eq("status", "scheduled")
    .lte("scheduled_for", now)
    .order("scheduled_for", { ascending: true })
    .limit(3);

  for (const item of duePosts ?? []) {
    // Optimistic lock: mark as publishing before calling Threads
    const { count } = await db
      .from("beauty_post_queue")
      .update({ status: "publishing" })
      .eq("id", item.id)
      .eq("status", "scheduled")
      .select("id", { count: "exact", head: true });

    if ((count ?? 0) === 0) continue; // Another invocation already took it

    try {
      const post = item.post_content as Record<string, unknown>;
      const result = await callFn(PUBLISH_URL, {
        action: "publish_text",
        text:   formatPost(post),
        title:  post.title ?? item.title,
        topic:  item.topic,
      });

      if (result.success) {
        await db.from("beauty_post_queue").update({
          status:          "published",
          threads_post_id: result.post_id ?? null,
          published_at:    new Date().toISOString(),
        }).eq("id", item.id);
        processed++;
      } else {
        await db.from("beauty_post_queue").update({
          status:        "failed",
          error_message: String(result.error ?? "unknown"),
        }).eq("id", item.id);
        errors.push(`${item.id}: ${result.error}`);
      }
    } catch (e) {
      await db.from("beauty_post_queue").update({
        status:        "failed",
        error_message: String(e),
      }).eq("id", item.id);
      errors.push(String(e));
    }
  }

  // Auto-fill: if nothing was due, check if today's CST date has any queued posts
  if ((duePosts ?? []).length === 0) {
    const todayCST = nowCST().toISOString().slice(0, 10); // YYYY-MM-DD in CST
    // Convert CST day boundaries to UTC for the query
    const startUTC = new Date(`${todayCST}T00:00:00+08:00`).toISOString();
    const endUTC   = new Date(`${todayCST}T23:59:59+08:00`).toISOString();

    const { count } = await db
      .from("beauty_post_queue")
      .select("id", { count: "exact", head: true })
      .gte("scheduled_for", startUTC)
      .lte("scheduled_for", endUTC);

    if ((count ?? 0) === 0) {
      // Nothing queued today — auto-generate today's theme
      const cstDay = nowCST().getDay(); // 0=Sun
      const schedKey = cstDay === 0 ? 6 : cstDay - 1; // 0=Mon in our schedule
      const plan = WEEKLY_SCHEDULE[schedKey] ?? WEEKLY_SCHEDULE[0];

      try {
        const gen = await callFn(GENERATE_URL, {
          action:       "single",
          topic:        plan.theme,
          post_format:  plan.format,
          tone:         plan.tone,
        });

        const post = gen.post as Record<string, unknown> | undefined;
        if (post) {
          const slot = getNextSlot();
          await db.from("beauty_post_queue").insert({
            topic:        plan.theme,
            title:        post.title ?? `今日${plan.theme}內容`,
            post_content: post,
            scheduled_for: slot,
            status:       "scheduled",
          });
          generated++;

          await signalBrain({
            signal_type: "content_queued",
            title:       `BeautyBot 自動補稿：${post.title ?? plan.theme}`,
            data:        { topic: plan.theme, scheduled_for: slot, source: "auto_fill" },
            strength:    4,
          });
        }
      } catch (e) {
        errors.push(`Auto-fill failed: ${e}`);
      }
    }
  }

  return { processed, generated, errors };
}

// ── CORS ─────────────────────────────────────────────────────────────────────

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const body = await req.json();
    const action: string = body.action ?? "process_queue";

    // ── process_queue ──────────────────────────────────────────────────────
    if (action === "process_queue") {
      const result = await processQueue();
      return json(result);
    }

    // ── enqueue: add a post to the queue ──────────────────────────────────
    if (action === "enqueue") {
      const post = body.post as Record<string, unknown> | undefined;
      if (!post) return json({ error: "post required" }, 400);

      const topic: string        = body.topic ?? (post.topic as string) ?? "醫美";
      const scheduledFor: string = body.scheduled_for ?? getNextSlot();

      const db = adminClient();
      const { data, error } = await db
        .from("beauty_post_queue")
        .insert({
          topic,
          title:        post.title ?? "新貼文",
          post_content: post,
          scheduled_for: scheduledFor,
          status:       "scheduled",
        })
        .select()
        .single();

      if (error) return json({ error: error.message }, 500);

      await signalBrain({
        signal_type: "content_queued",
        title:       `BeautyBot 排入佇列：${post.title ?? topic}`,
        data:        { topic, scheduled_for: scheduledFor, queue_id: data.id },
        strength:    3,
      });

      return json({ ok: true, queue_item: data });
    }

    // ── get_queue ──────────────────────────────────────────────────────────
    if (action === "get_queue") {
      const db = adminClient();
      const { data, error } = await db
        .from("beauty_post_queue")
        .select("id, topic, title, scheduled_for, status, threads_post_id, error_message, created_at, published_at")
        .in("status", ["scheduled", "publishing", "published", "failed"])
        .order("scheduled_for", { ascending: true })
        .limit(body.limit ?? 30);

      if (error) return json({ error: error.message }, 500);
      return json({ queue: data });
    }

    // ── cancel ─────────────────────────────────────────────────────────────
    if (action === "cancel") {
      const id: string = body.id ?? "";
      if (!id) return json({ error: "id required" }, 400);
      const db = adminClient();
      const { error } = await db
        .from("beauty_post_queue")
        .update({ status: "cancelled" })
        .eq("id", id)
        .eq("status", "scheduled");
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    // ── reschedule ─────────────────────────────────────────────────────────
    if (action === "reschedule") {
      const id: string           = body.id ?? "";
      const scheduledFor: string = body.scheduled_for ?? "";
      if (!id || !scheduledFor) return json({ error: "id and scheduled_for required" }, 400);
      const db = adminClient();
      const { error } = await db
        .from("beauty_post_queue")
        .update({ scheduled_for: scheduledFor })
        .eq("id", id)
        .eq("status", "scheduled");
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    // ── auto_fill_week: generate & queue a full week ───────────────────────
    if (action === "auto_fill_week") {
      const weekOffset: number = body.week_offset ?? 0;
      const gen = await callFn(GENERATE_URL, { action: "weekly", week_offset: weekOffset });
      const posts = (gen.posts ?? []) as Array<Record<string, unknown>>;
      if (!posts.length) return json({ error: "Generation returned no posts" }, 500);

      const rows = posts.map((post) => {
        const dateStr     = post.scheduled_date as string ?? new Date().toISOString().slice(0, 10);
        const scheduledFor = new Date(`${dateStr}T08:00:00+08:00`).toISOString(); // 08:00 CST
        return {
          topic:        (post.topic as string) ?? "醫美",
          title:        (post.title as string) ?? "本週內容",
          post_content: post,
          scheduled_for: scheduledFor,
          status:       "scheduled",
        };
      });

      const db = adminClient();
      const { data, error } = await db.from("beauty_post_queue").insert(rows).select();
      if (error) return json({ error: error.message }, 500);

      await signalBrain({
        signal_type: "content_queued",
        title:       `BeautyBot 本週 ${rows.length} 篇已排入自動發文佇列`,
        data:        { count: rows.length, week_offset: weekOffset },
        strength:    7,
      });

      return json({ ok: true, queued: data?.length ?? 0 });
    }

    // ── check_token: verify Threads token health ───────────────────────────
    if (action === "check_token") {
      const status = await callFn(PUBLISH_URL, { action: "status" });

      if (!status.connected) {
        await signalBrain({
          signal_type: "task_completed",
          title:       "⚠️ BeautyBot Threads Token 異常 — 請重新授權",
          data:        { error: status.error ?? "not connected", needs_reauth: true },
          strength:    9,
        });
        return json({ ok: false, connected: false, needs_reauth: true });
      }

      // Warn if token expires within 14 days (not stored in status currently,
      // but if it becomes available we can surface it)
      return json({ ok: true, connected: true, ...status });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err: unknown) {
    return json({ error: String(err) }, 500);
  }
});
