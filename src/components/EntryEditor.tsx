import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { JournalEntry, ReflectionMode, ReflectionTurn } from '../types';
import { requestGeminiReflection, requestEntryTitle } from '../lib/api';
import {
  Sparkles,
  Send,
  Check,
  Copy,
  Brain,
  FileText,
  Lightbulb,
  ListTodo,
  Star,
  Trash2,
  Share2,
  Clock,
  ArrowDown,
  RotateCcw,
} from 'lucide-react';

interface EntryEditorProps {
  userId: string;
  entry: JournalEntry | null;
  onSaveEntry: (entry: JournalEntry) => Promise<void>;
  onDeleteEntry: (entryId: string) => void;
  onNewEntry: () => void;
  onReportError: (msg: string, retryFn?: () => Promise<void>) => void;
}

const INSPIRATION_PROMPTS = [
  'What is occupying the most mental energy for me today?',
  "A difficult decision I'm facing and the conflicting desires involved...",
  'What went well today, and what personal strength did I rely on?',
  'Something I feel grateful for that I usually take for granted...',
  'A conversation I had recently that left an impression on me...',
];

const MODES: Array<{ id: ReflectionMode; label: string; icon: typeof Brain; desc: string }> = [
  {
    id: 'reflection',
    label: 'Deep Reflection',
    icon: Brain,
    desc: 'Empathetic inquiry, perspective, and thoughtful questions',
  },
  {
    id: 'summary',
    label: 'Summary & Insights',
    icon: FileText,
    desc: 'Key themes, emotional undertones, and core takeaways',
  },
  {
    id: 'brainstorm',
    label: 'Brainstorm Ideas',
    icon: Lightbulb,
    desc: 'Creative alternatives and divergent possibilities',
  },
  {
    id: 'action_plan',
    label: 'Action Steps',
    icon: ListTodo,
    desc: 'Practical, low-friction next actions to take',
  },
];

export default function EntryEditor({
  userId,
  entry,
  onSaveEntry,
  onDeleteEntry,
  onNewEntry,
  onReportError,
}: EntryEditorProps) {
  const [currentEntry, setCurrentEntry] = useState<JournalEntry | null>(entry);
  const [inputText, setInputText] = useState('');
  const [selectedMode, setSelectedMode] = useState<ReflectionMode>('reflection');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTitleGenerating, setIsTitleGenerating] = useState(false);
  const [copiedTurnId, setCopiedTurnId] = useState<string | null>(null);
  const [saveSuccessTick, setSaveSuccessTick] = useState(false);

  const turnsEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync state whenever active entry prop changes
  useEffect(() => {
    setCurrentEntry(entry);
    setInputText('');
  }, [entry?.id]);

  // Scroll to bottom when new turns arrive
  useEffect(() => {
    turnsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentEntry?.turns?.length, isGenerating]);

  // Handle title edits
  const handleTitleChange = async (newTitle: string) => {
    if (!currentEntry) return;
    const updated: JournalEntry = {
      ...currentEntry,
      title: newTitle,
      updatedAt: Date.now(),
    };
    setCurrentEntry(updated);
    try {
      await onSaveEntry(updated);
    } catch (err: unknown) {
      onReportError('Failed to save title update.', () => onSaveEntry(updated));
    }
  };

  // Auto-generate Title & Tags via Gemini
  const handleAutoTitle = async () => {
    if (!currentEntry) return;
    const content =
      currentEntry.turns.map((t) => t.text).join('\n\n') || inputText;
    if (!content.trim()) return;

    try {
      setIsTitleGenerating(true);
      const res = await requestEntryTitle(content);
      if (res.title) {
        const updated: JournalEntry = {
          ...currentEntry,
          title: res.title,
          tags: res.tags || currentEntry.tags,
          sentiment: res.sentiment || currentEntry.sentiment,
          updatedAt: Date.now(),
        };
        setCurrentEntry(updated);
        await onSaveEntry(updated);
      }
    } catch (err: unknown) {
      console.error('Error generating title:', err);
    } finally {
      setIsTitleGenerating(false);
    }
  };

  // Submit reflection turn to Gemini and persist to Firestore
  const handleSendTurn = async () => {
    const textToSend = inputText.trim();
    if (!textToSend || isGenerating) return;

    // Prepare active entry object (create if brand new)
    let activeEntry: JournalEntry;
    if (currentEntry) {
      activeEntry = currentEntry;
    } else {
      const newId = `entry_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      activeEntry = {
        id: newId,
        userId,
        title: textToSend.slice(0, 32) + (textToSend.length > 32 ? '...' : ''),
        snippet: textToSend.slice(0, 160),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: ['Journal'],
        sentiment: 'Reflective',
        isStarred: false,
        turns: [],
      };
    }

    const userTurn: ReflectionTurn = {
      id: `turn_${Date.now()}_u`,
      role: 'user',
      text: textToSend,
      mode: selectedMode,
      timestamp: Date.now(),
    };

    // Optimistically update entry with user's turn
    const entryWithUserTurn: JournalEntry = {
      ...activeEntry,
      snippet: textToSend.slice(0, 160),
      turns: [...activeEntry.turns, userTurn],
      updatedAt: Date.now(),
    };

    setCurrentEntry(entryWithUserTurn);
    setInputText('');
    setIsGenerating(true);

    try {
      // Build conversation history array for server
      const historyForGemini = entryWithUserTurn.turns.slice(0, -1).map((t) => ({
        role: t.role,
        text: t.text,
      }));

      // Call Gemini reflection endpoint
      const geminiRes = await requestGeminiReflection({
        prompt: textToSend,
        mode: selectedMode,
        history: historyForGemini,
      });

      const modelTurn: ReflectionTurn = {
        id: `turn_${Date.now()}_m`,
        role: 'model',
        text: geminiRes.text,
        mode: selectedMode,
        timestamp: Date.now(),
        modelUsed: geminiRes.modelUsed,
      };

      const finalEntry: JournalEntry = {
        ...entryWithUserTurn,
        turns: [...entryWithUserTurn.turns, modelTurn],
        updatedAt: Date.now(),
      };

      setCurrentEntry(finalEntry);

      // Persist to Cloud Firestore with retry handling
      setIsSaving(true);
      await onSaveEntry(finalEntry);
      setIsSaving(false);
      setSaveSuccessTick(true);
      setTimeout(() => setSaveSuccessTick(false), 3000);

      // If this was the first turn, kick off an auto-title in background
      if (entryWithUserTurn.turns.length === 1) {
        requestEntryTitle(textToSend).then((titleData) => {
          if (titleData.title) {
            const titled: JournalEntry = {
              ...finalEntry,
              title: titleData.title,
              tags: titleData.tags,
              sentiment: titleData.sentiment,
              updatedAt: Date.now(),
            };
            setCurrentEntry(titled);
            onSaveEntry(titled).catch((e) => console.error('Save title error:', e));
          }
        });
      }
    } catch (err: unknown) {
      console.error('Error during reflection generation or persistence:', err);
      // Restore input text so the user doesn't lose their thought
      setInputText(textToSend);
      const errMsg =
        err instanceof Error ? err.message : 'Failed to generate and save Gemini reflection.';
      onReportError(errMsg, () => handleSendTurn());
    } finally {
      setIsGenerating(false);
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSendTurn();
    }
  };

  const copyToClipboard = (text: string, turnId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTurnId(turnId);
    setTimeout(() => setCopiedTurnId(null), 2000);
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const hasTurns = currentEntry && currentEntry.turns && currentEntry.turns.length > 0;

  return (
    <div
      id="entry-editor-container"
      className="flex h-full flex-col bg-slate-50 select-text"
    >
      {/* Top Header / Meta Bar */}
      <div className="border-b border-slate-200 bg-white px-6 sm:px-8 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Title input */}
          <div className="flex flex-1 items-center gap-2 min-w-[240px]">
            <input
              id="entry-title-input"
              type="text"
              value={currentEntry?.title || ''}
              placeholder="Title of this reflection..."
              onChange={(e) => handleTitleChange(e.target.value)}
              className="w-full text-lg font-semibold tracking-tight text-slate-900 placeholder-slate-400 focus:outline-none"
            />
            {hasTurns && (
              <button
                id="auto-title-btn"
                onClick={handleAutoTitle}
                disabled={isTitleGenerating}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
                title="Auto-generate title with Gemini"
              >
                <Sparkles className={`h-3.5 w-3.5 text-blue-600 ${isTitleGenerating ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Auto-title</span>
              </button>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {/* Save indicator */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mr-2">
              {isSaving ? (
                <div className="flex items-center gap-1 text-slate-400">
                  <div className="h-2 w-2 animate-ping rounded-full bg-blue-500" />
                  <span>Saving...</span>
                </div>
              ) : saveSuccessTick ? (
                <div className="flex items-center gap-1 text-emerald-600 font-medium">
                  <Check className="h-3.5 w-3.5" />
                  <span>Saved to Firestore</span>
                </div>
              ) : currentEntry ? (
                <div className="flex items-center gap-1 text-slate-400">
                  <Check className="h-3.5 w-3.5 text-slate-400" />
                  <span>Synced</span>
                </div>
              ) : null}
            </div>

            {currentEntry && (
              <>
                <button
                  id="star-entry-toggle"
                  onClick={() => {
                    const updated = {
                      ...currentEntry,
                      isStarred: !currentEntry.isStarred,
                      updatedAt: Date.now(),
                    };
                    setCurrentEntry(updated);
                    onSaveEntry(updated);
                  }}
                  className={`flex h-8.5 w-8.5 items-center justify-center rounded-lg border transition cursor-pointer ${
                    currentEntry.isStarred
                      ? 'border-amber-300 bg-amber-50 text-amber-600'
                      : 'border-slate-200 bg-white text-slate-400 hover:text-slate-700'
                  }`}
                  title={currentEntry.isStarred ? 'Unstar' : 'Star'}
                >
                  <Star className={`h-4 w-4 ${currentEntry.isStarred ? 'fill-amber-500 text-amber-500' : ''}`} />
                </button>

                <button
                  id="delete-entry-top-btn"
                  onClick={() => {
                    if (window.confirm('Are you sure you want to delete this reflection?')) {
                      onDeleteEntry(currentEntry.id);
                    }
                  }}
                  className="flex h-8.5 w-8.5 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 transition cursor-pointer"
                  title="Delete reflection"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Reflection Mode Chips */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-1">Focus Mode:</span>
          {MODES.map((m) => {
            const Icon = m.icon;
            const isSelected = selectedMode === m.id;
            return (
              <button
                key={m.id}
                id={`mode-select-${m.id}`}
                onClick={() => setSelectedMode(m.id)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
                title={m.desc}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Conversation / Reflection Content */}
      <div className="flex-1 overflow-y-auto p-6 sm:p-8" id="turns-history-container">
        {!hasTurns ? (
          /* Empty State / Inspiration Prompts */
          <div className="flex h-full flex-col items-center justify-center max-w-xl mx-auto text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
              <Sparkles className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-slate-900">
              Begin your reflection
            </h3>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed max-w-md">
              Share your thoughts, challenges, or goals. Gemini will provide thoughtful inquiry and structured synthesis in your private workspace.
            </p>

            <div className="mt-6 w-full text-left">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Inspiration Prompts
              </span>
              <div className="mt-2 space-y-2">
                {INSPIRATION_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    id={`inspiration-prompt-${idx}`}
                    onClick={() => {
                      setInputText(prompt);
                      textareaRef.current?.focus();
                    }}
                    className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white p-3.5 text-xs font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition cursor-pointer text-left shadow-2xs"
                  >
                    <span>{prompt}</span>
                    <Sparkles className="h-3.5 w-3.5 text-slate-400 shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Multi-turn Timeline */
          <div className="space-y-6 max-w-3xl mx-auto">
            {currentEntry.turns.map((turn) => {
              const isUser = turn.role === 'user';
              const modeMeta = MODES.find((m) => m.id === turn.mode);
              const ModeIcon = modeMeta?.icon || Brain;

              return isUser ? (
                /* User Turn */
                <div key={turn.id} id={`turn-item-${turn.id}`} className="flex gap-4">
                  <div className="h-8 w-8 shrink-0 rounded-full bg-slate-800 flex items-center justify-center text-[10px] text-white font-bold">
                    AM
                  </div>
                  <div className="flex-1 rounded-2xl rounded-tl-none bg-white p-5 border border-slate-200 shadow-xs">
                    <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                      <span className="font-semibold text-slate-800">You</span>
                      <span>{formatTimestamp(turn.timestamp)}</span>
                    </div>
                    <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap font-sans">
                      {turn.text}
                    </p>
                  </div>
                </div>
              ) : (
                /* Gemini Synthesis Turn */
                <div key={turn.id} id={`turn-item-${turn.id}`} className="flex gap-4">
                  <div className="h-8 w-8 shrink-0 rounded-full bg-blue-100 flex items-center justify-center">
                    <div className="h-3.5 w-3.5 bg-blue-600 rounded-full" />
                  </div>
                  <div className="flex-1 rounded-2xl rounded-tl-none bg-blue-50/50 p-5 border border-blue-100">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-blue-800">
                          Gemini Synthesis
                        </span>
                        {turn.mode && (
                          <span className="flex items-center gap-1 rounded bg-blue-100/80 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                            <ModeIcon className="h-2.5 w-2.5" />
                            <span>{modeMeta?.label || turn.mode}</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        {turn.modelUsed && (
                          <span className="font-mono text-[10px] text-blue-600/70">
                            {turn.modelUsed}
                          </span>
                        )}
                        <span>•</span>
                        <span>{formatTimestamp(turn.timestamp)}</span>
                      </div>
                    </div>

                    <div className="prose prose-slate prose-sm max-w-none text-slate-700 leading-relaxed">
                      <ReactMarkdown>{turn.text}</ReactMarkdown>
                    </div>

                    <div className="mt-4 flex items-center justify-end border-t border-blue-100/70 pt-2">
                      <button
                        id={`copy-turn-${turn.id}`}
                        onClick={() => copyToClipboard(turn.text, turn.id)}
                        className="flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900 transition cursor-pointer"
                      >
                        {copiedTurnId === turn.id ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                            <span className="text-emerald-600">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            <span>Copy response</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* In-Flight Generating Indicator */}
            {isGenerating && (
              <div className="flex gap-4" id="generating-indicator">
                <div className="h-8 w-8 shrink-0 rounded-full bg-blue-100 flex items-center justify-center">
                  <div className="h-3.5 w-3.5 bg-blue-600 rounded-full animate-pulse" />
                </div>
                <div className="flex-1 rounded-2xl rounded-tl-none bg-blue-50/50 p-5 border border-blue-100">
                  <p className="text-sm font-semibold text-blue-800 mb-2">
                    Gemini Synthesis
                  </p>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <div className="flex items-center gap-1">
                      <div className="h-2 w-2 animate-bounce rounded-full bg-blue-400 [animation-delay:-0.3s]" />
                      <div className="h-2 w-2 animate-bounce rounded-full bg-blue-400 [animation-delay:-0.15s]" />
                      <div className="h-2 w-2 animate-bounce rounded-full bg-blue-400" />
                    </div>
                    <span>
                      Synthesizing thoughts with {MODES.find((m) => m.id === selectedMode)?.label}...
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div ref={turnsEndRef} />
          </div>
        )}
      </div>

      {/* Input Composition Box */}
      <footer className="border-t border-slate-200 bg-white p-6">
        <div className="mx-auto max-w-3xl">
          <div className="relative rounded-xl border border-slate-200 bg-slate-50 transition-colors focus-within:border-blue-500 focus-within:bg-white focus-within:ring-1 focus-within:ring-blue-500">
            <textarea
              id="reflection-input-textarea"
              ref={textareaRef}
              rows={3}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                hasTurns
                  ? 'Write your reflection or ask Gemini...'
                  : 'Write your reflection or ask Gemini...'
              }
              className="w-full resize-none bg-transparent p-4 pr-16 text-sm text-slate-800 placeholder-slate-400 focus:outline-none leading-relaxed"
            />

            <div className="flex items-center justify-between border-t border-slate-200/50 px-4 py-2 text-xs">
              <div className="flex items-center gap-1.5 text-slate-400">
                <span>Press</span>
                <kbd className="rounded bg-slate-200/60 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                  Cmd/Ctrl + Enter
                </kbd>
                <span>to submit</span>
              </div>

              <button
                id="send-reflection-btn"
                onClick={handleSendTurn}
                disabled={!inputText.trim() || isGenerating}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs transition hover:bg-blue-700 disabled:opacity-40 cursor-pointer"
                title="Send reflection"
              >
                {isGenerating ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <p className="mt-3 text-center text-[11px] text-slate-400">
            Your reflections are private, encrypted, and isolated to your Firestore profile.
          </p>
        </div>
      </footer>
    </div>
  );
}
