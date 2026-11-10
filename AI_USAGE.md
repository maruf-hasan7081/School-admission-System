# AI Usage

I used Cursor Agent and OpenAI Codex for bug fixing, debugging, testing support, and local setup troubleshooting.

| Tool | Used for |
|------|----------|
| Cursor Agent | Investigating errors and suggesting bug fixes. |
| OpenAI Codex | Fixing frontend and backend bugs, checking edge cases, assisting with tests, and troubleshooting startup and Docker issues. |

## Main areas of assistance

- Frontend form validation, loading and error states, and application-state bugs.
- Backend validation, seat reservation, expiry, and repeated or concurrent requests.
- Backend tests, browser tests, and checks using a real PostgreSQL database.
- Local run scripts, port conflicts, and Docker setup.

## Review and corrections

AI suggestions were checked against the project requirements and verified through builds, automated tests, and browser checks.

For example, a database query failed when translated by EF Core. PostgreSQL-backed tests exposed the error, and the query was corrected before projecting the response. Browser checks also helped identify stale application state after a student ID change; state and request handling were corrected.
