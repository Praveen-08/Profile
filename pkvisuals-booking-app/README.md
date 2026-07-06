# PK Visuals Business System

A Google Apps Script web app for managing PK Visuals' real estate media bookings:
Google Sheets database, Calendar scheduling, Drive delivery folders, Gmail
automation, invoice PDFs and GST/revenue reporting.

## Stack

- Google Sheets — database (`PK Visuals Business System`, created automatically on first run)
- Google Apps Script — backend (`src/*.gs`)
- HTML/CSS/JS — frontend (`src/*.html`), served as a single-page app via `HtmlService`
- Google Calendar, Google Drive, Gmail/MailApp — automation
- Google Docs → PDF export — invoice generation

## Deploying

The `src/` folder is a standalone Apps Script project (not bound to a specific
spreadsheet — it creates and manages its own).

### Option A — clasp (recommended)

1. Install clasp: `npm install -g @google/clasp`
2. Log in: `clasp login`
3. From `pkvisuals-booking-app/src`, create a new Apps Script project:
   ```
   clasp create --type standalone --title "PK Visuals Business System"
   ```
   This generates a `.clasp.json` in `src/` (gitignored — it's machine/account specific).
4. Push the code: `clasp push`
5. Deploy as a web app: `clasp deploy` (or use `clasp open` and deploy from the editor UI —
   Deploy > New deployment > Web app).
   - Execute as: **User accessing the web app**
   - Who has access: your organisation (Domain), or "Only myself" while testing.
6. Open the deployed web app URL. On first load the script automatically:
   - Creates the `PK Visuals Business System` spreadsheet (or finds one with that
     exact name already in your Drive).
   - Creates all required sheets, headers, default Settings rows, the 9 default
     packages and the 4 default email templates.

### Option B — manual copy/paste

1. Go to script.google.com → New project.
2. Rename it "PK Visuals Business System".
3. For each file in `src/`, create a matching file in the Apps Script editor
   (Script files for `.gs`, HTML files for `.html`) and paste the contents.
4. Open Project Settings and set the `appsscript.json` manifest to match
   `src/appsscript.json` (enable "Show manifest file" first).
5. Deploy > New deployment > Web app, same settings as above.

## First-time setup checklist

Open **Settings** in the app and fill in:

- **GST Number** — your IRD GST number, printed on invoices.
- **Drive Parent Folder ID** — optional; if left blank the app creates and uses
  a top-level "PK Visuals Jobs" folder in the deploying user's Drive automatically.
- **Calendar ID** — `primary` uses the deploying user's default calendar, or
  paste a specific calendar's ID.
- **Bank Account Name / Number** — printed on invoices.
- **Google Places API Key** — optional. Leave blank to use manual address entry
  on the New Job screen; add a key (with the Places API enabled and HTTP referrer
  restrictions matching your web app URL) to enable autocomplete.

Everything else (business name/email, admin email, invoice/job prefixes,
payment terms) already has sensible PK Visuals defaults and can be changed
any time — nothing is hard-coded in the frontend or backend.

## Project structure

```
src/
  appsscript.json     Web app manifest
  Code.gs             doGet(), include(), bootstrap data endpoint
  Config.gs           Sheet names, column headers, status enums, seed data
  Database.gs         Generic spreadsheet read/write helpers
  Setup.gs            Idempotent DB bootstrap (creates sheets/rows if missing)
  Audit.gs            Append-only action log
  Settings.gs         Settings + email template CRUD
  Agents.gs           Agent CRUD + stats
  Agencies.gs         Agency CRUD + stats
  Packages.gs         Package CRUD
  Drive.gs            Job folder hierarchy creation
  Calendar.gs         Shoot calendar event creation/update
  Emails.gs           Templated booking/delivery/invoice/reminder emails
  Invoices.gs         PDF invoice generation (via temp Google Doc export)
  Jobs.gs             Core job workflow: create/update/cancel/deliver/invoice/pay
  Payments.gs         Payments ledger read accessors
  Reports.gs          Dashboard + GST/revenue reports + CSV export

  Index.html          SPA shell (sidebar nav + all views + modals)
  Styles.html          Design system (black/white/gold, mobile responsive)
  JavaScript.html      All client-side logic
  Dashboard.html, Jobs.html, JobDetail.html, NewJob.html,
  Agents.html, Agencies.html, Packages.html, Reports.html, Settings.html
                       Page templates rendered into Index.html
```

## Workflow covered

1. **New Job** — Address + Agent + Package + Date/Time only. Agent/agency
   contact details, package price and GST are pulled automatically. New
   agents/agencies can be added inline via modals without leaving the form.
2. On create: Drive folders (`Photos`, `Videos`, `Final Delivery`, `Invoice`,
   `Admin`) and a Calendar event are created, and a booking confirmation email
   is sent to the agent (cc admin).
3. **Send Delivery Email** — from the job detail page once files are in Drive;
   blocked if no delivery link is available.
4. **Create Invoice** — generates a PDF (via a temporary Google Doc, exported
   and discarded) into the job's Invoice folder.
5. **Send Invoice** — blocked until the PDF exists; emails it as an attachment
   and updates invoice/payment status and due date.
6. **Mark Paid** — records a payment, updates the job balance and, once fully
   paid, marks the job Paid and updates agent/agency lifetime revenue.
7. **Reports** — This Month / Last Month / This Quarter / This Financial Year
   (1 Apr–31 Mar) / custom range, with GST collected, revenue breakdowns by
   month/package/agent/agency, and outstanding/overdue invoices. CSV export.

Every one of the above actions is written to the `AuditLog` sheet.
