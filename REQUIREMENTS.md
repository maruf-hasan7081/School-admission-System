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
| Refresh/browser reopen recovery | Implemented and browser-tested | URL recovery and stored identity |
| Frontend automated tests (bonus) | Verified | 10 browser tests with isolated API responses |
| Multiple API instances (bonus) | Verified | Two hosts in tests and two live processes sharing PostgreSQL |
| Dockerfiles + Compose + persistent volume | Present; runtime not verified here | Docker is not installed on this machine |
| README / assumptions / AI usage | Updated | Root documentation |
| Public repository and assignment submission | User action | No publication or submission performed |

Backend verification: 36 tests passed against an isolated test database. Frontend verification: production build and 10 browser tests passed. Docker runtime remains a separate verification step.
