'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send, ShieldAlert } from 'lucide-react';
import Link from 'next/link';

const getApiUrl = () => (typeof window !== 'undefined' && (window as any).ENV?.API_URL) ? (window as any).ENV.API_URL : 'http://localhost:3001';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const res = await fetch(`${getApiUrl()}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password })
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      // Store user data in localStorage (JWT is now an HttpOnly Cookie handled inherently)
      localStorage.setItem('squawk_user', JSON.stringify(data.user));

      // Route
      if (data.user.is_admin) {
        router.push('/admin'); // Admins usually want to see the dashboard first or can switch
      } else {
        router.push('/');
      }

    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-sm mx-auto justify-center p-6 relative z-10">
      <div className="glass-panel p-8 rounded-3xl border-t border-glassBorder shadow-2xl flex flex-col gap-6">
        
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-wider">SQUAWK<span className="text-orbCyan">BOX</span></h1>
          <p className="text-xs text-slate-500 font-mono tracking-widest">SECURE LOGON</p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-2 text-sm font-mono">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="space-y-1">
            <label className="text-xs font-mono text-slate-400 ml-1">USERNAME (@username)</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orbCyan transition-colors font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-mono text-slate-400 ml-1">PASSWORD</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orbCyan transition-colors font-mono"
            />
          </div>

          <button 
            type="submit"
            disabled={!username || !password}
            className="mt-2 w-full bg-orbCyan/20 hover:bg-orbCyan/30 text-orbCyan border border-orbCyan/30 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            LOGIN <Send className="w-4 h-4" />
          </button>
        </form>

        <p className="text-center text-xs font-mono text-slate-500 mt-4">
          NO ACCOUNT? <Link href="/register" className="text-orbCyan hover:underline">REGISTER INSTEAD</Link>
        </p>

      </div>
    </div>
  );
}
