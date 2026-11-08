# Assumptions

Short list; extend as you implement edge cases.

| Topic | Decision | Reason |
|-------|----------|--------|
| Admin auth | No authentication; anyone can open **Create class** | Spec says no login; admin actions are available in UI |
| Class ID format | `c_{guid}` | Readable prefix, spec allows custom IDs |
| Hold ID format | `h_{guid}` | Same |
| Student ID | Exactly 17 numeric digits via `X-Student-Id` | Matches assignment |
| Expired holds | Background sweep every 15s + lazy expire on reads/writes | Spec requires auto-release without client calls |
| Errors | `4xx` JSON body `{ "message": "..." }` | User-visible errors; avoid 500 for validation/business rules |
| API errors in UI | Banner text on each screen | Spec forbids console-only errors |
