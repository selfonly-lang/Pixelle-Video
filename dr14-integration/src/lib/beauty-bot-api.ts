import { createClient } from '@supabase/supabase-js';
import type {
  ThreadsPost,
  GeneratePostRequest,
  PublishResult,
  PostHistoryItem,
  ThreadsAccount,
} from '@/types/beauty-bot';

// ── Supabase client ──────────────────────────────────────

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://lfhhiwubapkgrtgkqryd.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmaGhpd3ViYXBrZ3J0Z2txcnlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNTAwMTUsImV4cCI6MjA5NjYyNjAxNX0.aF6wF83wOzGFeH-KcAXOfa71K20FaArDtbYKvKpUiAo';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Generic Edge Function caller ─────────────────────────

async function invoke<T>(fnName: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fnName, { body });
  if (error) throw new Error(error.message);
  return data as T;
}

// ── Content generation ───────────────────────────────────

export async function generatePost(req: GeneratePostRequest = {}): Promise<ThreadsPost> {
  const result = await invoke<{ post: ThreadsPost }>('beauty-bot-generate', {
    action: 'single',
    ...req,
  });
  return result.post;
}

export async function generateWeeklyPlan(weekOffset = 0): Promise<ThreadsPost[]> {
  const result = await invoke<{ posts: ThreadsPost[] }>('beauty-bot-generate', {
    action: 'weekly',
    week_offset: weekOffset,
  });
  return result.posts;
}

export async function generateSeries(topic: string, count = 3): Promise<ThreadsPost[]> {
  const result = await invoke<{ posts: ThreadsPost[] }>('beauty-bot-generate', {
    action: 'series',
    topic,
    count,
  });
  return result.posts;
}

// ── Threads publishing ───────────────────────────────────

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

// ── Account / token management ───────────────────────────

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

export async function exchangeOAuthCode(code: string): Promise<{
  ok: boolean; username?: string; user_id?: string; expires_at?: string; error?: string;
}> {
  return invoke('beauty-bot-publish', { action: 'oauth_exchange', code });
}

// ── Post history ─────────────────────────────────────────

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

// ── Helpers ──────────────────────────────────────────────

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
