Frontend-only recovery from incomplete programming loads. No database changes.

On loading or failure the Summary hides totals and operational data instead of presenting empty arrays as zero availability. A 57014 timeout is explained plainly; other errors remain visible. Weeks from an independently successful schedule read are retained solely as selection metadata. Operational arrays remain atomic and unchanged on partial failure. Retry remains explicit; no ACL/network fallback or automatic retry.

Synthetic tests cover empty startup, selected-week preservation, timeout with a successful schedule response, absence of zero totals, loading duplicate-retry guard and permission errors. No production transactions were exercised. SQL performance repair was separately coordinated; it is not included or rerun here. Candidate has no version bump/publication: perform release bump and final checks only when publication is authorized.
