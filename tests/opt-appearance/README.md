# OPT native appearance

Local candidate v445, based on published v444. Presentation only; no RPC, roles,
permissions, parsing, import limits or cut-registration semantics changed.

## Reference lock

The existing SGP Mecanizado and Picking controls are the primary visual target.
Use SGP action blue #1264C8, heading blue #103B73, soft surface #EAF2FB,
8px control corners, 42–44px controls, 14px operational text and visible focus.
The user's two screenshots show browser-default buttons/inputs inside OPT while
Mecanizado's own tabs are styled. OPT's shadow boundary prevents inherited global
control styles; the native host now loads an encapsulated adapter. The standalone
viewer retains its theme. Refero live research was unavailable (subscription).
No marketing layout, new palette, imagery, external font or dependency added.

## Changes

- Native host loads sgp-theme.css, also listed in the release artifact manifest.
- Carga / Cortes tabs and all dynamic controls get SGP states and focus treatment.
- Scope fields have visible labels and responsive alignment.
- File inputs are grouped in a labeled panel; no behavior or input IDs changed.
- Native header no longer calls the published feature a local v21 pilot.
- Hidden/disabled states are preserved; no broad CSS leaks outside shadow root.

## Checks

- Full Node suite: 1,193 PASS, 10 omitted, 0 failures.
- Workflow, scope, shared-cut and import DOM suites: PASS, synthetic data only.
- verify:release, syntax and diff checks: PASS.
- appearance-browser.cjs is added to existing isolated PC/mobile CI. It checks
  computed blue/size, tabs, overflow, disabled write action and cleanup and saves
  four screenshots. Not yet run: local Chromium cannot create sockets (EPERM).
- Rendered visual review and CI of the final commit remain pending. No push,
  PR, merge or deployment performed in this task.
