# Assignment implementation checklist

| Area | Status | Evidence |
| --- | --- | --- |
| .NET 8 + PostgreSQL + EF Core | Implemented | Backend project, migrations and real PostgreSQL tests |
| React 18 or newer | Implemented using React 19 | Frontend package.json |
| Four required UI screens | Implemented | Class directory, application, my applications, create class |
| 17-digit Student ID, no login | Implemented | Shared identity context and API validation |
| Exact eight API contracts | Implemented | API contract and admission safety tests |
| Seat capacity under concurrent requests | Verified | 80-request test plus live two-process verification |
| One active application per student/class | Verified | Transaction lock and partial unique index; parallel duplicate test |
| Only owner can confirm/cancel | Verified | Ownership tests |
| Idempotent confirm | Verified | Repeat-confirm and live 16-request verification |
| Configurable expiry and automatic release | Verified | Configured TTL and background sweep tests |
| Restart persistence | Verified | Independent host/restart tests using PostgreSQL |
| Invalid input produces 4xx and visible errors | Verified | Backend validation and frontend browser tests |
| Live seat counts and expiry | Implemented and browser-tested | Polling and local deadline handling |
| Refresh/browser reopen recovery | Verified | URL recovery, stored identity and a full browser-process close/relaunch check |
| Frontend automated tests (bonus) | Verified | 10 browser tests with isolated API responses |
| Multiple API instances (bonus) | Verified | Two hosts in tests and two live processes sharing PostgreSQL |
| Dockerfiles + Compose + persistent volume | Verified with a local host-port override | Linux container builds, browser/API flows and retained data after Compose down/up |
| README / assumptions / AI usage | Updated | Root documentation |
| Public repository and assignment submission | Public repository verified; form submission remains a user action | Repository visibility and pushed commits checked through the GitHub API |

Backend verification: 36 tests passed against an isolated test database. Frontend verification: production build, 10 regression browser tests and 15 live full-stack checks passed. Additional Docker builds, UI/API smoke checks and Compose down/up persistence passed on 10 November 2026. Local Docker verification used API host port 8088 to coexist with Oracle; the base Compose configuration still publishes port 8080.
