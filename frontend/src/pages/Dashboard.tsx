import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3, TrendingUp, Clock, AlertTriangle, Database, Activity, PieChart, Loader2,
} from 'lucide-react';
import {
  PieChart as RePieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart,
} from 'recharts';
import { useAppStore } from '../hooks/useAppStore';
import { api, type BackendDashboard, type BackendSchema } from '../lib/api';

const COLORS = ['#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function Dashboard() {
  const { connectionSummary } = useAppStore();
  const [dashboard, setDashboard] = useState<BackendDashboard | null>(null);
  const [schema, setSchema] = useState<BackendSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);
      setError(null);
      try {
        const [dashboardData, schemaData] = await Promise.all([
          api.getDashboard(connectionSummary?.connectionId),
          api.getSchema(connectionSummary?.connectionId),
        ]);
        if (!cancelled) {
          setDashboard(dashboardData);
          setSchema(schemaData);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load dashboard');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDashboard();
    return () => {
      cancelled = true;
    };
  }, [connectionSummary?.connectionId]);

  const totalColumns = schema?.tables.reduce((total, table) => total + table.columns.length, 0) ?? 0;
  const recentQueries = dashboard?.recent_queries ?? [];
  const queryTypeDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    recentQueries.forEach((query) => {
      const type = (query.selected_query?.trim().split(/\s+/)[0] || 'UNKNOWN').toUpperCase();
      counts.set(type, (counts.get(type) ?? 0) + 1);
    });
    return [...counts.entries()].map(([type, count]) => ({ type, count }));
  }, [recentQueries]);
  const queryChartData = useMemo(() => {
    const counts = new Map<string, number>();
    recentQueries.forEach((query) => {
      const day = query.timestamp ? query.timestamp.slice(0, 10) : 'unknown';
      counts.set(day, (counts.get(day) ?? 0) + 1);
    });
    return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));
  }, [recentQueries]);
  const tableRows = useMemo(() => {
    const tables = schema?.tables ?? [];
    return [...tables]
      .map((table) => ({ name: table.name, count: table.row_count ?? 0 }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [schema]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <span className="badge badge-cyan">Dashboard</span>
        <h1 className="mt-3 text-3xl font-bold text-white">Overview</h1>
        <p className="mt-1 text-sm text-text-muted">Monitor query activity and database health.</p>
      </div>

      {error && (
        <div className="rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-text-muted">
          <Loader2 className="h-4 w-4 animate-spin text-accent" />
          Loading live database metrics...
        </div>
      )}

      {/* Stats - full width row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[
          { label: 'Database', value: dashboard?.database ?? connectionSummary?.databaseName ?? 'Connected DB', sub: dashboard?.db_type ?? connectionSummary?.databaseType ?? 'PostgreSQL', icon: Database },
          { label: 'Tables', value: String(dashboard?.tables ?? connectionSummary?.tablesFound ?? 0), sub: `${totalColumns || connectionSummary?.columnsIndexed || 0} columns`, icon: BarChart3 },
          { label: 'Rows', value: String(dashboard?.rows ?? 0), sub: dashboard?.largest_table ? `largest: ${dashboard.largest_table.name}` : 'counted from tables', icon: TrendingUp },
          { label: 'Queries', value: recentQueries.length.toLocaleString(), sub: 'stored history', icon: Activity },
          { label: 'Avg Time', value: '0ms', sub: 'not tracked yet', icon: Clock },
          { label: 'Risky', value: '0', sub: 'not tracked yet', icon: AlertTriangle },
        ].map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="app-panel p-4 transition-colors hover:bg-white/[0.05]"
          >
            <card.icon className="w-4 h-4 text-primary-light mb-3" />
            <p className="text-xl font-bold text-white">{card.value}</p>
            <p className="text-xs text-text-muted mt-0.5">{card.label}</p>
            <p className="text-[10px] text-text-dim mt-0.5">{card.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts - two column full width */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="app-panel">
          <div className="flex items-center gap-2 mb-5">
            <Activity className="w-4 h-4 text-primary-light" />
            <h3 className="text-sm font-semibold text-white">Queries Over Time</h3>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={queryChartData}>
              <defs>
                <linearGradient id="qg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(148,163,184,0.06)" vertical={false} />
              <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis stroke="#64748b" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(148,163,184,0.1)', borderRadius: '10px', fontSize: '12px' }} />
              <Area type="monotone" dataKey="count" stroke="#7c3aed" strokeWidth={2} fill="url(#qg)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="app-panel">
          <div className="flex items-center gap-2 mb-5">
            <PieChart className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-semibold text-white">Query Types</h3>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <RePieChart>
              <Pie data={queryTypeDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="count">
                {queryTypeDistribution.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(148,163,184,0.1)', borderRadius: '10px', fontSize: '12px' }} />
            </RePieChart>
          </ResponsiveContainer>
          {queryTypeDistribution.length === 0 && (
            <p className="-mt-36 mb-28 text-center text-sm text-text-muted">No query history yet</p>
          )}
          <div className="mt-3 flex flex-wrap justify-center gap-4">
            {queryTypeDistribution.map((item, i) => (
              <div key={item.type} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                <span className="text-xs text-text-muted">{item.type}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom - two column full width */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="app-panel">
          <h3 className="text-sm font-semibold text-white mb-5">Tables In Connected Database</h3>
          <div className="space-y-3">
            {tableRows.map((t, i) => (
              <div key={t.name} className="flex items-center gap-3">
                <span className="w-4 text-xs text-text-dim">{i + 1}</span>
                <div className="flex-1 h-8 bg-white/[0.05] rounded-lg overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(18, tableRows[0]?.count ? (t.count / tableRows[0].count) * 100 : 100)}%` }}
                    className="h-full bg-gradient-to-r from-primary/40 to-accent/40 rounded-lg flex items-center px-3"
                  >
                    <span className="text-xs text-white font-medium">{t.name}</span>
                  </motion.div>
                </div>
                <span className="text-xs text-text-muted w-8 text-right">{t.count}</span>
              </div>
            ))}
            {tableRows.length === 0 && (
              <p className="text-sm text-text-muted">No tables found in the active connection.</p>
            )}
          </div>
        </div>

        <div className="app-panel">
          <h3 className="text-sm font-semibold text-white mb-5">Performance Summary</h3>
          <div className="grid grid-cols-2 gap-4">
            {[
              ['Primary Keys', String(connectionSummary?.primaryKeys ?? schema?.tables.reduce((total, table) => total + table.primary_keys.length, 0) ?? 0)],
              ['Foreign Keys', String(connectionSummary?.foreignKeys ?? schema?.tables.reduce((total, table) => total + table.foreign_keys.length, 0) ?? 0)],
              ['Relationships', String(connectionSummary?.relationships ?? schema?.tables.reduce((total, table) => total + table.foreign_keys.length, 0) ?? 0)],
              ['Recent Queries', String(recentQueries.length)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4">
                <p className="text-xl font-bold text-white">{value}</p>
                <p className="text-xs text-text-muted mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
