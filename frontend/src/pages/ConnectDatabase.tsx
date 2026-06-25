import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { UserButton, useAuth, useUser } from '@clerk/clerk-react';
import {
  ArrowRight,
  CheckCircle2,
  Database,
  KeyRound,
  Loader2,
  Lock,
  Network,
  Server,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { schemaAnalysisSteps } from '../constants/mockData';
import { useAppStore } from '../hooks/useAppStore';
import { api, type BackendSchema, type SavedDatabase } from '../lib/api';
import type { DatabaseConnectionForm, DatabaseType } from '../types';

const defaultForm: DatabaseConnectionForm = {
  type: 'PostgreSQL',
  host: 'localhost',
  port: '5432',
  databaseName: 'production_hr',
  username: 'admin',
  password: '',
  ssl: true,
};

const databaseOptions: {
  type: DatabaseType;
  title: string;
  subtitle: string;
  accent: string;
}[] = [
  {
    type: 'PostgreSQL',
    title: 'PostgreSQL',
    subtitle: 'Production analytics and relational schemas',
    accent: 'from-primary to-accent',
  },
  {
    type: 'MySQL',
    title: 'MySQL',
    subtitle: 'Operational apps, CRM, and commerce data',
    accent: 'from-accent to-success',
  },
];

export default function ConnectDatabase() {
  const navigate = useNavigate();
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const { connectDatabase, setSchemaAnalyzed, isDatabaseConnected, isSchemaAnalyzed, connectionSummary } =
    useAppStore();
  const [form, setForm] = useState<DatabaseConnectionForm>(defaultForm);
  const [savedDatabases, setSavedDatabases] = useState<SavedDatabase[]>([]);
  const [savedPasswords, setSavedPasswords] = useState<Record<string, string>>({});
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [selectingDatabaseId, setSelectingDatabaseId] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [tested, setTested] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      navigate('/login', { replace: true });
      return;
    }

    let cancelled = false;
    setLoadingSaved(true);
    api
      .getSavedDatabases()
      .then((response) => {
        if (!cancelled) setSavedDatabases(response.databases);
      })
      .catch((error) => {
        if (!cancelled) setConnectionError(error instanceof Error ? error.message : 'Unable to load saved databases');
      })
      .finally(() => {
        if (!cancelled) setLoadingSaved(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, navigate]);

  useEffect(() => {
    if (!analyzing) return;

    const timer = window.setInterval(() => {
      setActiveStep((step) => {
        if (step >= schemaAnalysisSteps.length - 1) {
          window.clearInterval(timer);
          window.setTimeout(() => {
            setAnalyzing(false);
            setSchemaAnalyzed(true);
          }, 650);
          return step;
        }

        return step + 1;
      });
    }, 850);

    return () => window.clearInterval(timer);
  }, [analyzing, setSchemaAnalyzed]);

  const updateField = <T extends keyof DatabaseConnectionForm>(
    field: T,
    value: DatabaseConnectionForm[T],
  ) => {
    const nextForm = { ...form, [field]: value };
    if (field === 'type') {
      nextForm.port = value === 'PostgreSQL' ? '5432' : '3306';
    }
    setForm(nextForm);
    setTested(false);
    setConnectionError(null);
  };

  const selectDatabase = (type: DatabaseType) => {
    updateField('type', type);
  };

  const connectToBackend = async () => {
    const body = await api.connectDatabase({
      name: form.databaseName.trim(),
      db_type: form.type === 'PostgreSQL' ? 'postgresql' : 'mysql',
      host: form.host.trim(),
      port: Number(form.port),
      username: form.username.trim(),
      password: form.password,
      database: form.databaseName.trim(),
      ssl: form.ssl,
    });

    const schema = (await api.getSchema(body.connection_id)) as BackendSchema;

    const columns = schema.tables.flatMap((table) => table.columns);
    const primaryKeys = schema.tables.reduce((total, table) => total + (table.primary_keys?.length ?? 0), 0);
    const foreignKeys = schema.tables.reduce((total, table) => total + (table.foreign_keys?.length ?? 0), 0);

    connectDatabase({
      connectionId: body.connection_id,
      databaseId: body.database_id,
      databaseName: body.database,
      databaseType: body.db_type === 'postgresql' ? 'PostgreSQL' : 'MySQL',
      tablesFound: schema.tables.length,
      columnsIndexed: columns.length,
      primaryKeys,
      foreignKeys,
      relationships: foreignKeys,
    });
  };

  const hydrateConnectionSummary = async (database: SavedDatabase, connectionId: string) => {
    const schema = (await api.getSchema(connectionId)) as BackendSchema;
    const columns = schema.tables.flatMap((table) => table.columns);
    const primaryKeys = schema.tables.reduce((total, table) => total + (table.primary_keys?.length ?? 0), 0);
    const foreignKeys = schema.tables.reduce((total, table) => total + (table.foreign_keys?.length ?? 0), 0);

    connectDatabase({
      connectionId,
      databaseId: database.database_id,
      databaseName: database.name || database.database,
      databaseType: database.db_type === 'postgresql' ? 'PostgreSQL' : 'MySQL',
      tablesFound: schema.tables.length,
      columnsIndexed: columns.length,
      primaryKeys,
      foreignKeys,
      relationships: foreignKeys,
    });
  };

  const handleSelectSaved = async (database: SavedDatabase) => {
    setSelectingDatabaseId(database.database_id);
    setConnectionError(null);
    try {
      const response = await api.selectDatabase(database.database_id, savedPasswords[database.database_id]);
      await hydrateConnectionSummary(database, response.connection_id);
      navigate('/', { replace: true });
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : 'Saved database reconnect failed');
    } finally {
      setSelectingDatabaseId(null);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setConnectionError(null);
    try {
      await connectToBackend();
      setTesting(false);
      setTested(true);
    } catch (error) {
      setTesting(false);
      setTested(false);
      setConnectionError(error instanceof Error ? error.message : 'Database connection failed');
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    setConnectionError(null);
    try {
      await connectToBackend();
      setConnecting(false);
      setAnalyzing(true);
      setActiveStep(0);
    } catch (error) {
      setConnecting(false);
      setConnectionError(error instanceof Error ? error.message : 'Database connection failed');
    }
  };

  return (
    <main className="app-surface relative min-h-screen overflow-hidden text-text">
      <div className="soft-grid pointer-events-none absolute inset-0" />

      <div className="connect-shell relative flex min-h-screen flex-col py-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="ai-glow flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent">
              <Database className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">SQL AI Assistant</p>
              <p className="text-xs text-text-muted">Database-first AI query platform</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-success/20 bg-success/10 px-4 py-2 text-xs text-success backdrop-blur md:flex">
              <Lock className="h-3.5 w-3.5" />
              {user?.primaryEmailAddress?.emailAddress ?? 'Authenticated session'}
            </div>
            <UserButton afterSignOutUrl="/login" />
          </div>
        </header>

        <section className="connect-layout flex-1 py-10 lg:py-12">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="min-w-0"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary-light">
              <Sparkles className="h-3.5 w-3.5" />
              AI database onboarding
            </span>
            <h1 className="mt-6 max-w-2xl text-4xl font-bold leading-[1.08] text-white sm:text-5xl xl:text-6xl">
              Connect once. Let AI understand your schema before it writes SQL.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-text-muted sm:text-lg">
              Start with a database connection or reconnect one you already saved. The assistant reads live schema,
              maps relationships, and prepares context for safer query generation.
            </p>

            <div className="mt-8 space-y-3">
              {[
                ['01', 'Connect database', 'Choose PostgreSQL or MySQL and verify credentials.'],
                ['02', 'Analyze schema', 'Index columns, keys, and relationships for AI context.'],
                ['03', 'Generate SQL', 'Ask in natural language, compare options, and execute safely.'],
              ].map(([number, title, description], index) => (
                <motion.div
                  key={title}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.08 }}
                  className="flex gap-4 rounded-2xl border border-white/[0.1] bg-white/[0.04] p-4 backdrop-blur"
                >
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-white/10 text-xs font-bold text-accent">
                    {number}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{title}</p>
                    <p className="mt-1 text-sm text-text-muted">{description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="premium-card connect-card min-w-0 p-5 sm:p-7"
          >
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Step 1</p>
                <h2 className="mt-1 text-3xl font-bold text-white">Choose database</h2>
                <p className="mt-1 text-base text-text-muted">Validate real credentials through the FastAPI backend.</p>
              </div>
              {tested && (
                <span className="badge-success inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold">
                  Connection test passed
                </span>
              )}
            </div>

            {(loadingSaved || savedDatabases.length > 0) && (
              <div className="mb-6 rounded-2xl border border-white/[0.1] bg-black/20 p-4 sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-light">
                      Previously Connected Databases
                    </p>
                    <p className="mt-1 text-sm text-text-muted">Reconnect without re-entering host, port, username, or DB name.</p>
                  </div>
                  {loadingSaved && <Loader2 className="h-4 w-4 animate-spin text-accent" />}
                </div>
                <div className="grid gap-3">
                  {savedDatabases.map((database) => (
                    <div key={database.database_id} className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                          <p className="text-lg font-semibold text-white">{database.name}</p>
                          <p className="mt-1 text-sm text-text-muted">
                            {database.db_type === 'postgresql' ? 'PostgreSQL' : 'MySQL'} • {database.host}:{database.port}
                          </p>
                          <p className="mt-1 text-xs text-text-dim">Username: {database.username} • Password: ********</p>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_130px] lg:w-[360px]">
                          <input
                            type="password"
                            placeholder="Optional password"
                            value={savedPasswords[database.database_id] ?? ''}
                            onChange={(event) =>
                              setSavedPasswords((current) => ({ ...current, [database.database_id]: event.target.value }))
                            }
                            className="field connect-field-plain"
                          />
                          <button
                            type="button"
                            onClick={() => handleSelectSaved(database)}
                            disabled={selectingDatabaseId === database.database_id}
                            className="ai-glow flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-accent text-sm font-bold text-white disabled:opacity-60"
                          >
                            {selectingDatabaseId === database.database_id && <Loader2 className="h-4 w-4 animate-spin" />}
                            Connect
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              {databaseOptions.map((option) => {
                const selected = option.type === form.type;
                return (
                  <button
                    key={option.type}
                    type="button"
                    onClick={() => selectDatabase(option.type as DatabaseType)}
                    className={`relative min-h-[150px] overflow-hidden rounded-2xl border p-5 text-left transition-all ${
                      selected
                        ? 'border-accent/50 bg-accent/10 shadow-lg shadow-accent/10'
                        : 'border-glass-border bg-white/[0.035] hover:border-primary/35 hover:bg-white/[0.06]'
                    }`}
                  >
                    <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${option.accent}`}>
                      <Database className="h-6 w-6 text-white" />
                    </div>
                    <p className="text-lg font-semibold text-white">{option.title}</p>
                    <p className="mt-2 text-sm leading-6 text-text-muted">{option.subtitle}</p>
                    {selected && <CheckCircle2 className="absolute right-4 top-4 h-4 w-4 text-accent" />}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 rounded-2xl border border-white/[0.1] bg-black/20 p-4 sm:p-5">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-text-muted">Host</span>
                  <div className="relative">
                    <Server className="connect-field-icon absolute top-1/2 h-5 w-5 -translate-y-1/2 text-text-dim" />
                    <input
                      value={form.host}
                      onChange={(event) => updateField('host', event.target.value)}
                      className="field connect-field"
                    />
                  </div>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-text-muted">Port</span>
                  <input
                    value={form.port}
                    onChange={(event) => updateField('port', event.target.value)}
                    className="field connect-field-plain"
                  />
                </label>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-text-muted">Database name</span>
                  <div className="relative">
                    <Database className="connect-field-icon absolute top-1/2 h-5 w-5 -translate-y-1/2 text-text-dim" />
                    <input
                      value={form.databaseName}
                      onChange={(event) => updateField('databaseName', event.target.value)}
                      className="field connect-field"
                    />
                  </div>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-text-muted">Username</span>
                  <input
                    value={form.username}
                    onChange={(event) => updateField('username', event.target.value)}
                    className="field connect-field-plain"
                  />
                </label>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_180px] md:items-end">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-text-muted">Password</span>
                  <div className="relative">
                    <KeyRound className="connect-field-icon absolute top-1/2 h-5 w-5 -translate-y-1/2 text-text-dim" />
                    <input
                      type="password"
                      value={form.password}
                      onChange={(event) => updateField('password', event.target.value)}
                      placeholder="Database password"
                      className="field connect-field placeholder:text-text-dim"
                    />
                  </div>
                </label>
                <button
                  type="button"
                  onClick={() => updateField('ssl', !form.ssl)}
                  className={`flex min-h-[58px] items-center justify-between rounded-2xl border px-5 text-base transition ${
                    form.ssl
                      ? 'border-success/25 bg-success/10 text-success'
                      : 'border-glass-border bg-white/[0.04] text-text-muted'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" />
                    SSL
                  </span>
                  <span className={`h-2.5 w-2.5 rounded-full ${form.ssl ? 'bg-success' : 'bg-text-dim'}`} />
                </button>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-[0.9fr_1.25fr]">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testing || connecting}
                  className="chip flex min-h-[58px] items-center justify-center gap-2 rounded-2xl text-base font-semibold disabled:opacity-60"
                >
                  {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Network className="h-4 w-4" />}
                  Test Connection
                </button>
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={connecting || analyzing}
                  className="ai-glow flex min-h-[58px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-accent text-base font-bold text-white transition hover:opacity-95 disabled:opacity-60"
                >
                  {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                  Connect Database
                </button>
              </div>

              {connectionError && (
                <div className="mt-4 rounded-2xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
                  {connectionError}
                </div>
              )}
            </div>

            <AnimatePresence>
              {(isDatabaseConnected || analyzing) && connectionSummary && (
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mt-5 grid gap-4 xl:grid-cols-[0.8fr_1.2fr]"
                >
                  <div className="rounded-3xl border border-success/25 bg-success/10 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-success">
                      <CheckCircle2 className="h-4 w-4" />
                      Database Connected Successfully
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-2xl bg-black/15 p-3">
                        <p className="text-lg font-bold text-white">{connectionSummary.tablesFound}</p>
                        <p className="text-[10px] text-text-muted">Tables</p>
                      </div>
                      <div className="rounded-2xl bg-black/15 p-3">
                        <p className="text-lg font-bold text-white">{connectionSummary.columnsIndexed}</p>
                        <p className="text-[10px] text-text-muted">Columns</p>
                      </div>
                      <div className="rounded-2xl bg-black/15 p-3">
                        <p className="text-lg font-bold text-white">{connectionSummary.relationships}</p>
                        <p className="text-[10px] text-text-muted">Links</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-primary/25 bg-primary/10 p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary-light">
                      Step 2 - Schema Analysis
                    </p>
                    <div className="space-y-2">
                      {schemaAnalysisSteps.map((step, index) => (
                        <div key={step} className="flex items-center gap-2 text-sm">
                          {index <= activeStep || isSchemaAnalyzed ? (
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          ) : (
                            <Loader2 className="h-4 w-4 text-text-dim" />
                          )}
                          <span className={index <= activeStep || isSchemaAnalyzed ? 'text-text' : 'text-text-dim'}>
                            {step}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {isDatabaseConnected && isSchemaAnalyzed && (
              <button
                type="button"
                onClick={() => navigate('/generator')}
                className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white text-sm font-bold text-surface transition hover:bg-text"
              >
                Open AI Query Generator
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </motion.div>
        </section>
      </div>
    </main>
  );
}
