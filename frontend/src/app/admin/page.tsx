'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, UserCheck, XCircle, ArrowLeft, Users, Ban, Trash2, ToggleLeft, ToggleRight, ScrollText, RefreshCw, ArrowUp, ArrowDown } from 'lucide-react';
import Link from 'next/link';

const getApiUrl = () => (typeof window !== 'undefined' && (window as any).ENV?.API_URL) ? (window as any).ENV.API_URL : 'http://localhost:3001';

interface PendingUser {
  id: number;
  username: string;
  created_at: string;
}

interface ManagedUser {
  id: number;
  username: string;
  is_approved: boolean;
  is_admin: boolean;
  is_banned: boolean;
  created_at: string;
}

interface LogEntry {
  timestamp: string;
  direction: 'TX' | 'RX' | 'SYS';
  type: string;
  summary: string;
  raw?: string;
}

export default function AdminPanel() {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [allUsers, setAllUsers] = useState<ManagedUser[]>([]);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsExpanded, setLogsExpanded] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
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

    setCurrentUser(user);
    fetchPending();
    fetchUsers();
    fetchSettings();
    fetchLogs();
  }, [router]);

  const fetchPending = async () => {
    try {
      const res = await fetch(`${getApiUrl()}/api/admin/pending`, { credentials: 'include' });
      if (!res.ok) throw new Error("Unauthorized");
      const data = await res.json();
      setPendingUsers(data);
    } catch {
      router.push('/login');
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${getApiUrl()}/api/admin/users`, { credentials: 'include' });
      if (res.ok) setAllUsers(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${getApiUrl()}/api/admin/settings`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setRegistrationEnabled(data.registration_enabled !== 'false');
      }
    } catch (e) { console.error(e); }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch(`${getApiUrl()}/api/admin/logs?count=200`, { credentials: 'include' });
      if (res.ok) setLogs(await res.json());
    } catch (e) { console.error(e); }
  };

  const handlePendingAction = async (id: number, action: 'approve' | 'reject') => {
    try {
      setPendingUsers(prev => prev.filter(u => u.id !== id));
      await fetch(`${getApiUrl()}/api/admin/${action}/${id}`, {
        method: action === 'approve' ? 'POST' : 'DELETE',
        credentials: 'include'
      });
      fetchUsers();
    } catch (e) {
      console.error(e);
      fetchPending();
    }
  };

  const handleBan = async (id: number) => {
    try {
      await fetch(`${getApiUrl()}/api/admin/ban/${id}`, { method: 'POST', credentials: 'include' });
      fetchUsers();
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id: number, username: string) => {
    if (!confirm(`Permanently delete @${username}? This cannot be undone.`)) return;
    try {
      await fetch(`${getApiUrl()}/api/admin/user/${id}`, { method: 'DELETE', credentials: 'include' });
      fetchUsers();
      fetchPending();
    } catch (e) { console.error(e); }
  };

  const toggleRegistration = async () => {
    const newValue = !registrationEnabled;
    try {
      await fetch(`${getApiUrl()}/api/admin/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ registration_enabled: String(newValue) })
      });
      setRegistrationEnabled(newValue);
    } catch (e) { console.error(e); }
  };

  const dirColor = (dir: string) => {
    if (dir === 'TX') return 'text-orbCyan';
    if (dir === 'RX') return 'text-emerald-400';
    return 'text-amber-400';
  };

  return (
    <div className="flex flex-col max-w-4xl mx-auto p-4 md:p-6 relative z-10 min-h-screen">

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

      <div className="space-y-8">

        {/* PENDING CLEARANCES */}
        <section className="glass-panel rounded-2xl p-6">
          <h2 className="text-lg font-bold border-b border-slate-700 pb-3 mb-4 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-orbCyan" /> Pending Approvals
          </h2>

          {pendingUsers.map(user => (
            <div key={user.id} className="bg-slate-800/50 border border-slate-700 p-4 rounded-xl flex items-center justify-between mb-3">
              <div>
                <p className="font-mono text-orbCyan break-all">@{user.username}</p>
                <p className="text-xs text-slate-500 font-mono">
                  {new Date(user.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePendingAction(user.id, 'approve')}
                  className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition-colors"
                >
                  <UserCheck className="w-4 h-4" /> Approve
                </button>
                <button
                  onClick={() => handlePendingAction(user.id, 'reject')}
                  className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors"
                >
                  <XCircle className="w-4 h-4" /> Reject
                </button>
              </div>
            </div>
          ))}

          {pendingUsers.length === 0 && (
            <div className="text-center text-slate-500 font-mono py-6 text-sm">
              No pending approvals.
            </div>
          )}
        </section>

        {/* GATEWAY SETTINGS */}
        <section className="glass-panel rounded-2xl p-6">
          <h2 className="text-lg font-bold border-b border-slate-700 pb-3 mb-4 flex items-center gap-2">
            <ToggleRight className="w-5 h-5 text-orbCyan" /> Gateway Settings
          </h2>

          <div className="flex items-center justify-between bg-slate-800/50 border border-slate-700 p-4 rounded-xl">
            <div>
              <p className="font-bold text-white">Public Registration</p>
              <p className="text-xs text-slate-500 mt-1">Allow new users to create accounts</p>
            </div>
            <button
              onClick={toggleRegistration}
              className={`p-1 rounded-lg transition-all ${registrationEnabled ? 'text-emerald-400' : 'text-slate-600'}`}
              title={registrationEnabled ? 'Disable Registration' : 'Enable Registration'}
            >
              {registrationEnabled
                ? <ToggleRight className="w-10 h-10" />
                : <ToggleLeft className="w-10 h-10" />
              }
            </button>
          </div>
        </section>

        {/* ALL USERS */}
        <section className="glass-panel rounded-2xl p-6">
          <h2 className="text-lg font-bold border-b border-slate-700 pb-3 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-orbCyan" /> All Users
            <span className="ml-auto text-xs text-slate-500 font-mono">{allUsers.length} total</span>
          </h2>

          <div className="space-y-3">
            {allUsers.map(u => (
              <div key={u.id} className={`bg-slate-800/50 border p-4 rounded-xl flex items-center justify-between ${u.is_banned ? 'border-red-500/30 opacity-60' : 'border-slate-700'}`}>
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-orbCyan break-all">@{u.username}</p>
                      {u.is_admin && (
                        <span className="text-[9px] font-black bg-orbCyan/10 text-orbCyan px-1.5 py-0.5 rounded border border-orbCyan/20">ADMIN</span>
                      )}
                      {u.is_banned && (
                        <span className="text-[9px] font-black bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded border border-red-500/20">BANNED</span>
                      )}
                      {!u.is_approved && !u.is_banned && (
                        <span className="text-[9px] font-black bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20">PENDING</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 font-mono mt-1">
                      Joined {new Date(u.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Don't show actions for the current admin's own account */}
                {currentUser && u.id !== currentUser.id && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleBan(u.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${u.is_banned
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20'
                        }`}
                      title={u.is_banned ? 'Unban User' : 'Ban User'}
                    >
                      <Ban className="w-3.5 h-3.5" /> {u.is_banned ? 'Unban' : 'Ban'}
                    </button>
                    <button
                      onClick={() => handleDelete(u.id, u.username)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors text-xs font-bold"
                      title="Permanently Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* NODE LOG */}
        <section className="glass-panel rounded-2xl p-6 mb-12">
          <div className="flex items-center justify-between border-b border-slate-700 pb-3 mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <ScrollText className="w-5 h-5 text-orbCyan" /> Node Traffic Log
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchLogs}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-slate-400 hover:text-white border border-slate-700 rounded-lg text-xs font-bold transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
              <button
                onClick={() => setLogsExpanded(!logsExpanded)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-slate-400 hover:text-white border border-slate-700 rounded-lg text-xs font-bold transition-colors"
              >
                {logsExpanded ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
                {logsExpanded ? 'Collapse' : 'Expand'}
              </button>
            </div>
          </div>

          <div className={`overflow-y-auto font-mono text-xs space-y-0.5 transition-all ${logsExpanded ? 'max-h-[70vh]' : 'max-h-64'}`}>
            {logs.length === 0 && (
              <div className="text-center text-slate-500 py-8">No log entries yet. Waiting for node traffic...</div>
            )}
            {[...logs].reverse().map((entry, i) => (
              <div key={i} className="flex gap-2 px-3 py-1.5 hover:bg-slate-800/50 rounded transition-colors">
                <span className="text-slate-600 shrink-0 w-[145px]">
                  {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 } as any)}
                </span>
                <span className={`font-black shrink-0 w-8 ${dirColor(entry.direction)}`}>
                  {entry.direction}
                </span>
                <span className="text-slate-500 shrink-0 w-24">[{entry.type}]</span>
                <span className="text-slate-300 break-all">{entry.summary}</span>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
