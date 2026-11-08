# School Admission System

Onnorokom Projukti take-home assignment: first-come-first-served school admission with seat holds and mock fee payment.

## Stack

- **Backend:** .NET 8, PostgreSQL, EF Core (`backend/`)
- **Frontend:** React 18, TypeScript, Vite (`frontend/`)

## Run with Docker (recommended)

From the repository root:

**PowerShell (Windows):**

```powershell
.\run.ps1
```

If `docker` is not recognized, Docker Desktop is not installed — see [docs/WINDOWS.md](docs/WINDOWS.md).

**Linux / macOS / Git Bash:**

```bash
docker compose up --build
```

| Service   | URL |
|-----------|-----|
| Frontend  | http://localhost:5173 |
| Backend API | http://localhost:8080 |
| PostgreSQL | `localhost:5432` (user/password/db: `postgres` / `postgres` / `school_admission`) |

Environment:

- `ConnectionStrings__Default` — set in `docker-compose.yml` for the backend
- `VITE_API_URL` — baked into the frontend image at build time (default `http://localhost:8080`)
- `HOLD_DURATION_SECONDS` — hold TTL (default `600`)

## Local development (without Docker)

1. Start PostgreSQL and set `ConnectionStrings__Default` in `backend/appsettings.Development.json` or env.
2. Backend:

   ```bash
   cd backend
   dotnet ef database update
   dotnet run
   ```

3. Frontend:

   ```bash
   cd frontend
   npm install
   set VITE_API_URL=http://localhost:8080
   npm run dev
   ```

## Tests

```bash
dotnet test SchoolAdmission.slnx
```

Integration and concurrency tests against PostgreSQL are scaffolded under `backend/tests/` — enable when a test database is available.

## Repository layout

```
backend/
  Api/              HTTP endpoints
  Data/             EF Core entities & DbContext
  Middleware/       API error handling
  Models/           Request/response DTOs
  Services/         Domain logic & hold expiry job
  tests/            xUnit tests
frontend/
  src/api/          API client
  src/context/      Student ID (localStorage)
  src/pages/        UI screens
docker-compose.yml
ASSUMPTIONS.md
AI_USAGE.md
```
