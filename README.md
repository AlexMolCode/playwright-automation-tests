# Playwright QA Automation Portfolio

This project will showcase automation tests being used to practice Playwright skills.

I will be doing the Pop-Up Challenge on the [Candymapper site](http://www.candymapper.com) recommended to me by [Paul Grossman](https://www.linkedin.com/in/pmgrossman/), an accomplished automation expert. 

The goal is to run the initial set of tests on candymapper.com as a coding exercise.

I am also using [Claude Code](https://claude.com/product/claude-code) integrated with VS Code to help implement Playwright automation.

The test is [here](https://github.com/AlexMolCode/playwright-automation-tests/blob/main/tests/CandyMapper/candymappercom.spec.ts).

## Running Tests Locally
1. Make sure you have Git installed: [Download Git](https://git-scm.com/downloads)
2. Make sure you have Node installed: [Download Node](https://nodejs.org)
3. Clone this repo to your machine: `git clone https://github.com/AlexMolCode/playwright-automation-tests.git`
4. Navigate to the downloaded folder: `cd playwright-automation-tests`
5. Install dependencies: `npm install`
6. Install the browsers Playwright uses(Chromium, Firefox, WebKit) : `npx playwright install`

##Running Tests
Run all tests: `npx playwright test`
Run tests in headed mode (see the browser): `npx playwright test --headed`
View the test report after running the tests above: `npx playwright show-report`
Run the tests in Playwright test runner instead: `npx playwright test --ui`
