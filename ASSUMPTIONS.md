# Assumptions

| Topic | Decision | Reason |
| --- | --- | --- |
| Identity | Exactly 17 ASCII digits in one X-Student-Id header; no login | Matches the API identity contract and frontend input |
| Admin access | Create-class UI is available without authentication | Assignment has no login requirement |
| Shifts | Each shift is a separate class with its own capacity | Matches the assignment |
| IDs | c_{guid} and h_{guid} | ID format is implementation-defined |
| Payment | Mock action; no charge or payment details | Assignment requires simulation only |
| Reservation duration | Positive integer HOLD_DURATION_SECONDS, default 600 | Invalid configuration fails startup |
| Deadlines | PostgreSQL clock_timestamp() is authoritative | Requests waiting for a lock and separate API hosts use the same clock |
| Allocation and state changes | Create/confirm/cancel take the same PostgreSQL class-row lock; status updates are conditional | Prevents lost updates, late confirmation and overbooking across hosts |
| Duplicate applications | One HELD or CONFIRMED row per student/class, enforced by a partial unique index | Expired/cancelled history remains available |
| Expiry | Automatic sweep every 15 seconds; targeted lazy expiry on hold/student operations; seat counts exclude overdue holds immediately | No client API call is required for eventual persisted expiry |
| Repeated confirmation | An owned CONFIRMED hold returns 200 without changing its confirmation timestamp or seat counts | Idempotent mock payment |
| Cancellation | Only an owned, unexpired HELD hold can be cancelled; terminal states return 409 | A confirmed admission is not cancelled through the reservation endpoint |
| Errors | Validation/business failures are 4xx JSON messages; genuine service failures are 500/503 | Avoids disguising server faults as invalid input |
| Counts | Total/held/confirmed/available come from one SQL statement snapshot | Concurrent confirmations cannot be counted twice in one response |
| Startup | Migrations use a session advisory lock | Multiple API processes can start against the same database |
| Local ports | 8080 preferred; local fallback ports for conflicts | Docker and assignment contract still use 8080 |
| Test database | Only explicit TEST_CONNECTION with school_admission_test prefix; verify context before migrations/reset | Development credentials must never select the test target implicitly |

## Multiple backend processes

Use the same ConnectionStrings__Default and different ASPNETCORE_URLS values for two backend processes. Allocation is serialized by database row locks, not in-memory locks. Each process may run the expiry sweep; the conditional updates are safe to repeat.

Verified locally using two independent API processes and one isolated PostgreSQL database: 80 parallel reservation requests for 5 seats created exactly 5 holds, and 16 repeated confirmation requests produced exactly 1 confirmed seat. The test suite also verifies two independent app hosts, queued allocation after expiry, and confirm/cancel races.

## Frontend

The visual design, class search and filters are usability additions. Application IDs are preserved in the URL; the current student's applications are recovered from the API. A local countdown disables actions at expiry; the server remains authoritative for every transition.
