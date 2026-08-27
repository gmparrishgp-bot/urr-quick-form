# URR Quick Form — Production Gates

## Workflow
- Preserve the proven Build 33 desktop/phone workflow: desktop review, QR pairing, phone quote/approval capture, live sync, DMS job-number mapping, editable rows, per-job copy, approved-labor copy, duplicate-photo protection, and local state.
- RO is required. Read it from the sheet when legible and prevent approval-sheet reconciliation against the wrong quote/RO.
- Repair row count is dynamic. Never assume a fixed 16-row form.
- Quote and approval photos are separate inputs. Approval must reconcile to the loaded quote rather than replace it.
- A reader result is not successful until every extracted repair reaches the review grid.

## Extraction
For every populated repair line, extract independently:
1. Technician repair description.
2. Labor hours, preserving decimals exactly.
3. Parts dollar amount, preserving the quoted amount rather than calculating it.
4. Explicit RECON / NOTE indicators when present.
5. Approval / decline information from the approval sheet.

Use RV vocabulary as interpretation context; normalize door side to DS, off-door side to ODS, and wheel bearing pack to WBP. Do not invent rows or silently drop low-confidence fields. Surface uncertain fields for review.

## Pricing
- Labor rate: $199/hour.
- Raw price = labor hours × 199 + parts.
- Final price = round UP to the next $5 increment.
- If only labor or only parts is present, price the present value; if both are blank, total is blank.
- Preserve technician-quoted labor/parts even when the item is declined or may be RECON/gray-area; classification concerns belong in comments, not by skipping the math.

## Status
- Quoted dollars/labor do not make an item RECON.
- On the corrected RO 105470 fixture, any line with quoted dollars is DECLINED unless explicitly approved; row 7 LP detector is explicitly APPROVED.
- RECON requires an explicit RECON read/classification and normally has no quoted labor/parts on the URR sheet.
- Approval output prefix: `(APPROVED $xxx)`.
- Declined output prefix: `(DECLINED)` while retaining the quoted labor/parts in the row.
- Recon output prefix: `(RECON)`.
- Copy Labor is only available for APPROVED items.

## Standard RECON scope
Interior: blinds; cabinet doors/drawers; heat registers; screens; interior panel/trim secure/touch-up; 12V fuses/bulbs; struts; plumbing recon.
Exterior: spot-seal trim/roof; secure loose components; adjust compartment doors/replace catches.
Full replacement or severity beyond normal touch-up can be a separate/gray-area job and must not be auto-converted without evidence.

## Regression / release gates
- Real collected URR sheets are the primary regression fixtures.
- RO 105470 exact ground truth is stored in `validation/ground-truth-105470.json`.
- Pricing/status contract must pass before any reader build is considered.
- Reader evaluation must measure RO accuracy, repair-row recall, description accuracy, labor exactness, parts exactness, and status exactness.
- UI success alone is not a release criterion.
- Do not promote staging to production until real-sheet accuracy is proven materially useful with minimal manual cleanup.
- Browser-local large vision inference is not the production architecture; production handwriting recognition must use hosted inference so phone/computer performance is not dependent on user hardware.
