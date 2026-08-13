import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Link2, CheckCircle, AlertCircle, ExternalLink, LogOut } from 'lucide-react';
import { toast } from 'sonner';

import {
  verifyThreadsToken,
  saveThreadsToken,
  exchangeOAuthCode,
  publishText,
  fetchPostHistory,
} from '@/lib/beauty-bot-api';
import type { ThreadsAccount, PostHistoryItem } from '@/types/beauty-bot';
import { useEffect } from 'react';

const APP_ID = '1854440058813609';

function buildOAuthUrl(): { oauthUrl: string; redirectUri: string } {
  const redirectUri = (typeof window !== 'undefined' ? window.location.origin : 'https://self.com.tw') + '/oauth/callback';
  const oauthUrl =
    `https://threads.net/oauth/authorize?client_id=${APP_ID}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=threads_basic,threads_content_publish,threads_manage_insights` +
    `&response_type=code&state=beautybot`;
  return { oauthUrl, redirectUri };
}

interface Props {
  account: ThreadsAccount | null;
  onAccountChange: (a: ThreadsAccount) => void;
}

export function ThreadsConnect({ account, onAccountChange }: Props) {
  const [codeInput, setCodeInput] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [testText, setTestText] = useState(
    '🌸 BeautyBot 測試發文 — 醫美資訊自動化上線！\n\n更多醫美資訊 👉 https://self.com.tw',
  );
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<PostHistoryItem[]>([]);
  const { oauthUrl, redirectUri } = buildOAuthUrl();

  useEffect(() => {
    fetchPostHistory(20).then(setHistory).catch(() => {});
  }, []);

  const handleOAuthExchange = async () => {
    if (!codeInput.trim()) return;
    setLoading(true);
    try {
      const result = await exchangeOAuthCode(codeInput.trim(), redirectUri);
      if (result.ok) {
        toast.success(`✅ 授權成功！帳號：@${result.username}  Token 有效至：${result.expires_at?.slice(0, 10)}`);
        onAccountChange({ connected: true, username: result.username, user_id: result.user_id, today_count: 0, remaining: 250 });
        setCodeInput('');
      } else {
        toast.error(`授權失敗：${result.error}`);
      }
    } catch (e: unknown) {
      toast.error(`失敗：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDirectToken = async () => {
    if (!tokenInput.trim()) return;
    setLoading(true);
    try {
      const vr = await verifyThreadsToken(tokenInput.trim());
      if (vr.ok) {
        await saveThreadsToken(tokenInput.trim(), vr.user_id!, vr.username!);
        toast.success(`✅ 驗證成功！帳號：@${vr.username}`);
        onAccountChange({ connected: true, username: vr.username, user_id: vr.user_id, today_count: 0, remaining: 250 });
        setTokenInput('');
      } else {
        toast.error(`驗證失敗：${vr.error}`);
      }
    } catch (e: unknown) {
      toast.error(`失敗：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTestPublish = async () => {
    setLoading(true);
    try {
      const result = await publishText(testText);
      if (result.success) {
        toast.success(`✅ 測試成功！貼文 ID：${result.post_id}`);
        fetchPostHistory(20).then(setHistory).catch(() => {});
      } else {
        toast.error(`失敗：${result.error}`);
      }
    } catch (e: unknown) {
      toast.error(`失敗：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Status */}
      {account?.connected ? (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-green-600" />
                <div>
                  <div className="font-semibold text-green-800">Threads 已連線</div>
                  <div className="text-sm text-green-600">
                    @{account.username || account.user_id} · 今日 {account.today_count}/250 篇
                  </div>
                </div>
              </div>
              <Button variant="outline" size="sm" className="border-red-200 text-red-600 hover:bg-red-50">
                <LogOut className="w-3 h-3 mr-1" />登出
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-amber-500" />
              <div className="text-sm text-amber-800">尚未連接 Threads 帳號，請完成下方三步驟授權</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 1: OAuth URL */}
      <Card className="border-purple-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-purple-800">步驟 1️⃣ 點擊授權 Threads 帳號</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-gray-500">
            點下方按鈕，在瀏覽器中授權你的 Threads 帳號（需已設定 Redirect URI）
          </p>
          <a href={oauthUrl} target="_blank" rel="noreferrer">
            <Button className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white">
              <ExternalLink className="w-4 h-4 mr-2" />🔗 點此授權 Threads 帳號
            </Button>
          </a>
          <p className="text-xs text-gray-400">
            授權後會跳轉至 {redirectUri}?code=XXXXXX，複製整個網址
          </p>
        </CardContent>
      </Card>

      {/* Step 2: Paste Code */}
      <Card className="border-purple-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-purple-800">步驟 2️⃣ 貼入授權 Code</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">授權 Code 或完整 Redirect URL</Label>
            <Input
              value={codeInput}
              onChange={e => setCodeInput(e.target.value)}
              placeholder="貼入授權後的完整網址或 code 值..."
              className="text-sm"
            />
          </div>
          <Button
            onClick={handleOAuthExchange}
            disabled={loading || !codeInput.trim()}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white"
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            🔄 換取 Access Token
          </Button>
        </CardContent>
      </Card>

      {/* Alternative: Direct Token */}
      <Card className="border-gray-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-600">或直接貼入 Access Token（已有長效 Token 時）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            type="password"
            value={tokenInput}
            onChange={e => setTokenInput(e.target.value)}
            placeholder="貼入長效 Access Token..."
            className="text-sm"
          />
          <Button
            onClick={handleDirectToken}
            disabled={loading || !tokenInput.trim()}
            variant="outline"
            className="w-full border-purple-200 text-purple-700"
          >
            💾 驗證並儲存
          </Button>
        </CardContent>
      </Card>

      {/* Test Post */}
      {account?.connected && (
        <Card className="border-teal-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-teal-700 flex items-center gap-2">
              <Link2 className="w-4 h-4" />測試發文
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={testText}
              onChange={e => setTestText(e.target.value)}
              className="resize-none h-24 text-sm"
            />
            <Button
              onClick={handleTestPublish}
              disabled={loading}
              variant="outline"
              className="w-full border-teal-200 text-teal-700 hover:bg-teal-50"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              📤 發送測試貼文
            </Button>
          </CardContent>
        </Card>
      )}

      {/* History */}
      <Card className="border-gray-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-600">📋 發文歷史（最近 20 筆）</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">尚無發文記錄</p>
          ) : (
            <div className="space-y-1">
              {history.map(h => (
                <div key={h.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge
                      variant="outline"
                      className={`text-xs flex-shrink-0 ${h.success ? 'text-green-600 border-green-200' : 'text-red-600 border-red-200'}`}
                    >
                      {h.success ? '✅' : '❌'}
                    </Badge>
                    <span className="text-sm truncate text-gray-700">{h.title}</span>
                    <Badge variant="outline" className="text-xs text-purple-600 border-purple-100 flex-shrink-0">{h.topic}</Badge>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                    {h.published_at.slice(0, 16).replace('T', ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
