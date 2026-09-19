# Airbnb calendar sync

The website supports a two-way iCalendar connection without sharing guest
identity between channels:

- Airbnb → website: the server imports Airbnb's private `.ics` feed into
  `external_calendar_events`.
- Website → Airbnb: the public feed exports website booking requests and
  manual date blocks as generic `Unavailable` events.
- Imported Airbnb rows are separate from website bookings and manual blocks.
  They participate in the same half-open overlap checks but are never exported
  back to Airbnb.

## Server environment

Set these values only in the server/deployment environment. Do not commit a
filled-in `.env` file or paste the private Airbnb URL into source code.

- `NEXT_PUBLIC_SUPABASE_URL`: the Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY` (or the existing `SUPABASE_SECRET_KEY` alias):
  server-only Supabase key. Never expose it with a `NEXT_PUBLIC_` prefix.
- `AIRBNB_ICAL_URL`: the private Airbnb export link ending in `.ics?t=...`.
  The application also permits an admin-saved URL in Supabase; that saved URL
  takes precedence over this environment fallback.
- `AIRBNB_CALENDAR_TOKEN`: at least 32 random characters used as the bearer
  token for the website feed. `ICAL_EXPORT_TOKEN` is accepted as a legacy
  alias when the primary variable is absent.
- `NEXT_PUBLIC_SITE_URL`: the canonical production origin, used to render the
  complete copyable feed URL in the admin workspace.
- `CRON_SECRET`: random secret used by the protected Vercel cron route.

The private Airbnb import link and the website export token are different
secrets. Rotate both if either is shared outside the intended calendar
connections.

## Database setup

Apply all migrations in `supabase/migrations` in timestamp order. The Airbnb
sync migrations are:

1. `20260913155156_airbnb_calendar_sync.sql`
2. `20260913234413_admin_airbnb_calendar_url.sql`
3. `20260914030036_admin_calendar_controls.sql`
4. `20260919000000_airbnb_calendar_sync_hardening.sql`

The hardening migration adds VEVENT summary/description/status storage,
append-only sync-run history, a server-only sync lock, and the transactional
replace function that safely accepts a valid empty calendar. Public and
authenticated clients cannot read the imported rows, private URL, token, or
sync history tables.

## Airbnb setup

1. In Airbnb, open the listing's calendar connection/export settings and copy
   the private `.ics` URL.
2. Set `AIRBNB_ICAL_URL` in the deployment, or sign in as a manager/admin and
   paste the URL into Admin → Housekeeping & finance → Airbnb availability
   sync. The URL is stored server-side and is never displayed after saving.
3. Generate and set `AIRBNB_CALENDAR_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`,
   `NEXT_PUBLIC_SITE_URL`, and `CRON_SECRET` in the deployment.
4. Deploy after applying the migrations.
5. Open the admin sync panel, confirm **Airbnb → website** is connected, and
   select **Sync Airbnb now**.
6. Copy **Website availability feed** from the same panel into Airbnb's
   calendar import field. Treat the copied URL as a password.

The feed route is:

```text
/api/calendar/airbnb/<AIRBNB_CALENDAR_TOKEN>.ics
```

The route responds only when the token matches and returns generic
`Unavailable` events. It contains no guest names, email addresses, phone
numbers, payment details, or booking notes.

## Refresh and failure behavior

- Public availability requests trigger a background refresh when the last
  successful import is older than 15 minutes.
- Vercel runs `/api/cron/airbnb-calendar` with its `CRON_SECRET`. The checked-in
  Hobby-compatible schedule is once daily; use a Vercel plan or external
  scheduler that supports a shorter interval if needed.
- Managers/admins can run a manual sync from the admin panel.
- A successful empty `VCALENDAR` means Airbnb currently has no blocked events,
  so previously imported Airbnb rows are marked cancelled/inactive.
- Network, HTTP, oversized, malformed, or database failures do not clear the
  last known Airbnb rows. The panel shows the last error and recent sync
  history.
- A server-side lock prevents simultaneous admin/cron/background syncs from
  racing the event replacement. A crashed invocation's lock expires after ten
  minutes.

## Booking behavior

Website pending, contacted, and confirmed requests are included in the
website-to-Airbnb feed as temporary generic holds. Declined and cancelled
requests are not exported. The final booking RPC rechecks the shared calendar
before insertion, so a stale browser calendar cannot bypass an imported
Airbnb block. Checkout remains exclusive: a guest checking out on a date does
not block another guest checking in on that same date.

## Verification checklist

1. Import a test Airbnb feed containing a confirmed all-day event and verify
   one source-labeled external block appears in the admin calendar and public
   availability.
2. Sync the same feed twice and verify no duplicate external UID rows appear.
3. Remove the event from a valid feed and sync again; verify the old row is
   inactive and the date is available.
4. Return an HTTP error or malformed feed and verify the old row remains
   active and the run is marked failed.
5. Create a pending website request and fetch the protected website feed;
   verify it contains only a generic `Unavailable` event.
6. Try the same export URL without its token and verify a 404 response.
7. Submit a booking overlapping an imported Airbnb date and verify the
   backend rejects it even if the browser's availability result is stale.
8. Run the repository lint, typecheck, test, and production build commands.
