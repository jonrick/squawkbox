'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send, ShieldAlert, Fingerprint } from 'lucide-react';
import Link from 'next/link';

const getApiUrl = () => (typeof window !== 'undefined' && (window as any).ENV?.API_URL) ? (window as any).ENV.API_URL : 'http://localhost:3001';

export default function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState<'idle' | 'success'>('idle');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.match(/^[a-zA-Z0-9_]{3,16}$/)) {
      setError('Username must be 3-16 chars alphanumeric/underscore.');
      return;
    }

    try {
      const res = await fetch(`${getApiUrl()}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password })
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      setStatus('success');
      
      // If auto-approved (first user), they can login immediately.
      // We will just redirect to login so they can authenticate.
      setTimeout(() => {
        router.push('/login');
      }, 2000);

    } catch (err: any) {
      setError(err.message);
    }
  };

  if (status === 'success') {
    return (
      <div className="flex flex-col h-screen max-w-sm mx-auto justify-center p-6 relative z-10">
        <div className="glass-panel p-8 flex flex-col items-center text-center gap-4 rounded-3xl border-orbCyan/30 border">
          <Fingerprint className="w-12 h-12 text-orbCyan" />
          <h2 className="text-xl font-bold">Account Pending</h2>
          <p className="text-slate-400 text-sm">Your account access is pending admin approval. You will be redirected to the terminal.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-w-sm mx-auto justify-center p-6 relative z-10">
      <div className="glass-panel p-8 rounded-3xl border-t border-glassBorder shadow-2xl flex flex-col gap-6">
        
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-wider">SQUAWK<span className="text-orbCyan">BOX</span></h1>
          <p className="text-xs text-slate-500 font-mono tracking-widest">ACCOUNT REGISTRATION</p>
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
              className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orbCyan transition-colors font-mono placeholder:text-slate-600"
              placeholder="e.g. ghost_actual"
              maxLength={16}
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
            REGISTER ACCOUNT <Send className="w-4 h-4" />
          </button>
        </form>

        <p className="text-center text-xs font-mono text-slate-500 mt-4">
          HAVE AN ACCOUNT? <Link href="/login" className="text-orbCyan hover:underline">LOGIN INSTEAD</Link>
        </p>

      </div>
    </div>
  );
}
