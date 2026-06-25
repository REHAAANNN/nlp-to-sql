import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database,
  Table2,
  ChevronDown,
  ChevronRight,
  Key,
  Link2,
  Search,
  Eye,
  Columns3,
  Loader2,
} from 'lucide-react';
import { useAppStore } from '../hooks/useAppStore';
import { api, type BackendSchema, type BackendTable } from '../lib/api';

function quoteIdentifier(name: string, dbType?: string) {
  const quote = dbType === 'mysql' ? '`' : '"';
  return `${quote}${name.replaceAll(quote, quote + quote)}${quote}`;
}

export default function SchemaExplorer() {
  const { connectionSummary } = useAppStore();
  const [schema, setSchema] = useState<BackendSchema | null>(null);
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTable, setSelectedTable] = useState('');
  const [sampleRows, setSampleRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTable = (name: string) => {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  useEffect(() => {
    let cancelled = false;

    async function loadSchema() {
      setLoading(true);
      setError(null);
      try {
        const data = await api.getSchema(connectionSummary?.connectionId);
        if (cancelled) return;
        setSchema(data);
        const firstTable = data.tables[0]?.name ?? '';
        setSelectedTable((current) => current || firstTable);
        setExpandedTables(firstTable ? new Set([firstTable]) : new Set());
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load schema');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSchema();
    return () => {
      cancelled = true;
    };
  }, [connectionSummary?.connectionId]);

  const tables = schema?.tables ?? [];
  const filteredSchema = tables.filter(
    (table) =>
      table.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      table.columns.some((col) => col.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const activeTable = tables.find((t) => t.name === selectedTable);
  const referencesByColumn = useMemo(() => {
    const refs = new Map<string, string>();
    activeTable?.foreign_keys.forEach((fk) => {
      refs.set(fk.column, `${fk.referred_table}.${fk.referred_column}`);
    });
    return refs;
  }, [activeTable]);
  const referenceFor = (table: BackendTable, columnName: string) => {
    const fk = table.foreign_keys.find((item) => item.column === columnName);
    return fk ? `${fk.referred_table}.${fk.referred_column}` : null;
  };

  useEffect(() => {
    let cancelled = false;
    if (!activeTable) {
      setSampleRows([]);
      return;
    }

    async function loadSamples(table: BackendTable) {
      setSampleLoading(true);
      try {
        const result = await api.executeQuery(
          `SELECT * FROM ${quoteIdentifier(table.name, schema?.db_type)} LIMIT 3`,
          connectionSummary?.connectionId,
        );
        if (cancelled) return;
        setSampleRows(
          result.rows.map((row) =>
            Object.fromEntries(result.columns.map((column, index) => [column, row[index]])),
          ),
        );
      } catch {
        if (!cancelled) setSampleRows([]);
      } finally {
        if (!cancelled) setSampleLoading(false);
      }
    }

    loadSamples(activeTable);
    return () => {
      cancelled = true;
    };
  }, [activeTable, connectionSummary?.connectionId, schema?.db_type]);

  return (
    <div className="space-y-6">
      <div>
        <span className="badge badge-cyan">Schema</span>
        <h1 className="mt-3 text-3xl font-bold text-white">Schema Explorer</h1>
        <p className="text-text-muted text-sm mt-1">Browse database tables, columns, and relationships</p>
      </div>

      {error && (
        <div className="rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-text-muted">
          <Loader2 className="h-4 w-4 animate-spin text-accent" />
          Loading real schema from the backend...
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        {/* Left Panel - Table List */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="min-w-0"
        >
          <div className="app-panel">
            <div className="flex items-center gap-2 mb-3">
              <Database className="w-4 h-4 text-primary-light" />
              <h3 className="text-sm font-semibold">Tables</h3>
              <span className="text-xs text-text-dim ml-auto">{tables.length} tables</span>
            </div>

            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-dim" />
              <input
                type="text"
                placeholder="Search tables or columns..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-surface-light/50 border border-glass-border rounded-lg text-text placeholder:text-text-dim focus:outline-none focus:border-primary/50"
              />
            </div>

            <div className="space-y-1">
              {filteredSchema.map((table) => (
                <div key={table.name}>
                  <button
                    onClick={() => {
                      toggleTable(table.name);
                      setSelectedTable(table.name);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all ${
                      selectedTable === table.name
                        ? 'bg-primary/15 text-primary-light'
                        : 'text-text-muted hover:text-text hover:bg-glass-hover'
                    }`}
                  >
                    {expandedTables.has(table.name) ? (
                      <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
                    )}
                    <Table2 className="w-4 h-4 flex-shrink-0" />
                    <span className="font-medium">{table.name}</span>
                    <span className="text-xs text-text-dim ml-auto">{table.columns.length} cols</span>
                  </button>

                  <AnimatePresence>
                    {expandedTables.has(table.name) && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="ml-8 mt-1 space-y-0.5">
                          {table.columns.map((col) => (
                            <div
                              key={col.name}
                              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-text-muted hover:bg-glass-hover"
                            >
                              {col.primary_key && <Key className="w-3 h-3 text-warning" />}
                              {col.foreign_key && <Link2 className="w-3 h-3 text-accent" />}
                              {!col.primary_key && !col.foreign_key && (
                                <Columns3 className="w-3 h-3 text-text-dim" />
                              )}
                              <span className="font-mono">{col.name}</span>
                              <span className="text-text-dim">{col.data_type}</span>
                              {referenceFor(table, col.name) && (
                                <span className="ml-auto text-[10px] text-accent">to {referenceFor(table, col.name)}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Right Panel - Table Details */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="min-w-0 space-y-4"
        >
          {activeTable && (
            <>
              <div className="app-panel">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                    <Table2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">{activeTable.name}</h2>
                    <p className="text-xs text-text-muted">{activeTable.columns.length} columns - {sampleRows.length} sample rows</p>
                  </div>
                </div>

                {/* Columns */}
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Columns3 className="w-4 h-4 text-primary-light" />
                  Columns
                </h3>
                <div className="table-shell">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-glass-border">
                        <th className="text-left py-2 px-3 text-text-dim font-medium">Name</th>
                        <th className="text-left py-2 px-3 text-text-dim font-medium">Type</th>
                        <th className="text-left py-2 px-3 text-text-dim font-medium">Constraints</th>
                        <th className="text-left py-2 px-3 text-text-dim font-medium">References</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeTable.columns.map((col) => (
                        <tr key={col.name} className="border-b border-glass-border/50">
                          <td className="py-2 px-3 text-text font-mono">{col.name}</td>
                          <td className="py-2 px-3 text-text-muted font-mono">{col.data_type}</td>
                          <td className="py-2 px-3">
                            <div className="flex gap-1">
                              {col.primary_key && <span className="badge-warning text-[10px] px-1.5 py-0.5">PK</span>}
                              {col.foreign_key && <span className="badge-info text-[10px] px-1.5 py-0.5">FK</span>}
                              {!col.primary_key && !col.foreign_key && (
                                <span className="text-[10px] text-text-dim">none</span>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-text-muted font-mono text-[10px]">
                            {referencesByColumn.get(col.name) || 'none'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Relationships */}
              {activeTable.foreign_keys.length > 0 && (
                <div className="app-panel">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Link2 className="w-4 h-4 text-accent" />
                    Relationships
                  </h3>
                  <div className="space-y-2">
                    {activeTable.foreign_keys.map((rel, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 p-3 rounded-xl bg-surface-light/30 border border-glass-border"
                      >
                        <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center">
                          <Link2 className="w-4 h-4 text-accent" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">many to one</p>
                          <p className="text-xs text-text-muted">
                            {activeTable.name}.{rel.column} to {rel.referred_table}.{rel.referred_column}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sample Rows */}
              <div className="app-panel">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-success" />
                  Sample Data
                  {sampleLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-text-muted" />}
                </h3>
                <div className="table-shell">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-glass-border">
                        {activeTable.columns.map((col) => (
                          <th key={col.name} className="text-left py-2 px-3 text-text-dim font-medium">
                            {col.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sampleRows.map((row, i) => (
                        <tr key={i} className="border-b border-glass-border/50">
                          {activeTable.columns.map((col) => (
                            <td key={col.name} className="py-2 px-3 text-text-muted">
                              {String(row[col.name] ?? 'none')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {sampleRows.length === 0 && !sampleLoading && (
                    <p className="px-3 py-4 text-sm text-text-muted">No sample rows returned for this table.</p>
                  )}
                </div>
              </div>
            </>
          )}
          {!activeTable && !loading && (
            <div className="app-panel text-sm text-text-muted">No tables found in this database.</div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
