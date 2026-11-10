# Full-stack data test report

Run started: 09 November 2026, 11:07:31 PM (Asia/Dhaka, UTC+06:00).

All 61 distinct automated checks passed. Development data was not used as the test target.

## Results

| Suite | Passed | Scope |
| --- | ---: | --- |
| Backend xUnit | 36 | Real PostgreSQL: contracts, validation, ownership, concurrency, expiry, TTL, schema and persistence |
| Frontend browser regression | 10 | Isolated API fixtures: UI states, validation, refresh, identity and responsive layout |
| Live full-stack | 15 | Real API processes, PostgreSQL records and browser interaction; 96.1s |

The live suite used a newly created database named school_admission_test_live_<run-id>, two API instances (600-second and 6-second hold TTLs), and a separate frontend. Temporary test servers were stopped after verification. The test database remains available for local inspection.

## Seeded data

All student identifiers are synthetic. Initial data included six classes and the four statuses HELD, CONFIRMED, CANCELLED and EXPIRED for the sample student.

| Class / shift | Total | Held | Confirmed | Available |
| --- | ---: | ---: | ---: | ---: |
| Class 10 - Day Shift | 5 | 0 | 0 | 5 |
| Class 6 - Day Shift | 8 | 1 | 2 | 5 |
| Class 6 - Morning Shift | 12 | 2 | 4 | 6 |
| Class 7 - Morning Shift | 3 | 0 | 3 | 0 |
| Class 8 - Day Shift | 6 | 0 | 0 | 6 |
| Class 9 - Science | 10 | 0 | 2 | 8 |

Initial totals: 44 seats, 3 held, 11 confirmed and 30 available. Additional scenario-specific classes and reservations were created during the tests.

## Live scenarios

| Scenario | Result |
| --- | --- |
| real seeded directory has six classes, exact seat totals, filters and full state | PASS |
| real student history contains all four statuses and filters correctly | PASS |
| class creation, hold, page reopen, confirmation and database counts agree | PASS |
| two students compete for last seat; loser gets conflict and counts stay correct | PASS |
| another student reservation and cancellation update open directory without reload | PASS |
| other-tab confirmation wins over an open cancel prompt | PASS |
| other-tab cancellation removes stale payment action | PASS |
| lost apply response recovers actual committed state without duplicate mutation | PASS |
| lost confirm response recovers actual committed state without duplicate mutation | PASS |
| lost cancel response recovers actual committed state without duplicate mutation | PASS |
| actual six-second expiry updates application and history, releases seat, and allows reapply | PASS |
| cross-tab identity change hides foreign hold and sends no mutation | PASS |
| offline error is visible and retry recovers real application | PASS |
| real API concurrency, repeated confirmation and CORS preserve contract | PASS |
| real-data screens fit 375px and 768px viewports | PASS |

The lost-response scenarios let the real server commit, then drop delivery to the browser. Offline and delayed-response scenarios inject network conditions while retaining real backend/database state. No replacement API bodies are used in the live suite.

Expiry was tested with an actual six-second reservation. The UI removed payment actions, its seat count reconciled through polling, the API rejected late confirmation, and a new application received a different hold ID.

Concurrency result: 60 simultaneous requests for 7 seats produced exactly 7 successful reservations and 53 conflicts. Twelve repeated confirmations across the two API instances produced one confirmed seat.

## Visual evidence

Desktop and mobile captures were inspected. Automated layout checks found no horizontal overflow at 375px and 768px. Selected screenshots from this run are preserved in docs/test-evidence. Full reports, logs and additional screenshots are generated locally and can be recreated with the command below.

- [Class directory with real seat counts](test-evidence/class-directory-desktop.png)
- [Student history with all four statuses](test-evidence/student-application-statuses.png)
- [Actual expired reservation](test-evidence/expired-application.png)
- [375px application history](test-evidence/application-history-mobile.png)

## Re-run

From the repository root in PowerShell:

```powershell
.\scripts\test-backend.ps1
cd frontend
npm run test:e2e
cd ..
.\scripts\test-fullstack.ps1
```

The full-stack runner requires the local PostgreSQL credentials in .env.local and installed frontend dependencies. Ports 5099, 5100 and 5181 must be available. It refuses to reuse occupied test ports.

## Docker verification - 10 November 2026

Completed at 22:21 Asia/Dhaka (16:21 UTC), using Docker Desktop 4.99.0, Docker Engine 29.9.3, Compose 5.7.0 and WSL 3.0.3.

Both the .NET 8 backend image and the Node 22 Alpine/Nginx frontend image built successfully from the repository. PostgreSQL 16, the API and the frontend started successfully; API readiness and frontend HTTP checks returned 200.

Local Oracle already occupied host port 8080, and native PostgreSQL occupied 5432. A generated local Compose override published API port 8088, retained frontend port 5173, and kept PostgreSQL internal to the Compose network. The base docker-compose.yml was validated and remains unchanged, publishing API port 8080.

| Container scenario | Result |
| --- | --- |
| Class creation, reservation, confirmation and application history through the UI | PASS |
| Nginx deep-link refresh restores the current reservation | PASS |
| UI cancellation releases the reserved seat | PASS |
| Invalid input returns 400; another student cannot confirm and receives 403 | PASS |
| 24 simultaneous requests for 3 seats produce 3 reservations and 21 conflicts | PASS |
| Eight repeated confirmations produce one confirmed seat | PASS |
| Compose down followed by up recreates containers while preserving the named database volume | PASS |
| Confirmed admission, cancelled history and class counts remain correct through API and UI after restart | PASS |

The earlier 61-check result is retained as the 9 November baseline; these Docker checks are additional verification. Machine-readable local results are generated under backend/bin/DockerSetup and are excluded from Git as runtime artifacts. A separate full Edge process close/relaunch check also restored the saved Student ID and original reservation without creating a duplicate.

To repeat the container workflow on a machine with the default host ports available:

```sh
docker compose up --build -d
# Create a class, reserve a seat and confirm it through the UI.
docker compose down
docker compose up -d
# Reopen the UI with the same Student ID and confirm that the admission remains.
```

## Limits

These results cover the exercised scenarios on Windows/Edge and Linux Docker containers hosted by WSL2. Local Docker tests used a host-port override to coexist with Oracle and native PostgreSQL; the base Compose configuration retains API host port 8080.
