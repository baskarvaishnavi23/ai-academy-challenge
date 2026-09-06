/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import {
  auth,
  onAuthStateChanged,
  signInWithGoogle,
  logOut,
  subscribeToUserEntries,
  saveJournalEntry,
  deleteJournalEntry,
} from './lib/firebase';
import { JournalEntry, UserProfile } from './types';
import Header from './components/Header';
import AuthScreen from './components/AuthScreen';
import EntryHistorySidebar from './components/EntryHistorySidebar';
import EntryEditor from './components/EntryEditor';
import ErrorBanner from './components/ErrorBanner';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // System error escalation banner state
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryCallback, setRetryCallback] = useState<(() => Promise<void>) | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  // Monitor Firebase Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
      if (user) {
        setCurrentUser({
          uid: user.uid,
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
        });
      } else {
        setCurrentUser(null);
        setEntries([]);
        setSelectedEntryId(null);
      }
      setIsAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Subscribe to user-isolated Firestore entries
  useEffect(() => {
    if (!currentUser) return;

    const unsubscribe = subscribeToUserEntries(
      currentUser.uid,
      (userEntries) => {
        setEntries(userEntries);
      },
      (err) => {
        setErrorMessage(`Firestore synchronization error: ${err.message}`);
      }
    );

    return () => unsubscribe();
  }, [currentUser?.uid]);

  const handleSignIn = async () => {
    try {
      setAuthError(null);
      await signInWithGoogle();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign-in failed.';
      setAuthError(msg);
      throw err;
    }
  };

  const handleSignOut = async () => {
    try {
      await logOut();
      setCurrentUser(null);
      setEntries([]);
      setSelectedEntryId(null);
    } catch (err: unknown) {
      console.error('Sign out error:', err);
    }
  };

  // Find currently selected entry (or null if drafting a new entry)
  const activeEntry = entries.find((e) => e.id === selectedEntryId) || null;

  // Save entry to Firestore
  const handleSaveEntry = useCallback(
    async (entryToSave: JournalEntry) => {
      if (!currentUser) return;
      try {
        setErrorMessage(null);
        setRetryCallback(null);
        await saveJournalEntry(currentUser.uid, entryToSave);
        // Ensure selectedEntryId is set to this entry
        setSelectedEntryId(entryToSave.id);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to save reflection to Firestore.';
        setErrorMessage(msg);
        setRetryCallback(() => async () => {
          setIsRetrying(true);
          try {
            await saveJournalEntry(currentUser.uid, entryToSave);
            setErrorMessage(null);
            setRetryCallback(null);
          } finally {
            setIsRetrying(false);
          }
        });
        throw err;
      }
    },
    [currentUser]
  );

  // Delete entry
  const handleDeleteEntry = async (entryId: string) => {
    if (!currentUser) return;
    try {
      await deleteJournalEntry(currentUser.uid, entryId);
      if (selectedEntryId === entryId) {
        setSelectedEntryId(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete reflection.';
      setErrorMessage(msg);
    }
  };

  // Toggle star
  const handleToggleStar = async (entry: JournalEntry) => {
    const updated: JournalEntry = {
      ...entry,
      isStarred: !entry.isStarred,
      updatedAt: Date.now(),
    };
    await handleSaveEntry(updated);
  };

  // Start new entry
  const handleNewEntry = () => {
    setSelectedEntryId(null);
    setIsSidebarOpen(false);
  };

  const handleSelectEntry = (entry: JournalEntry) => {
    setSelectedEntryId(entry.id);
    setIsSidebarOpen(false);
  };

  // Error reporter for child components
  const reportError = (msg: string, retryFn?: () => Promise<void>) => {
    setErrorMessage(msg);
    if (retryFn) {
      setRetryCallback(() => async () => {
        setIsRetrying(true);
        try {
          await retryFn();
          setErrorMessage(null);
          setRetryCallback(null);
        } finally {
          setIsRetrying(false);
        }
      });
    }
  };

  if (isAuthLoading) {
    return (
      <div id="auth-loading-state" className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
          <p className="text-xs font-medium text-slate-500">Initializing secure session...</p>
        </div>
      </div>
    );
  }

  return (
    <div id="app-root" className="flex h-screen flex-col overflow-hidden bg-slate-50 font-sans text-slate-900">
      <Header
        user={currentUser}
        onSignOut={handleSignOut}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        isSidebarOpen={isSidebarOpen}
      />

      {!currentUser ? (
        <AuthScreen onSignIn={handleSignIn} authError={authError} />
      ) : (
        <div className="relative flex flex-1 overflow-hidden">
          {/* Sidebar for Desktop */}
          <div className="hidden h-full w-72 shrink-0 lg:block">
            <EntryHistorySidebar
              entries={entries}
              selectedEntryId={selectedEntryId}
              onSelectEntry={handleSelectEntry}
              onNewEntry={handleNewEntry}
              onDeleteEntry={handleDeleteEntry}
              onToggleStar={handleToggleStar}
            />
          </div>

          {/* Drawer for Mobile */}
          {isSidebarOpen && (
            <div className="fixed inset-0 z-40 flex lg:hidden">
              <div
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
                onClick={() => setIsSidebarOpen(false)}
              />
              <div className="relative z-50 h-full w-4/5 max-w-xs bg-white shadow-xl">
                <EntryHistorySidebar
                  entries={entries}
                  selectedEntryId={selectedEntryId}
                  onSelectEntry={handleSelectEntry}
                  onNewEntry={handleNewEntry}
                  onDeleteEntry={handleDeleteEntry}
                  onToggleStar={handleToggleStar}
                />
              </div>
            </div>
          )}

          {/* Main Content Area */}
          <main id="main-editor-area" className="flex flex-1 flex-col overflow-hidden bg-slate-50">
            {errorMessage && (
              <div className="px-6 pt-4">
                <ErrorBanner
                  message={errorMessage}
                  onRetry={retryCallback ? () => retryCallback() : undefined}
                  onDismiss={() => {
                    setErrorMessage(null);
                    setRetryCallback(null);
                  }}
                  isRetrying={isRetrying}
                />
              </div>
            )}

            <div className="flex-1 overflow-hidden">
              <EntryEditor
                key={selectedEntryId || 'new_draft'}
                userId={currentUser.uid}
                entry={activeEntry}
                onSaveEntry={handleSaveEntry}
                onDeleteEntry={handleDeleteEntry}
                onNewEntry={handleNewEntry}
                onReportError={reportError}
              />
            </div>
          </main>
        </div>
      )}
    </div>
  );
}

