# Playwright QA Automation Portfolio

Both tests below were done while working with [Claude Code](https://claude.com/product/claude-code) integrated with VS Code to help implement Playwright automation.

## Test 1 - Candymapper test
I will be doing the Pop-Up Challenge on the [Candymapper site](http://www.candymapper.com) recommended to me by [Paul Grossman](https://www.linkedin.com/in/pmgrossman/), an accomplished automation expert. 

The test is [here](https://github.com/AlexMolCode/playwright-automation-tests/blob/main/tests/CandyMapper/candymappercom.spec.ts).

## Test 2 - Custom Auto Loan Refinance App and API test
How to test the app:
- To test it manually, start the app server using `node app/refinance-calculator/server.js` and go to `http://localhost:4200`
- User fills in: Remaining Balance, Current Interest Rate, Remaining Term
- Clicks "Check Rates" → app sends POST /api/rates with { balance, rate, term }
- API returns { offers: [{ lender, newRate, termMonths, monthlySavings }, ...] }
- Offer cards render with lender name, rate, and monthly savings
- "Save Quote" button stores the offer in localStorage as "savedQuote"
- On page load, if a savedQuote exists, a banner appears at the top

The test is [here](https://github.com/AlexMolCode/playwright-automation-tests/blob/main/tests/RefinanceCalculator/refinance-calculator.spec.ts).

## Installing Repo to Desktop
1. Make sure you have Git installed: [Download Git](https://git-scm.com/downloads)
2. Make sure you have Node installed: [Download Node](https://nodejs.org/en/download)
3. Clone this repo to your machine: `git clone https://github.com/AlexMolCode/playwright-automation-tests.git`
4. Navigate to the downloaded folder: `cd playwright-automation-tests`
5. Install dependencies: `npm install`
6. Install the browsers Playwright uses(Chromium, Firefox, WebKit) : `npx playwright install`

## Running the Tests
Run all tests: `npx playwright test`

Run tests in headed mode (see the browser): `npx playwright test --headed`

View the test report after running the tests above: `npx playwright show-report`

Run the tests in Playwright test runner instead: `npx playwright test --ui`
