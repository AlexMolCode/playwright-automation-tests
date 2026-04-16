const { chromium } = require('playwright');
const Anthropic = require('@anthropic-ai/sdk').default;
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Anthropic client — reads ANTHROPIC_API_KEY from .env
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Config ────────────────────────────────────────────────────────────────
// APP_URL: the app must be running locally before starting the agent
// MESSAGES_PATH: persists conversation history so runs can resume after a crash
const APP_URL = 'http://localhost:4200';
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');
const REPORT_PATH = path.join(__dirname, 'report.md');
const MESSAGES_PATH = path.join(__dirname, 'messages.json');

// ─── Tool definitions ──────────────────────────────────────────────────────
// Tools are the actions Claude is allowed to take in the browser.
// Each tool has a name, a description (which guides Claude's decision-making),
// and an input_schema (which defines what parameters Claude must provide).
// The descriptions are intentionally instructional — they shape Claude's behavior.

const tools = [
  {
    // Batch fill tool — fills multiple fields in one API call.
    // More efficient than calling fill_field repeatedly, which costs one iteration per field.
    name: 'fill_form',
    description: 'Fill multiple form fields at once. Use this whenever you need to fill more than one field — do not call fill_field multiple times when you can batch them here.',
    input_schema: {
      type: 'object',
      properties: {
        fields: {
          type: 'array',
          description: 'List of fields to fill',
          items: {
            type: 'object',
            properties: {
              selector: { type: 'string', description: 'CSS selector e.g. #balance' },
              value: { type: 'string', description: 'Value to fill in' },
            },
            required: ['selector', 'value'],
          },
        },
      },
      required: ['fields'],
    },
  },
  {
    // Single field fill — used when testing one field in isolation (e.g. one field's validation).
    name: 'fill_field',
    description: 'Fill a single form field. Use this only when filling one field in isolation (e.g. to test one field\'s validation). Use fill_form when filling multiple fields.',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector for the field e.g. #balance' },
        value: { type: 'string', description: 'Value to type into the field' },
      },
      required: ['selector', 'value'],
    },
  },
  {
    name: 'clear_field',
    description: 'Clear a form field',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector for the field to clear' },
      },
      required: ['selector'],
    },
  },
  {
    name: 'click_element',
    description: 'Click a button or element',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector for the element to click' },
      },
      required: ['selector'],
    },
  },
  {
    // Snapshot tool — captures a screenshot and returns page state as JSON.
    // Intentionally limited to meaningful actions to reduce token usage.
    // Each snapshot adds to the message history that gets resent on every API call.
    name: 'take_snapshot',
    description: 'Take a screenshot and capture visible errors and offers on the page. Only use this to verify the result of a meaningful action (e.g. after submitting a form, after reloading). Do NOT snapshot after every single step.',
    input_schema: {
      type: 'object',
      properties: {
        label: { type: 'string', description: 'Short label for this snapshot e.g. "empty-form-errors"' },
      },
      required: ['label'],
    },
  },
  {
    // reload_page is needed because the saved quote banner only appears on DOMContentLoaded
    // when localStorage has a saved quote. It won't appear without a full page reload.
    name: 'reload_page',
    description: 'Reload the page. Use this after saving a quote so the saved quote banner appears on page load.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    // finish signals the agent to stop exploring and write the QA report.
    // The report is written to report.md and the session file is cleaned up.
    name: 'finish',
    description: 'You have explored enough. Generate the final QA report and finish.',
    input_schema: {
      type: 'object',
      properties: {
        report: { type: 'string', description: 'The full QA report in markdown format' },
      },
      required: ['report'],
    },
  },
];

// ─── Tool execution ────────────────────────────────────────────────────────
// Translates Claude's tool call instructions into real Playwright browser actions.
// Each handler returns a string result that gets sent back to Claude
// so it knows what happened and can decide the next action.

async function executeTool(page, toolName, toolInput, snapshotCount) {
  console.log(`  → Executing tool: ${toolName}`, JSON.stringify(toolInput));

  if (toolName === 'fill_form') {
    const results = [];
    for (const field of toolInput.fields) {
      try {
        await page.fill(field.selector, field.value);
      } catch (err) {
        // input[type=number] blocks non-numeric text via Playwright's fill().
        // Fall back to setting the value directly via JavaScript so Claude can
        // test how the app handles invalid input on number fields.
        try {
          await page.evaluate(
            ({ selector, value }) => { document.querySelector(selector).value = value; },
            { selector: field.selector, value: field.value }
          );
        } catch (evalErr) {
          results.push(`ERROR: Could not fill ${field.selector} — ${evalErr.message.split('\n')[0]}`);
          continue;
        }
      }
      results.push(`Filled ${field.selector} with "${field.value}"`);
    }
    return results.join('\n');
  }

  if (toolName === 'fill_field') {
    try {
      await page.fill(toolInput.selector, toolInput.value);
    } catch (err) {
      // Same fallback as fill_form — force value via JS for input[type=number]
      try {
        await page.evaluate(
          ({ selector, value }) => { document.querySelector(selector).value = value; },
          { selector: toolInput.selector, value: toolInput.value }
        );
      } catch (evalErr) {
        return `ERROR: Could not fill ${toolInput.selector} — ${evalErr.message.split('\n')[0]}`;
      }
    }
    return `Filled ${toolInput.selector} with "${toolInput.value}"`;
  }

  if (toolName === 'clear_field') {
    await page.fill(toolInput.selector, '');
    return `Cleared ${toolInput.selector}`;
  }

  if (toolName === 'click_element') {
    try {
      await page.click(toolInput.selector);
      await page.waitForTimeout(1000);
      return `Clicked ${toolInput.selector}`;
    } catch (err) {
      // Return the UI error to Claude instead of crashing the agent.
      // Claude can then decide how to recover (e.g. reload before clicking a hidden element).
      return `ERROR: Could not click ${toolInput.selector} — ${err.message.split('\n')[0]}`;
    }
  }

  if (toolName === 'reload_page') {
    await page.reload();
    await page.waitForLoadState('networkidle');
    return 'Page reloaded';
  }

  if (toolName === 'take_snapshot') {
    if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    const screenshotPath = path.join(SCREENSHOTS_DIR, `${String(snapshotCount).padStart(2, '0')}-${toolInput.label}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    // Extract page state and return it as JSON to Claude.
    // Claude uses this to understand what happened after an action —
    // which errors appeared, whether offer cards rendered, etc.
    const pageInfo = await page.evaluate(() => {
      const errors = Array.from(document.querySelectorAll('.field-error, .error-message, [role="alert"]'))
        .map(el => el.textContent.trim())
        .filter(t => t.length > 0);

      const offers = Array.from(document.querySelectorAll('.offer-card'))
        .map(card => card.innerText.trim());

      const inputs = Array.from(document.querySelectorAll('input, select, button'))
        .map(el => ({
          selector: el.id ? `#${el.id}` : el.className,
          type: el.type || el.tagName.toLowerCase(),
          value: el.value || null,
          text: el.innerText ? el.innerText.trim() : null,
          disabled: el.disabled,
        }));

      return { errors, offers, inputs };
    });

    return JSON.stringify(pageInfo, null, 2);
  }

  return 'Unknown tool';
}

// ─── History compression ───────────────────────────────────────────────────
// The Anthropic API is billed per token and every API call resends the full
// message history. Without compression, costs snowball as the conversation grows.
// This function summarizes the history into bullet points every N iterations,
// replacing the full transcript with a compact summary Claude can continue from.

async function compressHistory(messages, systemPrompt) {
  console.log('Compressing message history...');
  const summaryResponse = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      ...messages,
      {
        role: 'user',
        content: 'Summarize what you have explored and found so far in 5-7 bullet points. Include which scenarios you have already tested so you do not repeat them.',
      },
    ],
  });

  const summary = summaryResponse.content[0].text;
  console.log('History compressed.');

  // Replace the full message history with just the summary.
  // Claude picks up from here with a much smaller context window.
  return [
    {
      role: 'user',
      content: `Previous exploration summary:\n${summary}\n\nContinue exploring from where you left off.`,
    },
  ];
}

// ─── Main agent loop ────────────────────────────────────────────────────────
// This is the ReAct loop (Reason + Act):
// 1. Send the current message history to Claude
// 2. Claude responds with tool calls (actions to take)
// 3. Execute each tool call in the browser via Playwright
// 4. Send the results back to Claude
// 5. Repeat until Claude calls the finish tool or hits the iteration cap

async function main() {
  console.log('Starting agent...');

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto(APP_URL);
  await page.waitForLoadState('networkidle');
  console.log('App loaded. Starting Claude agent loop...\n');

  // The system prompt defines Claude's role, the app structure, and behavioral rules.
  // Tool descriptions and system prompt work together to guide Claude's decisions.
  const systemPrompt = `You are a Senior QA Engineer exploring an Auto Loan Refinance Calculator web app.

The app has these fields:
- #balance — Remaining Balance in dollars (must be at least $1,000)
- #rate — Current Interest Rate as a percentage (must be at least 0.1%)
- #term — Remaining Term in months (must be at least 1)
- button[type="submit"] — the "Check Rates" button
- .dismiss-quote-btn — dismisses the saved quote banner. IMPORTANT: this button is always in the DOM but hidden. It only becomes visible AFTER you call reload_page following a Save Quote click. Never try to click it without reloading first.

Your goal is to thoroughly explore the app by:
1. First taking a snapshot to see the initial state
2. Testing the happy path with valid data
3. Testing validation errors (empty fields, values below minimums)
4. Testing edge cases relevant to auto loan refinancing
5. Testing the save quote and dismiss banner functionality — IMPORTANT: after clicking "Save Quote", you must use reload_page before the banner will appear, because it only renders on DOMContentLoaded when localStorage has a saved quote

Only use take_snapshot to verify the result of a meaningful action (e.g. after submitting a form, after reloading the page). Do not snapshot after filling a single field or clicking a non-submit button.

The offer cards that appear after submitting the form contain hardcoded mock data (lender names, rates, monthly savings). Do not test or validate the specific values inside them — only verify that cards appear or do not appear as expected.

After exploring at least 5-6 different scenarios, use the finish tool to generate a comprehensive QA report in markdown that includes:
- App overview
- How to use the app
- Key fields and their Playwright selectors
- Happy path test scenarios
- Edge cases and negative test scenarios
- Suggested Playwright test structure

Be thorough. The report will be used to write automation tests.`;

  // Resume from a previous session if messages.json exists.
  // This allows the agent to continue after a crash or out-of-credits error
  // without re-testing scenarios already covered.
  // To start fresh, delete agent/messages.json before running.
  let messages;
  if (fs.existsSync(MESSAGES_PATH)) {
    messages = JSON.parse(fs.readFileSync(MESSAGES_PATH, 'utf8'));
    console.log(`Resuming from saved session (${messages.length} messages loaded).`);
  } else {
    messages = [
      {
        role: 'user',
        content: 'Start exploring the app. Take a snapshot first to see the initial state, then systematically test all the scenarios you need to write a complete QA report.',
      },
    ];
    console.log('Starting fresh session.');
  }

  let snapshotCount = 0;
  let iterationCount = 0;
  let done = false;

  while (!done) {
    iterationCount++;

    // Compress history every 20 iterations to prevent context snowballing.
    // Without this, every API call resends the entire conversation from the start.
    if (iterationCount % 20 === 0) {
      messages = await compressHistory(messages, systemPrompt);
    }

    // Hard stop — if the agent hasn't finished by iteration 40, force it to wrap up.
    // Prevents runaway agents that keep finding micro edge cases indefinitely.
    if (iterationCount === 40) {
      console.log('Max iterations reached. Forcing finish.');
      messages.push({
        role: 'user',
        content: 'You have explored enough. Stop testing and call the finish tool now to generate the QA report.',
      });
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: systemPrompt,
      tools,
      messages,
    });

    console.log(`Claude [iter ${iterationCount}]: stop_reason=${response.stop_reason}`);

    // Add Claude's full response to message history so it has context for the next iteration
    messages.push({ role: 'assistant', content: response.content });

    // end_turn means Claude has nothing more to say and made no tool calls — unexpected but handled
    if (response.stop_reason === 'end_turn') {
      console.log('Claude finished without calling finish tool.');
      break;
    }

    // Process each tool call in Claude's response
    const toolResults = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        console.log(`Claude says: ${block.text}`);
      }

      if (block.type === 'tool_use') {
        if (block.name === 'finish') {
          if (!block.input.report) {
            // This can happen if Claude hits the max_tokens limit mid-response.
            // The report comes back undefined. Increasing max_tokens or running again fixes it.
            console.error('finish tool called with no report — likely hit token limit. Try running again.');
            done = true;
            break;
          }
          fs.writeFileSync(REPORT_PATH, block.input.report);
          console.log(`\nReport written to ${REPORT_PATH}`);
          // Clean up session file — report is complete, next run should start fresh
          if (fs.existsSync(MESSAGES_PATH)) fs.unlinkSync(MESSAGES_PATH);
          done = true;
          break;
        }

        if (block.name === 'take_snapshot') snapshotCount++;

        const result = await executeTool(page, block.name, block.input, snapshotCount);

        // Collect all tool results to send back to Claude in one message
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: result,
        });
      }
    }

    // Send all tool results back to Claude so it can decide the next action
    if (toolResults.length > 0) {
      messages.push({ role: 'user', content: toolResults });
    }

    // Save message history to disk after every iteration.
    // If the agent crashes, the next run loads this file and resumes from here.
    fs.writeFileSync(MESSAGES_PATH, JSON.stringify(messages, null, 2));
  }

  await browser.close();
  console.log('Done.');
}

main().catch(console.error);