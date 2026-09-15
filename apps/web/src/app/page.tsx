import Image from "next/image";
import Link from "next/link";
import AvailabilityCalendar from "./AvailabilityCalendar";
import UiIcon, { type IconName } from "./UiIcon";
import { SavedBookingLink } from "./BookingMemory";
import BookingLauncher from "./BookingLauncher";
import PwaInstallPrompt from "./PwaInstallPrompt";
import HeroCarousel from "./HeroCarousel";
import {
  amenityGroups,
  guestReviews,
  galleryImages,
  galleryLinks,
  galleryVideo,
  heroImages,
  nearbyPlaces,
  propertyProfile,
  propertyLogoSrc,
  reviewSummary,
  serviceContacts,
  stayDetails,
  unavailableAmenities,
} from "@/lib/property";
import { getPublicPricing } from "@/lib/server/pricing";
import { formatPhpMinor, formatPricingPercent } from "@uppadar-hollie/shared/pricing";

export const dynamic = "force-dynamic";

const quickFacts: ReadonlyArray<[IconName, string]> = [
  ["bed", "2 Bedrooms"],
  ["users", "Up to 6 guests"],
  ["bed", "5 Beds"],
  ["shower", "2.5 Baths"],
];

export default async function Home() {
  const pricing = await getPublicPricing();
  const nightlyRate = pricing ? formatPhpMinor(pricing.wholeCondoNightlyRateMinor) : "Current rate";
  const securityDeposit = pricing ? formatPhpMinor(pricing.refundableSecurityDepositMinor) : "Current deposit";
  const downPayment = pricing ? formatPricingPercent(pricing.downPaymentPercent) : "Configured";
  return (
    <main className="pwa-site" id="home">
      <header className="pwa-header">
        <a className="pwa-logo" href="#home">
          <Image src={propertyLogoSrc} alt="Rechel’s Place" width={42} height={42} />
          <span><strong>Rechel’s Place</strong><small>CDO condo stay</small></span>
        </a>
        <span className="pwa-online"><i /> Online</span>
        <div className="pwa-head-actions">
          <BookingLauncher className="pwa-icon-book"><UiIcon name="calendar" size={16} /><span className="sr-only">View live availability</span></BookingLauncher>
          <a href={propertyProfile.messengerUrl} target="_blank" rel="noreferrer" aria-label="Chat with the host"><UiIcon name="message" size={16} /></a>
        </div>
      </header>

      <PwaInstallPrompt />
      <div className="pwa-status"><span><i /> Online · Ready to book</span><span><UiIcon name="bolt" size={11} /> Live availability calendar</span></div>

      <section className="pwa-hero" aria-labelledby="hero-heading">
        <div className="pwa-hero-copy">
          <Image className="pwa-botanical-corner" src="/images/rechel-s-place/botanical-corner.svg" alt="" aria-hidden="true" width={240} height={270} />
          <div className="pwa-hero-meta"><span><UiIcon name="pin" size={13} /> {propertyProfile.locationLabel}</span><strong>Entire condo</strong></div>
          <div className="pwa-hero-copy-main"><small>YOUR HOME AWAY FROM HOME</small><h1 id="hero-heading">A calm home base for your CDO days.</h1><p>{propertyProfile.tagline}</p></div>
          <div className="pwa-hero-rate"><span>DIRECT BOOKING RATE</span><strong>{nightlyRate} <em>/ night</em></strong><small>{downPayment} down payment · {securityDeposit} refundable deposit</small></div>
        </div>
        <HeroCarousel slides={heroImages} />
        <div className="pwa-facts">{quickFacts.map(([icon, label]) => <div key={label}><span><UiIcon name={icon} size={19} /></span><strong>{label}</strong></div>)}</div>
      </section>

      <div className="pwa-primary-actions"><BookingLauncher><UiIcon name="calendar" size={17} />Reserve your dates</BookingLauncher><a href={propertyProfile.messengerUrl} target="_blank" rel="noreferrer"><UiIcon name="message" size={17} />Chat host</a></div>
      <div className="pwa-source-links" aria-label="Official property links">
        <a href={propertyProfile.airbnbUrl} target="_blank" rel="noreferrer"><UiIcon name="image" size={15} />View listing on Airbnb ↗</a>
        <a href={propertyProfile.facebookUrl} target="_blank" rel="noreferrer"><UiIcon name="message" size={15} />Visit Facebook page ↗</a>
      </div>
      <div className="pwa-trust-strip" aria-label="Reasons to stay at Rechel's Place">
        <article><span><UiIcon name="check" size={16} /></span><div><strong>{propertyProfile.ratingLabel}</strong><small>{propertyProfile.reviewCount} Airbnb reviews</small></div></article>
        <article><span><UiIcon name="home" size={16} /></span><div><strong>Entire condo</strong><small>Private two-bedroom stay</small></div></article>
        <article><span><UiIcon name="message" size={16} /></span><div><strong>Direct owner support</strong><small>Ask Rechel about your dates</small></div></article>
      </div>

      <section className="pwa-section" id="spaces">
        <div className="pwa-section-title"><div><small>PHOTOS FROM THE LISTING</small><h2>Bright spaces for easy living.</h2></div><span>REAL<small>PHOTOS</small></span></div>
        <div className="pwa-gallery">{galleryImages.map((image, index) => <figure key={image.src} className={index === 0 ? "pwa-gallery-main" : ""}><Image src={image.src} alt={image.alt} fill sizes="(max-width: 760px) 50vw, 32vw" quality={90} /></figure>)}</div>
        <div className="pwa-video-showcase">
          <div className="pwa-video-copy">
            <small>VIDEO TOUR</small>
            <h3>See the space before you arrive.</h3>
            <p>{propertyProfile.descriptor}, with {propertyProfile.maxGuests} guests, 2 bedrooms, {propertyProfile.bedLabel}, and {propertyProfile.bathroomLabel}.</p>
            <div className="pwa-video-facts" aria-label="Property details">
              <span>6 guests</span>
              <span>2 bedrooms</span>
              <span>5 beds</span>
              <span>2.5 baths</span>
            </div>
          </div>
          <figure className="pwa-video-frame">
            <video controls playsInline preload="metadata" poster={galleryVideo.poster} aria-label={galleryVideo.alt}>
              <source src={galleryVideo.src} type="video/mp4" />
              Your browser does not support the property tour video.
            </video>
            <figcaption>Rechel’s Place · walkthrough video</figcaption>
          </figure>
        </div>
        <div className="pwa-tour-links">{galleryLinks.map((link, index) => <a key={link.href} href={link.href} target="_blank" rel="noreferrer"><UiIcon name={index === 0 ? "image" : "message"} size={14} />{link.label} ↗</a>)}</div>
      </section>

      <section className="pwa-rooms" id="rooms">
        <div className="pwa-rooms-heading"><small>SLEEPING SPACES</small><h2>Two bedrooms.<br />One easy stay.</h2><p>The entire condo is available for your group, with five beds and room for up to six guests.</p></div>
        <article><div className="pwa-room-photo"><Image src="/images/rechel-s-place/airbnb-bedroom-1.webp" alt="Primary bedroom with a queen bed and city view" fill sizes="(max-width: 700px) 100vw, 50vw" /></div><div className="pwa-room-copy"><span>PRIMARY BEDROOM</span><strong className="pwa-room-price">Included</strong><small className="pwa-room-occupancy">1 queen bed · Part of the entire-condo stay</small><h3>Rest with a view</h3><p>A private bedroom with a queen bed, workspace, storage, and a city-facing view.</p><ul><li>Queen bed</li><li>Dedicated workspace</li><li>Clothing storage</li><li>TV</li></ul></div></article>
        <article><div className="pwa-room-photo"><Image src="/images/rechel-s-place/airbnb-bedroom-2.webp" alt="Second bedroom with a queen bed, desk, and city view" fill sizes="(max-width: 700px) 100vw, 50vw" /></div><div className="pwa-room-copy"><span>SECOND BEDROOM</span><strong className="pwa-room-price">Included</strong><small className="pwa-room-occupancy">Queen bed · Sofa bed · Bunk bed · Floor mattresses</small><h3>Flexible sleeping space</h3><p>Settle in with flexible sleeping arrangements for families and friends sharing the condo.</p><ul><li>Queen bed</li><li>Sofa bed and bunk bed</li><li>Two floor mattresses</li><li>Desk and TV</li></ul></div></article>
      </section>

      <section className="pwa-section pwa-amenities" id="amenities">
        <small>WHAT THIS PLACE OFFERS</small><h2>Stay essentials,<br />already handled.</h2>
        <div className="pwa-amenity-groups">{amenityGroups.map(group => <article className="pwa-amenity-group" key={group.title}><header><span><UiIcon name={group.icon as IconName} size={19} /></span><h3>{group.title}</h3></header><ul>{group.items.map(item => <li key={item.name}><UiIcon name="check" size={15} /><div><strong>{item.name}</strong>{"detail" in item && item.detail ? <small>{item.detail}</small> : null}</div></li>)}</ul></article>)}</div>
        <article className="pwa-unavailable"><header><span aria-hidden="true">×</span><div><small>NOT INCLUDED</small><h3>Unavailable at this property</h3></div></header><ul>{unavailableAmenities.map(item => <li key={item.name}><span aria-hidden="true">×</span><div><strong>{item.name}</strong><small>{item.detail}</small></div></li>)}</ul></article>
      </section>

      <section className="pwa-reviews" id="reviews" aria-labelledby="reviews-heading">
        <div className="pwa-reviews-heading"><div><small>GUEST REVIEWS</small><h2 id="reviews-heading">A stay guests come back to.</h2><p>{reviewSummary.ratingLabel}</p></div><a className="pwa-reviews-link" href={propertyProfile.airbnbUrl} target="_blank" rel="noreferrer">Show all {propertyProfile.reviewCount} reviews <UiIcon name="arrow-right" size={15} /></a></div>
        <div className="pwa-review-overview">
          <article className="pwa-review-score"><span className="pwa-review-eyebrow">OVERALL RATING</span><div className="pwa-review-score-value"><strong>{reviewSummary.rating}</strong><span>/ 5</span></div><p>{propertyProfile.reviewCount} Airbnb reviews</p><small>7 of 7 rating areas shown</small></article>
          <article className="pwa-review-favorite"><div className="pwa-review-favorite-mark"><UiIcon name="bookmark" size={18} /><span>{reviewSummary.guestFavoriteTitle}</span></div><h3>Top 10% of homes</h3><p>{reviewSummary.guestFavoriteCopy}</p><a href={propertyProfile.airbnbUrl} target="_blank" rel="noreferrer">Learn more ↗</a></article>
          <article className="pwa-review-distribution"><span className="pwa-review-eyebrow">RATING BREAKDOWN</span><div className="pwa-review-bars">{reviewSummary.ratingDistribution.map(row => <div className="pwa-review-bar" key={row.label} aria-label={`${row.label}: ${row.percentage}% of reviews`}><span>{row.label.replace(" stars", "").replace(" star", "")}</span><div className="pwa-review-bar-track" aria-hidden="true"><span style={{ width: `${row.percentage}%` }} /></div><b>{row.percentage}%</b></div>)}</div></article>
        </div>
        <div className="pwa-review-category-grid" aria-label="Category ratings">{reviewSummary.categoryRatings.map(category => <article key={category.label}><span>{category.label}</span><strong>{category.score}</strong></article>)}</div>
        <div className="pwa-review-topics"><div className="pwa-review-section-label"><span>GUEST REVIEWS MENTION</span><small>Topics guests bring up most often</small></div><div className="pwa-review-topic-list">{reviewSummary.mentionedTopics.map(topic => <span key={topic.label}><strong>{topic.label}</strong><b>{topic.count}</b></span>)}</div></div>
        <div className="pwa-review-cards">{guestReviews.map(review => <article className="pwa-review-card" key={`${review.author}-${review.date}`}><header><span className="pwa-review-avatar" aria-hidden="true">{review.author.slice(0, 1)}</span><div><strong>{review.author}</strong><small>{review.tenure}</small></div><span className="pwa-review-rating" aria-label="5 out of 5 rating">5.0</span></header><blockquote><p>{review.quote}</p></blockquote><footer><span>{review.context}</span><span>{review.date}</span></footer></article>)}</div>
      </section>

      <section className="pwa-section pwa-stay-details" id="stay-details">
        <div><small>BEFORE YOU ARRIVE</small><h2>Important stay details</h2><p>Self check-in is available with a keypad. Rechel will confirm current arrival instructions and building details after your request.</p></div>
        <div className="pwa-stay-details-grid"><article><strong>Check-in</strong><span>{stayDetails.checkIn}</span></article><article><strong>Check-out</strong><span>{stayDetails.checkOut}</span></article><article className="pwa-stay-reminders"><strong>House rules</strong><ul><li>Maximum of 6 guests</li><li>Pets are not allowed</li></ul></article><article className="pwa-stay-contacts"><strong>Need help?</strong>{serviceContacts.map(contact => <a key={contact.label} href={`tel:${contact.phone}`}><span>{contact.label}</span>{contact.name} · {propertyProfile.phoneDisplay}</a>)}</article></div>
      </section>

      <section className="pwa-location" id="location">
        <div><small>YOUR CDO HOME BASE</small><h2>Close to the city.<br />Cozy when you&apos;re home.</h2><address>{propertyProfile.address}</address><ul>{nearbyPlaces.map(place => <li key={place}>{place}</li>)}</ul><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(propertyProfile.address)}`} target="_blank" rel="noreferrer">Open in Google Maps ↗</a></div>
        <Image src="/images/rechel-s-place/airbnb-kitchen-dining.webp" alt="Open-plan kitchen, dining, and living area" width={520} height={640} />
      </section>

      <section className="pwa-booking" id="availability" tabIndex={-1} aria-labelledby="availability-heading">
        <div className="pwa-book-heading"><span>LIVE AVAILABILITY · DIRECT WITH HOST</span><h2 id="availability-heading">Reserve your stay.</h2><p>Choose your preferred dates and contact Rechel directly. The current accommodation rate is {nightlyRate} per night; a {downPayment} down payment secures the stay, and the separate {securityDeposit} refundable security deposit is due upon check-in on that day.</p></div>
        <div className="pwa-config-card"><span>STAY CONFIGURATION</span><article><div><strong>{propertyProfile.descriptor}</strong><small>{propertyProfile.maxGuests} guests · 2 bedrooms · {propertyProfile.bedLabel} · {propertyProfile.bathroomLabel} · Kitchen · Pool · Keypad</small></div><b>{nightlyRate}/night</b></article><article><div><strong>Top guest favorite</strong><small>{propertyProfile.ratingLabel} from {propertyProfile.reviewCount} Airbnb reviews</small></div><b>Airbnb</b></article></div>
        <div className="pwa-booking-policy" aria-label="Booking payment terms">
          <article><b>{nightlyRate}</b><span>nightly rate</span></article>
          <article><b>{downPayment}</b><span>down payment</span></article>
          <article><b>{securityDeposit}</b><span>refundable security deposit on check-in</span></article>
        </div>
        <AvailabilityCalendar pricing={pricing} />
        <div className="pwa-returning"><strong>Already sent a request?</strong><SavedBookingLink /></div>
      </section>

      <section className="pwa-host"><Image src={propertyLogoSrc} alt="Rechel’s Place logo" width={110} height={110} /><div><small>DIRECT OWNER ASSISTANCE</small><h2>Questions before booking?</h2><p>Talk directly with Rechel about availability, current pricing, policies, and anything you need for a comfortable CDO stay.</p><div className="pwa-host-links"><a href={propertyProfile.messengerUrl} target="_blank" rel="noreferrer">Chat on Facebook →</a><a href={propertyProfile.airbnbUrl} target="_blank" rel="noreferrer">View Airbnb listing →</a></div></div></section>

      <footer className="pwa-footer"><div className="pwa-logo"><Image src={propertyLogoSrc} alt="" width={38} height={38} /><span><strong>Rechel’s Place</strong><small>{propertyProfile.tagline}</small></span></div><div><a href={propertyProfile.facebookUrl} target="_blank" rel="noreferrer">Facebook</a><a href={propertyProfile.airbnbUrl} target="_blank" rel="noreferrer">Airbnb</a><Link href="/privacy">Privacy</Link><Link href="/cookies">Cookies</Link><span>© {new Date().getFullYear()}</span></div></footer>

      <nav className="pwa-bottom-nav" aria-label="Mobile navigation"><a href="#home"><span><UiIcon name="home" /></span>Explore</a><a href="#rooms"><span><UiIcon name="bed" /></span>Bedrooms</a><BookingLauncher className="pwa-bottom-book"><span><UiIcon name="calendar" /></span>Book</BookingLauncher><a href="#amenities"><span><UiIcon name="sparkles" /></span>Amenities</a><a href={propertyProfile.messengerUrl} target="_blank" rel="noreferrer"><span><UiIcon name="message" /></span>Host</a></nav>
    </main>
  );
}
