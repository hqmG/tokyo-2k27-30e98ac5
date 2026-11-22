# Tokyo 2027: administrator guide

This guide is for you as a admin the plan. It describes how the parts fit together, how to set them up from the start, and how the plan changes.

## How it fits together

| Part | What it contains | Where it lives |
|---|---|---|
| **Web app** | Code, map, timeline, proposals | The repo on GitHub, published with GitHub Pages |
| **The plan** | Flights, hotels, restaurants, proposals, status | A Google Sheets spreadsheet, tab `Plan` |
| **Changes** | What you ask Claude to do | Claude writes to the sheet in the chat |

The plan is never changed by editing the files or in the app. You describe the change in the chat, and Claude writes it to the sheet. The app reads the sheet every time someone opens it, so changes show up right away. GitHub Pages only needs updating when the code changes.

## Part 1: Connect Claude to the plan

Claude creates and maintains the sheet for you. You only need to do the steps below yourself, because they involve your own accounts and permissions.

### 1.1 Connect your Google account to Claude

1. Open claude.ai and go to **Settings → Connectors**.
2. Connect **Google Sheets**. Sign in with the Google account you want to own the plan.

### 1.2 Share the sheet with your contributor

Do this after Claude has created the sheet, and before your contributor connects their account.

1. Open the sheet in Google Sheets and click **Share**.
2. Add your contributor's Google account as **Editor**. Only you and your contributor should be editors.
3. Under **General access**, choose **Restricted** and **Viewer**. Then only people with the link can view the sheet, and nobody can change it through the link.

Do not put booking numbers, passport details, card details or exact addresses in the sheet. Anyone with the link can read it.

## Part 2: Publish the web app

Claude prepares the code. You only need to do the steps below yourself, because they involve your GitHub account.

### 2.1 Push the code to GitHub

1. Commit and push the changes in the repo to the `main` branch on your machine. Claude can give you the exact commands.

### 2.2 Turn on GitHub Pages

1. Go to the repo's **Settings → Pages**.
2. Choose **Deploy from a branch**, branch `main` and folder `/ (root)`. Click **Save**.
3. The site is then available at `https://<your-username>.github.io/<repo-name>/`. It can take a minute the first time.

After this, every push to `main` updates the site. You do not need to push when the plan changes in the sheet.

## Part 3: Booking and changing the plan

All bookings are made manually, outside Claude. Claude does not book or pay for anything.

1. Make the booking yourself, on the provider's site or in their app.
2. Tell Claude in the chat that it is booked, with the details that matter, for example: *"The hotel is booked for 14–18 March, status approved."*
3. Claude adds or updates the item in the plan.

Do not edit the sheet by hand if the change can be described in the chat. Small changes, such as moving a dinner, are made directly. Larger changes, such as switching hotels, are confirmed by Claude first.

## Part 4: Changes to the web app

Changes to the web app itself, outside the plan, are made by the admin. This includes new categories, new filters and layout changes. Claude can prepare the code, but you commit and push it to `main` yourself.

