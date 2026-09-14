# Rechel's Place

Independent client copy of the direct-booking, availability, guest-status, deposit, and property-operations system. The customer-facing brand is set to Rechel's Place; property-specific location, contact, payment, calendar, and Supabase values must be replaced before launch.

This repository is intentionally independent from the original Uppadar Hollie repository. Do not connect it to the original production database or payment account.

## Local development

```powershell
npm.cmd install
npm.cmd run dev --workspace web
```

Open `http://localhost:3000`.

## Airbnb calendar sync

The production booking flow includes a protected two-way iCalendar integration
for Airbnb. Follow [docs/airbnb-calendar-sync.md](docs/airbnb-calendar-sync.md)
to configure the server-only feed URL, export token, Supabase service key, and
scheduled sync before enabling it for guests.

## Before enabling direct booking

1. Confirm the maximum guest count and bedroom sleeping arrangements.
2. Confirm nightly rates, extra-guest pricing, parking fees, deposit amount, cancellation policy, and house rules.
3. Obtain the official phone number, email address, payment account, and payment QR image.
4. Create a new Supabase project and apply the included migrations only to that new project.
5. Add the new environment values from `apps/web/.env.example`.
6. Change `bookingConfigured` to `true` in `apps/web/src/lib/property.ts` only after the new database and business rules are verified.
7. Configure a separate hosting project and keep this repository connected only to the Rechel's Place GitHub project.

## Verification

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```
