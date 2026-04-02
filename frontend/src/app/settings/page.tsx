'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, KeyRound, ArrowLeft, ShieldAlert, CheckCircle } from 'lucide-react';
import Link from 'next/link';

const getApiUrl = () => (typeof window !== 'undefined' && (window as any).ENV?.API_URL) ? (window as any).ENV.API_URL : 'http://localhost:3001';

export default function SettingsPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [minLength, setMinLength] = useState(8);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const storedUser = localStorage.getItem('squawk_user');
    if (!storedUser) {
      router.push('/login');
      return;
    }
    setUser(JSON.parse(storedUser));

    // Fetch min password length
    fetch(`${getApiUrl()}/api/settings/public`)
      .then(res => res.json())
      .then(data => {
        if (data.min_password_length) setMinLength(data.min_password_length);
      })
      .catch(console.error);
  }, [router]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < minLength) {
      setError(`New password must be at least ${minLength} characters.`);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    try {
      const res = await fetch(`${getApiUrl()}/api/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to change password.');
      }

      setSuccess('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (!user) return null;

  return (
    <div className="flex flex-col max-w-lg mx-auto p-4 md:p-6 relative z-10 min-h-screen justify-center">
      <div className="glass-panel p-8 rounded-3xl border-t border-glassBorder shadow-2xl flex flex-col gap-6">
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="w-7 h-7 text-orbCyan" />
            <div>
              <h1 className="text-xl font-bold tracking-wider">ACCOUNT<span className="text-orbCyan"> SETTINGS</span></h1>
              <p className="text-xs text-slate-500 font-mono">@{user.username}</p>
            </div>
          </div>
          <Link 
            href="/"
            className="flex items-center gap-2 text-slate-400 hover:text-white border border-slate-700 px-3 py-1.5 rounded-full font-mono text-xs transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> BACK
          </Link>
        </div>

        <div className="border-t border-slate-700/50 pt-6">
          <div className="flex items-center gap-2 mb-4">
            <KeyRound className="w-4 h-4 text-orbCyan" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">Change Password</h2>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-2 text-sm font-mono mb-4">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-2 text-sm font-mono mb-4">
              <CheckCircle className="w-4 h-4 shrink-0" />
              {success}
            </div>
          )}

          <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
            <div className="space-y-1">
              <label className="text-xs font-mono text-slate-400 ml-1">CURRENT PASSWORD</label>
              <input 
                type="password" 
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orbCyan transition-colors font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-mono text-slate-400 ml-1">NEW PASSWORD</label>
              <input 
                type="password" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orbCyan transition-colors font-mono"
              />
              <p className="text-[10px] text-slate-600 font-mono ml-1">Minimum {minLength} characters</p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-mono text-slate-400 ml-1">CONFIRM NEW PASSWORD</label>
              <input 
                type="password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orbCyan transition-colors font-mono"
              />
            </div>

            <button 
              type="submit"
              disabled={!currentPassword || !newPassword || !confirmPassword}
              className="mt-2 w-full bg-orbCyan/20 hover:bg-orbCyan/30 text-orbCyan border border-orbCyan/30 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              UPDATE PASSWORD <KeyRound className="w-4 h-4" />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
