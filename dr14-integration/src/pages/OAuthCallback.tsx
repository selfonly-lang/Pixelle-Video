// OAuth callback page — auto-exchanges the ?code= returned by Threads
// Route this component to /oauth/callback in your router.
//
// Setup (React Router v6):
//   import OAuthCallback from '@/pages/OAuthCallback';
//   { path: '/oauth/callback', element: <OAuthCallback /> }

import { useEffect, useState } from 'react';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { exchangeOAuthCode } from '@/lib/beauty-bot-api';

export default function OAuthCallback() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [username, setUsername] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');

    if (error) {
      setStatus('error');
      setMessage(`授權被拒絕：${params.get('error_description') ?? error}`);
      return;
    }

    if (!code) {
      setStatus('error');
      setMessage('未收到授權 Code，請重試。');
      return;
    }

    const redirectUri = window.location.origin + '/oauth/callback';
    exchangeOAuthCode(code, redirectUri)
      .then(result => {
        if (result.ok) {
          setUsername(result.username ?? '');
          setStatus('success');
          setMessage(`授權成功！Token 有效至 ${result.expires_at?.slice(0, 10) ?? '未知'}`);
          // Redirect to beauty bot after 3 seconds
          setTimeout(() => {
            window.location.href = '/beauty-bot';
          }, 3000);
        } else {
          setStatus('error');
          setMessage(`授權失敗：${result.error ?? '未知錯誤'}`);
        }
      })
      .catch(err => {
        setStatus('error');
        setMessage(`網路錯誤：${err instanceof Error ? err.message : String(err)}`);
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center space-y-4">
        {status === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 text-purple-500 animate-spin mx-auto" />
            <h2 className="text-lg font-semibold text-gray-700">正在完成 Threads 授權…</h2>
            <p className="text-sm text-gray-400">請稍候，正在換取 Access Token</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
            <h2 className="text-lg font-semibold text-green-700">授權成功！</h2>
            {username && <p className="text-sm text-gray-600">帳號：@{username}</p>}
            <p className="text-sm text-gray-500">{message}</p>
            <p className="text-xs text-gray-400">3 秒後自動跳轉…</p>
          </>
        )}
        {status === 'error' && (
          <>
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
            <h2 className="text-lg font-semibold text-red-700">授權失敗</h2>
            <p className="text-sm text-gray-600">{message}</p>
            <button
              onClick={() => window.history.back()}
              className="mt-2 text-sm text-purple-600 underline"
            >
              返回重試
            </button>
          </>
        )}
      </div>
    </div>
  );
}
