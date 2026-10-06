# TrekAI n8n demo

This is a classroom/demo integration. The browser sends a trip brief to the
Express backend. If `N8N_PLAN_WEBHOOK_URL` is configured, Express forwards the
brief to n8n. The imported workflow calls the backend's OpenRouter tool-using
agent and returns its itinerary and estimates to the site.

## Start n8n

From the project root, run:

```bash
docker compose -f n8n/docker-compose.yml up -d
```

Open <http://localhost:5678> and create the local n8n owner account.

## Import the workflows

In n8n, use **Import from File** and import:

- `n8n/workflows/kaadu-trip-planner.json`
- `n8n/workflows/kaadu-trip-reminders.json`

The trip workflow calls `http://host.docker.internal:4000/api/trip-demo/agent`.
Keep the TrekAI backend running on port 4000 while you demo. This hostname is
provided by the included Docker Compose setup for a local machine.

Activate/publish **TrekAI · Trip planning workflow**, then copy its Production
webhook URL into `N8N_PLAN_WEBHOOK_URL` in `backend/.env`. The expected path is
`/webhook/kaadu-trip-plan`.

For actual email delivery, open both **Send Email** nodes in the reminder
workflow and choose an SMTP credential in n8n. Replace the example From Email
with a sender address allowed by that SMTP account. Then activate/publish the
workflow and copy its Production URL into `N8N_REMINDER_WEBHOOK_URL` in
`backend/.env`; the expected path is `/webhook/kaadu-trip-reminders`.

Restart the backend after changing either URL. The browser talks only to the
TrekAI backend, so n8n does not need browser CORS access.

## What the demo does and doesn't do

- The model uses deterministic app tools for trek filtering, season checks,
  trek fees, and a rough transport/stay/food budget. OpenRouter supplies the
  language model; n8n provides the visible webhook workflow around it.
- Train fares, local transfers, and food are labelled planning allowances.
  Train schedules, seats, and hotel availability are not queried live. Use the
  IRCTC link in the plan to check actual trains and fares.
- **Add to calendar** downloads an `.ics` event that a user can import into
  their calendar. It doesn't write to a calendar account.
- Without the reminder webhook, the site only displays a local schedule
  preview. With the webhook and an SMTP credential, n8n waits and sends the
  one-week/near-term and one-day email reminders.
- Nothing purchases tickets, reserves stays, or sends email unless a user
  schedules reminders and an email credential is configured in n8n.
