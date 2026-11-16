# Internship Daily Log — Student Training Report Journal

An offline-first, client-side daily work journal designed for MSc IT students (and other degree programs) completing practical industry training. Record your day-to-day internship activities, track hours and learning outcomes, and export a formatted training report ready for academic evaluation.

---

## 1. Authorized Login Accounts

This application includes a secure front-end access gate. Two student profiles are pre-configured with independent, isolated storage for their logs, drafts, and settings:

| Profile / Username | Password | Default Student Name |
| :--- | :--- | :--- |
| `Harsh123` | `123` | Harsh |
| `nishtha123` | `123` | Nishtha |

*(You can also click the quick-fill account badges directly on the login screen to autofill your credentials).*

---

## 2. How to Run Locally

Because this project uses vanilla HTML, CSS, and modern JavaScript modules with **no build steps or dependencies**, you can run it right away:

### Method A: Direct File Open (Easiest)
1. Navigate to this folder.
2. Double-click `index.html` to open it directly in Google Chrome, Firefox, Safari, or Microsoft Edge.

### Method B: Local Static Server (Recommended for ES Module support across all browsers)
If your browser restricts ES modules loaded via the `file://` protocol, run any quick local static server:
- **VS Code**: Install the "Live Server" extension, right-click `index.html`, and choose **"Open with Live Server"**.
- **Python**: Run `python -m http.server 8000` in this directory and open `http://localhost:8000`.
- **Node.js (npx)**: Run `npx serve` in this directory.

---

## 3. How to Deploy

This application is 100% static and requires no server runtime or database.

### Deploy to Netlify (Drag and Drop — 30 seconds)
1. Go to [Netlify Drop](https://app.netlify.com/drop).
2. Log in or create a free Netlify account.
3. Drag and drop this entire folder (`webtual internship`) into the designated browser upload box.
4. Netlify will instantly assign you a live public URL (e.g. `https://internship-log-xxxx.netlify.app`).

### Deploy to Vercel
1. Install the Vercel CLI (optional) or push this folder to a GitHub repository.
2. Go to [Vercel Dashboard](https://vercel.com) and click **"Add New Project"**.
3. Import your GitHub repository (or run `npx vercel` directly in your terminal inside this folder).
4. Leave all build and output settings at their defaults (no build command, output directory `./`).
5. Click **"Deploy"**.

---

## 4. Important: Data Storage Notice

> **IMPORTANT WARNING**: 
> All profile data, daily logs, and working drafts are stored in your current browser's `localStorage` partitioned under your logged-in username. No data is ever sent across the network or stored on an external server.
> 
> - **Export backups regularly**: Use the **Export / Print** menu in the top-right header and click **"Backup Data (.json)"**.
> - **Clearing browser cache**: If you clear browser website cookies/storage or switch to another browser/device, your logs will not be present unless you restore them using the **"Import Backup (.json)"** feature.
> - A gentle reminder banner will notify you automatically if more than 7 days have passed since your last exported backup.

---

## 5. Key Features & Academic Workflow

1. **Integrated Mini Calendar**: View your logs across the month with intuitive status dots (`Completed`, `In progress`, `Blocked`, `No work`). Click any date on the calendar to open or create that day's entry instantly.
2. **Automatic Day and Week Counting**: Enter your internship start date in the **Profile** modal `[P]`. Day 1, Day 2, and Week numbers will be calculated automatically for every calendar date.
3. **Missing Days Detection**: The logbook calculates any unrecorded dates between your start date and today. Click **Days Missing** in the summary shelf to view unlogged dates and jump straight into logging them.
4. **One Entry Per Date**: Choosing an existing date in the date picker or mini calendar immediately loads that day's log for editing instead of creating a duplicate.
5. **Draft Protection**: As you type in the editor, your text is continuously preserved in a local draft so closing a tab or browser window never causes lost work.
6. **Report Export (.txt)**: Generates a structured text document grouped by week matching standard college training documentation requirements.
7. **Print / Save as PDF**: Provides a dedicated black-and-white academic layout with a title cover page, student and supervisor signature blocks, and page breaks formatted to avoid splitting entries mid-page.
8. **Undo Deletions**: Deleting an entry triggers a 10-second undo bar to protect against accidental removals.
9. **Keyboard Shortcuts**:
   - `Ctrl + S` / `Cmd + S`: Save active log entry.
   - `Ctrl + K` / `Cmd + K`: Jump to search box to find tasks, tools, or notes.
   - `Escape`: Close open dialogs or dropdowns.
