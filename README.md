# My Budget

A budgeting app that runs in your browser. No installs or build tools.

## How to run it

Double-click `index.html` to open it in your browser.

Your data is saved in your browser's localStorage. It stays on this computer in
this browser only, so use **Settings → Export backup** every so often.

## Features

- **Quick add:** type `12.50 groceries`, `4.50 coffee eat` or `+3200 salary` and press Enter.
  It works out the amount and category (and remembers notes you've used before).
  A preview shows what will be added, and warns if it will go over a limit.
- **Again:** one-tap buttons to repeat recent expenses for today
- **Pay day:** choose how often you're paid (daily, weekly, every 2 weeks, twice a month, monthly).
  Your budget starts fresh on each pay day, a badge counts down to the next one, and your pay
  can be added automatically, including any pay days you missed while the app was closed.
- **Spending limits:** set a limit on just the categories you care about. Each limit chooses
  when it resets: each pay period, daily, weekly, every 2 weeks or monthly.
- **Suggestions:** personalised tips based on your spending (over a limit, on track to go over,
  small purchases adding up, savings rate...). Click one to open more advice and a button to act on it.
- **Over-budget warnings:** a red message when you go over, a badge in the summary card,
  red dots on that category's transactions, and the category highlighted at the top of your limits
- "Left to spend" summary, with a daily allowance for the rest of the month
- Transactions grouped by day, with search
- Click a transaction to edit or delete it (delete has Undo)
- Doughnut chart and breakdown of spending by category
- Insights: daily average, biggest category, change vs last month, savings rate
- Light, dark or automatic theme (button in the top bar)
- Currency, categories with emoji icons, backup and restore in Settings
- Works on phones: the Add button floats and pop-ups slide up from the bottom
- **Hide amounts:** the eye button next to the big number blurs every amount in the app
  (handy in public). It's remembered next time you open the app.
- Keyboard shortcuts: **/** jumps to quick add, **N** opens the full form, **H** hides or shows amounts

## What's in each file

| File | What it does |
|---|---|
| `index.html` | The structure of the page: sections, pop-ups and buttons |
| `style.css` | How it looks: colours, light and dark themes, phone layout, animations |
| `app.js` | How it works: saving data, totals, budgets, the chart and insights |

## Ideas for what to build next

1. Rename or delete categories (and decide what happens to their transactions)
2. Recurring bills (rent every month), built the same way as automatic pay
3. Import a CSV file exported from your bank
4. A bar chart comparing the last 6 months
5. Savings goals with a progress ring
6. Put it online for free with GitHub Pages
