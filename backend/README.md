# SQL AI Assistant Backend

FastAPI backend for connecting to PostgreSQL or MySQL databases, reading schema metadata, generating SQL with Groq, analyzing query impact, safely executing selected SQL, and storing query history in MongoDB.

## Setup

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Create `backend/.env`:

```env
GROQ_API_KEY=
MONGO_URI=
SECRET_KEY=
APP_DATABASE_URL=
REDIS_URL=
```

Do not commit real secrets. If an API key was shared in chat or source control, rotate it before use.

## Run

```powershell
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

API docs:

- `http://127.0.0.1:8000/docs`
- `http://127.0.0.1:8000/health`

## Main Endpoints

- `POST /api/connect-db`
- `GET /api/schema`
- `GET /api/dashboard`
- `POST /api/generate-query`
- `POST /api/explain-query`
- `POST /api/analyze-impact`
- `POST /api/execute-query`
- `GET /api/history`
- `DELETE /api/history/{id}`

## Connection Flow

`POST /api/connect-db` accepts database credentials and returns a `connection_id`. Later endpoints accept `connection_id`; if it is omitted, the most recent active connection is used.

```json
{
  "db_type": "postgresql",
  "host": "localhost",
  "port": 5432,
  "username": "user",
  "password": "pass",
  "database": "company"
}
```

## Safety

Execution blocks multiple statements and dangerous patterns such as `DROP DATABASE`, `TRUNCATE`, `ALTER SYSTEM`, `COPY ... PROGRAM`, `xp_cmdshell`, `LOAD_FILE`, and `INTO OUTFILE`.

`UPDATE` and `DELETE` require:

```json
{
  "query": "UPDATE employees SET salary = salary * 1.1 WHERE department_id = 3",
  "confirm_destructive": true
}
```

The analyzer warns for `SELECT *`, `UPDATE`/`DELETE` without `WHERE`, and large join chains.

## Alembic

Set `APP_DATABASE_URL` to the backend metadata database URL, then run:

```powershell
alembic revision --autogenerate -m "init"
alembic upgrade head
```

The user's connected database is not migrated by this backend. Alembic is for backend-owned metadata only.
