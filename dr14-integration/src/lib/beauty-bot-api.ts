import { createClient } from '@supabase/supabase-js';
import type {
  ThreadsPost,
  GeneratePostRequest,
  PublishResult,
  PostHistoryItem,
  ThreadsAccount,
} from '@/types/beauty-bot';

// ── Supabase client ──────────────────────────────────────────────────────────

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://lfhhiwubapkgrtgkqryd.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmaGhpd3ViYXBrZ3J0Z2txcnlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNTAwMTUsImV4cCI6MjA5NjYyNjAxNX0.aF6wF83wOzGFeH-KcAXOfa71K20FaArDtbYKvKpUiAo';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Types ────────────────────────────────────────────────────────────────────

export interface QueueItem {
  id: string;
  topic: string;
  title: string;
  post_content: ThreadsPost;
  scheduled_for: string;
  status: 'scheduled' | 'publishing' | 'published' | 'failed' | 'cancelled';
  threads_post_id?: string;
  error_message?: string;
  created_at: string;
  published_at?: string;
}

export interface WeeklyPlanResult {
  posts: ThreadsPost[];
  week_summary: string;
}

// ── Generic Edge Function caller ─────────────────────────────────────────────

async function invoke<T>(fnName: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fnName, { body });
  if (error) throw new Error(error.message);
  return data as T;
}

// ── Content generation ───────────────────────────────────────────────────────

export async function generatePost(req: GeneratePostRequest = {}): Promise<ThreadsPost> {
  const result = await invoke<{ post: ThreadsPost }>('beauty-bot-generate', {
    action: 'single',
    ...req,
  });
  return result.post;
}

export async function generateWeeklyPlan(weekOffset = 0): Promise<WeeklyPlanResult> {
  return invoke<WeeklyPlanResult>('beauty-bot-generate', {
    action: 'weekly',
    week_offset: weekOffset,
  });
}

export async function generateSeries(topic: string, count = 3): Promise<ThreadsPost[]> {
  const result = await invoke<{ posts: ThreadsPost[] }>('beauty-bot-generate', {
    action: 'series',
    topic,
    count,
  });
  return result.posts;
}

// ── Threads publishing ───────────────────────────────────────────────────────

export async function publishToThreads(post: ThreadsPost): Promise<PublishResult> {
  const text = formatPostForPublish(post);
  return invoke<PublishResult>('beauty-bot-publish', {
    action: 'publish_text',
    text,
    title: post.title,
    topic: post.topic,
  });
}

export async function publishText(text: string, topic = '醫美'): Promise<PublishResult> {
  return invoke<PublishResult>('beauty-bot-publish', {
    action: 'publish_text',
    text,
    title: text.slice(0, 30),
    topic,
  });
}

export async function refreshThreadsToken(): Promise<{ ok: boolean; expires_at?: string; error?: string }> {
  return invoke('beauty-bot-publish', { action: 'refresh_token' });
}

// ── Account / token management ───────────────────────────────────────────────

export async function getThreadsAccount(): Promise<ThreadsAccount> {
  return invoke<ThreadsAccount>('beauty-bot-publish', { action: 'status' });
}

export async function verifyThreadsToken(
  token: string,
): Promise<{ ok: boolean; user_id?: string; username?: string; error?: string }> {
  return invoke('beauty-bot-publish', { action: 'verify', access_token: token });
}

export async function saveThreadsToken(
  token: string,
  userId: string,
  username: string,
): Promise<{ ok: boolean; error?: string }> {
  return invoke('beauty-bot-publish', { action: 'save_token', access_token: token, user_id: userId, username });
}

export async function exchangeOAuthCode(code: string, redirectUri?: string): Promise<{
  ok: boolean; username?: string; user_id?: string; expires_at?: string; error?: string;
}> {
  return invoke('beauty-bot-publish', { action: 'oauth_exchange', code, ...(redirectUri ? { redirect_uri: redirectUri } : {}) });
}

// ── Post history ─────────────────────────────────────────────────────────────

export async function fetchPostHistory(limit = 20): Promise<PostHistoryItem[]> {
  const result = await invoke<{ history: PostHistoryItem[] }>('beauty-bot-publish', {
    action: 'history',
    limit,
  });
  return result.history ?? [];
}

export async function countTodayPosts(): Promise<number> {
  const account = await getThreadsAccount();
  return account.today_count ?? 0;
}

// ── Queue management (beauty-bot-scheduler) ──────────────────────────────────

export async function enqueuePost(post: ThreadsPost, scheduledFor?: string): Promise<{ ok: boolean; queue_item?: QueueItem; error?: string }> {
  return invoke('beauty-bot-scheduler', {
    action: 'enqueue',
    post,
    topic: post.topic,
    ...(scheduledFor ? { scheduled_for: scheduledFor } : {}),
  });
}

export async function getQueue(limit = 30): Promise<QueueItem[]> {
  const result = await invoke<{ queue: QueueItem[] }>('beauty-bot-scheduler', {
    action: 'get_queue',
    limit,
  });
  return result.queue ?? [];
}

export async function cancelQueueItem(id: string): Promise<{ ok: boolean; error?: string }> {
  return invoke('beauty-bot-scheduler', { action: 'cancel', id });
}

export async function rescheduleQueueItem(id: string, scheduledFor: string): Promise<{ ok: boolean; error?: string }> {
  return invoke('beauty-bot-scheduler', { action: 'reschedule', id, scheduled_for: scheduledFor });
}

export async function autoFillWeek(weekOffset = 0): Promise<{ ok: boolean; queued?: number; error?: string }> {
  return invoke('beauty-bot-scheduler', { action: 'auto_fill_week', week_offset: weekOffset });
}

export async function processQueueNow(): Promise<{ processed: number; generated: number; errors: string[] }> {
  return invoke('beauty-bot-scheduler', { action: 'process_queue' });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function formatPostForPublish(post: ThreadsPost): string {
  const parts: string[] = [post.title, '', post.body];
  if (post.engagement_question) parts.push('', post.engagement_question);
  if (post.hashtags?.length) parts.push('', post.hashtags.join(' '));
  if (post.cta) parts.push('', post.cta);
  return parts.join('\n');
}

export function formatPostForDisplay(post: ThreadsPost): string {
  return formatPostForPublish(post);
}
