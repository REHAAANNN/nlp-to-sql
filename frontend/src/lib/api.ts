const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000';
const TOKEN_KEY = 'sql_ai_auth_token';
let clerkTokenProvider: (() => Promise<string | null>) | null = null;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = clerkTokenProvider ? await clerkTokenProvider() : window.localStorage.getItem(TOKEN_KEY);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail = Array.isArray(body.detail)
      ? body.detail.map((item: { msg?: string }) => item.msg).filter(Boolean).join(', ')
      : body.detail;
    throw new Error(detail || response.statusText || 'Request failed');
  }

  return body as T;
}

export type BackendColumn = {
  name: string;
  data_type: string;
  nullable: boolean;
  primary_key: boolean;
  foreign_key: boolean;
  default?: string | null;
};

export type BackendForeignKey = {
  column: string;
  referred_table: string;
  referred_column: string;
};

export type BackendTable = {
  name: string;
  columns: BackendColumn[];
  primary_keys: string[];
  foreign_keys: BackendForeignKey[];
  row_count?: number | null;
};

export type BackendSchema = {
  connection_id: string;
  db_type: 'postgresql' | 'mysql';
  database: string;
  tables: BackendTable[];
};

export type BackendDashboard = {
  connected: boolean;
  connection_id?: string | null;
  db_type?: string | null;
  database?: string | null;
  tables: number;
  rows: number;
  largest_table?: { name: string; rows: number } | null;
  recent_queries: {
    id: string;
    prompt?: string;
    selected_query?: string;
    timestamp?: string;
  }[];
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  auth_provider: 'email' | 'google' | string;
  profile_picture: string;
  connected_databases: SavedDatabase[];
};

export type AuthResponse = {
  access_token: string;
  token_type: 'bearer';
  user: AuthUser;
};

export type SavedDatabase = {
  database_id: string;
  name: string;
  db_type: 'postgresql' | 'mysql';
  host: string;
  port: number;
  username: string;
  database: string;
  schema_cache?: unknown[] | Record<string, unknown> | null;
  last_connected?: string | null;
};

export type GenerateQueryResponse = {
  queries: {
    sql: string;
    confidence: number;
    recommended: boolean;
    explanation?: string | null;
  }[];
  best_query?: string | null;
};

export type ExplainQueryResponse = {
  explanation: string;
  joins_used: string[];
  filters_used: string[];
  aggregations_used: string[];
};

export type AnalyzeImpactResponse = {
  rows_affected?: number | null;
  risk: string;
  query_cost?: string | null;
  warnings: string[];
};

export type ExecuteQueryResponse = {
  columns: string[];
  rows: unknown[][];
  row_count: number;
  execution_time_ms: number;
  truncated: boolean;
  message: string;
};

export type HistoryItem = {
  id: string;
  prompt?: string | null;
  generated_queries: {
    sql?: string;
    confidence?: number;
    recommended?: boolean;
    explanation?: string | null;
  }[];
  selected_query?: string | null;
  timestamp: string;
  metadata: Record<string, unknown>;
};

export const api = {
  tokenKey: TOKEN_KEY,
  setClerkTokenProvider: (provider: (() => Promise<string | null>) | null) => {
    clerkTokenProvider = provider;
  },
  signup: (payload: { name: string; email: string; password: string }) =>
    request<AuthResponse>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  login: (payload: { email: string; password: string }) =>
    request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  googleLogin: (payload: { name: string; email: string; profile_picture?: string; google_token?: string }) =>
    request<AuthResponse>('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  connectDatabase: (payload: {
    name?: string;
    db_type: 'postgresql' | 'mysql';
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    ssl: boolean;
  }) =>
    request<{
      connected: boolean;
      connection_id: string;
      database_id: string;
      db_type: 'postgresql' | 'mysql';
      database: string;
      message: string;
    }>('/api/database/connect', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getSavedDatabases: () => request<{ databases: SavedDatabase[] }>('/api/database/saved'),
  selectDatabase: (databaseId: string, password?: string) =>
    request<{
      connected: boolean;
      connection_id: string;
      database_id: string;
      db_type: 'postgresql' | 'mysql';
      database: string;
      message: string;
    }>('/api/database/select', {
      method: 'POST',
      body: JSON.stringify({ database_id: databaseId, password: password || undefined }),
    }),
  getSchema: (connectionId?: string) =>
    request<BackendSchema>(`/api/schema${connectionId ? `?connection_id=${encodeURIComponent(connectionId)}` : ''}`),
  getDashboard: (connectionId?: string) =>
    request<BackendDashboard>(
      `/api/dashboard${connectionId ? `?connection_id=${encodeURIComponent(connectionId)}` : ''}`,
    ),
  generateQuery: (prompt: string, connectionId?: string) =>
    request<GenerateQueryResponse>('/api/generate-query', {
      method: 'POST',
      body: JSON.stringify({ prompt, connection_id: connectionId }),
    }),
  explainQuery: (query: string, connectionId?: string) =>
    request<ExplainQueryResponse>('/api/explain-query', {
      method: 'POST',
      body: JSON.stringify({ query, connection_id: connectionId }),
    }),
  analyzeImpact: (query: string, connectionId?: string) =>
    request<AnalyzeImpactResponse>('/api/analyze-impact', {
      method: 'POST',
      body: JSON.stringify({ query, connection_id: connectionId }),
    }),
  executeQuery: (query: string, connectionId?: string, confirmDestructive = false) =>
    request<ExecuteQueryResponse>('/api/execute-query', {
      method: 'POST',
      body: JSON.stringify({
        query,
        connection_id: connectionId,
        confirm_destructive: confirmDestructive,
      }),
    }),
  getHistory: (limit = 50, connectionId?: string) => {
    let url = `/api/history?limit=${limit}`;
    if (connectionId) url += `&connection_id=${encodeURIComponent(connectionId)}`;
    return request<{ items: HistoryItem[] }>(url);
  },
  deleteHistory: (historyId: string) =>
    request<{ deleted: boolean }>(`/api/history/${encodeURIComponent(historyId)}`, {
      method: 'DELETE',
    }),
};
