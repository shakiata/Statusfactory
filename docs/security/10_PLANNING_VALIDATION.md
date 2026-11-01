# Planning package validation

**Result:** PASSED · **Run:** 2026-10-31T18:54:17.508400+00:00

The portable validator completed **34 planning-artifact checks**: **34 passed, 0 failed, 0 pending**. Detailed observations and input hashes are in [planning_validation.json](data/planning_validation.json).

These checks verify the delivered planning files, their internal consistency and retained artifact QA. They do not implement or verify the application remediation. Canonical requirement/work-package delivery states track **future owner adoption/remediation**, including WP-00 adoption of the operating kit. They intentionally remain `not_started`; release gates remain `not_run`. Current planning-artifact completion is measured separately here. For example, REQ-032's requested files exist now even though future adoption has not been performed.

## Reproduce the package checks

Use Python 3.10 or newer from the extracted package directory. No additional modules, network access or installed application dependencies are needed.

```sh
python tools/validate_planning_package.py
```

The default is read-only and prints a summary. Exit codes are `0` for all planning checks passed, `1` for a failure, and `2` for pending artifact evidence. To explicitly regenerate only the JSON result and this Markdown report:

```sh
python tools/validate_planning_package.py --write-reports
```

The validator also accepts `--root /path/to/extracted/Statusfactory_Security_Package` and `--json` to print the full result. It never modifies the canonical register, workbook, diagrams, application source or retained QA records. [Validator source](tools/validate_planning_package.py).

## Artifact check results

| ID | Area | Check | Result |
| --- | --- | --- | --- |
| PVAL-001 | files | Required deliverables exist and are nonempty | passed |
| PVAL-002 | canonical | Planning-only authority and pinned baseline are retained | passed |
| PVAL-003 | canonical | Canonical entity IDs are unique | passed |
| PVAL-004 | canonical | 36 requirement, 14 work-package and six gate IDs are complete | passed |
| PVAL-005 | canonical | Requirement fields, specifications, owners and work/gate references agree | passed |
| PVAL-006 | canonical | Work dependencies are valid and acyclic | passed |
| PVAL-007 | canonical | Future owner adoption/remediation remains not started; gates remain not run | passed |
| PVAL-008 | canonical | Nine source findings and six dependency groups remain distinct | passed |
| PVAL-009 | dependencies | Independent baseline counts match all stated units | passed |
| PVAL-010 | dependencies | Machine-readable baseline summaries agree | passed |
| PVAL-011 | dependencies | 167 raw advisory records match identities, CVE aliases and withdrawal state | passed |
| PVAL-012 | dependencies | Six dependency groups cover every baseline advisory exactly once | passed |
| PVAL-013 | dependencies | Full baseline OSV response covers 863 queries and the same 167 IDs | passed |
| PVAL-014 | dependencies | CSV and Markdown appendix retain every advisory ID | passed |
| PVAL-015 | dependencies | Inventory paths and versions match the retained baseline lock | passed |
| PVAL-016 | dependencies | Baseline and candidate lock hashes match recorded identities | passed |
| PVAL-017 | dependencies | Candidate evidence is 834 paths, 782 pairs, one advisory and 28 moderate families | passed |
| PVAL-018 | dependencies | Resolution experiment does not claim application installation/build/tests | passed |
| PVAL-019 | dependencies | 17 embedded-Node candidates remain separate from confirmed Electron findings | passed |
| PVAL-020 | provenance | Retained source verification records 94 of 94 matching Git blobs | passed |
| PVAL-021 | costs | Effort totals and CAD 100/hour allowance agree; nonlabor remains unknown | passed |
| PVAL-022 | links | Owned Markdown relative links resolve within the package | passed |
| PVAL-023 | links | Checksum-manifest links are accounted for at the final packaging step | passed |
| PVAL-024 | diagrams | Two diagrams match current inputs, output hashes and recorded QA | passed |
| PVAL-025 | diagrams | Diagrams retain their planned/unimplemented status | passed |
| PVAL-026 | workbook | Workbook source hashes and final XLSX identity match recorded validation | passed |
| PVAL-027 | workbook | Packaged advisory fields agree with the exact workbook input | passed |
| PVAL-028 | workbook | 43 interaction/formula and 39 exported-file checks are recorded passed | passed |
| PVAL-029 | workbook | XLSX ZIP/XML is readable and contains the four intended sheets | passed |
| PVAL-030 | workbook | Workbook baseline preserves unknown total and unperformed delivery states | passed |
| PVAL-031 | pdf | Final PDF and its narrative/catalogue inputs match recorded hashes | passed |
| PVAL-032 | pdf | Recorded final PDF QA covers 39 pages, all identifiers and zero out-of-page characters | passed |
| PVAL-033 | pdf | Nine packaged workbook/contact-sheet previews match their manifest | passed |
| PVAL-034 | packaging | Optional checksum manifest is verified when present | passed |

## Evidence and interpretation

The count checks distinguish 167 individual GHSA records and 165 CVE aliases from 66 npm affected families, including propagated metavulnerabilities. They separately validate the candidate lock's single remaining advisory and 28 moderate propagated families. The candidate remains a resolution-only experiment; its scanner count is not a compatibility or release result.

Workbook evidence records **43 interaction/formula scenarios and 39 exported-file checks**. The validator verifies their recorded results, current canonical source identity, exact historical advisory input and final XLSX hash. It also checks the workbook's ZIP/XML and the four expected sheets. It does not execute Excel or rerun the artifact-tool formula engine. Packaged advisory records may differ from the exact workbook input only in normalized `raw_evidence` pointers.

PDF evidence is tied to the final PDF and source hashes. Its retained inspection covers 39 rendered pages, all 167 advisory identifiers and nine source findings, with zero recorded out-of-page characters. All pages were inspected through two contact sheets and representative pages at full size. This is document layout/coverage QA, not accessibility certification. Diagram input/output hashes, SVG XML and PNG dimensions are rechecked; recorded topology and visual checks are preserved without pretending this script rerenders Mermaid or images.

The retained source verification reports 94 matching Git blobs out of 94 checked. This portable validator verifies that record and baseline identity; the complete source snapshot is not included for a fresh blob rehash. No broader source-history or secret audit is implied.

Effort remains **68 / 129 / 205 hours**, with an explicitly assumed **CAD 100/hour** allowance and unknown nonlabor costs. The overall cost remains unavailable while that allowance is unknown. The canonical register remains authoritative; workbook changes are proposals for integrator review.

[Workbook QA](evidence/planning/workbook_validation.json) · [PDF QA](evidence/planning/pdf_validation.json) · [Independent semantic review](evidence/planning/package_review.md) · [Diagram manifest](diagrams/manifest.json)

## Future owner checks — not run

| Area | Status |
| --- | --- |
| Application remediation and existing app tests/build | not_run |
| Actual OpenCode v2 and Codex adoption/portability matrix | not_run |
| Browser and Windows/Linux packaged-runtime integration | not_run |
| Native binary provenance and runtime/SBOM verification | not_run |
| Live FRM/provider authentication and public endpoint closure | not_run |
| Publication approval and release distribution | not_run |

Planning-artifact completion does not supply implementation authorization, a live provider test account, credentials, risk-exception approval or publication authority. G-00 through G-05 remain open as defined in the canonical register.

## Scope limits

- Recorded hash-bound workbook/PDF/diagram QA is verified as evidence; rendering engines are not rerun.
- Source verification checks the retained 94-of-94 record, not a fresh Git/source audit.
- Owned local Markdown link destinations are checked; external URLs and fragment anchors are not fetched/validated.
- Fenced/inline future examples and raw specialist notes are excluded from owned-link checking.
- An existing SHA256SUMS.txt is verified; its pre-packaging absence is nonblocking. Generate/refresh it after all report writes and rerun read-only.
- Snapshot-specific counts are deliberate. A new baseline needs reviewed expectations, not automatic relaxation.
