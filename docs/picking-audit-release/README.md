# Picking audit LAB v396

Reception audit now uses the existing PR174 decision form: accept, modify with the same pending ID/history, logically annul rejected material, and add missing material through the V4 contract. The body scrolls with header/actions accessible on PC and mobile.

Integrated on d45c5ed, preserving later database changes: active-production reception scope, optional NC in Assembly/Packing, and both source function timeouts (45s). No LP interface, publication policy, workflows, global configuration or project instructions changed by this release.

The exact approved atomic installer was applied once to SGP-ONE-LAB (ocvxbwzqxbrfndkvjmfx). SHA256 bfb3364a3b522790d920137c7e76915ee6bce4c7c82477cf19a03cd899f15935. Catalog postcheck confirms ten expected bodies, four RLS tables, anon/authenticated execute on the two new session/role-validated RPCs, no private-schema usage, and no direct differences INSERT/UPDATE/DELETE. See production-installed.json. No operational audit was performed against production data.

Validation retained: 14 local SQL cases, three access/report controls, five domain and eight Reception tests, Chromium PC1366/mobile390 with actual local SQL and all four decisions, stable ID/history, active-list exclusion and scroll. Eight additional local checks validated the current catalog delta and empty-use rollback. Version/cache bumped to v396 and verify:release passes. Synthetic data and emulated mobile; managed session behavior remains a real-user acceptance step.

Unknown-origin histories and pending material with subsequent NC/validation/movements remain guarded; no inferred links or physical deletion. SQL installation is not publication evidence. Deployment outcome must be verified from the actual workflow and live files.
