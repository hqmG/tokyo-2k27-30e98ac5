# Tokyo 2027: contributor guide

This guide is for you as a contributor to the plan. It describes how the parts fit together, what you need to set up, and how to change the plan.

## How it fits together

| Part | What it contains | Where it lives |
|---|---|---|
| **Web app** | Map, timeline, proposals | The repo on GitHub, published with GitHub Pages |
| **The plan** | Flights, hotels, restaurants, proposals, status | A Google Sheets spreadsheet, tab `Plan` |
| **Changes** | What you ask Claude to do | Claude writes to the sheet in the chat |

The app shows the plan. You view it in the browser, and you change it by asking Claude in the chat. Do not edit the spreadsheet or the app by hand. The app reads the sheet every time someone opens it, so changes show up when you reload the page.

Claude sets up and maintains the plan. The steps below are the ones you need to do yourself, because they involve your own Google account.

## Part 1: Create a Claude account

1. Go to claude.ai and create an account. A free account or a Pro account works.

## Part 2: Connect Claude to the plan

### 2.1 Connect your Google account to Claude

1. Open claude.ai and go to **Settings → Connectors**.
2. Connect **Google Sheets**. Sign in with the Google account that you want to use for the plan. This is the account your admin will share the sheet with.

### 2.2 Accept the sharing invitation

1. Open the invitation email from your Google account, or the link your admin sent you.
2. Accept the invitation to the plan's spreadsheet. You need editor access to change the plan.

## Part 3: Open the app

Open the link to the app that your admin sent you. You do not need to sign in to view the plan.

## Part 4: Booking and changing the plan

All bookings are made manually, outside Claude. Claude does not book or pay for anything.

1. Make the booking yourself, on the provider's site or in their app.
2. Tell Claude in the chat that it is booked, with the details that matter, for example: *"The hotel is booked for 14–18 March, status approved."*
3. Claude adds or updates the item in the plan.

Do not edit the sheet by hand if the change can be described in the chat. Small changes, such as moving a dinner, are made directly. Larger changes, such as switching hotels, are confirmed by Claude first.

Do not add booking numbers, passport or card details, or exact addresses of private homes to the plan. Anyone with the link to the sheet can read it.
