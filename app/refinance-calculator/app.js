const API_URL = '/api/rates';

// -- On page load: check for saved quote in localStorage --
document.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('savedQuote');
  if (saved) {
    try {
      const quote = JSON.parse(saved);
      const banner = document.querySelector('.saved-quote-banner');
      const text = document.querySelector('.saved-quote-text');
      text.textContent = `${quote.lender} — ${quote.newRate}% APR, saving you $${quote.monthlySavings}/mo`;
      banner.classList.add('visible');

      banner.querySelector('.dismiss-quote-btn').addEventListener('click', () => {
        localStorage.removeItem('savedQuote');
        banner.classList.remove('visible');
      });
    } catch (e) { /* ignore corrupt data */ }
  }
});

// -- Form validation --
function validateForm() {
  const balanceInput = document.getElementById('balance');
  const rateInput = document.getElementById('rate');
  const termInput = document.getElementById('term');

  const balanceError = document.getElementById('balance-error');
  const rateError = document.getElementById('rate-error');
  const termError = document.getElementById('term-error');

  // Clear previous errors
  balanceError.textContent = '';
  rateError.textContent = '';
  termError.textContent = '';

  let isValid = true;

  if (!balanceInput.value || isNaN(balanceInput.value)) {
    balanceError.textContent = 'Remaining Balance is required.';
    isValid = false;
  } else if (parseFloat(balanceInput.value) < 1000) {
    balanceError.textContent = 'Remaining Balance must be at least $1,000.';
    isValid = false;
  }

  if (!rateInput.value || isNaN(rateInput.value)) {
    rateError.textContent = 'Current Interest Rate is required.';
    isValid = false;
  } else if (parseFloat(rateInput.value) < 0.1) {
    rateError.textContent = 'Current Interest Rate must be at least 0.1%.';
    isValid = false;
  }

  if (!termInput.value || isNaN(termInput.value)) {
    termError.textContent = 'Remaining Term is required.';
    isValid = false;
  } else if (parseInt(termInput.value, 10) < 1) {
    termError.textContent = 'Remaining Term must be at least 1 month.';
    isValid = false;
  } else if (!Number.isInteger(parseFloat(termInput.value))) {
    termError.textContent = 'Remaining Term must be a whole number.';
    isValid = false;
  }

  return isValid;
}

// -- Form submission --
document.getElementById('loan-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!validateForm()) return;

  const balance = parseFloat(document.getElementById('balance').value);
  const rate = parseFloat(document.getElementById('rate').value);
  const term = parseInt(document.getElementById('term').value, 10);

  const spinner = document.querySelector('.loading-spinner');
  const errorEl = document.querySelector('.error-message');
  const offersContainer = document.getElementById('offers-container');
  const submitBtn = document.querySelector('.check-rates-btn');

  // Reset state
  offersContainer.innerHTML = '';
  errorEl.classList.remove('visible');
  errorEl.textContent = '';
  spinner.classList.add('visible');
  submitBtn.disabled = true;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ balance, rate, term }),
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const data = await response.json();
    renderOffers(data.offers);
  } catch (err) {
    errorEl.textContent = 'Unable to fetch rates. Please try again later.';
    errorEl.classList.add('visible');
  } finally {
    spinner.classList.remove('visible');
    submitBtn.disabled = false;
  }
});

// -- Render offer cards --
function renderOffers(offers) {
  const container = document.getElementById('offers-container');
  offers.forEach((offer) => {
    const card = document.createElement('div');
    card.className = 'offer-card';
    card.setAttribute('role', 'listitem');
    card.innerHTML = `
      <div class="offer-info">
        <h3 class="lender-name">${offer.lender}</h3>
        <p class="rate">${offer.newRate}% APR · ${offer.termMonths} months</p>
      </div>
      <div class="offer-savings">
        <div class="amount">$${offer.monthlySavings}</div>
        <div class="label">monthly savings</div>
        <button class="save-quote-btn" aria-label="Save quote from ${offer.lender}">Save Quote</button>
      </div>
    `;
    // Save quote handler
    card.querySelector('.save-quote-btn').addEventListener('click', () => {
      localStorage.setItem('savedQuote', JSON.stringify(offer));
      const btn = card.querySelector('.save-quote-btn');
      btn.textContent = 'Saved!';
      btn.disabled = true;
    });
    container.appendChild(card);
  });
}
