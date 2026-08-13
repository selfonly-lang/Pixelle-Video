import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Trash2, Clock, CheckCircle2, XCircle, Zap, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';

import {
  getQueue,
  cancelQueueItem,
  rescheduleQueueItem,
  autoFillWeek,
  processQueueNow,
} from '@/lib/beauty-bot-api';
import type { QueueItem } from '@/lib/beauty-bot-api';

const STATUS_BADGE: Record<string, { label: string; class: string }> = {
  scheduled:  { label: '排程中',  class: 'bg-blue-50 text-blue-700 border-blue-200' },
  publishing: { label: '發布中',  class: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  published:  { label: '已發布',  class: 'bg-green-50 text-green-700 border-green-200' },
  failed:     { label: '失敗',    class: 'bg-red-50 text-red-700 border-red-200' },
  cancelled:  { label: '已取消',  class: 'bg-gray-50 text-gray-500 border-gray-200' },
};

function formatCST(iso: string): string {
  return new Date(iso).toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function nextSlotOptions(): { label: string; value: string }[] {
  const slots: { label: string; value: string }[] = [];
  const now = Date.now();
  const cstOffset = 8 * 60 * 60 * 1000;

  for (let dayOffset = 0; dayOffset <= 3; dayOffset++) {
    const base = new Date(now + cstOffset);
    base.setDate(base.getDate() + dayOffset);

    for (const cstHour of [8, 12, 19]) {
      base.setHours(cstHour, 0, 0, 0);
      const utcTime = new Date(base.getTime() - cstOffset);
      if (utcTime.getTime() > now + 5 * 60 * 1000) {
        const label = utcTime.toLocaleString('zh-TW', {
          timeZone: 'Asia/Taipei',
          month: 'numeric',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
        slots.push({ label, value: utcTime.toISOString() });
        if (slots.length >= 6) return slots;
      }
    }
  }
  return slots;
}

export function QueueManager() {
  const [queue, setQueue]           = useState<QueueItem[]>([]);
  const [loading, setLoading]       = useState(false);
  const [filling, setFilling]       = useState(false);
  const [processing, setProcessing] = useState(false);
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const slotOptions = nextSlotOptions();

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const items = await getQueue(30);
      setQueue(items);
    } catch (e: unknown) {
      toast.error(`載入失敗：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const handleCancel = async (id: string, title: string) => {
    try {
      await cancelQueueItem(id);
      toast.success(`已取消：${title}`);
      reload();
    } catch (e: unknown) {
      toast.error(`取消失敗：${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleReschedule = async (id: string, newTime: string) => {
    setReschedulingId(id);
    try {
      await rescheduleQueueItem(id, newTime);
      toast.success('已重新排程！');
      reload();
    } catch (e: unknown) {
      toast.error(`排程失敗：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setReschedulingId(null);
    }
  };

  const handleAutoFill = async () => {
    setFilling(true);
    try {
      const result = await autoFillWeek(0);
      if (result.ok) {
        toast.success(`✅ 本週 ${result.queued} 篇貼文已排入佇列！`);
        reload();
      } else {
        toast.error(`排程失敗：${result.error}`);
      }
    } catch (e: unknown) {
      toast.error(`失敗：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setFilling(false);
    }
  };

  const handleProcessNow = async () => {
    setProcessing(true);
    try {
      const result = await processQueueNow();
      const msg = `已發文 ${result.processed} 篇${result.generated ? `、自動補稿 ${result.generated} 篇` : ''}`;
      if (result.errors.length) toast.warning(`${msg}（${result.errors.length} 個錯誤）`);
      else toast.success(msg || '佇列已處理');
      reload();
    } catch (e: unknown) {
      toast.error(`執行失敗：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setProcessing(false);
    }
  };

  const scheduled  = queue.filter(i => i.status === 'scheduled');
  const publishing = queue.filter(i => i.status === 'publishing');
  const recent     = queue.filter(i => ['published','failed'].includes(i.status)).slice(0, 5);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="grid grid-cols-3 gap-3">
        <Button
          onClick={handleAutoFill}
          disabled={filling}
          className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white text-sm h-10"
        >
          {filling ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />生成中...</> : <><CalendarDays className="w-4 h-4 mr-1" />一鍵排入本週</>}
        </Button>
        <Button
          onClick={handleProcessNow}
          disabled={processing}
          variant="outline"
          className="border-green-300 text-green-700 hover:bg-green-50 text-sm h-10"
        >
          {processing ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />執行中...</> : <><Zap className="w-4 h-4 mr-1" />立即執行佇列</>}
        </Button>
        <Button
          onClick={reload}
          disabled={loading}
          variant="ghost"
          className="text-gray-500 text-sm h-10"
        >
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />重新整理
        </Button>
      </div>

      {/* Summary */}
      <div className="flex gap-3 text-sm">
        <div className="flex items-center gap-1.5 bg-blue-50 rounded-lg px-3 py-2 flex-1">
          <Clock className="w-4 h-4 text-blue-500" />
          <span className="text-blue-800 font-medium">{scheduled.length + publishing.length}</span>
          <span className="text-blue-600">篇待發</span>
        </div>
        <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-3 py-2 text-gray-500 flex-1 text-xs">
          pg_cron 自動在台灣時間 08:00 · 12:00 · 19:00 觸發
        </div>
      </div>

      {/* Scheduled items */}
      {scheduled.length + publishing.length > 0 ? (
        <Card className="border-blue-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-blue-800 flex items-center gap-2">
              <Clock className="w-4 h-4" />排程佇列
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[...publishing, ...scheduled].map(item => (
              <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge variant="outline" className={`text-xs ${STATUS_BADGE[item.status]?.class ?? ''}`}>
                      {STATUS_BADGE[item.status]?.label ?? item.status}
                    </Badge>
                    <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                      {item.topic}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium text-gray-800 truncate">{item.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    預排：{formatCST(item.scheduled_for)}
                  </p>
                </div>

                {item.status === 'scheduled' && (
                  <div className="flex flex-col gap-1 shrink-0">
                    <select
                      className="text-xs border rounded px-2 py-1 text-gray-600 bg-white focus:outline-none focus:ring-1 focus:ring-purple-300"
                      defaultValue=""
                      onChange={e => e.target.value && handleReschedule(item.id, e.target.value)}
                      disabled={reschedulingId === item.id}
                    >
                      <option value="" disabled>改時間</option>
                      {slotOptions.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCancel(item.id, item.title)}
                      className="h-7 px-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />取消
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed border-gray-200">
          <CardContent className="py-8 text-center text-gray-400 text-sm">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
            佇列空了！點「一鍵排入本週」或在快速生成後點「加入排程」
          </CardContent>
        </Card>
      )}

      {/* Recent published / failed */}
      {recent.length > 0 && (
        <Card className="border-gray-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-700">最近紀錄</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recent.map(item => (
              <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg">
                {item.status === 'published'
                  ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  : <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 truncate">{item.title}</p>
                  {item.error_message && (
                    <p className="text-xs text-red-500 truncate">{item.error_message}</p>
                  )}
                </div>
                <span className="text-xs text-gray-400 shrink-0">
                  {item.published_at ? formatCST(item.published_at) : '—'}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
