import { UserProfile } from '../types';
import { Sparkles, LogOut, ShieldCheck, Menu, X } from 'lucide-react';

interface HeaderProps {
  user: UserProfile | null;
  onSignOut: () => void;
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
}

export default function Header({
  user,
  onSignOut,
  onToggleSidebar,
  isSidebarOpen,
}: HeaderProps) {
  return (
    <header
      id="app-header"
      className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8"
    >
      <div className="flex items-center gap-4">
        {onToggleSidebar && (
          <button
            id="mobile-sidebar-toggle-btn"
            onClick={onToggleSidebar}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 lg:hidden"
            aria-label="Toggle history menu"
          >
            {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        )}

        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-sm shadow-xs">
            L
          </div>
          <div className="flex items-baseline gap-2.5">
            <span className="text-base font-semibold tracking-tight text-slate-800 sm:text-lg">
              Lumina Journal
            </span>
            <div className="hidden items-center gap-2 sm:flex">
              <span className="text-xs font-medium text-slate-400 italic">
                Cloud Firestore • Gemini 3.6 Flash
              </span>
              <div className="h-3.5 w-[1px] bg-slate-200"></div>
              <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-[11px] font-semibold text-green-700 border border-green-200/60">
                User Isolated Session
              </span>
            </div>
          </div>
        </div>
      </div>

      {user && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 pl-1">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'User'}
                referrerPolicy="no-referrer"
                className="h-8 w-8 rounded-full border border-slate-200 object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 font-bold text-white text-[11px]">
                {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="hidden text-left md:block">
              <p className="max-w-[150px] truncate text-xs font-semibold text-slate-800">
                {user.displayName || user.email?.split('@')[0]}
              </p>
              <p className="max-w-[150px] truncate text-[11px] text-slate-500">{user.email}</p>
            </div>
          </div>

          <button
            id="sign-out-btn"
            onClick={onSignOut}
            className="flex h-8.5 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 cursor-pointer"
            title="Sign out of your account"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      )}
    </header>
  );
}
