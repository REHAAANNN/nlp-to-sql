import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Editor from '@monaco-editor/react';
import { Sparkles, Wand2, Trash2, Mic, Copy, CheckCircle2, Play, Code2, Info, Table2, Gauge, Shield, Download, Search, ArrowUpDown } from 'lucide-react';
import { useAppStore } from '../hooks/useAppStore';
import { api, type BackendSchema, type ExecuteQueryResponse } from '../lib/api';
import type { GeneratedSQL } from '../types';

type Tab = 'sql' | 'explanation' | 'tables' | 'impact' | 'optimization' | 'output';

function queryType(sql: string): GeneratedSQL['queryType'] {
  const firstWord = sql.trim().split(/\s+/)[0]?.toUpperCase();
  if (firstWord === 'UPDATE' || firstWord === 'DELETE' || firstWord === 'INSERT') return firstWord;
  return 'SELECT';
}

function riskLevel(risk: string) {
  if (risk.toLowerCase() === 'high') return 85;
  if (risk.toLowerCase() === 'medium') return 55;
  return 15;
}

function costLevel(cost?: string | null): GeneratedSQL['impact']['cost'] {
  const normalized = (cost ?? '').toLowerCase();
  if (normalized.includes('high')) return 'High';
  if (normalized.includes('medium')) return 'Medium';
  return 'Low';
}

function extractTables(sql: string, schema: BackendSchema | null) {
  const lowerSql = sql.toLowerCase();
  return (schema?.tables ?? [])
    .filter((table) => lowerSql.includes(table.name.toLowerCase()))
    .map((table) => ({ name: table.name, columns: table.columns.map((column) => column.name) }));
}

export default function AIGenerator() {
  const { connectionSummary } = useAppStore();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [sqls, setSqls] = useState<GeneratedSQL[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [editor, setEditor] = useState('');
  const [tab, setTab] = useState<Tab>('sql');
  const [executionResult, setExecutionResult] = useState<ExecuteQueryResponse | null>(null);
  const [executing, setExecuting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [schema, setSchema] = useState<BackendSchema | null>(null);
  const [error, setError] = useState<string | null>(null);

  const active = sqls.find(s => s.id === selected) || sqls[0];
  const PAGE_SIZE = 5;

  useEffect(() => {
    let cancelled = false;
    api.getSchema(connectionSummary?.connectionId)
      .then((data) => {
        if (!cancelled) setSchema(data);
      })
      .catch(() => {
        if (!cancelled) setSchema(null);
      });
    return () => {
      cancelled = true;
    };
  }, [connectionSummary?.connectionId]);

  const examples = useMemo(() => {
    const tables = schema?.tables ?? [];
    const first = tables[0];
    const second = tables[1];
    return [
      first ? `Show all rows from ${first.name}` : 'Show all rows from the first table',
      first ? `Count rows in ${first.name}` : 'Count rows in each table',
      second ? `Show records from ${second.name}` : 'Show the largest table',
      first?.columns[0] ? `Find ${first.name} by ${first.columns[0].name}` : 'Find recent records',
    ];
  }, [schema]);

  const generate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setExecutionResult(null);
    try {
      const generated = await api.generateQuery(prompt, connectionSummary?.connectionId);
      const options = await Promise.all(
        generated.queries.map(async (option, index) => {
          const [explanation, impact] = await Promise.all([
            api.explainQuery(option.sql, connectionSummary?.connectionId).catch(() => null),
            api.analyzeImpact(option.sql, connectionSummary?.connectionId).catch(() => null),
          ]);
          const kind = queryType(option.sql);
          return {
            id: `${index}-${option.sql.slice(0, 16)}`,
            sql: option.sql,
            confidence: option.confidence,
            queryType: kind,
            complexity: impact?.risk === 'high' ? 'High' : impact?.risk === 'medium' ? 'Medium' : 'Low',
            explanation: option.explanation || explanation?.explanation || 'No explanation returned.',
            filters: explanation?.filters_used ?? [],
            joins: explanation?.joins_used ?? [],
            aggregations: explanation?.aggregations_used ?? [],
            sorting: [],
            tables: extractTables(option.sql, schema),
            impact: {
              estimatedRows: impact?.rows_affected ?? 0,
              cost: costLevel(impact?.query_cost),
              warnings: impact?.warnings ?? [],
              riskLevel: riskLevel(impact?.risk ?? 'low'),
            },
            validation: {
              syntaxValid: !(impact?.warnings ?? []).some((warning) => warning.toLowerCase().includes('failed')),
              missingWhere: (impact?.warnings ?? []).some((warning) => warning.toLowerCase().includes('without where')),
              usesSelectStar: /\bselect\s+\*/i.test(option.sql),
              indexRecommendation: [],
              optimizationSuggestions: impact?.warnings ?? [],
            },
          } satisfies GeneratedSQL;
        }),
      );
      setSqls(options);
      setSelected(options[0]?.id ?? null);
      setEditor(generated.best_query || options[0]?.sql || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate SQL');
    } finally {
      setLoading(false);
    }
  };

  const clear = () => {
    setPrompt(''); setSqls([]); setSelected(null); setEditor(''); setExecutionResult(null); setError(null);
  };

  const copy = async (t: string, id: string) => {
    await navigator.clipboard.writeText(t);
    setCopied(id);
    setTimeout(() => setCopied(null), 1400);
  };

  const execute = async () => {
    if (!editor.trim()) return;
    const destructive = /^(update|delete|insert)\b/i.test(editor.trim());
    if (destructive && !window.confirm('Run this write query against the connected database?')) return;
    setExecuting(true);
    setError(null);
    try {
      const result = await api.executeQuery(editor, connectionSummary?.connectionId, destructive);
      setExecutionResult(result);
      setTab('output');
      setPage(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Query execution failed');
      setTab('output');
    } finally {
      setExecuting(false);
    }
  };

  const resultColumns = executionResult?.columns ?? [];
  const resultRows = useMemo(
    () =>
      (executionResult?.rows ?? []).map((row) =>
        Object.fromEntries(resultColumns.map((column, index) => [column, row[index]])),
      ),
    [executionResult?.rows, resultColumns],
  );

  const sorted = [...resultRows].sort((a, b) => {
    if (!sortCol) return 0;
    const av = a[sortCol], bv = b[sortCol];
    if (typeof av === 'number' && typeof bv === 'number') return sortAsc ? av - bv : bv - av;
    return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  });
  const filtered = sorted.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(search.toLowerCase())));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const outputCount = resultColumns.length > 0 ? filtered.length : executionResult?.row_count ?? 0;
  const outputCountLabel = resultColumns.length > 0 ? 'rows' : 'rows affected';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <span className="badge badge-cyan"><Sparkles className="w-3 h-3" /> AI Generator</span>
        <h1 className="mt-3 text-3xl font-bold text-white">Ask your database in plain English</h1>
        <p className="mt-1 text-sm text-text-muted">Generate SQL, compare options, edit, and preview results.</p>
      </div>

      {error && (
        <div className="rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Prompt */}
      <div className="app-panel">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-text-dim uppercase tracking-wider">Natural Language Prompt</label>
          <button className="btn-ghost text-xs"><Mic className="w-3 h-3" /> Voice</button>
        </div>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="What would you like to know from your database?"
          className="field min-h-[118px] resize-none p-4 text-sm leading-6 placeholder:text-text-dim"
        />
        <div className="flex flex-wrap gap-2 mt-3">
          {examples.map(e => (
            <button key={e} onClick={() => setPrompt(e)} className="rounded-md px-2 py-1 text-xs text-text-muted transition-colors hover:bg-white/[0.05] hover:text-white">{e}</button>
          ))}
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={generate} disabled={!prompt.trim() || loading} className="btn-primary">
            {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {loading ? 'Generating...' : 'Generate SQL'}
          </button>
          <button onClick={clear} className="btn-ghost"><Trash2 className="w-4 h-4" /> Clear</button>
        </div>
      </div>

      {/* Loading */}
      <AnimatePresence>
        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-3 py-4">
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-light" />
            </div>
            <p className="text-sm text-text-muted">Analyzing schema & generating options...</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SQL Options */}
      {sqls.length > 0 && !loading && (
        <div className="app-panel space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-white">Generated Options</h2>
            <div className="h-px flex-1 bg-white/[0.06]" />
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {sqls.slice(0, 3).map((sql, i) => (
              <motion.div
                key={sql.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => { setSelected(sql.id); setEditor(sql.sql); }}
                className={`min-w-0 cursor-pointer rounded-xl border p-4 transition-all ${selected === sql.id ? 'border-accent/35 bg-accent/[0.08]' : 'border-white/[0.06] bg-white/[0.025] hover:bg-white/[0.04]'}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex gap-1.5">
                    {i === 0 && <span className="badge badge-purple text-[10px]">Best</span>}
                    <span className={`badge ${sql.queryType === 'SELECT' ? 'badge-green' : sql.queryType === 'UPDATE' ? 'badge-yellow' : sql.queryType === 'DELETE' ? 'badge-red' : 'badge-cyan'} text-[10px]`}>{sql.queryType}</span>
                  </div>
                  <span className="text-xs font-semibold text-success">{sql.confidence}%</span>
                </div>
                <pre className="max-h-16 overflow-hidden whitespace-pre-wrap break-words font-mono text-xs leading-5 text-text-muted">{sql.sql}</pre>
                <div className="flex gap-3 text-xs text-text-dim mt-2">
                  <span>Risk: {sql.impact.riskLevel < 25 ? 'Low' : sql.impact.riskLevel < 60 ? 'Med' : 'High'}</span>
                  <span>{sql.impact.estimatedRows} rows</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Workspace */}
      {active && (
        <div className="app-panel space-y-5">
          <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
            <h3 className="text-sm font-semibold text-white">Workspace</h3>
            <button onClick={execute} disabled={executing} className="btn-primary text-xs">
              {executing ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Play className="w-3 h-3" />}
              {executing ? 'Running...' : 'Execute'}
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto border-b border-white/[0.06]">
            {([['sql', 'SQL', Code2], ['explanation', 'Explanation', Info], ['tables', 'Tables', Table2], ['impact', 'Impact', Gauge], ['optimization', 'Optimization', Shield], ['output', 'Output', Play]] as [Tab, string, typeof Code2][]).map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`-mb-px flex flex-shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition-all ${tab === id ? 'border-accent text-accent-light' : 'border-transparent text-text-muted hover:text-text'}`}
              >
                <Icon className="w-3 h-3" />
                {label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {tab === 'sql' && (
            <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-black/20">
              <div className="flex items-center justify-between px-4 py-2 bg-black/30 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-danger" />
                  <span className="w-2.5 h-2.5 rounded-full bg-warning" />
                  <span className="w-2.5 h-2.5 rounded-full bg-success" />
                  <span className="text-xs text-text-muted ml-2">Monaco Editor</span>
                </div>
                <button onClick={() => copy(editor, 'editor')} className="btn-ghost text-xs">{copied === 'editor' ? <CheckCircle2 className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />} Copy</button>
              </div>
              <div className="h-[360px]">
                <Editor height="100%" defaultLanguage="sql" theme="vs-dark" value={editor} onChange={v => setEditor(v || '')} options={{ minimap: { enabled: false }, fontSize: 13, lineNumbers: 'on', scrollBeyondLastLine: false, automaticLayout: true, tabSize: 2 }} />
              </div>
            </div>
          )}

          {tab === 'explanation' && (
            <div className="space-y-5">
              <p className="text-sm text-text-muted leading-relaxed">{active.explanation}</p>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                {[
                  ['Filters', active.filters, 'bg-primary'],
                  ['Joins', active.joins, 'bg-accent'],
                  ['Sorting', active.sorting, 'bg-success'],
                ].filter(([_, items]) => (items as string[]).length > 0).map(([title, items, color]) => (
                  <div key={title as string}>
                    <h4 className="text-xs font-semibold text-text-dim uppercase mb-2">{title as string}</h4>
                    {(items as string[]).map(i => (
                      <div key={i} className="flex items-start gap-2 text-sm text-text-muted mb-1">
                        <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${color}`} />
                        {i}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'tables' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {active.tables.map(t => (
                <div key={t.name}>
                  <div className="flex items-center gap-2 mb-2"><Table2 className="w-4 h-4 text-accent" /><h4 className="text-sm font-semibold text-white">{t.name}</h4></div>
                  <div className="flex flex-wrap gap-2">{t.columns.map(c => <span key={c} className="text-xs text-text-muted bg-white/[0.04] px-2.5 py-1 rounded-md font-mono">{c}</span>)}</div>
                </div>
              ))}
            </div>
          )}

          {tab === 'impact' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {[['Rows', String(active.impact.estimatedRows)], ['Cost', active.impact.cost], ['Risk', `${active.impact.riskLevel}%`]].map(([l, v]) => (
                  <div key={l} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4"><p className="text-xs text-text-dim">{l}</p><p className="text-xl font-bold text-white mt-1">{v}</p></div>
                ))}
              </div>
              {active.impact.warnings.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-text-dim uppercase mb-2">Warnings</h4>
                  {active.impact.warnings.map(w => <div key={w} className="flex items-start gap-2 text-sm text-text-muted mb-1"><span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-warning flex-shrink-0" />{w}</div>)}
                </div>
              )}
            </div>
          )}

          {tab === 'optimization' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Valid Syntax', ok: active.validation.syntaxValid },
                  { label: 'Has WHERE', ok: !active.validation.missingWhere },
                  { label: 'No SELECT *', ok: !active.validation.usesSelectStar },
                ].map(item => (
                  <div key={item.label} className={`p-3 rounded-xl ${item.ok ? 'bg-success/[0.06]' : 'bg-warning/[0.06]'}`}>
                    <div className="flex items-center gap-2 text-sm">{item.ok ? <CheckCircle2 className="w-4 h-4 text-success" /> : <span className="w-4 h-4 rounded-full bg-warning/40" />}<span className="text-white">{item.label}</span></div>
                  </div>
                ))}
              </div>
              {active.validation.indexRecommendation.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-text-dim uppercase mb-2">Index Suggestions</h4>
                  {active.validation.indexRecommendation.map(r => <div key={r} className="flex items-start gap-2 text-sm text-text-muted mb-1"><span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />{r}</div>)}
                </div>
              )}
              {active.validation.optimizationSuggestions.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-text-dim uppercase mb-2">Optimization Tips</h4>
                  {active.validation.optimizationSuggestions.map(s => <div key={s} className="flex items-start gap-2 text-sm text-text-muted mb-1"><span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-warning flex-shrink-0" />{s}</div>)}
                </div>
              )}
            </div>
          )}

          {tab === 'output' && !executionResult && !error && (
            <div className="text-center py-12"><Play className="w-8 h-8 text-text-dim mx-auto mb-3" /><p className="text-sm text-text-muted">Click <span className="text-white font-medium">Execute</span> to run the query.</p></div>
          )}

          {tab === 'output' && executionResult && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">
                  {outputCount} {outputCountLabel} - {executionResult.execution_time_ms}ms
                  {executionResult.truncated ? ' - truncated' : ''}
                </span>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-text-dim" />
                    <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="Search..." className="input-field text-xs pl-8 pr-3 py-1.5 w-32" />
                  </div>
                  <button className="btn-ghost text-xs"><Download className="w-3 h-3" /> CSV</button>
                </div>
              </div>
              <div className="table-shell">
                <table className="w-full text-xs">
                  <thead><tr className="bg-white/[0.03]">
                    {resultColumns.map(c => (
                      <th key={c} onClick={() => { setSortCol(c); setSortAsc(sortCol === c ? !sortAsc : true); }} className="text-left px-4 py-3 text-text-dim font-medium cursor-pointer hover:text-text transition-all">
                        <span className="flex items-center gap-1">{c} {sortCol === c && <ArrowUpDown className={`w-3 h-3 ${sortAsc ? '' : 'rotate-180'}`} />}</span>
                      </th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} className="border-t border-white/[0.04] hover:bg-white/[0.02]">
                        {resultColumns.map(c => <td key={c} className="px-4 py-3 text-text-muted">{String(row[c] ?? '')}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {resultColumns.length === 0 && (
                  <p className="px-4 py-5 text-sm text-text-muted">
                    {executionResult.message || `${executionResult.row_count} rows affected`}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-dim">Page {page + 1} of {pages}</span>
                <div className="flex gap-2">
                  <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="btn-ghost text-xs disabled:opacity-40">Previous</button>
                  <button onClick={() => setPage(Math.min(pages - 1, page + 1))} disabled={page >= pages - 1} className="btn-ghost text-xs disabled:opacity-40">Next</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
