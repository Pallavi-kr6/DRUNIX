# Drunix smoke checklist (run against the REAL network; not automated here)

Status: NOT RUN. These are the checks required before any feature is marked BUILT on Drunix.

1. `cd chaincode/rasid && go mod tidy && go test ./rules` — rules pass.
2. Deploy the chaincode (README §3). `npm run seed` succeeds (operator bound, 6 participants registered).
3. `GET /api/network/health` → ok:true, detail "connected as OPERATOR".
4. Demo lab steps 1–3: each shows "Committed", positions A ₹1,92,000 / B ₹2,88,000.
5. Demo lab step 4: exactly one "Committed" and one "Rejected at commit" (expect MVCC_READ_CONFLICT).
   If both commit or both fail, STOP: confirm both proposals read POS~<fu>~FINANCIER_A and the endorsement policy.
6. Step 5: five rejections with codes INSUFFICIENT_POSITION, NOT_A_HOLDER, INVALID_LIFECYCLE, REPLAYED_REFERENCE, ROLE_NOT_AUTHORISED.
7. Step 6: settlement committed, replay REPLAYED_REFERENCE, all positions 0.
8. Restart the network; positions and audit trail unchanged.
9. Network page: record p50/p95 and sample size for your write-up (measured, not invented).
