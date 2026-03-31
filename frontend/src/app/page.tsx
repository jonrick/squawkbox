'use client';

import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Send, Radio, LogOut, ShieldCheck, Activity, Route, Signal, Reply, X, Github } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import manifest from '../../version.json';

// Lazy getter — called at runtime inside useEffect/handlers where window is always available.
// This prevents Next.js SSR from freezing it as 'localhost' before window.ENV is populated.
const getApiUrl = () =>
  (typeof window !== 'undefined' && (window as any).ENV?.API_URL)
    ? (window as any).ENV.API_URL
    : 'http://localhost:3001';

interface Squawk {
  id: number;
  author: string;
  node_id: string;
  message: string;
  is_global: boolean;
  snr?: number;
  rssi?: number;
  hops?: number;
  created_at: string;
  parent_squawk?: Squawk;
}

export default function Home() {
  const [squawks, setSquawks] = useState<Squawk[]>([]);
  const [isNodeOnline, setIsNodeOnline] = useState(true);
  const [nodeId, setNodeId] = useState('0000');
  const [message, setMessage] = useState('');
  const [replyingTo, setReplyingTo] = useState<Squawk | null>(null);
  const [user, setUser] = useState<any>(null);
  const socketRef = useRef<Socket | null>(null);
  const router = useRouter();

  useEffect(() => {
    const storedUser = localStorage.getItem('squawk_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }

    // Fetch health for Gateway ID
    fetch(`${getApiUrl()}/api/health`)
      .then(res => res.json())
      .then(data => {
        if (data.node) {
           setNodeId(data.node.length > 4 ? data.node.slice(-4) : data.node);
        }
      })
      .catch(console.error);

    fetch(`${getApiUrl()}/api/squawks`)
      .then(res => res.json())
      .then(data => {
        setSquawks(Array.isArray(data) ? data : []);
      })
      .catch(console.error);

    const socket = io(getApiUrl());
    socketRef.current = socket;

    socket.on('new_squawk', (squawk: Squawk) => {
      setSquawks((prev) => [squawk, ...prev]);
    });

    socket.on('node_status', (isOnline) => {
      setIsNodeOnline(isOnline);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || message.length > 180 || !user) return;

    const msgToSubmit = message;
    setMessage('');
    const currentReplyId = replyingTo?.id;
    setReplyingTo(null);

    const res = await fetch(`${getApiUrl()}/api/squawk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ message: msgToSubmit, reply_to_id: currentReplyId }),
    });

    if (res.status === 401) {
      handleLogout();
    }
  };

  const handleLogout = async () => {
    await fetch(`${getApiUrl()}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    localStorage.removeItem('squawk_user');
    setUser(null);
  }

  const timeAgo = (dateStr: string) => {
    const minDiff = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / 60000);
    if (minDiff < 1) return 'JUST NOW';
    if (minDiff < 60) return `${minDiff}M AGO`;
    return `${Math.floor(minDiff / 60)}H AGO`;
  }

  return (
    <div className="flex flex-col h-screen max-w-3xl mx-auto p-4 md:p-6 relative z-10 min-h-screen">

      {/* Modern Compact Header */}
      <header className="flex flex-col sm:flex-row gap-4 items-center justify-between pb-8 mb-4 border-b border-slate-700/30">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Radio className={`w-10 h-10 ${isNodeOnline ? 'text-orbCyan' : 'text-slate-600 animate-pulse'}`} />
            {isNodeOnline && <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-darkBg animate-pulse"></span>}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black tracking-tight leading-none">SQUAWK<span className="text-orbCyan">BOX</span></h1>
              <span className="text-[10px] font-mono font-bold bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">v{manifest.version}</span>
            </div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1.5 flex items-center gap-2">
              Shared Social Node <span className="text-slate-700">•</span> 
              <span className="text-slate-300 font-mono">
                {user ? `${user.username}📡${nodeId}` : 'GUEST_MODE'}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <a href="https://github.com/jonrick/squawkbox" target="_blank" rel="noopener noreferrer" className="p-2.5 text-slate-500 hover:text-white bg-slate-800/40 hover:bg-slate-800/80 rounded-xl border border-slate-700/50 transition-all group" title="View Source on GitHub">
            <Github className="w-5 h-5 group-hover:scale-110 transition-transform" />
          </a>
          
          <div className="h-8 w-[1px] bg-slate-700/50 hidden sm:block"></div>

          <div className="flex items-center gap-2 bg-slate-800/40 p-1.5 rounded-2xl border border-slate-700/50">
            {user ? (
              <>
                {user.is_admin && (
                  <Link href="/admin" className="p-2 text-slate-400 hover:text-orbCyan hover:bg-slate-700/60 rounded-xl transition-all" aria-label="Admin Panel">
                    <ShieldCheck className="w-5 h-5" />
                  </Link>
                )}
                <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700/60 rounded-xl transition-all" aria-label="Logout">
                  <LogOut className="w-5 h-5" />
                </button>
              </>
            ) : (
              <div className="flex items-center gap-1">
                <Link href="/login" className="px-4 py-2 text-xs font-black text-slate-400 hover:text-white transition-colors">LOGON</Link>
                <Link href="/register" className="px-4 py-2 text-xs font-black bg-orbCyan/10 text-orbCyan rounded-xl hover:bg-orbCyan/20 border border-orbCyan/20 transition-all">SIGNUP</Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Compose Box */}
      {user && (
        <div className="mb-10">
          <form onSubmit={handleSubmit} className="relative glass-panel rounded-2xl overflow-hidden transition-all focus-within:ring-1 ring-orbCyan/40 focus-within:border-orbCyan/50">
            {replyingTo && (
              <div className="flex items-center justify-between bg-slate-900/90 px-4 py-2.5 text-xs text-slate-400 border-b border-slate-700/50 backdrop-blur-sm">
                <div className="flex items-center gap-2 overflow-hidden">
                  <Reply className="w-3.5 h-3.5 text-orbCyan shrink-0" />
                  <span className="font-black text-slate-200 shrink-0 uppercase tracking-tighter">REP TO: {replyingTo.author}</span>
                  <span className="truncate opacity-50 italic">{replyingTo.message}</span>
                </div>
                <button type="button" onClick={() => setReplyingTo(null)} className="p-1 hover:text-red-400 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={!isNodeOnline}
              maxLength={180}
              placeholder={isNodeOnline ? "What's happening on the mesh?" : "Gate offline..."}
              className="w-full bg-transparent p-5 pb-16 text-lg text-white placeholder:text-slate-600 focus:outline-none resize-none disabled:opacity-50 min-h-[120px]"
            />
            <div className="absolute right-4 bottom-4 flex items-center gap-3 bg-slate-900/80 px-4 py-2 rounded-full backdrop-blur-md border border-slate-700/50">
              <span className={`text-xs font-bold ${message.length > 160 ? 'text-red-400' : 'text-slate-500'}`}>
                {message.length}/180
              </span>
              <button
                type="submit"
                disabled={!isNodeOnline || !message.trim()}
                className="flex items-center gap-2 text-sm font-bold bg-orbCyan text-slate-950 px-4 py-1.5 rounded-full hover:bg-cyan-400 disabled:opacity-50 transition-all cursor-pointer"
              >
                Squawk <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Feed Container */}
      <div className="flex-1 overflow-y-auto space-y-6 pb-12 pr-2 custom-scrollbar">
        {squawks.map((s) => (
          <div key={s.id} className="glass-panel p-7 rounded-2xl flex flex-col gap-5 transition-all hover:bg-slate-800/10 group shadow-lg">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="font-bold text-white text-xl tracking-tight leading-none">{s.author}</span>
                <span className="text-[10px] text-slate-500 font-bold tracking-widest uppercase mt-2 flex items-center gap-1.5 overflow-hidden max-w-full">
                   {!s.is_global ? `GATEWAY` : `REMOTE`} <span className="text-slate-800 px-1 font-normal opacity-50">|</span> 
                   <span className="text-slate-400">ID: !{s.node_id}</span>
                </span>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-slate-500 font-bold tracking-tighter uppercase">
                <span>{timeAgo(s.created_at)}</span>
                {user && (
                  <button onClick={() => setReplyingTo(s)} className="p-2 hover:text-orbCyan bg-slate-800/50 hover:bg-slate-800 rounded-lg transition-all text-slate-400 border border-transparent hover:border-orbCyan/30">
                    <Reply className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {s.parent_squawk && (
              <div className="mt-1 p-4 bg-slate-950/40 rounded-xl border-l-4 border-orbCyan text-sm shadow-inner group-hover:bg-slate-950/60 transition-all">
                <div className="flex items-center gap-1.5 mb-2">
                  <Reply className="w-3.5 h-3.5 text-orbCyan" />
                  <span className="font-bold text-slate-300 uppercase text-[10px] tracking-widest">In reply to @{s.parent_squawk.author}</span>
                </div>
                <p className="text-slate-500 line-clamp-2 italic font-medium leading-relaxed">"{s.parent_squawk.message}"</p>
              </div>
            )}

            <p className="text-slate-200 text-lg leading-relaxed break-words whitespace-pre-wrap font-medium">{s.message}</p>

            {(s.is_global && (s.snr !== undefined || s.rssi !== undefined)) && (
              <div className="flex flex-wrap items-center gap-3 mt-2 pt-5 border-t border-slate-700/20 opacity-60 group-hover:opacity-100 transition-all translate-y-1 group-hover:translate-y-0">
                {s.snr !== undefined && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/5 text-emerald-400 rounded-lg text-[10px] font-black border border-emerald-500/10 uppercase tracking-tighter">
                    <Signal className="w-3 h-3" /> SNR: {s.snr}
                  </div>
                )}
                {s.rssi !== undefined && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/5 text-amber-500 rounded-lg text-[10px] font-black border border-amber-500/10 uppercase tracking-tighter">
                    <Activity className="w-3 h-3" /> RSSI: {s.rssi}
                  </div>
                )}
                {s.hops !== undefined && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/5 text-blue-400 rounded-lg text-[10px] font-black border border-blue-500/10 uppercase tracking-tighter">
                    <Route className="w-3 h-3" /> HOPS: {s.hops}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {squawks.length === 0 && <div className="text-center text-slate-600 font-bold py-24 uppercase tracking-[0.3em] text-xs opacity-50">Transceiver Active — The Mesh is Silent</div>}
      </div>

    </div>
  );
}
