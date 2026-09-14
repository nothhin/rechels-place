---
name: Modern Luxury Staycation
source: https://stitch.withgoogle.com/projects/8516570275133104702
screens:
  explore: 19c4b3d21b3f4b3f9db8783a9dcc7834
  booking: d25e769c34114f8f9d5aca18ff7b1031
  admin-overview: 1b558b13939a4a2483ea9512af241583
  admin-calendar: 6fa982f15d314d309de8cc5e90dd7077
colors:
  surface: '#fcf9f3'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3ed'
  surface-container: '#f0eee8'
  surface-container-high: '#ebe8e2'
  on-surface: '#1c1c18'
  on-surface-variant: '#504539'
  outline: '#827567'
  outline-variant: '#d4c4b4'
  primary: '#815514'
  on-primary: '#ffffff'
  primary-container: '#be8a45'
  secondary: '#645d56'
  secondary-container: '#ebe1d7'
  tertiary: '#685d4d'
  background: '#fcf9f3'
  brand-gold-deep: '#9A6B2D'
  brand-gold-light: '#DFC293'
  surface-cream: '#FDFCFA'
  surface-ivory: '#F6F1EA'
  surface-sand: '#EDE5DA'
  charcoal-main: '#1C1B18'
  charcoal-muted: '#524F49'
  charcoal-subtle: '#858178'
typography:
  headline: EB Garamond
  body: Plus Jakarta Sans
  display-hero: 56px/64px 400
  display-hero-mobile: 36px/44px 400
  headline-lg: 40px/48px 400
  headline-lg-mobile: 28px/36px 400
  headline-md: 30px/38px 500
  body-md: 15px/24px 400
  label-caps: 11px/16px 700 0.12em
rounded:
  sm: 0.25rem
  default: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  xxs: 0.25rem
  xs: 0.5rem
  sm: 0.75rem
  md: 1rem
  lg: 1.5rem
  xl: 2rem
  2xl: 3rem
  3xl: 4.5rem
  4xl: 6rem
  5xl: 8rem
  max-width-content: 1280px
---

# Rechel's Place implementation contract

This project uses the exact **Modern Luxury Staycation** visual preset exported from Google Stitch: editorial warm minimalism, refined glass surfaces, champagne-gold actions, espresso text, creamy ivory canvas, EB Garamond display typography, and Plus Jakarta Sans interface typography.

## Explore screen

The mobile PWA composition follows the Stitch screen in this order: compact brand/status header, install prompt, online state, photographic hero with overlaid location and facts, paired reservation actions, horizontally browsable space gallery, stay configurations, comfort grid, Cagayan de Oro address, reservation lookup, and a persistent five-item bottom navigation with an elevated Book action.

## Booking screen

The booking route follows the second Stitch node: Step 1 of 3 progress indicator, live-availability overline, suite selection cards, public calendar with Open/Selected/Pending/Booked states, guest and stay details, visual room tiles, transparent reservation summary, offline-draft notice, Messenger option, and direct-request CTA.

## Admin overview screen

The host workspace follows Stitch node `1b558b13939a4a2483ea9512af241583`: a compact Rechel's Place brand and live-sync header, quick operational actions, a clear unit-status hero, an operations pulse, financial summary cards, guest pipeline cards, and a persistent mobile navigation. SnowAZ names, IoT controls, figures, and fictional guests shown in the Stitch mockup are reference content only and must never appear in production.

## Admin calendar screen

The admin calendar follows Stitch node `6fa982f15d314d309de8cc5e90dd7077`: month and Today controls, occupancy and stay summaries, room filters, a dense seven-column calendar, explicit Open/Request/Confirmed states, and contextual reservation details. The desktop layout expands the same hierarchy without changing the mobile-first ordering.

## Admin responsive behavior

- Mobile under 768px: compact host header, horizontally scrollable filters, dense calendar cells, stacked operational cards, and fixed five-item bottom navigation.
- Tablet 768–1023px: two-column operational cards with calendar controls kept on one row.
- Desktop 1024px and above: persistent dark espresso sidebar, wide content canvas, four-column pulse cards, and full booking detail panels.
- Admin screens use only Rechel's Place terminology and live database values. Internal legacy database function names are implementation details and are never rendered.

## Responsive behavior

- Mobile under 768px: one-column cards, edge-to-edge imagery, 20px page margin, 48–72px section rhythm, fixed glass bottom navigation with safe-area padding.
- Tablet 768–1023px: two-column cards and visible horizontal-scroll cues.
- Desktop 1024px and above: 12-column fluid layout, asymmetrical editorial compositions, maximum content width 1280px.

## Component states

- Primary actions use `#BE8A45`, white text, full-pill geometry, and a restrained warm shadow.
- Fields use cream surfaces, an 8px radius, subtle charcoal border, and a gold focus ring.
- Selected calendar endpoints are solid gold; range dates use the warm-sand fill; pending and booked states remain clearly distinguishable without exposing guest data.
- Elevated cards use a 1px warm-gold/charcoal hairline and soft ambient shadow, never harsh black elevation.

## Content rule

The design and interaction hierarchy mirror the Stitch nodes. SnowAZ business data in the source mockup is reference content only. Rechel's Place names, images, room details, contact, address, pricing, occupancy, policies, and payment terms must come only from confirmed Rechel's Place data. Unconfirmed prices display **Ask host** rather than copied SnowAZ rates.

## Accessibility

Maintain semantic landmarks and headings, useful image alternatives, visible keyboard focus, minimum 44px touch targets, form labels, status text in addition to color, and reduced-motion compatibility.

## Supplied Stitch source exports

The user supplied the rendered HTML exports used as the exact source reference:

- `C:/Users/Welmar/.codex/attachments/f08d0f6f-3343-4621-85dd-d2ee9434bead/pasted-text.txt` — host overview screen.
- `C:/Users/Welmar/.codex/attachments/53e8544b-5671-487d-81ed-760309d08965/pasted-text.txt` — host calendar screen.

Preserve the exported composition: fixed translucent cream header, live-sync row, quick actions, sanctuary card, dense calendar/filter panel, floating primary action, and fixed five-item bottom navigation. Exact visual tokens are `#fcf9f3` surface, `#f6f1ea` ivory, `#be8a45` primary container, `#9a6b2d` deep gold, `#1c1b18` charcoal, and `#827567` outline, with Plus Jakarta Sans for UI and EB Garamond for display headings. Replace SnowAZ text and sample data with Rechel's Place data.

Additional customer-facing source exports supplied by the user:

- `C:/Users/Welmar/.codex/attachments/8a4b960a-c5f9-497a-b633-a8d5a29e4dd4/pasted-text.txt` — customer Explore/property page.
- `C:/Users/Welmar/.codex/attachments/d22f0103-7331-4889-9700-49e30baf8885/pasted-text.txt` — customer Reserve Your Sanctuary booking page.

These customer exports are separate from the host overview and host calendar exports above. Their bottom navigation is Explore, Bedrooms, Book, Amenities, and Host; it must not be reused as the admin navigation.

Booking request source export:

- `C:/Users/Welmar/.codex/attachments/ec6056ba-43b2-4ca7-87a1-06980bf2052b/pasted-text.txt` — the exact Availability and Booking request view, including the three-step progress header, room selector, visual calendar, guest controls, parking option, calculated reserve summary, Messenger CTA, direct request CTA, and customer bottom navigation.
