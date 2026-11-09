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

## Limits

These results cover the exercised scenarios and local browser/runtime configuration. Docker runtime verification remains pending because Docker is not installed on this machine.
