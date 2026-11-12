# Picking report date-picker regression

Base: main 4e90e8d (LAB v441). Candidate LAB v442, calendar only; OPT excluded. Publication authorized, CI/deployment pending.

The report grid used 140px tracks but inherited `.pick-toolbar input{min-width:260px}`.
Inputs could overlap the next field and hide the native picker affordance.
The fix contains controls inside their grid tracks and adds an explicit native-calendar
button on the four report date fields. `showPicker()` is invoked only on click;
manual date entry remains usable if unsupported or denied. No RPC/schema/data changes.

Validation:
- `npm test`: 1004 passed, 10 skipped, 0 failed.
- `npm run build:vendor` and `npm run verify:release`: passed.
- `node tests/picking-reception-report/dom.mjs`: 17 checks passed.
- `node tests/report-date-picker/dom.mjs`: four controls; repeated initialization/clicks,
  disabled/read-only fields, showPicker success/error/absence and manual entry passed.
  Both DOM scripts require SGP_JSDOM_MODULE pointing to the local jsdom/lib/api.js.
- `git diff --check`: passed.

Real browser/plant verification is pending. The shared environment's Chromium/socket
restriction was already confirmed in the simultaneous OPT task; it was not bypassed
or retried. DOM checks do not prove that the native OS calendar appears.

Next: authorized publication workflow with the exact candidate SHA and PC/mobile
visual checks. Increment and reconcile the version before publishing; do not merge OPT.
