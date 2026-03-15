'use client'

import { useEffect, useRef, useState } from 'react';
import SupabaseWorkspace from '@/components/SupabaseWorkspace';
import { ArrowLeft, LogOut, LayoutDashboard } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export default function Home() {
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [authUser, setAuthUser] = useState<any>(null);
  const accountDropdownRef = useRef<HTMLDivElement>(null);

  const [sessionLoading, setSessionLoading] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        // Check if tokens were passed via URL from EduNext
        const params = new URLSearchParams(window.location.search);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (accessToken && refreshToken) {
          // Restore the session from EduNext tokens
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (!error && data?.user) {
            setAuthUser(data.user);
          }
          // Clean up URL (remove tokens from address bar)
          window.history.replaceState({}, '', '/ai-tutor');
        } else {
          // No tokens in URL — check existing local session
          const { data } = await supabase.auth.getUser();
          if (data?.user) setAuthUser(data.user);
        }
      } catch (err) {
        console.error('Session restore error:', err);
      } finally {
        setSessionLoading(false);
      }
    };

    restoreSession();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(e.target as Node)) {
        setAccountDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const avatarUrl = authUser?.user_metadata?.avatar_url;
  const fullName = authUser?.user_metadata?.full_name || authUser?.email?.split('@')[0] || 'Guest';
  const userEmail = authUser?.email || '';
  const initials = fullName.charAt(0).toUpperCase();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      window.history.back();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <div className="h-screen flex flex-col text-slate-100 overflow-hidden" style={{ backgroundColor: '#0E172A' }}>
      {/* Top Navbar */}
      <nav className="h-16 border-b border-white/5 glass-panel px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => window.history.back()}
            className="p-2 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl transition-all"
            title="Back to Dashboard"
          >
            <ArrowLeft size={20} />
          </button>

          <div className="flex items-center cursor-pointer group">
            <img
              src="/image.png"
              alt="Logo"
              className="h-10 md:h-11 w-auto object-contain transition-opacity duration-300 group-hover:opacity-80"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Account Circle */}
          <div className="relative" ref={accountDropdownRef}>
            <button
              onClick={() => setAccountDropdownOpen(!accountDropdownOpen)}
              className="w-10 h-10 rounded-full border-2 border-amber-500/50 hover:border-amber-500 transition-all duration-300 overflow-hidden flex items-center justify-center bg-amber-500/10 hover:bg-amber-500/20"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt={fullName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <span className="text-sm font-bold text-amber-500">{initials}</span>
              )}
            </button>

            {accountDropdownOpen && (
              <div className="absolute right-0 mt-3 w-64 rounded-2xl border border-white/10 bg-[#0F172A]/95 backdrop-blur-xl shadow-2xl shadow-black/50 overflow-hidden z-50">
                {/* User Info */}
                <div className="px-5 py-4 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden border border-white/10 flex items-center justify-center bg-amber-500/10 shrink-0">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt={fullName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="text-sm font-bold text-amber-500">{initials}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">{fullName}</p>
                      <p className="text-[11px] text-slate-500 truncate">{userEmail}</p>
                    </div>
                  </div>
                </div>

                {/* Menu Items */}
                <div className="py-2">
                  <button
                    onClick={() => { window.history.back(); setAccountDropdownOpen(false); }}
                    className="flex items-center gap-3 px-5 py-3 text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-all w-full"
                  >
                    <LayoutDashboard size={16} className="text-amber-500" />
                    <span className="font-medium">Back to Dashboard</span>
                  </button>
                </div>

                {/* Logout */}
                <div className="border-t border-white/10 py-2">
                  <button
                    onClick={() => { handleLogout(); setAccountDropdownOpen(false); }}
                    className="flex items-center gap-3 px-5 py-3 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/5 transition-all w-full"
                  >
                    <LogOut size={16} />
                    <span className="font-medium">Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Main Workspace */}
      <div className="flex-1 min-h-0">
        <SupabaseWorkspace />
      </div>
    </div>
  );
}
