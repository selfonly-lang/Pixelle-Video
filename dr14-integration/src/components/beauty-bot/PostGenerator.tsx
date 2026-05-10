import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, Send, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

import { generatePost, publishToThreads, formatPostForDisplay } from '@/lib/beauty-bot-api';
import type { ThreadsPost, ThreadsAccount } from '@/types/beauty-bot';
import { BEAUTY_TOPICS, POST_FORMATS, WEEKLY_SCHEDULE } from '@/types/beauty-bot';
import { PostCard } from './PostCard';

interface Props {
  account: ThreadsAccount | null;
  onAccountChange: (a: ThreadsAccount) => void;
}

export function PostGenerator({ account }: Props) {
  const todayIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
  const todayPlan = WEEKLY_SCHEDULE[todayIdx];

  const [topic, setTopic] = useState(todayPlan?.theme ?? '玻尿酸');
  const [format, setFormat] = useState(todayPlan?.format ?? '知識分享');
  const [tone, setTone] = useState(todayPlan?.tone ?? '親切專業');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [post, setPost] = useState<ThreadsPost | null>(null);
  const [copied, setCopied] = useState(false);

  const subtopics = BEAUTY_TOPICS[topic]?.subtopics ?? [];

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const result = await generatePost({ topic, post_format: format, tone, custom_notes: notes });
      setPost(result);
      toast.success('貼文生成成功！');
    } catch (e: unknown) {
      toast.error(`生成失敗：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!post) return;
    navigator.clipboard.writeText(formatPostForDisplay(post));
    setCopied(true);
    toast.success('已複製到剪貼簿！');
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePublish = async () => {
    if (!post) return;
    setPublishing(true);
    try {
      const result = await publishToThreads(post, formatPostForDisplay(post));
      if (result.success) {
        toast.success(`✅ 發文成功！${result.post_id ? `ID: ${result.post_id}` : ''}`);
      } else {
        toast.error(`發文失敗：${result.error}`);
      }
    } catch (e: unknown) {
      toast.error(`發文失敗：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-purple-100 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2 text-purple-800">
            <Sparkles className="w-5 h-5" />
            快速生成單篇貼文
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-sm text-gray-600">📌 主題分類</Label>
              <Select value={topic} onValueChange={setTopic}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(BEAUTY_TOPICS).map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex flex-wrap gap-1 mt-1">
                {subtopics.slice(0, 3).map(s => (
                  <Badge key={s} variant="outline" className="text-xs text-purple-600 border-purple-200">{s}</Badge>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-sm text-gray-600">📝 發文格式</Label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(POST_FORMATS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      <span>{k}</span>
                      <span className="text-xs text-gray-400 ml-2">— {v.slice(0, 12)}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-sm text-gray-600">🎨 語氣風格</Label>
            <input
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
              value={tone}
              onChange={e => setTone(e.target.value)}
              placeholder="如：親切專業、輕鬆幽默、科普權威..."
            />
          </div>

          <div className="space-y-1">
            <Label className="text-sm text-gray-600">💭 特別備註（選填）</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="如：近期有玻尿酸優惠活動、強調無痛療程、針對30歲女性..."
              className="resize-none h-20 text-sm"
            />
          </div>

          <Button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />AI 生成中...</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-2" />✨ 生成貼文</>
            )}
          </Button>
        </CardContent>
      </Card>

      {post && (
        <div className="space-y-3">
          <PostCard post={post} />

          <Card className="border-gray-100">
            <CardContent className="pt-4">
              <Label className="text-sm text-gray-500 mb-2 block">📋 完整貼文文字</Label>
              <Textarea
                readOnly
                value={formatPostForDisplay(post)}
                className="resize-none h-48 text-sm bg-gray-50 font-mono"
              />
              <div className="flex gap-2 mt-3">
                <Button variant="outline" onClick={handleCopy} className="flex-1 border-purple-200 text-purple-700 hover:bg-purple-50">
                  {copied ? <><Check className="w-4 h-4 mr-2" />已複製</> : <><Copy className="w-4 h-4 mr-2" />複製全文</>}
                </Button>
                <Button
                  onClick={handlePublish}
                  disabled={publishing || !account?.connected}
                  className="flex-1 bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700 text-white"
                >
                  {publishing ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />發文中...</>
                  ) : (
                    <><Send className="w-4 h-4 mr-2" />🚀 直接發文到 Threads</>
                  )}
                </Button>
              </div>
              {!account?.connected && (
                <p className="text-xs text-amber-600 mt-2 text-center">
                  請先在「🔗 Threads 串接」分頁完成帳號設定
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
