import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Calendar, Download, Send, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';

import { generateWeeklyPlan, publishToThreads, autoFillWeek, formatPostForDisplay } from '@/lib/beauty-bot-api';
import type { ThreadsPost, ThreadsAccount } from '@/types/beauty-bot';
import type { WeeklyPlanResult } from '@/lib/beauty-bot-api';
import { WEEKLY_SCHEDULE } from '@/types/beauty-bot';
import { PostCard } from './PostCard';

interface Props { account: ThreadsAccount | null; }

const DAY_NAMES = ['一', '二', '三', '四', '五', '六', '日'];

export function WeeklyPlan({ account }: Props) {
  const [loading, setLoading]         = useState(false);
  const [queueing, setQueueing]       = useState(false);
  const [plan, setPlan]               = useState<WeeklyPlanResult | null>(null);
  const [publishingIdx, setPublishingIdx] = useState<number | null>(null);

  const weekStart = (() => {
    const d = new Date();
    d.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1));
    return d;
  })();

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const result = await generateWeeklyPlan(0);
      setPlan(result);
      toast.success(`✅ 已生成 ${result.posts.length} 篇貼文！`);
    } catch (e: unknown) {
      toast.error(`生成失敗：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleQueueAll = async () => {
    setQueueing(true);
    try {
      const result = await autoFillWeek(0);
      if (result.ok) {
        toast.success(`✅ ${result.queued} 篇已排入自動發文佇列！系統將在最佳時段發出`);
      } else {
        toast.error(`排程失敗：${result.error}`);
      }
    } catch (e: unknown) {
      toast.error(`失敗：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setQueueing(false);
    }
  };

  const handleDownload = () => {
    if (!plan) return;
    const lines: string[] = [];
    plan.posts.forEach((post, i) => {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      lines.push(`=== 週${DAY_NAMES[i]} ${date.toLocaleDateString('zh-TW')} (${post.topic}/${post.format}) ===`);
      lines.push(formatPostForDisplay(post));
      lines.push('');
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `beauty_posts_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('已下載！');
  };

  const handlePublishOne = async (post: ThreadsPost, idx: number) => {
    setPublishingIdx(idx);
    try {
      const result = await publishToThreads(post);
      if (result.success) toast.success(`週${DAY_NAMES[idx]} 發文成功！`);
      else toast.error(`發文失敗：${result.error}`);
    } catch (e: unknown) {
      toast.error(`發文失敗：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setPublishingIdx(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Schedule Preview */}
      <Card className="border-purple-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2 text-purple-800">
            <Calendar className="w-4 h-4" />本週主題排程
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1">
            {Object.entries(WEEKLY_SCHEDULE).map(([day, plan]) => {
              const date = new Date(weekStart);
              date.setDate(date.getDate() + Number(day));
              const isToday = date.toDateString() === new Date().toDateString();
              return (
                <div
                  key={day}
                  className={`rounded-lg p-2 text-center text-xs ${
                    isToday
                      ? 'bg-purple-600 text-white ring-2 ring-purple-400'
                      : 'bg-purple-50 text-purple-800'
                  }`}
                >
                  <div className="font-medium">週{DAY_NAMES[Number(day)]}</div>
                  <div className={`text-xs ${isToday ? 'text-purple-100' : 'text-gray-500'}`}>
                    {date.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })}
                  </div>
                  <div className="font-semibold mt-1">{plan.theme}</div>
                  <div className={`text-xs mt-0.5 ${isToday ? 'text-purple-200' : 'text-gray-400'}`}>
                    {plan.format}
                  </div>
                  {isToday && <div className="text-xs mt-1 text-yellow-300">● 今天</div>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          onClick={handleGenerate}
          disabled={loading || queueing}
          className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white h-12"
        >
          {loading ? (
            <><Loader2 className="w-5 h-5 mr-2 animate-spin" />生成中...</>
          ) : (
            <>🚀 生成本週 7 篇貼文</>
          )}
        </Button>
        <Button
          onClick={handleQueueAll}
          disabled={queueing || loading}
          className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white h-12"
        >
          {queueing ? (
            <><Loader2 className="w-5 h-5 mr-2 animate-spin" />排程中...</>
          ) : (
            <><CalendarDays className="w-5 h-5 mr-2" />一鍵排入全週佇列</>
          )}
        </Button>
      </div>
      <p className="text-xs text-gray-400 text-center">
        「一鍵排入全週佇列」會自動生成並排程，每日 08:00 由系統發出，無需手動操作
      </p>

      {plan && (
        <>
          {plan.week_summary && (
            <Card className="border-blue-100 bg-blue-50">
              <CardContent className="pt-3 pb-3 text-sm text-blue-800">
                📊 <strong>本週策略摘要：</strong>{plan.week_summary}
              </CardContent>
            </Card>
          )}

          <Button variant="outline" onClick={handleDownload} className="w-full border-purple-200 text-purple-700">
            <Download className="w-4 h-4 mr-2" />💾 下載全週貼文（TXT）
          </Button>

          <div className="space-y-4">
            {plan.posts.map((post, i) => (
              <div key={i} className="space-y-2">
                <PostCard post={post} dayLabel={`週${DAY_NAMES[i]} ${post.topic}`} />
                {account?.connected && (
                  <Button
                    onClick={() => handlePublishOne(post, i)}
                    disabled={publishingIdx === i}
                    variant="outline"
                    className="w-full border-green-200 text-green-700 hover:bg-green-50"
                  >
                    {publishingIdx === i
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />發文中...</>
                      : <><Send className="w-4 h-4 mr-2" />立即發布 週{DAY_NAMES[i]} 貼文</>}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
