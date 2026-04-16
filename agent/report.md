# QA Report: Auto Loan Refinance Calculator

## App Overview

The Auto Loan Refinance Calculator is a web application that allows users to input their current auto loan details and receive mock refinance offers from lenders. Users enter their remaining balance, current interest rate, and remaining loan term, then submit the form to see offer cards. A "Save Quote" feature persists the last result to `localStorage`, which is restored on page reload via a dismissible banner.

---

## How to Use the App

1. Enter your **Remaining Balance** (minimum $1,000) in the `#balance` field.
2. Enter your **Current Interest Rate** as a percentage (minimum 0.1%) in the `#rate` field.
3. Enter your **Remaining Term** in months (minimum 1, whole numbers only) in the `#term` field.
4. Click the **"Check Rates"** button to submit.
5. If valid, two mock offer cards appear (Sample Credit Union, Sample Bank).
6. Click **"Save Quote"** to persist the quote to `localStorage`.
7. On the next page load, a banner displays the saved quote; click **`.dismiss-quote-btn`** to dismiss it.

---

## Key Fields and Their Playwright Selectors

| Field | Selector | Type | Constraints |
|---|---|---|---|
| Remaining Balance | `#balance` | Number input | Min: $1,000 |
| Current Interest Rate | `#rate` | Number input | Min: 0.1% |
| Remaining Term (months) | `#term` | Number input | Min: 1 month, whole numbers only |
| Submit Button | `button[type="submit"]` | Button | Triggers validation + offer fetch |
| Save Quote Button | `.save-quote-btn` | Button | Saves to localStorage |
| Dismiss Banner Button | `.dismiss-quote-btn` | Button | Hidden until page reload after save |

---

## Happy Path Test Scenarios

### Scenario 1: Standard Valid Input
- **Balance**: `15000`, **Rate**: `7.5`, **Term**: `48`
- **Expected**: No validation errors; two offer cards rendered.
- **Result**: ✅ Pass

### Scenario 2: Exact Minimum Boundary Values
- **Balance**: `1000`, **Rate**: `0.1`, **Term**: `1`
- **Expected**: No validation errors; two offer cards rendered.
- **Result**: ✅ Pass

### Scenario 3: Very Large Values (No Upper Bound)
- **Balance**: `9999999`, **Rate**: `99.9`, **Term**: `999`
- **Expected**: No validation errors; two offer cards rendered.
- **Result**: ✅ Pass (no upper-bound validation exists — by design or omission)

### Scenario 4: Save Quote → Reload → Banner Appears → Dismiss
- After successful submission, click Save Quote.
- Reload the page (banner only renders on `DOMContentLoaded` when localStorage has data).
- **Expected**: Saved quote banner is visible after reload.
- Click `.dismiss-quote-btn`.
- **Expected**: Banner is hidden/removed.
- **Result**: ✅ Pass

---

## Edge Cases and Negative Test Scenarios

### Scenario 5: All Fields Empty — Submission
- **Input**: All fields blank.
- **Expected**: Three validation errors:
  - *"Remaining Balance is required."*
  - *"Current Interest Rate is required."*
  - *"Remaining Term is required."*
- **Result**: ✅ Pass

### Scenario 6: Partial Empty — Only Rate Missing
- **Balance**: `15000`, **Rate**: *(empty)*, **Term**: `48`
- **Expected**: Only the rate required error fires; no errors on balance or term.
- **Result**: ✅ Pass

### Scenario 7: Negative Values — Below Minimum
- **Balance**: `-5000`, **Rate**: `-3.5`, **Term**: `-12`
- **Expected**: All three minimum-value errors triggered.
- **Result**: ✅ Pass

### Scenario 8: Rate Between 0 and 0.1 — Bug Found and Fixed
- **Balance**: `15000`, **Rate**: `0.05`, **Term**: `48`
- **Expected**: Styled error message: *"Current Interest Rate must be at least 0.1%."*
- **Root cause**: `step="0.1"` on `#rate` caused the browser's native validation to intercept form submission before the custom JS ran, showing an inconsistent native browser tooltip instead of the app's styled error.
- **Fix applied**: Changed `step="0.1"` to `step="any"` on `#rate` in `index.html` so native validation is suppressed and custom JS errors display correctly.
- **Result**: ✅ Pass (after fix)

### Scenario 9: Decimal Term Value — Bug Found and Fixed
- **Balance**: `15000`, **Rate**: `7.5`, **Term**: `12.7`
- **Expected**: Styled error message: *"Remaining Term must be a whole number."*
- **Root cause**: `step="1"` on `#term` caused native browser validation to intercept before JS, showing a native popup. No JS validation existed for non-integer values, causing a silent failure when the native popup was suppressed.
- **Fix applied**: Changed `step="1"` to `step="any"` on `#term` to suppress native validation, and added integer check in `validateForm()` in `app.js` using `Number.isInteger(Number(termInput.value))`.
- **Result**: ✅ Pass (after fix)

---

## Bugs and Issues Summary

| # | Severity | Status | Description |
|---|---|---|---|
| 1 | **Medium** | ✅ Fixed | `step="0.1"` on `#rate` caused native browser validation to override custom JS errors for values between 0 and 0.1. Fixed with `step="any"`. |
| 2 | **Medium** | ✅ Fixed | `step="1"` on `#term` caused native browser popup for decimals, and no JS integer validation existed. Fixed with `step="any"` and added `Number.isInteger` check in `validateForm()`. |
| 3 | **Low** | 📋 Open | No upper-bound validation on any field (balance=9,999,999 accepted). Likely by design but worth confirming with product. |

---

## Suggested Playwright Test Structure

```typescript
import { test, expect } from '@playwright/test';

const URL = 'http://localhost:4200';

test.describe('Auto Loan Refinance Calculator', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(URL);
    // Clear localStorage so saved quote banner does not interfere between tests
    await page.evaluate(() => localStorage.clear());
  });

  // --- HAPPY PATH ---

  test('HP-01: Valid mid-range inputs show offer cards', async ({ page }) => {
    await page.fill('#balance', '15000');
    await page.fill('#rate', '7.5');
    await page.fill('#term', '48');
    await page.click('button[type="submit"]');
    await expect(page.locator('.offer-card')).toHaveCount(2);
  });

  test('HP-02: Exact minimum boundary values show offer cards', async ({ page }) => {
    await page.fill('#balance', '1000');
    await page.fill('#rate', '0.1');
    await page.fill('#term', '1');
    await page.click('button[type="submit"]');
    await expect(page.locator('.offer-card')).toHaveCount(2);
  });

  test('HP-03: Large values accepted with no upper-bound errors', async ({ page }) => {
    await page.fill('#balance', '9999999');
    await page.fill('#rate', '99.9');
    await page.fill('#term', '999');
    await page.click('button[type="submit"]');
    await expect(page.locator('.offer-card')).toHaveCount(2);
  });

  // --- SAVE QUOTE FLOW ---

  test('HP-04: Save Quote persists and banner appears on reload', async ({ page }) => {
    await page.fill('#balance', '15000');
    await page.fill('#rate', '7.5');
    await page.fill('#term', '48');
    await page.click('button[type="submit"]');
    await page.click('.save-quote-btn');
    await page.reload();
    await expect(page.locator('.dismiss-quote-btn')).toBeVisible();
  });

  test('HP-05: Dismiss banner hides it', async ({ page }) => {
    await page.fill('#balance', '15000');
    await page.fill('#rate', '7.5');
    await page.fill('#term', '48');
    await page.click('button[type="submit"]');
    await page.click('.save-quote-btn');
    await page.reload();
    await page.click('.dismiss-quote-btn');
    await expect(page.locator('.dismiss-quote-btn')).toBeHidden();
  });

  // --- VALIDATION: EMPTY FIELDS ---

  test('NEG-01: All fields empty triggers three required errors', async ({ page }) => {
    await page.click('button[type="submit"]');
    await expect(page.locator('#balance-error')).toHaveText('Remaining Balance is required.');
    await expect(page.locator('#rate-error')).toHaveText('Current Interest Rate is required.');
    await expect(page.locator('#term-error')).toHaveText('Remaining Term is required.');
    await expect(page.locator('.offer-card')).toHaveCount(0);
  });

  test('NEG-02: Only rate empty shows only rate error', async ({ page }) => {
    await page.fill('#balance', '15000');
    await page.fill('#term', '48');
    await page.click('button[type="submit"]');
    await expect(page.locator('#rate-error')).toHaveText('Current Interest Rate is required.');
    await expect(page.locator('#balance-error')).toBeEmpty();
    await expect(page.locator('#term-error')).toBeEmpty();
  });

  // --- VALIDATION: BELOW MINIMUM ---

  test('NEG-03: Negative values trigger minimum-value errors', async ({ page }) => {
    await page.fill('#balance', '-5000');
    await page.fill('#rate', '-3.5');
    await page.fill('#term', '-12');
    await page.click('button[type="submit"]');
    await expect(page.locator('#balance-error')).toHaveText('Remaining Balance must be at least $1,000.');
    await expect(page.locator('#rate-error')).toHaveText('Current Interest Rate must be at least 0.1%.');
    await expect(page.locator('#term-error')).toHaveText('Remaining Term must be at least 1 month.');
    await expect(page.locator('.offer-card')).toHaveCount(0);
  });

  // --- REGRESSION TESTS FOR FIXED BUGS ---

  test('REG-01: Rate between 0 and 0.1 shows styled error not browser tooltip', async ({ page }) => {
    await page.fill('#balance', '15000');
    await page.fill('#rate', '0.05');
    await page.fill('#term', '48');
    await page.click('button[type="submit"]');
    await expect(page.locator('#rate-error')).toHaveText('Current Interest Rate must be at least 0.1%.');
    await expect(page.locator('.offer-card')).toHaveCount(0);
  });

  test('REG-02: Decimal term value shows whole number error', async ({ page }) => {
    await page.fill('#balance', '15000');
    await page.fill('#rate', '7.5');
    await page.fill('#term', '12.7');
    await page.click('button[type="submit"]');
    await expect(page.locator('#term-error')).toHaveText('Remaining Term must be a whole number.');
    await expect(page.locator('.offer-card')).toHaveCount(0);
  });

});
```

---

## Notes for Automation Engineers

- **`.dismiss-quote-btn` is always in the DOM** but hidden by default. Only call `page.click('.dismiss-quote-btn')` after a `page.reload()` that follows a Save Quote action; otherwise the element exists but is not interactable.
- **Offer cards contain hardcoded mock data** — do not assert on specific lender names, rates, or savings figures; only assert on card count (`.offer-card` count should be 2 on success, 0 on failure).
- **Clear localStorage in `beforeEach`** using `page.evaluate(() => localStorage.clear())` to prevent saved quote state from leaking between tests.
- **Error message selectors** are `#balance-error`, `#rate-error`, and `#term-error` — these are always in the DOM but empty when no error is present.