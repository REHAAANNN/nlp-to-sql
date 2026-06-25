# NLP to SQL AI Assistant - Complete Project Flow

## 🧠 Project Overview
A full-stack application that lets users connect their databases (PostgreSQL/MySQL), then write natural language prompts that get converted to SQL queries using AI (Groq API). Users can generate, explain, analyze impact, and execute SQL queries safely.

---

## 🔄 Complete User Flow

### Step 1: Authentication (Clerk)
- **Frontend** uses Clerk (oauth/email login)
- **Backend** verifies JWT from Clerk on every request
- Protected routes redirect to `/login` if not authenticated

### Step 2: Connect Database
```
User fills form → Frontend sends POST /api/database/connect → Backend:
  1. Creates SQLAlchemy engine with credentials
  2. Tests connection (SELECT 1)
  3. Fetches schema (tables, columns, keys, relationships)
  4. Caches schema in memory (300 seconds)
  5. Encrypts & saves credentials in MongoDB
  6. Returns connection_id + schema summary
```

### Step 3: Write Natural Language Prompt
- User types something like *"Show me all employees hired in 2023"*
- Frontend sends `POST /api/generate-query` with the prompt

### Step 4: AI Query Generation
```
Backend receives prompt → 
  1. Gets active database schema from memory cache
  2. Sends prompt + schema to Groq API (llama-3.3-70b-versatile)
  3. Groq returns 3 SQL query options with confidence scores
  4. Backend validates every table/column against real schema
  5. Falls back to local schema-based generation if AI fails
  6. Saves everything to MongoDB history
  7. Returns ✅ GenerateQueryResponse (3 options + best_query)
```

### Step 5: Explain, Analyze, Execute
- **Explain** → `POST /api/explain-query` → Groq explains in plain English
- **Analyze Impact** → `POST /api/analyze-impact` → Runs EXPLAIN, checks risk (low/medium/high)
- **Execute** → `POST /api/execute-query` → Runs real SQL, returns rows/columns/metrics

### Safety Features
- SQL safety validation (blocks DROP, TRUNCATE unless confirmed)
- Statement timeout (3s on PostgreSQL)
- Max 500 rows returned
- Schema validation - rejects queries with fake tables/columns
- Postgres: auto-appends RETURNING * to writes

---

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│   React/Vite    │────▶│  FastAPI Backend     │────▶│  PostgreSQL/MySQL│
│   (TypeScript)  │◀────│  (Python)            │◀────│  (User's DB)     │
└─────────────────┘     └─────────────────────┘     └──────────────────┘
        │                        │                           │
        │ Clerk Auth             │ MongoDB                   │
        ▼                        ▼                           │
┌─────────────────┐     ┌─────────────────────┐             │
│   Clerk.com     │     │  MongoDB            │◀────────────┘
│   (JWT Auth)    │     │  (Queries, Schema,  │
└─────────────────┘     │   History, Users)   │
                        └─────────────────────┘
                                │
                                ▼
                        ┌─────────────────────┐
                        │  Groq API           │
                        │  (llama-3.3-70b)    │
                        └─────────────────────┘
```

---

## 🗄️ Database Layer Flow

### How Database Connection Works (Backend)

1. **`POST /api/database/connect`**
   - Route: `backend/app/routes/database.py`
   - Calls `database_service.connect_database()`
   - Which calls `connection_manager.connect()` in `backend/app/db/connection_manager.py`
   - Creates SQLAlchemy `Engine` with connection pooling
   - Tests with `SELECT 1`

2. **Schema Discovery**
   - Automatically fetches all tables, columns, primary/foreign keys
   - Reads from `information_schema` (PostgreSQL) or `SHOW TABLES/COLUMNS` (MySQL)
   - Caches result for 300 seconds
   - Returns to frontend for display (tables count, columns, relationships)

3. **Credential Storage**
   - Encrypts password using `cryptography.fernet`
   - Saves to MongoDB under user's `connected_databases` array
   - User can reconnect later without re-entering all fields

### MongoDB Schema (for state/app data)
```
Users collection:
  - _id (from Clerk)
  - connected_databases: [{database_id, name, host, port, username, encrypted_password, schema_cache, db_type}]
  - active_database_id

History collection:
  - user_id, prompt, generated_queries[], selected_query, metadata, created_at
```

---

## 📋 API Routes Summary

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/database/connect` | New database connection |
| POST | `/api/connect-db` | Alias for connect |
| GET | `/api/database/saved` | List user's saved databases |
| POST | `/api/database/select` | Reconnect to saved database |
| GET | `/api/schema` | Get database schema |
| POST | `/api/generate-query` | AI generates SQL from prompt |
| POST | `/api/explain-query` | AI explains SQL in English |
| POST | `/api/analyze-impact` | Check query risk/cost |
| POST | `/api/execute-query` | Run SQL on connected DB |
| GET | `/api/history` | Get query history |
| GET | `/health` | Backend health check |

---

## 🚀 Setup Steps (for your friend)

### Backend (.env)
```
GROQ_API_KEY=gsk_your_groq_key
MONGO_URI=mongodb+srv://your_mongo_atlas
SECRET_KEY=random_32_byte_fernet_key
CLERK_JWKS_URL=https://your_clerk.userevents.com/.well-known/jwks.json
CLERK_ISSUER=https://your_clerk.userevents.com
```

### Frontend (.env)
```
VITE_CLERK_PUBLISHABLE_KEY=pk_live_your_clerk_key
VITE_API_URL=http://localhost:8000/api
```

### Start
```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

---

## 🔑 Key Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, Zustand (state) |
| Backend | FastAPI, Python 3.11+, SQLAlchemy 2.0 |
| Auth | Clerk (JWT verification) |
| AI | Groq API (llama-3.3-70b-versatile) |
| App DB | MongoDB (Atlas) |
| Target DBs | PostgreSQL, MySQL |
| Connection | SQLAlchemy engine with connection pooling |

---

## 💡 Prompt Template for Your Friend's Project

If your friend wants to build the **same project**, here's the exact prompt they should give to their AI coding assistant:

```
Create a full-stack NLP to SQL AI Assistant with the following structure:

BACKEND (Python/FastAPI):
1. FastAPI app with CORS middleware
2. PostgreSQL/MySQL connection via SQLAlchemy (connection_manager.py with pooling, statement timeout, schema caching)
3. Groq API integration (generate SQL from natural language, explain SQL, recommend best query)
4. MongoDB for storing user data, saved databases (encrypted credentials), query history
5. Clerk JWT authentication middleware
6. Schema discovery service (read tables, columns, keys from information_schema)
7. SQL safety validator (block dangerous operations)
8. Routes: /api/database/connect, /api/database/saved, /api/database/select, /api/generate-query, /api/explain-query, /api/analyze-impact, /api/execute-query, /api/history, /api/schema
9. Fallback mechanism when AI is unavailable (generate simple SELECT queries from schema)
10. Schema repair logic that validates AI-generated columns against real schema

FRONTEND (React/Vite/TypeScript):
1. Clerk authentication with login page
2. Database connection page (PostgreSQL/MySQL selection, credentials form, saved databases)
3. Schema analysis with animated progress steps
4. AI Generator page (text input, 3 query options with confidence scores, select best)
5. Query results display (table, row count, execution time)
6. Schema Explorer page (list tables, columns, keys with expand/collapse)
7. Query History page (past prompts & generated queries)
8. Saved Queries page (bookmark favorite queries)
9. Settings page
10. Zustand store for global state
11. Tailwind CSS with dark theme
12. Protected routes that redirect to /connect if no database connected
13. Framer Motion animations for smooth transitions

DEPLOYMENT:
- Docker Compose for backend + MongoDB
- Frontend can be deployed to Vercel/Netlify
- Backend to Railway/Render/Fly.io
```

---

## 📦 Folder Structure

```
backend/
├── alembic/              # Database migrations
├── app/
│   ├── ai/
│   │   └── groq_service.py    # Groq API calls (generate, explain, recommend)
│   ├── auth/
│   │   ├── clerk.py           # Clerk JWKS verification
│   │   ├── dependencies.py    # FastAPI dependency (current_user)
│   │   └── security.py        # Fernet encryption for passwords
│   ├── config/
│   │   └── settings.py        # Pydantic settings from .env
│   ├── db/
│   │   ├── base.py            # SQLAlchemy Base
│   │   ├── connection_manager.py  # Pooled connections, schema cache
│   │   └── mongo.py           # MongoDB client
│   ├── models/                # SQLAlchemy models
│   ├── routes/
│   │   ├── auth.py
│   │   ├── database.py
│   │   ├── history.py
│   │   ├── query.py
│   │   └── schema.py
│   ├── schemas/               # Pydantic request/response models
│   ├── services/
│   │   ├── database_service.py
│   │   ├── history_service.py
│   │   ├── query_service.py
│   │   └── schema_service.py
│   ├── utils/
│   │   ├── exceptions.py
│   │   ├── sql_parser.py
│   │   └── sql_safety.py
│   └── main.py                # FastAPI app entry point
├── requirements.txt
└── .env

frontend/
├── src/
│   ├── components/
│   ├── constants/
│   │   └── mockData.ts
│   ├── hooks/
│   │   └── useAppStore.ts     # Zustand store
│   ├── layouts/
│   │   ├── MainLayout.tsx
│   │   ├── Navbar.tsx
│   │   └── Sidebar.tsx
│   ├── lib/
│   │   └── api.ts             # Axios/fetch wrapper with Clerk token
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── ConnectDatabase.tsx
│   │   ├── Dashboard.tsx
│   │   ├── AIGenerator.tsx
│   │   ├── SchemaExplorer.tsx
│   │   ├── QueryHistory.tsx
│   │   ├── SavedQueries.tsx
│   │   └── Settings.tsx
│   ├── types/
│   │   └── index.ts
│   ├── App.tsx                # Routing + protected routes
│   ├── main.tsx
│   └── index.css
├── vite.config.ts
└── package.json