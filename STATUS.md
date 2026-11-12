# Rasid implementation status

**Nothing here has been run on Drunix.** The build sandbox had no Docker, and it could not resolve `golang.org`, `gopkg.in` or `proxy.golang.org`, so the Fabric Go library could not be downloaded.

## BUILT AND VERIFIED ON DRUNIX
*None.*

## BUILT AND VERIFIED ON DEVELOPMENT ENGINE ONLY
(The dev engine is a local mirror of the chaincode with versioned reads. It is not Drunix.)

| Feature | Evidence |
|---|---|
| Register, accept, discount, transfer, release, settle flows | `reports/node-api-test.txt` (3 tests pass); Playwright 16/16 |
| Role authorisation and role-specific navigation | API tests; Playwright auth/nav tests for 4 role types |
| Same-state double sale: exactly one commit, totals conserved | `reports/concurrency-dev-*.json` (20/20, `drunixEvidence:false`); Playwright step-4 test |
| Rejections: over-balance, non-holder, invalid lifecycle, replayed ref, unauthorised role, duplicate registration, replayed settlement, settle-after-release | API tests; Playwright steps 5–6 |
| Append-only audit log with hash chain; success + rejection records | API test (`/api/audit/verify`), Playwright audit test |
| React 19 + Vite + Tailwind 3 + Router + Lucide console, 9 pages, API-driven, no optimistic balances | `web/dist` builds; Playwright suite passed in 3 consecutive runs (16/16) |
| Simulated adapters labelled SIMULATED (invoice/duplicate, payment, insurance policy, CERSAI) | UI + Playwright assertions |
| Previously fixed defects (array render, 422 vs 500, settled-unit display, New run ID, six-step flow) | Playwright regression tests |
| Benchmark and verification tooling | `scripts/*.js`, run on dev engine only |

Verified with no ledger at all: Go ownership rules (`reports/go-rules-test.txt`).

## NOT BUILT OR NOT YET VERIFIED
| Item | State / blocker |
|---|---|
| Chaincode compiles against the real `fabric-contract-api-go` | **Not verified.** gofmt clean; `go vet`/`go build` pass only against a hand-written API stub. Real dependencies could not be fetched. |
| Chaincode deployment on Drunix | **Not done** (no Docker). |
| Seven identities enrolled, permissions verified | **Not done.** |
| Fabric Gateway adapter against a live network | **Written, never run.** |
| Real concurrent double-sale on Drunix; actual validation code | **Not demonstrated.** Run `LEDGER_MODE=drunix npm run verify:concurrency`. |
| Rule tests against Drunix | **Not run.** `npm run test:drunix`. |
| Restart persistence | **Not tested.** |
| Drunix benchmark (p50/p95) | **Not measured.** Dev-engine numbers say nothing about Drunix. |
| Demo rehearsal on Drunix | **Not done.** |
| OVER_ALLOCATION on-chain | Unreachable by construction (transfers conserve the total); Go unit test only. |
| PostgreSQL, Prometheus/Grafana | Not built (optional). |
| Audit log across multiple server processes | Single writer only. |
| Recorded fallback demo | Not produced. |
