# Rechel's Place

Independent client copy of the direct-booking, availability, guest-status, payment, and property-operations system. The customer-facing property details are set for Rechel's Place CDO from the official Facebook page and Airbnb listing. The current client rules are ₱4,500 per night, a 50% down payment, and a separate ₱1,000 refundable security deposit due upon check-in. Payment configuration, calendar credentials, and the new Supabase environment still require deployment setup before direct booking is enabled.

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

1. Confirm the maximum guest count, sleeping arrangements, cancellation policy, and house rules with Rechel before enabling payment collection. The configured client rules are ₱4,500/night, a 50% down payment, and a separate ₱1,000 refundable security deposit due upon check-in.
2. Verify the phone number, email address, Facebook page, Airbnb listing, and final payment instructions in `apps/web/src/lib/property.ts`.
3. Use only the host-provided GCash/InstaPay QR in the Rechel's Place payment page; never commit secrets or full banking credentials.
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
