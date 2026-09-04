# Lot Walk Scanner — controlled source of truth

## Goal
Mobile-first lot-walk scanner that is faster than manually searching units. It imports the current open-work-order export, finds promising alphanumeric regions anywhere in a camera frame/photo, normalizes orientation/crops, reads candidate identifiers, and matches them to open ROs.

## Locked behavior
- Android/mobile browser and laptop friendly.
- No extra account/login for normal use.
- No paid OCR/API dependency.
- Computer loads the combined WO dataset, pairs the phone by QR, and receives accepted phone results back for final audit.
- Phone must explicitly select **SERVICE AREA** or **SALES AREA** before scanning; every accepted unit is recorded against that area.
- Service Area Scanned / Sales Area Scanned remain separate completion flags, not scan-location selectors.
- Whole-frame adaptive search; no fixed VIN/tag box.
- Candidate text regions are cropped, enlarged, contrast-adjusted, and retried at multiple orientations.
- Recognize and combine full VIN, VIN suffix, stock/service tag, RO/RO suffix, customer-name, make/model clues.
- Same physical VIN may return multiple open ROs.
- Weak evidence must remain Unknown/Research. Never call a unit "no ticket" just because one recognition path fails.
- Large Proceed control.

## Recovered regression assets
- `DIA_Lot_Walk_Corrected_Answer_Key_v2.xlsx`: corrected answer key used to build deterministic matching fixtures.
- `DIA_Lot_Walk_Picture_Reconciliation_Working.xlsx`: broader image reconciliation set and failed-app evidence.
- `automatic_recognition_baseline_results.csv`: baseline showing the earlier OCR pipeline missed nearly all identifier targets.
- Four actual July image crops are now stored under `validation/real/` and are mandatory browser gates: `4746_actual_crop.jpg`, `1174_actual_crop.jpg`, `L3116_crop.jpg`, and `839289_crop.jpg`.

## Automated gates
1. JavaScript syntax checks for the app, pairing layer, and every scanner module.
2. Deterministic matching regression: 31/31 required cases, including direct identifiers, contextual RO suffix, duplicate ROs on one VIN, and unresolved guardrails.
3. Synthetic browser OCR orientation checks.
4. Mandatory real-photo browser regression: all four recovered July crops must resolve the expected RO with MEDIUM/HIGH confidence in <= 5 seconds each.
5. Live two-browser pairing regression: computer and phone must pair, transfer the WO dataset, synchronize current scan area and area-completion status, and return a phone-confirmed match to the computer audit with the correct Service/Sales area.

## Current validated scanner
`scanner-v10.js` adds a cheap raw sparse-text read before the expensive adaptive fallbacks. This specifically prevents a usable weak suffix fragment from being buried behind hundreds of OCR attempts. A 3-digit fragment is only expanded to a 4-digit identifier when that completion is unique in the currently imported work-order set and the completed identifier itself produces a defensible match.

Latest validated real-photo timings from CI:
- `4746_actual_crop.jpg` → RO 104746: ~0.85 s.
- `1174_actual_crop.jpg` → RO 104862: ~0.05 s (raw OCR `174`, uniquely completed to VIN suffix `1174`).
- `L3116_crop.jpg` → RO 105252: ~1.77 s.
- `839289_crop.jpg` → RO 105243: ~0.40 s.

## Architecture
- `index.html` — mobile UI, explicit Service/Sales scan-area selector, and active scanner chain.
- `app.js` — camera/photo capture, WO import/matching, regression UI.
- `pairing.js` — QR pairing, WO transfer, live phone→computer audit updates, current scan-area sync, area-completion sync, and audit export.
- `enhancements.js` — contextual RO-suffix and conservative OCR-confusion hardening.
- `scanner-v10.js` — current front-door recognition path; older scanner modules remain as staged fallbacks.
- `validation/matching.test.js` — deterministic answer-key regression.
- `validation/browser-smoke.test.js` — synthetic + mandatory real-photo + live pairing/area workflow gate.
- `.github/workflows/lot-walk-validation.yml` — CI gate.
- `.github/workflows/lot-walk-pages.yml` — zero-cost GitHub Pages deployment after successful validation.

## Production gate
A build is not promoted merely because the UI works. The deterministic matching set, browser orientation checks, all available real July photo gates, and live computer↔phone workflow must remain green. Newly recovered historical photos should be added to the regression set before future releases.
