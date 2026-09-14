# SnowAZ Philippines compliance checklist

This is an implementation checklist, not legal advice. Confirm business-specific facts with the owner and, where appropriate, a Philippine lawyer, accountant, the condominium administration, and the relevant government office before publishing final policies.

## Already implemented

- The website labels the calendar submission as a booking request, not a confirmed reservation.
- No card, wallet, bank, or other online payment data is collected by the website.
- The booking modal explains that payment instructions are handled offline after owner confirmation.
- Collection is limited to stay dates, guest count, name, email, phone, and an optional request.
- Explicit consent is required before submission and stored with consent version `booking-request-v2`.
- Public Supabase access is insert-only for booking requests. Guests cannot read booking contact records.
- Availability exposes date ranges only and does not expose guest identities.
- The public form enforces 1–8 guests and a future stay of no more than 366 days.
- Known deposit, bedroom-access, smoking, pet, balcony, and parking conditions are shown before submission.
- The homepage publishes the SnowAZ contact number, email address, unit location, and service description.

## Owner decisions required before final legal pages

1. Registered owner or business name, DTI/SEC registration details, BIR registration/TIN display requirements, and the exact business address to publish.
2. Confirmation of the Mandaue City business permit, barangay requirements, condominium or homeowners' rules, and authority to offer short-term stays in Unit 1920.
3. Whether DOT accreditation applies to this operation and the correct accommodation category.
4. Final nightly price for 2 guests/1 bedroom, additional-guest charges, two-bedroom pricing, weekly rate, taxes, and every mandatory fee.
5. Offline payment methods, payment deadline, proof-of-payment procedure, official invoice or receipt process, and who receives payment.
6. Cancellation, rescheduling, no-show, early departure, refund, force-majeure, and date-change rules.
7. Exact security-deposit deductions, inspection/clearing process, refund channel, and maximum refund timeframe.
8. Complaint and redress contact, response target, and escalation procedure.
9. Personal-data retention period for declined, cancelled, completed, and abandoned booking requests.
10. Identity and contact details of the Personal Information Controller and designated privacy contact or DPO, if applicable.
11. Whether guest identification will be collected outside the website, why it is required, who can access it, and how long it is retained.
12. Rules for minors, visitors, maximum occupancy, quiet hours, prohibited activities, damages, lost keys/access codes, and check-in verification.

## Pages and controls to publish after confirmation

- Privacy Notice shown next to the booking consent, covering collected data, purposes, lawful basis, processors/recipients, cross-border storage, retention, security, data-subject rights, and complaint contacts.
- Booking Terms covering prices, taxes and fees, confirmation, offline payment, receipts, cancellation/refunds, deposit handling, house-rule penalties, and complaint resolution.
- Business identity and registration disclosures required for the homepage and checkout/request experience.
- A way for guests to request access, correction, deletion, or objection concerning their personal data.
- A documented retention and deletion workflow in Supabase, plus an incident/breach response procedure.

## Primary official references

- National Privacy Commission, Data Privacy Act: https://privacy.gov.ph/data-privacy-act/
- NPC, Right to be Informed: https://privacy.gov.ph/the-right-to-be-informed/
- NPC, Implementing Rules and Regulations: https://privacy.gov.ph/implementing-rules-regulations-data-privacy-act-2012/
- Republic Act No. 11967, Internet Transactions Act: https://lawphil.net/statutes/repacts/ra2023/ra_11967_2023.html
- DTI, Implementing Rules and Regulations of the Internet Transactions Act: https://www.dti.gov.ph/sdm_downloads/implementing-rules-regulations-of-the-internet-transactions-act-of-2023
- DTI E-Commerce, Joint Administrative Order No. 22-01: https://ecommerce.dti.gov.ph/joint-administrative-order-no-22-01/
- DTI E-Commerce FAQs, including online-business and BIR registration guidance: https://ecommerce.dti.gov.ph/faqs/
- Department of Tourism accreditation portal and requirements: https://accreditation.tourism.gov.ph/
