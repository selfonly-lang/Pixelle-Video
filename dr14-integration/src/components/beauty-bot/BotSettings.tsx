import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings } from 'lucide-react';
import { WEEKLY_SCHEDULE } from '@/types/beauty-bot';

const DAY_NAMES = ['一', '二', '三', '四', '五', '六', '日'];

const CTA_TEMPLATES = [
  '✨ 想了解更多？來 己美社群 和千位美麗夥伴一起交流！\n👉 https://self.com.tw\n💬 加入 BeVenus：https://m.facebook.com/groups/bevenus',
  '💡 有任何醫美疑問？免費諮詢、真實評價都在這裡！\n🔗 己美 self.com.tw\n👥 BeVenus 社群：https://m.facebook.com/groups/bevenus',
  '🌸 美麗不孤單！加入我們的醫美社群，分享你的蛻變故事\n✅ 己美 self.com.tw\n💄 加入 BeVenus：https://m.facebook.com/groups/bevenus',
];

export function BotSettings() {
  return (
    <div className="space-y-4">
      <Card className="border-purple-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2 text-purple-800">
            <Settings className="w-4 h-4" />機器人設定
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-gray-500">己美官網</label>
              <div className="text-sm font-medium text-purple-700 bg-purple-50 rounded px-3 py-2">https://self.com.tw</div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500">BeVenus 社群</label>
              <div className="text-sm font-medium text-blue-700 bg-blue-50 rounded px-3 py-2 truncate">
                https://m.facebook.com/groups/bevenus
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-400">如需修改連結，請聯絡管理員更新 Supabase Edge Function 中的 CTA_TEMPLATES</p>
        </CardContent>
      </Card>

      <Card className="border-gray-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-gray-600">📝 CTA 模板（輪流使用）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {CTA_TEMPLATES.map((cta, i) => (
            <div key={i} className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1">模板 {i + 1}</div>
              <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans">{cta}</pre>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-gray-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-gray-600">🗓️ 週主題排程</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {Object.entries(WEEKLY_SCHEDULE).map(([day, plan]) => (
              <div key={day} className="flex items-center gap-3 text-sm py-1 border-b border-gray-50 last:border-0">
                <span className="font-medium text-purple-700 w-12">週{DAY_NAMES[Number(day)]}</span>
                <span className="text-gray-700">{plan.theme}</span>
                <span className="text-gray-400">×</span>
                <span className="text-gray-600">{plan.format}</span>
                <span className="text-gray-400 text-xs">— {plan.tone}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
