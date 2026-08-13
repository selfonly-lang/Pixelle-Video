import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import { WEEKLY_SCHEDULE } from '@/types/beauty-bot';

const DAY_NAMES = ['一', '二', '三', '四', '五', '六', '日'];

const STRATEGIES = [
  { icon: '⏰', title: '最佳發文時段', desc: '早上 7-9 點、中午 12-13 點、晚上 8-10 點' },
  { icon: '📊', title: '發文頻率', desc: '每天 1-2 篇，保持穩定節奏比爆發式更重要' },
  { icon: '🎯', title: '內容比例', desc: '60% 知識科普 + 30% 互動話題 + 10% 優惠推廣' },
  { icon: '🔗', title: 'Hashtag 策略', desc: '3-5 個大眾標籤 + 5-7 個利基標籤，每篇不超過 12 個' },
  { icon: '💬', title: '互動技巧', desc: '發文後前 30 分鐘主動回覆留言，提升演算法排名' },
  { icon: '🤝', title: '跨平台導流', desc: 'Threads 內容精選發至 Facebook BeVenus 社群' },
  { icon: '🌟', title: 'UGC 激勵', desc: '鼓勵用戶在己美平台留評價並分享至 Threads' },
  { icon: '📱', title: 'IG Stories 搭配', desc: 'Threads 貼文發布後同步更新 IG Stories' },
];

export function StrategyGuide() {
  const weekStart = (() => {
    const d = new Date();
    d.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1));
    return d;
  })();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-purple-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-purple-800 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />Threads 醫美帳號增粉策略
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {STRATEGIES.map(s => (
              <div key={s.title} className="flex gap-2 text-sm">
                <span className="flex-shrink-0">{s.icon}</span>
                <div><span className="font-medium text-gray-700">{s.title}：</span><span className="text-gray-500">{s.desc}</span></div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-green-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-green-800">🎯 導流到己美 & BeVenus</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-600 space-y-3">
            <div>
              <div className="font-medium text-green-700 mb-1">📌 己美 self.com.tw</div>
              <ul className="space-y-1 text-xs list-disc list-inside">
                <li>每篇貼文結尾放置連結</li>
                <li>提及「在己美查詢真實評價」</li>
                <li>使用「己美推薦」作為帳號標籤</li>
                <li>分享在己美找到好醫師的故事</li>
              </ul>
            </div>
            <div>
              <div className="font-medium text-blue-700 mb-1">👥 BeVenus 醫美社群</div>
              <ul className="space-y-1 text-xs list-disc list-inside">
                <li>邀請「加入 BeVenus，與萬人交流」</li>
                <li>每週一篇社群精選話題</li>
                <li>舉辦在 BeVenus 發文抽獎活動</li>
                <li>貼文底部固定 Facebook 社群連結</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-gray-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-700">📊 14 天內容日曆</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  {['日期', '星期', '主題', '格式', '語氣', '導流目標'].map(h => (
                    <th key={h} className="pb-2 text-left text-gray-500 font-medium pr-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 14 }, (_, i) => {
                  const date = new Date(weekStart);
                  date.setDate(date.getDate() + i);
                  const plan = WEEKLY_SCHEDULE[i % 7];
                  const isToday = date.toDateString() === new Date().toDateString();
                  return (
                    <tr key={i} className={`border-b border-gray-50 ${isToday ? 'bg-purple-50' : ''}`}>
                      <td className="py-1.5 pr-3 text-gray-600">{date.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })}</td>
                      <td className="py-1.5 pr-3 text-gray-600">週{DAY_NAMES[i % 7]}{isToday && ' ●'}</td>
                      <td className="py-1.5 pr-3 font-medium text-purple-700">{plan.theme}</td>
                      <td className="py-1.5 pr-3 text-gray-600">{plan.format}</td>
                      <td className="py-1.5 pr-3 text-gray-500">{plan.tone}</td>
                      <td className="py-1.5 text-green-600">self.com.tw + BeVenus</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
