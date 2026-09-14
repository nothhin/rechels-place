# Airbnb calendar sync

The website supports a two-way iCalendar connection:

- `AIRBNB_ICAL_URL` is the private Airbnb export URL. The server imports its
  all-day `VEVENT` ranges into `external_calendar_events`.
- `AIRBNB_CALENDAR_TOKEN` is a random, high-entropy token used by the public
  website feed at `/api/calendar/airbnb/<token>.ics`. Add that URL to Airbnb's
  **Connect calendars** screen.
- `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`) is server-only. It is
  never prefixed with `NEXT_PUBLIC_` and must never be sent to the browser.
- `CRON_SECRET` protects `/api/cron/airbnb-calendar`.

The importer marks dates unavailable through the same public schedule function
and the same database overlap trigger used by website bookings. Imported rows
are separate from local date blocks, so a refresh can cancel stale Airbnb
events without modifying local bookings or blocks.

## Setup

1. In Airbnb, export the listing calendar and copy its `.ics` URL.
2. Generate a random token of at least 32 characters for
   `AIRBNB_CALENDAR_TOKEN`.
3. Add the four server environment variables to the production deployment.
4. Apply the latest Supabase migration
   `20260913155156_airbnb_calendar_sync.sql`.
5. Deploy the website and open Admin → Housekeeping & finance → Airbnb
   availability sync. Use **Sync Airbnb now** for the first import.
6. Copy the website's feed URL (replace `<token>` with the configured token)
   into Airbnb's calendar import field.

The website also refreshes the Airbnb import in the background when the public
availability calendar is requested. The protected cron route provides a
scheduled fallback. On Vercel Hobby, cron jobs are limited to once per day;
use a Pro cron schedule or an external scheduler for more frequent imports.

## Booking behavior

Pending, contacted, and confirmed website requests are included in the website
feed so Airbnb sees a temporary hold. Declined and cancelled requests are not
exported. A pending request must still be confirmed by staff before it becomes
a confirmed stay; if it expires or is declined, it disappears from the feed.

The feed contains only generic `Unavailable` events. It never contains guest
names, email addresses, phone numbers, payment details, or booking notes.
