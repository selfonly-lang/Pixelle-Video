import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Loader2, Target } from 'lucide-react';
import { toast } from 'sonner';
import { generateSeries } from '@/lib/beauty-bot-api';
import type { ThreadsPost, ThreadsAccount } from '@/types/beauty-bot';
import { BEAUTY_TOPICS } from '@/types/beauty-bot';
import { PostCard } from './PostCard';

interface Props { account: ThreadsAccount | null; }

export function SeriesPosts({ account: _ }: Props) {
  const [topic, setTopic] = useState('玻尿酸');
  const [count, setCount] = useState(3);
  const [loading, setLoading] = useState(false);
  const [posts, setPosts] = useState<ThreadsPost[]>([]);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const result = await generateSeries(topic, count);
      setPosts(result);
      toast.success(`✅ 已生成 ${result.length} 篇 ${topic} 系列貼文！`);
    } catch (e: unknown) {
      toast.error(`生成失敗：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-purple-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2 text-purple-800">
            <Target className="w-4 h-4" />主題系列貼文
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm text-gray-600">主題</label>
              <Select value={topic} onValueChange={setTopic}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(BEAUTY_TOPICS).map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-gray-600">生成篇數：{count} 篇</label>
              <Slider value={[count]} onValueChange={v => setCount(v[0])} min={2} max={5} step={1} />
            </div>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white"
          >
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />生成中...</> : `🎯 生成 ${count} 篇 ${topic} 系列`}
          </Button>
        </CardContent>
      </Card>

      {posts.map((post, i) => (
        <PostCard key={i} post={post} dayLabel={`第 ${i + 1} 篇`} />
      ))}
    </div>
  );
}
