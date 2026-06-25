import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bookmark,
  Search,
  Trash2,
  Play,
  Tag,
  FileText,
  Clock,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { api, type HistoryItem } from '../lib/api';
import { readSavedQueryIds, removeSavedQueryId } from '../lib/savedQueries';

function sqlFor(item: HistoryItem) {
  return item.selected_query ?? item.generated_queries[0]?.sql ?? '';
}

function tagsFor(item: HistoryItem) {
  const sql = sqlFor(item).toLowerCase();
  const queryType = sql.trim().split(/\s+/)[0]?.toUpperCase();
  const dbType = item.metadata.db_type;
  return [typeof dbType === 'string' ? dbType : null, queryType || null].filter((tag): tag is string => Boolean(tag));
}

export default function SavedQueries() {
  const [searchQuery, setSearchQuery] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set(readSavedQueryIds()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getHistory(200)
      .then((response) => {
        if (!cancelled) setHistory(response.items);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load saved queries');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const removeSaved = (id: string) => {
    removeSavedQueryId(id);
    setSavedIds(new Set(readSavedQueryIds()));
  };

  const filtered = useMemo(
    () =>
      history
        .filter((item) => savedIds.has(item.id))
        .filter((item) => {
          const sql = sqlFor(item);
          const prompt = item.prompt ?? 'Generated SQL';
          const tags = tagsFor(item);
          const query = searchQuery.toLowerCase();
          return (
            prompt.toLowerCase().includes(query) ||
            sql.toLowerCase().includes(query) ||
            tags.some((tag) => tag.toLowerCase().includes(query))
          );
        }),
    [history, savedIds, searchQuery],
  );

  return (
    <div className="space-y-6">
      <div>
        <span className="badge badge-cyan">Saved</span>
        <h1 className="mt-3 text-3xl font-bold text-white">Saved Queries</h1>
        <p className="text-text-muted text-sm mt-1">Your bookmarked real query history</p>
      </div>

      {error && (
        <div className="rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="app-panel"
      >
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim" />
          <input
            type="text"
            placeholder="Search saved queries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-surface-light/50 border border-glass-border rounded-xl text-text placeholder:text-text-dim focus:outline-none focus:border-primary/50"
          />
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {filtered.map((item, index) => {
          const sql = sqlFor(item);
          const tags = tagsFor(item);
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="app-panel transition-all hover:border-accent/30"
            >
              <div className="flex items-start justify-between mb-3 gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Bookmark className="w-4 h-4 text-primary-light fill-primary-light flex-shrink-0" />
                  <h3 className="text-sm font-medium line-clamp-1">{item.prompt ?? 'Generated SQL'}</h3>
                </div>
                <span className="badge badge-green text-[10px]">Saved</span>
              </div>

              <pre className="text-xs text-text-muted font-mono bg-surface-light/50 rounded-lg p-3 overflow-x-auto mb-3 line-clamp-3">
                {sql || 'No SQL stored'}
              </pre>

              <div className="flex flex-wrap items-center gap-2 mb-3">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary-light"
                  >
                    <Tag className="w-2.5 h-2.5" />
                    {tag}
                  </span>
                ))}
              </div>

              {item.generated_queries[0]?.explanation && (
                <div className="flex items-start gap-2 p-2 rounded-lg bg-surface-light/30 mb-3">
                  <FileText className="w-3 h-3 text-text-dim mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-text-muted">{item.generated_queries[0].explanation}</p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-text-dim">
                  <Clock className="w-3 h-3" />
                  {new Date(item.timestamp).toLocaleDateString()}
                </div>
                <div className="flex items-center gap-1">
                  <button className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-glass-hover transition-all" title="Run">
                    <Play className="w-3.5 h-3.5" />
                  </button>
                  <button className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-glass-hover transition-all" title="Open in Generator">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => removeSaved(item.id)}
                    className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-all"
                    title="Remove from saved"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}

        {loading && (
          <div className="col-span-full text-center py-12">
            <Loader2 className="w-8 h-8 text-accent mx-auto mb-3 animate-spin" />
            <p className="text-sm text-text-muted">Loading saved queries</p>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="col-span-full text-center py-12">
            <Bookmark className="w-12 h-12 text-text-dim mx-auto mb-3" />
            <p className="text-sm text-text-muted">No saved queries yet</p>
            <p className="text-xs text-text-dim mt-1">Save real history items to access them here</p>
          </div>
        )}
      </div>
    </div>
  );
}
