# SearchJobs

The workflow creates a tailored CV for each job I receive by email in Gmail from LinkedIn job alerts.

Built in [Make.com](https://www.make.com) as a course exercise (Lesson 6, AI practice).

## Scenario: Process LinkedIn Job Documents

File: [`process-linkedin-job-documents.blueprint.json`](process-linkedin-job-documents.blueprint.json)

1. **Gmail: Watch emails**: picks up new LinkedIn job alert emails (`jobalerts-noreply@linkedin.com`).
2. **AI (Make AI Toolkit)**: extracts the jobs in the email into JSON: title, company, location, URL, role type, requirements.
3. **JSON: Parse JSON**: turns the AI answer into structured data.
4. **Google Drive: Search files + Download file**: reads my existing CV files from a Drive folder as plain text.
5. **Text aggregator**: combines all CV material into one text.
6. **AI (Make AI Toolkit): Generate Resume**: writes a one-page Hebrew CV tailored to the job, using only the material provided.
7. **Google Docs: Create a document**: saves the tailored CV in the "קורות חיים מותאמים" folder.
8. **Google Sheets: Add a row**: logs the job in the tracking sheet, including a link to the tailored CV.

Storage is Google Sheets rather than Airtable, so the scenario runs on free accounts.

## How to import

In Make: **Create a new scenario → ⋯ menu → Import Blueprint**, choose the JSON file, then reconnect your own Gmail, Google Drive, Google Docs and Google Sheets connections and pick your own folders and spreadsheet.
