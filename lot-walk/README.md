# Lot Walk Scanner — controlled source of truth

## Goal
Mobile-first lot-walk scanner that is faster than manually searching units. It imports the current open-work-order export, finds promising alphanumeric regions anywhere in a camera frame/photo, normalizes orientation/crops, reads candidate identifiers, and matches them to open ROs.

## Locked behavior
- Android/mobile browser and laptop friendly.
- No extra account/login for normal use.
- No paid OCR/API dependency.
- Whole-frame adaptive search; no fixed VIN/tag box.
- Candidate text regions are cropped, enlarged, contrast-adjusted, and retried at 0/90/-90/180 degrees.
- Recognize and combine full VIN, VIN suffix, stock/service tag, RO/RO suffix, customer-name, make/model clues.
- Same physical VIN may return multiple open ROs.
- Weak evidence must remain Unknown/Research. Never call a unit "no ticket" just because one recognition path fails.
- Large Proceed control; Service Area Scanned and Sales Area Scanned toggles.

## Recovered historical regression assets
- `DIA_Lot_Walk_Corrected_Answer_Key_v2.xlsx`: corrected 30-group answer key; 25 direct-confirmed, 1 contextual high-confidence, 4 unresolved.
- `DIA_Lot_Walk_Picture_Reconciliation_Working.xlsx`: broader 68-image reconciliation set and failed-app screenshots.
- `automatic_recognition_baseline_results.csv`: baseline showing the earlier OCR pipeline missed nearly all identifier targets.
- Historical Service Lot Control package evidence: `index.html` plus SHA256 records for `Service_Lot_Control_Production.zip` and `Service_Lot_Control_QA.zip`. The ZIP payloads/source tree were not recoverable from the connected file library.

## Automated gates
1. JavaScript syntax checks.
2. Deterministic matching regression for direct identifier cases, contextual RO-suffix case, duplicate-RO-on-one-VIN behavior, and unresolved guardrails.
3. Browser OCR smoke tests using synthetic straight, 90-degree, and 180-degree identifiers.
4. Historical-photo regression harness built into the app. This gate requires the original historical JPG binaries; the connected file library currently exposes their filenames/results but not the image payloads.

## Architecture
- `index.html` — mobile UI.
- `app.js` — camera/photo capture, OpenCV region proposals, rotated candidate preprocessing, browser OCR, WO import/matching, regression UI.
- `enhancements.js` — contextual RO-suffix and conservative OCR-confusion hardening.
- `validation/matching.test.js` — deterministic answer-key regression.
- `validation/browser-smoke.test.js` — headless browser OCR/orientation smoke test.
- `.github/workflows/lot-walk-validation.yml` — CI gate.

## Production gate
Do not promote a build as field-ready until the original lot-photo binaries can be run through the historical-photo harness and demonstrate material improvement over `automatic_recognition_baseline_results.csv`.
