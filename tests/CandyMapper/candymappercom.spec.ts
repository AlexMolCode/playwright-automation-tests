import { test, expect } from '@playwright/test';

test.describe('Testing CandyMapper.com Site', () => {
  test('Pop-Up Challenge', async ({ page }) => { 
    
    await page.goto('http://www.candymapper.com');
    
    //This timeout is necessary for the page to load all the javascript to load
    //the event handlers for the submit button
    await page.waitForTimeout(7000);

    //Close the layer and enter first and last name on the page form
    await expect(page.locator('[data-aid="POPUP_MODAL"]')).toBeVisible();
    await page.locator('#popup-widget307423-close-icon').click();
    await page.locator('input[data-aid="First Name"]').fill('Test');
    await page.locator('input[data-aid="Last Name"]').fill('Name');
   
    //Confirm an error message displays with email missing on submit
    const submitBtn = page.getByRole('button', { name: /submit/i });
    await submitBtn.click();
    await expect(page.locator('[data-aid="CONTACT_EMAIL_ERR_REND"]')).toBeVisible();
    await expect(page.getByText('Please enter a valid email address.')).toBeVisible();

    //Successfully submit after email is entered
    await page.locator('input[data-aid="CONTACT_FORM_EMAIL"]').fill('email@email.com');
    await submitBtn.click();
    await expect(page.locator('[data-aid="CONTACT_FORM_SUBMIT_SUCCESS_MESSAGE"]')).toBeVisible();
    await expect(page.getByText('48 Years')).toBeVisible();
  });
});
