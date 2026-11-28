# SearchJobs

The workflow creates a tailored CV for each job I receive by email in Gmail from LinkedIn job alerts. It is started from a button on the job search dashboard (through a Make webhook).

Built in [Make.com](https://www.make.com) as a course exercise (Lesson 6, AI practice).

## Scenario: Process LinkedIn Job Documents

File: [`process-linkedin-job-documents.blueprint.json`](process-linkedin-job-documents.blueprint.json)

1. **Webhooks: Custom webhook**: starts the scenario when the dashboard's "Run the process" button is clicked.
2. **Gmail: Search emails**: takes the latest unread LinkedIn job alert (`from:jobalerts-noreply@linkedin.com is:unread`, limit 1).
3. **AI (Make AI Toolkit)**: extracts the jobs in the email into JSON: title, company, location, URL, role type, requirements.
4. **JSON: Parse JSON**: turns the AI answer into structured data.
5. **Google Drive: Search files + Download file**: reads my existing CV files from a Drive folder as plain text.
6. **Text aggregator**: combines all CV material into one text.
7. **AI (Make AI Toolkit): Generate Resume**: writes a one-page Hebrew CV tailored to the job, using only the material provided.
8. **Google Docs: Create a document**: saves the tailored CV in the "קורות חיים מותאמים" folder.
9. **Google Sheets: Add a row**: logs the job in the tracking sheet, including a link to the tailored CV.

Storage is Google Sheets rather than Airtable, so the scenario runs on free accounts.

## Bonus: job search dashboard

A public web page (Google Apps Script web app) connected live to the tracking sheet: summary cards, 3 pie charts, a list of all jobs whose status can be changed from the page and is written back to the sheet, and a "Run the process" button that starts the Make scenario through its webhook.

Live page: https://script.google.com/macros/s/AKfycbyNZaFYrCRvWz0t6QNS0TpN3Iuo2x-a0TVh5fZQssUe5mMu8THdLVVDNaq8LZpLYaeZ/exec See [`DASHBOARD.md`](DASHBOARD.md) and [`dashboard-status.gs`](dashboard-status.gs).

## Bonus 2: imported automation

A friend's Make scenario (Tally form → Google Sheets → Gmail/Slack lead routing), imported and connected to my own Tally form. See [`BONUS2.md`](BONUS2.md) (Hebrew) and [`bonus2/integration-tally.blueprint.json`](bonus2/integration-tally.blueprint.json).

## Lesson 6: AI agent design: shopping agent

A design (not yet built) for a personal shopping agent: every purchase request comes from a Tally form with a max price and required features, Make writes it to Google Sheets and starts the agent on Anthropic Managed Agents, the agent searches online stores daily, and every Friday it emails the top picks. It never buys anything itself. All three documents are in Hebrew:

- [`shopping-agent/SPEC.md`](shopping-agent/SPEC.md): the agent design (LLM, tools, memory, goal, loop and brakes, safety) and the Tally form fields.
- [`shopping-agent/Architecture.md`](shopping-agent/Architecture.md): triggers, what happens with the output, and Mermaid data-flow diagrams of the whole system.
- [`shopping-agent/CONFIG.md`](shopping-agent/CONFIG.md): model, effort level, tools, full system prompt, memory stores, vault, sessions and deployments.

## How to import

In Make: **Create a new scenario → ⋯ menu → Import Blueprint**, choose the JSON file, then reconnect your own Gmail, Google Drive, Google Docs and Google Sheets connections and pick your own folders and spreadsheet.
