import { useState } from 'react';
import { Sparkles, Shield, Lock, Brain, ArrowRight, CheckCircle2 } from 'lucide-react';

interface AuthScreenProps {
  onSignIn: () => Promise<void>;
  authError?: string | null;
}

export default function AuthScreen({ onSignIn, authError }: AuthScreenProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSignIn = async () => {
    try {
      setIsLoading(true);
      setLocalError(null);
      await onSignIn();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign in failed. Please try again.';
      setLocalError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div id="auth-screen-container" className="flex min-h-[calc(100vh-65px)] flex-col items-center justify-center bg-slate-50 px-4 py-12 sm:px-6">
      <div className="w-full max-w-xl">
        {/* Main Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xs sm:p-10">
          <div className="mb-6 flex items-center justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
              <Sparkles className="h-7 w-7" />
            </div>
          </div>

          <div className="text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Gemini Journal & Reflections
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
              A private, thoughtful sanctuary to write daily reflections, untangle thoughts, and explore deep insights powered by Gemini 3.6 Flash.
            </p>
          </div>

          {/* Privacy & Security Callout */}
          <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
            <div className="flex items-start gap-3">
              <Shield className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
              <div className="text-xs text-slate-600">
                <span className="font-semibold text-slate-800">Strict Data Isolation Guarantee:</span>
                <p className="mt-0.5">
                  All your journal entries, prompts, and reflections are securely isolated to your individual account via owner-bound Cloud Firestore security rules. No other user can ever read your entries.
                </p>
              </div>
            </div>
          </div>

          {/* Error Display */}
          {(authError || localError) && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {authError || localError}
            </div>
          )}

          {/* Sign In Button */}
          <div className="mt-8 flex flex-col gap-3">
            <button
              id="google-sign-in-btn"
              onClick={handleSignIn}
              disabled={isLoading}
              className="group flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-slate-900 px-6 font-medium text-white shadow-xs transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:opacity-70 cursor-pointer"
            >
              {isLoading ? (
                <div className="flex items-center gap-2 text-sm">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Connecting to Google Account...</span>
                </div>
              ) : (
                <>
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span className="text-sm font-medium">Continue with Google</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </div>

          {/* Capabilities Highlights */}
          <div className="mt-8 border-t border-slate-100 pt-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Designed for Clarity & Mindfulness
            </h3>
            <ul className="mt-3 space-y-2 text-xs text-slate-600">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
                <span>Multi-turn conversational reflections with context memory</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
                <span>Deep inquiries, executive summaries & creative brainstorming modes</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
                <span>Zero password storage — outsourced securely to Google Identity</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
