import type { DashboardStats, GeneratedSQL, QueryHistoryItem, TableSchema } from '../types';

export const mockDashboardStats: DashboardStats = {
  connectedDatabase: 'production_hr',
  totalTables: 12,
  totalColumns: 84,
  totalQueries: 1284,
  successRate: 94.2,
  avgExecutionTime: 0.34,
  riskyQueries: 23,
  mostUsedTables: [
    { name: 'employees', count: 342 },
    { name: 'departments', count: 215 },
    { name: 'students', count: 189 },
    { name: 'orders', count: 156 },
    { name: 'products', count: 134 },
  ],
  queriesOverTime: [
    { date: '2026-06-15', count: 42 },
    { date: '2026-06-16', count: 58 },
    { date: '2026-06-17', count: 35 },
    { date: '2026-06-18', count: 67 },
    { date: '2026-06-19', count: 51 },
    { date: '2026-06-20', count: 73 },
    { date: '2026-06-21', count: 45 },
  ],
  queryTypeDistribution: [
    { type: 'SELECT', count: 654 },
    { type: 'UPDATE', count: 234 },
    { type: 'DELETE', count: 87 },
    { type: 'INSERT', count: 309 },
  ],
};

export const mockGeneratedSQLs: GeneratedSQL[] = [
  {
    id: 'sql-1',
    sql: 'SELECT e.*, d.department_name\nFROM employees e\nJOIN departments d ON e.department_id = d.department_id\nWHERE e.salary > 50000\nORDER BY e.salary DESC;',
    confidence: 96,
    queryType: 'SELECT',
    complexity: 'Medium',
    explanation:
      'This query retrieves all employee records whose salary exceeds ₹50,000. It joins the employees table with the departments table to include department names, and orders results by salary in descending order.',
    filters: ['salary > 50000'],
    joins: ['INNER JOIN departments ON department_id'],
    aggregations: [],
    sorting: ['ORDER BY salary DESC'],
    tables: [
      {
        name: 'employees',
        columns: ['employee_id', 'name', 'salary', 'department_id', 'email', 'hire_date'],
      },
      {
        name: 'departments',
        columns: ['department_id', 'department_name', 'location', 'budget'],
      },
    ],
    impact: {
      estimatedRows: 42,
      cost: 'Low',
      warnings: [],
      riskLevel: 12,
    },
    validation: {
      syntaxValid: true,
      missingWhere: false,
      usesSelectStar: true,
      indexRecommendation: ['Consider creating index on employees.salary'],
      optimizationSuggestions: ['Replace SELECT * with specific column names for better performance'],
    },
  },
  {
    id: 'sql-2',
    sql: 'SELECT student_id, first_name, last_name, cgpa\nFROM students\nWHERE cgpa > 3.5\nORDER BY cgpa DESC\nLIMIT 5;',
    confidence: 98,
    queryType: 'SELECT',
    complexity: 'Low',
    explanation:
      'This query finds the top 5 students with the highest CGPA above 3.5. It selects specific columns from the students table, filters by CGPA threshold, and limits results to the top 5 records.',
    filters: ['cgpa > 3.5'],
    joins: [],
    aggregations: [],
    sorting: ['ORDER BY cgpa DESC', 'LIMIT 5'],
    tables: [
      {
        name: 'students',
        columns: ['student_id', 'first_name', 'last_name', 'cgpa', 'enrollment_date', 'major'],
      },
    ],
    impact: {
      estimatedRows: 5,
      cost: 'Low',
      warnings: [],
      riskLevel: 5,
    },
    validation: {
      syntaxValid: true,
      missingWhere: false,
      usesSelectStar: false,
      indexRecommendation: ['Consider creating index on students.cgpa'],
      optimizationSuggestions: [],
    },
  },
  {
    id: 'sql-3',
    sql: 'UPDATE employees\nSET salary = salary * 1.10\nWHERE department_id = (\n  SELECT department_id FROM departments\n  WHERE department_name = \'IT\'\n);',
    confidence: 88,
    queryType: 'UPDATE',
    complexity: 'Medium',
    explanation:
      'This query increases the salary of all employees in the IT department by 10%. It uses a subquery to find the IT department ID and applies the salary increase to matching employees.',
    filters: ['department_name = IT'],
    joins: [],
    aggregations: [],
    sorting: [],
    tables: [
      {
        name: 'employees',
        columns: ['employee_id', 'name', 'salary', 'department_id'],
      },
      {
        name: 'departments',
        columns: ['department_id', 'department_name'],
      },
    ],
    impact: {
      estimatedRows: 42,
      cost: 'Medium',
      warnings: ['UPDATE affects 42 rows - consider backing up data first'],
      riskLevel: 45,
    },
    validation: {
      syntaxValid: true,
      missingWhere: false,
      usesSelectStar: false,
      indexRecommendation: ['Index on departments.department_name would improve subquery performance'],
      optimizationSuggestions: ['Consider adding a transaction wrapper for rollback capability'],
    },
  },
  {
    id: 'sql-4',
    sql: 'SELECT * FROM orders\nWHERE order_date BETWEEN \'2026-01-01\' AND \'2026-12-31\'\nAND status = \'pending\'\nORDER BY order_date;',
    confidence: 92,
    queryType: 'SELECT',
    complexity: 'Low',
    explanation:
      'This query retrieves all pending orders placed in the year 2026. It filters by date range and order status, then sorts chronologically.',
    filters: ["order_date BETWEEN '2026-01-01' AND '2026-12-31'", "status = 'pending'"],
    joins: [],
    aggregations: [],
    sorting: ['ORDER BY order_date'],
    tables: [
      {
        name: 'orders',
        columns: ['order_id', 'customer_id', 'order_date', 'status', 'total_amount', 'shipping_address'],
      },
    ],
    impact: {
      estimatedRows: 156,
      cost: 'Low',
      warnings: ['Full table scan detected - consider adding index on order_date and status'],
      riskLevel: 20,
    },
    validation: {
      syntaxValid: true,
      missingWhere: false,
      usesSelectStar: true,
      indexRecommendation: ['Create composite index on (status, order_date)'],
      optimizationSuggestions: ['Replace SELECT * with specific columns', 'Consider pagination for large result sets'],
    },
  },
];

export const mockQueryHistory: QueryHistoryItem[] = [
  {
    id: 'hist-1',
    prompt: 'Show all employees with salary above 50000',
    sql: 'SELECT * FROM employees WHERE salary > 50000;',
    timestamp: '2026-06-21T14:32:00Z',
    executionTime: 0.12,
    success: true,
    saved: true,
    tags: ['employees', 'salary'],
    notes: 'Used for monthly salary report',
  },
  {
    id: 'hist-2',
    prompt: 'Find top 5 students with highest CGPA',
    sql: 'SELECT * FROM students ORDER BY cgpa DESC LIMIT 5;',
    timestamp: '2026-06-21T13:15:00Z',
    executionTime: 0.08,
    success: true,
  },
  {
    id: 'hist-3',
    prompt: 'Increase salary of IT department by 10%',
    sql: 'UPDATE employees SET salary = salary * 1.10 WHERE department_id = (SELECT department_id FROM departments WHERE department_name = \'IT\');',
    timestamp: '2026-06-20T16:45:00Z',
    executionTime: 0.45,
    success: true,
    saved: true,
    tags: ['update', 'salary', 'IT'],
  },
  {
    id: 'hist-4',
    prompt: 'Delete all inactive users older than 1 year',
    sql: 'DELETE FROM users WHERE status = \'inactive\' AND last_login < NOW() - INTERVAL 1 YEAR;',
    timestamp: '2026-06-20T10:20:00Z',
    executionTime: 0.0,
    success: false,
    notes: 'Failed - missing foreign key constraint check',
  },
  {
    id: 'hist-5',
    prompt: 'Get monthly sales summary for 2026',
    sql: 'SELECT MONTH(order_date) as month, SUM(total_amount) as revenue, COUNT(*) as orders_count FROM orders WHERE YEAR(order_date) = 2026 GROUP BY MONTH(order_date) ORDER BY month;',
    timestamp: '2026-06-19T09:00:00Z',
    executionTime: 0.28,
    success: true,
    tags: ['sales', 'monthly', 'revenue'],
  },
  {
    id: 'hist-6',
    prompt: 'Find customers who purchased more than 5 items',
    sql: 'SELECT customer_id, COUNT(*) as purchase_count FROM orders GROUP BY customer_id HAVING COUNT(*) > 5;',
    timestamp: '2026-06-18T15:30:00Z',
    executionTime: 0.15,
    success: true,
  },
];

export const mockSchemaData: TableSchema[] = [
  {
    name: 'employees',
    columns: [
      { name: 'employee_id', type: 'INT', isPrimaryKey: true },
      { name: 'name', type: 'VARCHAR(100)' },
      { name: 'email', type: 'VARCHAR(255)' },
      { name: 'salary', type: 'DECIMAL(10,2)' },
      { name: 'department_id', type: 'INT', isForeignKey: true, references: 'departments.department_id' },
      { name: 'hire_date', type: 'DATE' },
      { name: 'status', type: 'ENUM(active,inactive)' },
    ],
    sampleRows: [
      { employee_id: 1, name: 'Alice Johnson', email: 'alice@company.com', salary: 75000, department_id: 1, hire_date: '2023-01-15', status: 'active' },
      { employee_id: 2, name: 'Bob Smith', email: 'bob@company.com', salary: 55000, department_id: 2, hire_date: '2024-03-20', status: 'active' },
      { employee_id: 3, name: 'Charlie Brown', email: 'charlie@company.com', salary: 48000, department_id: 1, hire_date: '2025-06-01', status: 'active' },
    ],
    relationships: [
      { type: 'one-to-many', targetTable: 'departments', viaColumn: 'department_id' },
    ],
  },
  {
    name: 'departments',
    columns: [
      { name: 'department_id', type: 'INT', isPrimaryKey: true },
      { name: 'department_name', type: 'VARCHAR(100)' },
      { name: 'location', type: 'VARCHAR(255)' },
      { name: 'budget', type: 'DECIMAL(12,2)' },
    ],
    sampleRows: [
      { department_id: 1, department_name: 'IT', location: 'Building A, Floor 3', budget: 500000 },
      { department_id: 2, department_name: 'HR', location: 'Building B, Floor 1', budget: 200000 },
      { department_id: 3, department_name: 'Finance', location: 'Building A, Floor 5', budget: 350000 },
    ],
  },
  {
    name: 'students',
    columns: [
      { name: 'student_id', type: 'INT', isPrimaryKey: true },
      { name: 'first_name', type: 'VARCHAR(50)' },
      { name: 'last_name', type: 'VARCHAR(50)' },
      { name: 'cgpa', type: 'DECIMAL(3,2)' },
      { name: 'major', type: 'VARCHAR(100)' },
      { name: 'enrollment_date', type: 'DATE' },
    ],
    sampleRows: [
      { student_id: 101, first_name: 'David', last_name: 'Lee', cgpa: 3.8, major: 'Computer Science', enrollment_date: '2024-09-01' },
      { student_id: 102, first_name: 'Emma', last_name: 'Wilson', cgpa: 3.95, major: 'Data Science', enrollment_date: '2024-09-01' },
      { student_id: 103, first_name: 'Frank', last_name: 'Garcia', cgpa: 3.6, major: 'Engineering', enrollment_date: '2023-09-01' },
    ],
  },
  {
    name: 'orders',
    columns: [
      { name: 'order_id', type: 'INT', isPrimaryKey: true },
      { name: 'customer_id', type: 'INT', isForeignKey: true, references: 'customers.customer_id' },
      { name: 'order_date', type: 'DATETIME' },
      { name: 'status', type: 'ENUM(pending,shipped,delivered,cancelled)' },
      { name: 'total_amount', type: 'DECIMAL(10,2)' },
      { name: 'shipping_address', type: 'TEXT' },
    ],
    sampleRows: [
      { order_id: 1001, customer_id: 201, order_date: '2026-06-15 10:30:00', status: 'pending', total_amount: 250.0, shipping_address: '123 Main St, NY' },
      { order_id: 1002, customer_id: 202, order_date: '2026-06-16 14:20:00', status: 'shipped', total_amount: 189.99, shipping_address: '456 Oak Ave, LA' },
      { order_id: 1003, customer_id: 201, order_date: '2026-06-17 09:15:00', status: 'delivered', total_amount: 599.99, shipping_address: '123 Main St, NY' },
    ],
    relationships: [
      { type: 'one-to-many', targetTable: 'customers', viaColumn: 'customer_id' },
    ],
  },
  {
    name: 'customers',
    columns: [
      { name: 'customer_id', type: 'INT', isPrimaryKey: true },
      { name: 'first_name', type: 'VARCHAR(50)' },
      { name: 'last_name', type: 'VARCHAR(50)' },
      { name: 'email', type: 'VARCHAR(255)' },
      { name: 'phone', type: 'VARCHAR(20)' },
      { name: 'created_at', type: 'DATETIME' },
    ],
    sampleRows: [
      { customer_id: 201, first_name: 'Grace', last_name: 'Hopper', email: 'grace@email.com', phone: '+1-555-0101', created_at: '2025-01-10 08:00:00' },
      { customer_id: 202, first_name: 'Henry', last_name: 'Ford', email: 'henry@email.com', phone: '+1-555-0102', created_at: '2025-02-15 09:30:00' },
    ],
  },
  {
    name: 'products',
    columns: [
      { name: 'product_id', type: 'INT', isPrimaryKey: true },
      { name: 'product_name', type: 'VARCHAR(200)' },
      { name: 'category', type: 'VARCHAR(100)' },
      { name: 'price', type: 'DECIMAL(10,2)' },
      { name: 'stock_quantity', type: 'INT' },
    ],
    sampleRows: [
      { product_id: 301, product_name: 'Laptop Pro', category: 'Electronics', price: 1299.99, stock_quantity: 50 },
      { product_id: 302, product_name: 'Wireless Mouse', category: 'Accessories', price: 29.99, stock_quantity: 200 },
      { product_id: 303, product_name: 'Desk Chair', category: 'Furniture', price: 349.99, stock_quantity: 30 },
    ],
  },
];

export const mockExecutionResults = {
  columns: ['employee_id', 'name', 'email', 'salary', 'department_id', 'hire_date', 'status'],
  rows: [
    { employee_id: 1, name: 'Alice Johnson', email: 'alice@company.com', salary: 75000, department_id: 1, hire_date: '2023-01-15', status: 'active' },
    { employee_id: 2, name: 'Bob Smith', email: 'bob@company.com', salary: 55000, department_id: 2, hire_date: '2024-03-20', status: 'active' },
    { employee_id: 4, name: 'Diana Prince', email: 'diana@company.com', salary: 82000, department_id: 1, hire_date: '2022-11-01', status: 'active' },
    { employee_id: 5, name: 'Eve Adams', email: 'eve@company.com', salary: 61000, department_id: 3, hire_date: '2024-07-15', status: 'active' },
    { employee_id: 7, name: 'George Harris', email: 'george@company.com', salary: 72000, department_id: 1, hire_date: '2023-05-20', status: 'active' },
    { employee_id: 8, name: 'Helen Clark', email: 'helen@company.com', salary: 58000, department_id: 2, hire_date: '2025-01-10', status: 'active' },
    { employee_id: 10, name: 'Jack Turner', email: 'jack@company.com', salary: 95000, department_id: 1, hire_date: '2021-08-05', status: 'active' },
    { employee_id: 12, name: 'Karen White', email: 'karen@company.com', salary: 67000, department_id: 3, hire_date: '2024-02-28', status: 'active' },
  ],
  totalRows: 42,
  executionTime: 0.12,
};

export const mockConnectionSummary = {
  databaseName: 'production_hr',
  databaseType: 'PostgreSQL' as const,
  tablesFound: 12,
  columnsIndexed: 84,
  primaryKeys: 12,
  foreignKeys: 18,
  relationships: 9,
};

export const schemaAnalysisSteps = [
  'Reading schema...',
  'Detecting relationships...',
  'Mapping foreign keys...',
  'Preparing AI context...',
];

export const generationSteps = [
  'Understanding prompt...',
  'Analyzing schema...',
  'Generating SQL...',
  'Optimizing queries...',
];
