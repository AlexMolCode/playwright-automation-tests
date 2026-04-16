# Playwright QA Automation Portfolio

Both tests below were done while working with [Claude Code](https://claude.com/product/claude-code) integrated with VS Code to help implement Playwright automation.

## Test 1 - Candymapper test
I will be doing the Pop-Up Challenge on the [Candymapper site](http://www.candymapper.com) recommended to me by [Paul Grossman](https://www.linkedin.com/in/pmgrossman/), an accomplished automation expert. 

The test is [here](https://github.com/AlexMolCode/playwright-automation-tests/blob/main/tests/CandyMapper/candymappercom.spec.ts).

## Test 2 - Custom Auto Loan Refinance App and API test

### AI Exploration Agent
This project includes a Claude AI-powered exploration agent that autonomously navigates the app, tests key scenarios, and generates a QA report. The agent uses the Anthropic SDK with a ReAct loop — Claude reasons about what to test, calls browser tools, receives results, and repeats until it has enough coverage to write the report.

The agent discovered two real bugs during exploration:
- **Rate field validation conflict** — `step="0.1"` caused the browser's native validation to override the app's styled error messages for rates between 0 and 0.1%
- **Decimal term silent failure** — `step="1"` caused a native browser popup for decimal terms, and no JS integer validation existed, resulting in a silent failure with no user feedback

Both bugs were fixed and regression tests added. See [agent/report.md](agent/report.md) for the full findings.

To run the agent (requires an Anthropic API key in `.env`):
```
npm run app          # start the app on port 4200
npm run agent    # run the agent
```

### How to use the app manually
- Start the app server: `npm run app` and go to `http://localhost:4200`
- User fills in: Remaining Balance, Current Interest Rate, Remaining Term
- Click the "Check Rates" button to send an API request and retrieve quotes
- The API returns quotes with cards listing lender name, rate, and monthly savings
- Click the "Save Quote" button to store the selected offer as a banner at the top after a page refresh

The test is [here](https://github.com/AlexMolCode/playwright-automation-tests/blob/main/tests/RefinanceCalculator/refinance-calculator.spec.ts).

## Installing Repo to Desktop
1. Make sure you have Git installed: [Download Git](https://git-scm.com/downloads)
2. Make sure you have Node installed: [Download Node](https://nodejs.org/en/download)
3. Clone this repo to your machine: `git clone https://github.com/AlexMolCode/playwright-automation-tests.git`
4. Navigate to the downloaded folder: `cd playwright-automation-tests`
5. Install dependencies: `npm install`
6. Install the browsers Playwright uses (Chromium, Firefox, WebKit): `npx playwright install`
7. Create a `.env` file in the root with your Anthropic API key if you want to run the agent: `ANTHROPIC_API_KEY=your-key-here`

## Running the Tests
Run all tests: `npx playwright test`

Run tests in headed mode (see the browser): `npx playwright test --headed`

View the test report after running the tests above: `npx playwright show-report`

Run the tests in Playwright test runner instead: `npx playwright test --ui`
