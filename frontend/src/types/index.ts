export interface TableColumn {
  name: string;
  type: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  references?: string;
}

export interface TableSchema {
  name: string;
  columns: TableColumn[];
  sampleRows: Record<string, string | number>[];
  relationships?: {
    type: 'one-to-one' | 'one-to-many' | 'many-to-many';
    targetTable: string;
    viaColumn: string;
  }[];
}

export interface GeneratedSQL {
  id: string;
  sql: string;
  confidence: number;
  queryType: 'SELECT' | 'UPDATE' | 'DELETE' | 'INSERT';
  complexity: 'Low' | 'Medium' | 'High';
  explanation: string;
  filters: string[];
  joins: string[];
  aggregations: string[];
  sorting: string[];
  tables: { name: string; columns: string[] }[];
  impact: {
    estimatedRows: number;
    cost: 'Low' | 'Medium' | 'High';
    warnings: string[];
    riskLevel: number; // 0-100
  };
  validation: {
    syntaxValid: boolean;
    missingWhere: boolean;
    usesSelectStar: boolean;
    indexRecommendation: string[];
    optimizationSuggestions: string[];
  };
}

export interface QueryHistoryItem {
  id: string;
  prompt: string;
  sql: string;
  timestamp: string;
  executionTime: number;
  success: boolean;
  saved?: boolean;
  tags?: string[];
  notes?: string;
}

export interface DashboardStats {
  connectedDatabase: string;
  totalTables: number;
  totalColumns: number;
  totalQueries: number;
  successRate: number;
  avgExecutionTime: number;
  riskyQueries: number;
  mostUsedTables: { name: string; count: number }[];
  queriesOverTime: { date: string; count: number }[];
  queryTypeDistribution: { type: string; count: number }[];
}

export type ThemeMode = 'dark' | 'light';
export type DatabaseType = 'MySQL' | 'PostgreSQL';
export type AIProvider = 'Ollama' | 'Groq';

export interface DatabaseConnectionForm {
  type: DatabaseType;
  host: string;
  port: string;
  databaseName: string;
  username: string;
  password: string;
  ssl: boolean;
}

export interface ConnectionSummary {
  connectionId?: string;
  databaseId?: string;
  databaseName: string;
  databaseType: DatabaseType;
  tablesFound: number;
  columnsIndexed: number;
  primaryKeys: number;
  foreignKeys: number;
  relationships: number;
}
