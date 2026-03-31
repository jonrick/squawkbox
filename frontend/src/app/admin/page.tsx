'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, UserCheck, XCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const getApiUrl = () => (typeof window !== 'undefined' && (window as any).ENV?.API_URL) ? (window as any).ENV.API_URL : 'http://localhost:3001';

interface PendingUser {
  id: number;
  username: string;
  created_at: string;
}

export default function AdminPanel() {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const router = useRouter();

  useEffect(() => {
    const storedUser = localStorage.getItem('squawk_user');
    
    if (!storedUser) {
      router.push('/login');
      return;
    }
    
    const user = JSON.parse(storedUser);
    if (!user.is_admin) {
      router.push('/');
      return;
    }

    fetchPending();
  }, [router]);

  const fetchPending = async () => {
    try {
      const res = await fetch(`${getApiUrl()}/api/admin/pending`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error("Unauthorized");
      const data = await res.json();
      setPendingUsers(data);
    } catch {
      router.push('/login');
    }
  }

  const handleAction = async (id: number, action: 'approve' | 'reject') => {
    try {
      // Optimistic UI Update
      setPendingUsers(prev => prev.filter(u => u.id !== id));

      await fetch(`${getApiUrl()}/api/admin/${action}/${id}`, {
        method: action === 'approve' ? 'POST' : 'DELETE',
        credentials: 'include'
      });
    } catch (e) {
      console.error(e);
      // If error, refetch to restore
      fetchPending();
    }
  }

  return (
    <div className="flex flex-col h-screen max-w-3xl mx-auto p-4 md:p-6 relative z-10 glass-panel border-x border-b-0 min-h-screen">
      
      <header className="flex flex-col sm:flex-row gap-4 items-center justify-between pb-4 border-b border-glassBorder mb-8">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-orbCyan" />
          <div>
            <h1 className="text-2xl font-bold tracking-wider">GATEWAY<span className="text-orbCyan"> ADMIN</span></h1>
            <p className="text-sm text-slate-400 font-mono">Access Control & Authorization</p>
          </div>
        </div>
        <Link 
          href="/the-roost"
          className="flex items-center gap-2 text-slate-400 hover:text-white border border-slate-700 px-4 py-2 rounded-full font-mono text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> THE ROOST
        </Link>
      </header>

      <div className="flex-1 space-y-6">
        <h2 className="text-lg font-bold border-b border-slate-700 pb-2">Pending Clearances</h2>
        
        {pendingUsers.map(user => (
          <div key={user.id} className="bg-slate-800/50 border border-slate-700 p-4 rounded-xl flex items-center justify-between">
            <div>
              <p className="font-mono text-orbCyan break-all">@{user.username}</p>
              <p className="text-xs text-slate-500 font-mono">
                {new Date(user.created_at).toLocaleString()}
              </p>
            </div>
            
            <div className="flex gap-2">
              <button 
                onClick={() => handleAction(user.id, 'approve')}
                className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition-colors"
              >
                <UserCheck className="w-4 h-4" /> Approve
              </button>
              <button 
                onClick={() => handleAction(user.id, 'reject')}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors"
              >
                <XCircle className="w-4 h-4" /> Reject
              </button>
            </div>
          </div>
        ))}

        {pendingUsers.length === 0 && (
          <div className="text-center text-slate-500 font-mono py-12">
            No pending clearances. Secure.
          </div>
        )}
      </div>

    </div>
  );
}
