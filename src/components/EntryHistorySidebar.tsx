import { useState, useMemo } from 'react';
import { JournalEntry } from '../types';
import {
  Plus,
  Search,
  Star,
  Trash2,
  Calendar,
  MessageSquare,
  Sparkles,
  SlidersHorizontal,
} from 'lucide-react';

interface EntryHistorySidebarProps {
  entries: JournalEntry[];
  selectedEntryId: string | null;
  onSelectEntry: (entry: JournalEntry) => void;
  onNewEntry: () => void;
  onDeleteEntry: (entryId: string) => void;
  onToggleStar: (entry: JournalEntry) => void;
}

export default function EntryHistorySidebar({
  entries,
  selectedEntryId,
  onSelectEntry,
  onNewEntry,
  onDeleteEntry,
  onToggleStar,
}: EntryHistorySidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStarredOnly, setFilterStarredOnly] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (filterStarredOnly && !entry.isStarred) return false;
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      const matchTitle = entry.title.toLowerCase().includes(q);
      const matchSnippet = entry.snippet.toLowerCase().includes(q);
      const matchTags = entry.tags?.some((t) => t.toLowerCase().includes(q));
      const matchTurns = entry.turns?.some((turn) => turn.text.toLowerCase().includes(q));

      return matchTitle || matchSnippet || matchTags || matchTurns;
    });
  }, [entries, searchQuery, filterStarredOnly]);

  const formatDate = (timestamp: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isToday) {
      return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    if (isYesterday) {
      return `Yesterday, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const handleDeleteClick = (e: React.MouseEvent, entryId: string) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this journal reflection? This cannot be undone.')) {
      onDeleteEntry(entryId);
    }
  };

  return (
    <aside
      id="entry-history-sidebar"
      className="flex h-full w-full flex-col border-r border-slate-200 bg-white select-none"
    >
      {/* Top Action Bar */}
      <div className="border-b border-slate-100 p-4">
        <button
          id="new-reflection-btn"
          onClick={onNewEntry}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 px-4 text-sm font-medium text-white shadow-xs transition hover:bg-blue-700 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>New Reflection</span>
        </button>

        {/* Search & Filter Controls */}
        <div className="mt-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              id="search-entries-input"
              type="text"
              placeholder="Search reflections..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8.5 pr-3 text-xs text-slate-800 placeholder-slate-400 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <button
            id="toggle-starred-filter-btn"
            onClick={() => setFilterStarredOnly(!filterStarredOnly)}
            className={`flex h-9 w-9 items-center justify-center rounded-lg border transition cursor-pointer ${
              filterStarredOnly
                ? 'border-amber-300 bg-amber-50 text-amber-600'
                : 'border-slate-200 bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-700'
            }`}
            title="Filter starred entries"
            aria-label="Filter starred entries"
          >
            <Star className={`h-4 w-4 ${filterStarredOnly ? 'fill-amber-500 text-amber-500' : ''}`} />
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Past Reflections
          </h3>
          <span className="text-[11px] font-medium text-slate-400">
            {filteredEntries.length}
          </span>
        </div>
      </div>

      {/* Entries List */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1" id="entry-list-container">
        {filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center text-slate-400">
            <Sparkles className="h-8 w-8 text-slate-300" />
            <p className="mt-2 text-xs font-medium text-slate-600">No reflections found</p>
            <p className="mt-1 text-[11px] text-slate-400">
              {searchQuery ? 'Try another search keyword' : 'Start your first reflection!'}
            </p>
          </div>
        ) : (
          filteredEntries.map((entry) => {
            const isSelected = entry.id === selectedEntryId;
            return (
              <div
                key={entry.id}
                id={`entry-card-${entry.id}`}
                onClick={() => onSelectEntry(entry)}
                className={`group relative flex flex-col rounded-lg px-3 py-3 transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-slate-100 text-slate-900 border border-slate-200/80'
                    : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                }`}
              >
                {/* Header Line */}
                <div className="flex items-start justify-between gap-2">
                  <h4 className="line-clamp-1 text-sm font-medium text-slate-900">
                    {entry.title || 'Untitled Reflection'}
                  </h4>

                  <div className="flex items-center gap-1">
                    <button
                      id={`star-btn-${entry.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleStar(entry);
                      }}
                      className="p-0.5 text-slate-400 hover:text-amber-500 cursor-pointer"
                      title={entry.isStarred ? 'Unstar entry' : 'Star entry'}
                    >
                      <Star
                        className={`h-3.5 w-3.5 ${
                          entry.isStarred ? 'fill-amber-500 text-amber-500' : ''
                        }`}
                      />
                    </button>

                    <button
                      id={`delete-btn-${entry.id}`}
                      onClick={(e) => handleDeleteClick(e, entry.id)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-rose-600 transition-opacity cursor-pointer"
                      title="Delete entry"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Snippet */}
                <p className="mt-1 line-clamp-2 text-xs text-slate-500 leading-relaxed">
                  {entry.snippet || entry.turns?.[0]?.text || 'No content yet...'}
                </p>

                {/* Footer Badges */}
                <div className="mt-2.5 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" />
                    <span>{formatDate(entry.updatedAt || entry.createdAt)}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {entry.turns && entry.turns.length > 0 && (
                      <span className="flex items-center gap-0.5 text-slate-400">
                        <MessageSquare className="h-3 w-3" />
                        {entry.turns.length}
                      </span>
                    )}
                    {entry.sentiment && (
                      <span className="rounded bg-slate-200/60 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                        {entry.sentiment}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
