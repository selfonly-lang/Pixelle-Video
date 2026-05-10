import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Sparkles, Calendar, Target, TrendingUp, Link2, Settings } from 'lucide-react';

import { PostGenerator } from '@/components/beauty-bot/PostGenerator';
import { WeeklyPlan } from '@/components/beauty-bot/WeeklyPlan';
import { SeriesPosts } from '@/components/beauty-bot/SeriesPosts';
import { StrategyGuide } from '@/components/beauty-bot/StrategyGuide';
import { ThreadsConnect } from '@/components/beauty-bot/ThreadsConnect';
import { BotSettings } from '@/components/beauty-bot/BotSettings';
import { getThreadsAccount } from '@/lib/beauty-bot-api';
import type { ThreadsAccount } from '@/types/beauty-bot';
import { WEEKLY_SCHEDULE } from '@/types/beauty-bot';

const DAY_NAMES = ['一', '二', '三', '四', '五', '六', '日'];

export default function BeautyBot() {
  const [account, setAccount] = useState<ThreadsAccount | null>(null);

  useEffect(() => {
    getThreadsAccount().then(setAccount).catch(() => {});
  }, []);

  const todayPlan = WEEKLY_SCHEDULE[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
  const todayName = DAY_NAMES[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50">
      {/* Hero */}
      <div className="bg-gradient-to-r from-pink-400 via-purple-500 to-indigo-500 text-white px-6 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="w-8 h-8" />
            <h1 className="text-2xl font-bold">BeautyBot 醫美發文機器人</h1>
          </div>
          <p className="text-pink-100 text-sm">
            AI 自動生成高互動率 Threads 貼文 · 增粉導流 · 連結己美 self.com.tw 及 BeVenus 醫美社群
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        {/* Status Bar */}
        <div className="flex flex-wrap gap-3 items-center">
          {account?.connected ? (
            <Alert className="border-green-200 bg-green-50 flex-1">
              <AlertDescription className="text-green-800 text-sm">
                ✅ Threads 已連線{account.username ? ` @${account.username}` : ''} ·
                今日已發 {account.today_count}/250 篇 · 剩餘 {account.remaining} 篇
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="border-amber-200 bg-amber-50 flex-1">
              <AlertDescription className="text-amber-800 text-sm">
                💡 尚未連接 Threads 帳號，請前往「🔗 Threads 串接」分頁完成設定後即可直接發文
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
              今天 週{todayName}
            </Badge>
            <Badge variant="outline" className="bg-pink-50 text-pink-700 border-pink-200">
              推薦：{todayPlan?.theme} × {todayPlan?.format}
            </Badge>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="generate" className="space-y-4">
          <TabsList className="grid grid-cols-6 w-full bg-white border shadow-sm">
            <TabsTrigger value="generate" className="flex items-center gap-1 text-xs">
              <Sparkles className="w-3 h-3" /> 快速生成
            </TabsTrigger>
            <TabsTrigger value="weekly" className="flex items-center gap-1 text-xs">
              <Calendar className="w-3 h-3" /> 週計畫
            </TabsTrigger>
            <TabsTrigger value="series" className="flex items-center gap-1 text-xs">
              <Target className="w-3 h-3" /> 系列貼文
            </TabsTrigger>
            <TabsTrigger value="strategy" className="flex items-center gap-1 text-xs">
              <TrendingUp className="w-3 h-3" /> 增粉策略
            </TabsTrigger>
            <TabsTrigger value="threads" className="flex items-center gap-1 text-xs">
              <Link2 className="w-3 h-3" /> Threads 串接
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-1 text-xs">
              <Settings className="w-3 h-3" /> 設定
            </TabsTrigger>
          </TabsList>

          <TabsContent value="generate">
            <PostGenerator account={account} onAccountChange={setAccount} />
          </TabsContent>
          <TabsContent value="weekly">
            <WeeklyPlan account={account} />
          </TabsContent>
          <TabsContent value="series">
            <SeriesPosts account={account} />
          </TabsContent>
          <TabsContent value="strategy">
            <StrategyGuide />
          </TabsContent>
          <TabsContent value="threads">
            <ThreadsConnect account={account} onAccountChange={setAccount} />
          </TabsContent>
          <TabsContent value="settings">
            <BotSettings />
          </TabsContent>
        </Tabs>
      </div>

      {/* Footer */}
      <footer className="text-center text-xs text-gray-400 py-6">
        BeautyBot ·{' '}
        <a href="https://self.com.tw" className="hover:text-purple-500" target="_blank" rel="noreferrer">
          己美 self.com.tw
        </a>{' '}
        ·{' '}
        <a href="https://m.facebook.com/groups/bevenus" className="hover:text-purple-500" target="_blank" rel="noreferrer">
          BeVenus 醫美社群
        </a>
      </footer>
    </div>
  );
}
