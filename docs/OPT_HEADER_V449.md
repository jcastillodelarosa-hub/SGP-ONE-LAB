# OPT justified wrapped headings — candidate LAB v449

Local correction only until explicitly approved deployment. No data migration.

## Cause and bounded fix

PDF generators may emit a justified first heading line as several text objects.
The existing metadata-backed continuation guard wrongly required one object in
that first line. The next heading line was then parsed as a project row or cut.
Remove only that first-line object-count restriction. Preserve exact independent
project metadata, exact suffix, one continuation object, alignment and maximum
25-point line distance. This does not discard arbitrary text or relax totals.

## Verification

Synthetic tests cover a fragmented heading, valid pattern continuation, wrong
suffix, horizontal displacement and vertical displacement. Existing negative
metadata/header tests remain. Full local suite: 1254 PASS, 10 SKIP, 0 FAIL.
Six private source PDFs were examined locally: extraction issues clear and all
reference/length/quantity/stock reconciliations match. No originals or extracted
business data are committed. Three previously accepted source documents retain
identical unit counts in local checks. No production import was attempted.

## Out of scope

A document with explicitly unoptimized demand remains blocked by the current
contract. Future support must persist requested, optimized and unoptimized
quantities independently, with exact per-identity conservation and provenance.
Unoptimized demand must never create a cuttable piece, bar or cut event.
Missing index identities remain blocked; descriptive similarity cannot authorize
mapping to a different optimization or reservation.

## Release boundary

The PR runs existing synthetic OPT/DOM/SQL/runtime checks. No workflow or production
configuration changes. Publication additionally needs the updated Edge bundle
because the server shares this extractor; frontend-only deployment is insufficient.
Do not merge, publish, retry imports, or alter already stored documents without
the applicable explicit approval.
