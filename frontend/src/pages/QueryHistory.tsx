import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  History,
  Search,
  Trash2,
  Play,
  Bookmark,
  Clock,
  CheckCircle2,
  Filter,
  ArrowUpDown,
  Loader2,
} from 'lucide-react';
import { api, type HistoryItem } from '../lib/api';
import { readSavedQueryIds, removeSavedQueryId, toggleSavedQueryId } from '../lib/savedQueries';
import { useAppStore } from '../hooks/useAppStore';

export default function QueryHistory() {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortAsc, setSortAsc] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'saved'>('all');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set(readSavedQueryIds()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { connectionSummary } = useAppStore();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getHistory(50, connectionSummary?.connectionId)
      .then((response) => {
        if (!cancelled) setHistory(response.items);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load history');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [connectionSummary?.connectionId]);

  const deleteItem = async (id: string) => {
    await api.deleteHistory(id);
    removeSavedQueryId(id);
    setSavedIds(new Set(readSavedQueryIds()));
    setHistory((items) => items.filter((item) => item.id !== id));
  };

  const toggleSaved = (id: string) => {
    setSavedIds(new Set(toggleSavedQueryId(id)));
  };

  const filtered = useMemo(() => history
    .filter((item) => {
      const sql = item.selected_query ?? item.generated_queries[0]?.sql ?? '';
      const matchesSearch =
        (item.prompt ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        sql.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = filterMode === 'all' || savedIds.has(item.id);
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      return sortAsc
        ? new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        : new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    }), [filterMode, history, savedIds, searchQuery, sortAsc]);

  return (
    <div className="space-y-6">
      <div>
        <span className="badge badge-cyan">History</span>
        <h1 className="mt-3 text-3xl font-bold text-white">Query History</h1>
        <p className="text-text-muted text-sm mt-1">Review and manage your past queries</p>
      </div>

      {error && (
        <div className="rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="app-panel"
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim" />
            <input
              type="text"
              placeholder="Search history..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-surface-light/50 border border-glass-border rounded-xl text-text placeholder:text-text-dim focus:outline-none focus:border-primary/50"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-text-dim" />
            {(['all', 'saved'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilterMode(f)}
                className={`text-xs px-3 py-1.5 rounded-lg transition-all ${
                  filterMode === f
                    ? 'bg-primary/20 text-primary-light'
                    : 'bg-surface-light/50 text-text-muted hover:text-text'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          <button
            onClick={() => { setSortAsc(!sortAsc); }}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-surface-light/50 text-text-muted hover:text-text transition-all"
          >
            <ArrowUpDown className="w-3 h-3" />
            {sortAsc ? 'Oldest' : 'Newest'}
          </button>
        </div>
      </motion.div>

      {/* History List */}
      <div className="space-y-3">
        {filtered.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="app-panel transition-all hover:border-accent/30"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                  <p className="text-sm font-medium truncate">{item.prompt ?? 'Generated SQL'}</p>
                </div>

                <pre className="text-xs text-text-muted font-mono bg-surface-light/50 rounded-lg p-3 overflow-x-auto mb-3">
                  {item.selected_query ?? item.generated_queries[0]?.sql ?? 'No SQL stored'}
                </pre>

                <div className="flex flex-wrap items-center gap-3 text-xs text-text-dim">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(item.timestamp).toLocaleString()}
                  </div>
                  <div className="flex items-center gap-1">
                    <span>{String(item.metadata.db_type ?? 'database')}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <button className="p-2 rounded-lg text-text-muted hover:text-text hover:bg-glass-hover transition-all" title="Rerun">
                  <Play className="w-4 h-4" />
                </button>
                <button
                  onClick={() => toggleSaved(item.id)}
                  className={`p-2 rounded-lg transition-all ${
                    savedIds.has(item.id)
                      ? 'text-primary-light bg-primary/10 hover:bg-primary/15'
                      : 'text-text-muted hover:text-text hover:bg-glass-hover'
                  }`}
                  title={savedIds.has(item.id) ? 'Remove from saved' : 'Save'}
                >
                  <Bookmark className={`w-4 h-4 ${savedIds.has(item.id) ? 'fill-primary-light' : ''}`} />
                </button>
                <button onClick={() => deleteItem(item.id)} className="p-2 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-all" title="Delete">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        ))}

        {loading && (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 text-accent mx-auto mb-3 animate-spin" />
            <p className="text-sm text-text-muted">Loading query history</p>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-12">
            <History className="w-12 h-12 text-text-dim mx-auto mb-3" />
            <p className="text-sm text-text-muted">No query history found</p>
          </div>
        )}
      </div>
    </div>
  );
}
