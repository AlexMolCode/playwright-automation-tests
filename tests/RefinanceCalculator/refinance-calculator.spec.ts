import { test, expect, type Page } from '@playwright/test';

const BASE_URL = 'http://localhost:4200';

test.describe('Auto Loan Refinance Calculator', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
  });

  async function fillAndSubmitLoanForm(
    page: Page,
    balance: string,
    rate: string,
    term: string
  ) {
    await page.getByLabel('Remaining Balance ($)').fill(balance);
    await page.getByLabel('Current Interest Rate (%)').fill(rate);
    await page.getByLabel('Remaining Term (months)').fill(term);
    await page.getByText('Check Rates').click();
  }

  // Validates that the form does not submit with invalid input
  test('should show error when Remaining Balance is blank', async ({ page }) => {
    await page.getByLabel('Current Interest Rate (%)').fill('6.5');
    await page.getByLabel('Remaining Term (months)').fill('48');
    await page.getByText('Check Rates').click();

    await expect(page.getByText('Remaining Balance is required.')).toBeVisible();
    await expect(page.getByRole('listitem')).toHaveCount(0);
  });

  test('should show error when Remaining Balance is below 1000', async ({ page }) => {
    await fillAndSubmitLoanForm(page, '999', '6.5', '48');

    await expect(page.getByText('Remaining Balance must be at least $1,000.')).toBeVisible();
    await expect(page.getByRole('listitem')).toHaveCount(0);
  });

  test('should show error when Current Interest Rate is blank', async ({ page }) => {
    await page.getByLabel('Remaining Balance ($)').fill('18000');
    await page.getByLabel('Remaining Term (months)').fill('48');
    await page.getByText('Check Rates').click();

    await expect(page.getByText('Current Interest Rate is required.')).toBeVisible();
    await expect(page.getByRole('listitem')).toHaveCount(0);
  });

  test('should show error when Current Interest Rate is below 0.1', async ({ page }) => {
    await fillAndSubmitLoanForm(page, '18000', '0', '48');

    await expect(page.getByText('Current Interest Rate must be at least 0.1%.')).toBeVisible();
    await expect(page.getByRole('listitem')).toHaveCount(0);
  });

  test('should show error when Remaining Term is blank', async ({ page }) => {
    await page.getByLabel('Remaining Balance ($)').fill('18000');
    await page.getByLabel('Current Interest Rate (%)').fill('6.5');
    await page.getByText('Check Rates').click();

    await expect(page.getByText('Remaining Term is required.')).toBeVisible();
    await expect(page.getByRole('listitem')).toHaveCount(0);
  });

  test('should show error when Remaining Term is below 1', async ({ page }) => {
    await fillAndSubmitLoanForm(page, '18000', '6.5', '0');

    await expect(page.getByText('Remaining Term must be at least 1 month.')).toBeVisible();
    await expect(page.getByRole('listitem')).toHaveCount(0);
  });

  // Valid form submission returns offers from the test server
  test('should display offers when valid data is submitted', async ({ page }) => {
    await fillAndSubmitLoanForm(page, '18000', '6.5', '48');

    await expect(page.getByRole('listitem')).toHaveCount(2);
    await expect(page.getByRole('listitem').first()).toContainText('Sample Credit Union');
    await expect(page.getByRole('listitem').last()).toContainText('Sample Bank');
  });

  // Mocks the API to return its own offer data
  test('should display mocked refinance offers', async ({ page }) => {
    await page.route('**/api/rates', async route => {
      await route.fulfill({
        json: ({offers: [
                  { lender: 'Bank 1', newRate: 2.2, termMonths: 8, monthlySavings: 10 }, 
                  { lender: 'Bank 2', newRate: 3.3, termMonths: 10, monthlySavings: 12 }
                ]})
      })
    })

    // Confirm the mocked API data displays on the page
    await fillAndSubmitLoanForm(page, '18000', '6.5', '48');
    
    await expect(page.getByRole('listitem')).toHaveCount(2);
    await expect(page.getByRole('listitem').first()).toContainText('Bank 1');    
    await expect(page.getByRole('listitem').first()).toContainText('$10');

    await expect(page.getByRole('listitem').last()).toContainText('Bank 2');
    await expect(page.getByRole('listitem').last()).toContainText('$12');
  });

  // Simulates a server error — no offers should display
  test('should show error message when API returns 500', async ({ page }) => {
    await page.route('**/api/rates', async route => {
      await route.fulfill({
        status: 500
      })
    })
    await fillAndSubmitLoanForm(page, '18000', '6.5', '48');
    
    // Should display error message when clicking Check Rates
    await expect(page.getByRole('listitem')).toHaveCount(0);
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByText('Unable to fetch rates. Please try again later.')).toBeVisible();
  });

  // Click on Save Quote to get the selected quote displayed at top of the page
  test('should persist saved quote across page reload', async ({ page }) => {
    await page.route('**/api/rates', async route => {
      await route.fulfill({
        json: ({offers: [
                  { lender: 'Bank 1', newRate: 2.2, termMonths: 8, monthlySavings: 10 }, 
                  { lender: 'Bank 2', newRate: 3.3, termMonths: 10, monthlySavings: 12 }
                ]})
      })
    })
    await fillAndSubmitLoanForm(page, '18000', '6.5', '48');
    await page.getByText('Save Quote').first().click();
    
    await expect(page.getByText('Saved!')).toBeVisible();
    await expect(page.getByText('Saved!')).toBeDisabled();
    
    await page.reload();
    
    await expect(page.getByText('Saved Quote')).toBeVisible();
    await expect(page.getByText('Bank 1')).toBeVisible();
  });

  // Pre-seeds localStorage directly to verify the saved quote banner renders on page load
  test('should show banner when localStorage is pre-seeded via evaluate', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('savedQuote', JSON.stringify({ lender: 'Bank 3', newRate: 3.2, termMonths: 12, monthlySavings: 50 })));
    await page.reload();
    
    await expect(page.getByText('Saved Quote')).toBeVisible();
    await expect(page.getByText('Bank 3')).toBeVisible();
  });

  // Simulate not being able to reach the server via API at all
  test('should handle network failure gracefully', async ({ page }) => {
    await page.route('**/api/rates', async route => {
      await route.abort()
    });
  
    await fillAndSubmitLoanForm(page, '18000', '6.5', '48');

    // Should display error message when clicking Check Rates
    await expect(page.getByRole('listitem')).toHaveCount(0);
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByText('Unable to fetch rates. Please try again later.')).toBeVisible();
  });
});