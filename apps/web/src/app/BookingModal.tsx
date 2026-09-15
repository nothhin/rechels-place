"use client";

import { useActionState, useEffect, useId, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  submitBookingRequestInline,
  type BookingActionState,
} from "./book/actions";
import {
  calculateSnowazBookingReceipt,
  createRechelsPlacePricingStrategy,
} from "@uppadar-hollie/shared/booking";
import {
  formatPhpMinor,
  formatPricingPercent,
  type RechelsPricingConfig,
} from "@uppadar-hollie/shared/pricing";
import { propertyLogoSrc, propertyProfile } from "@/lib/property";
import { showError, showSuccess } from "@/lib/sweetalert";
import { RememberBooking, rememberBooking } from "./BookingMemory";
import UiIcon from "./UiIcon";
import BookingPriceReceipt from "./BookingPriceReceipt";

type BookingModalProps = {
  checkIn: string;
  checkOut: string;
  pricing: RechelsPricingConfig | null;
  onClose: () => void;
};
const initialState: BookingActionState = { status: "idle" };

export default function BookingModal({
  checkIn,
  checkOut,
  pricing,
  onClose,
}: BookingModalProps) {
  const [state, action, pending] = useActionState(
    submitBookingRequestInline,
    initialState,
  );
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const idempotencyInputRef = useRef<HTMLInputElement>(null);
  const [selectedCheckIn, setSelectedCheckIn] = useState(checkIn);
  const [selectedCheckOut, setSelectedCheckOut] = useState(checkOut);
  const [guests, setGuests] = useState(2);
  const [bedroomChoice] = useState<"both_bedrooms">("both_bedrooms");
  const [parkingType] = useState<"none">("none");
  const [earlyCheckInHours] = useState(0);
  const [lateCheckoutHours] = useState(0);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [reviewedPricingVersion, setReviewedPricingVersion] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const availabilityNotified = useRef(false);
  const livePricing = state.status === "stale" && state.pricing ? state.pricing : pricing;
  const priceReviewRequired = state.status === "stale";
  const priceReviewed = livePricing?.version === reviewedPricingVersion;
  const visibleStep = state.status === "stale" ? 3 : step;
  const clientReceipt = useMemo(() => {
    if (!livePricing) return null;
    try {
      return calculateSnowazBookingReceipt(
        selectedCheckIn,
        selectedCheckOut,
        guests,
        parkingType,
        bedroomChoice,
        earlyCheckInHours,
        lateCheckoutHours,
        createRechelsPlacePricingStrategy(livePricing),
      );
    } catch {
      return null;
    }
  }, [
    bedroomChoice,
    earlyCheckInHours,
    guests,
    lateCheckoutHours,
    livePricing,
    parkingType,
    selectedCheckIn,
    selectedCheckOut,
  ]);

  const validateStep = (currentStep: 1 | 2) => {
    const form = formRef.current;
    if (!form) return false;
    const fields = Array.from(form.querySelectorAll<HTMLElement>(`[data-booking-step="${currentStep}"] input, [data-booking-step="${currentStep}"] select, [data-booking-step="${currentStep}"] textarea`));
    const invalid = fields.find((field) => field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement ? !field.checkValidity() : false) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | undefined;
    if (invalid) {
      invalid.reportValidity();
      return false;
    }
    if (currentStep === 1 && (!selectedCheckIn || !selectedCheckOut || selectedCheckOut <= selectedCheckIn)) {
      void showError("Choose a valid check-in and check-out date before continuing.");
      return false;
    }
    return true;
  };

  const continueToNextStep = () => {
    if (step === 3) return;
    if (validateStep(step)) setStep((value) => (value + 1) as 2 | 3);
  };

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.classList.add("booking-modal-open");
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.classList.remove("booking-modal-open");
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    stepHeadingRef.current?.focus();
  }, [visibleStep]);

  useEffect(() => {
    if (state.status === "success" && !availabilityNotified.current) {
      availabilityNotified.current = true;
      rememberBooking({
        url: state.depositLink ?? "/booking-status",
        reference: state.bookingReference,
        checkIn: selectedCheckIn,
        checkOut: selectedCheckOut,
      });
      window.dispatchEvent(new Event("snowaz:availability-changed"));
      void showSuccess(
        "Booking request received. The host will review your dates.",
      );
      window.location.assign(state.depositLink ?? "/booking-status");
    }
    if (state.status === "error" && state.message)
      void showError(state.message);
  }, [
    state.status,
    state.message,
    state.depositLink,
    state.bookingReference,
    selectedCheckIn,
    selectedCheckOut,
  ]);

  const adjustGuests = (change: number) =>
    setGuests((value) => Math.min(6, Math.max(1, value + change)));

  return (
    <div
      className="booking-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="booking-modal booking-modal-stitch"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        ref={dialogRef}
      >
        <header className="booking-modal-brandbar">
          <div>
            <Image
              src={propertyLogoSrc}
              alt=""
              width={38}
              height={38}
            />
            <span>
                <strong>Rechel’s Place</strong>
              <small>ONLINE</small>
            </span>
          </div>
          <strong>Availability and booking</strong>
          <button
            type="button"
            aria-label="Close booking form"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        {state.status !== "success" ? (
          <div className="booking-modal-progress" aria-label={`Booking progress, step ${visibleStep} of 3`}>
            <div>
              <b>{visibleStep}</b>
              <strong>{visibleStep === 1 ? "Choose your stay" : visibleStep === 2 ? "Guest details" : "Review request"}</strong>
              <small>Step {visibleStep} of 3</small>
            </div>
            <ol>
              {(["Select stay", "Guest details", "Review"] as const).map((label, index) => (
                <li className={index + 1 === visibleStep ? "active" : index + 1 < visibleStep ? "complete" : undefined} key={label}>
                  <button type="button" disabled={index + 1 >= visibleStep || state.status === "stale"} onClick={() => setStep((index + 1) as 1 | 2 | 3)}>{index + 1}. {label}</button>
                </li>
              ))}
            </ol>
            <div className="booking-modal-progress-track" aria-hidden="true"><span style={{ width: `${(visibleStep / 3) * 100}%` }} /></div>
          </div>
        ) : null}
        {state.status === "success" ? (
          <section className="booking-modal-success" role="status">
            <RememberBooking
              booking={{
                url: state.depositLink ?? "/booking-status",
                reference: state.bookingReference,
                checkIn: selectedCheckIn,
                checkOut: selectedCheckOut,
              }}
            />
            <span aria-hidden="true">✓</span>
            <p className="eyebrow">Request received</p>
            <h2 id={titleId}>Thank you. We&apos;ll be in touch.</h2>
            <p>
              Your reference is <strong>{state.bookingReference}</strong>. Your
              stay is not confirmed yet. Review the private payment page for
              the {livePricing ? formatPricingPercent(livePricing.downPaymentPercent) : "configured"} down payment; the {livePricing ? formatPhpMinor(livePricing.refundableSecurityDepositMinor) : "refundable security deposit"} is due separately upon check-in on that day.
            </p>
            <a
              className="booking-deposit-link"
              href={propertyProfile.messengerUrl}
              target="_blank"
              rel="noreferrer"
            >
              <UiIcon name="message" size={17} />
              Follow up on Messenger
            </a>
            <button type="button" onClick={onClose}>
              Return to the property
            </button>
          </section>
        ) : (
          <>
            <div className="booking-modal-scroll" ref={scrollRef}>
              {visibleStep === 1 ? <>
                <div className="booking-modal-heading">
                  <p className="eyebrow">
                    <UiIcon name="check" size={12} /> Live availability · Direct
                    with host
                  </p>
                  <h2 id={titleId} ref={stepHeadingRef} tabIndex={-1}>Reserve Your Sanctuary</h2>
                  <p>
                    Choose your preferred dates and send your stay details. The
                    current accommodation rate is {livePricing ? formatPhpMinor(livePricing.wholeCondoNightlyRateMinor) : "the configured rate"} per night, subject to the host confirming availability.
                  </p>
                </div>
                <div className="booking-selected-dates" role="status">
                  <UiIcon name="calendar" size={17} />
                  <div>
                    <strong>{selectedCheckIn && selectedCheckOut ? "Dates selected" : "Choose your dates"}</strong>
                    <small>{selectedCheckIn && selectedCheckOut ? `${new Date(`${selectedCheckIn}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })} – ${new Date(`${selectedCheckOut}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}` : "Select a check-in and check-out date in the first step."}</small>
                  </div>
                </div>
              </> : <h2 className="booking-step-content-heading" id={titleId} ref={stepHeadingRef} tabIndex={-1}>{visibleStep === 2 ? "Guest details" : "Review request"}</h2>}
              <form
                action={action}
                ref={formRef}
                onSubmit={() => { if (idempotencyInputRef.current && !idempotencyInputRef.current.value) idempotencyInputRef.current.value = crypto.randomUUID(); if (priceReviewRequired) setStep(3); }}
                className="booking-modal-form booking-stitch-form"
              >
                {state.status === "error" ? (
                  <div className="booking-modal-error" role="alert">
                    {state.message}
                  </div>
                ) : null}
                <input
                  type="hidden"
                  name="idempotencyKey"
                  defaultValue=""
                  ref={idempotencyInputRef}
                />
                <input type="hidden" name="roomTypeId" value="" />
                <input type="hidden" name="preferredContact" value="phone" />
                <input
                  type="hidden"
                  name="bedroomChoice"
                  value={bedroomChoice}
                />
                <input type="hidden" name="parkingType" value={parkingType} />
                <input type="hidden" name="earlyCheckInHours" value={earlyCheckInHours} />
                <input type="hidden" name="lateCheckoutHours" value={lateCheckoutHours} />
                <input type="hidden" name="pricingVersion" value={livePricing?.version ?? ""} />
                <input type="hidden" name="clientTotalMinor" value={clientReceipt?.totalMinor ?? ""} />
                <label className="booking-honeypot">
                  Website
                  <input name="website" tabIndex={-1} autoComplete="off" />
                </label>
                <div data-booking-step="1" className={visibleStep === 1 ? "booking-step" : "booking-step booking-step-hidden"}>
                <section className="booking-suite-section">
                  <span>CHOOSE YOUR STAY</span>
                  <div className="booking-room-options">
                    <div className="selected">
                      <span>
                        <strong>Entire two-bedroom condo</strong>
                        <small>2 bedrooms · 5 beds · 2.5 baths · Up to 6 guests</small>
                      </span>
                      <b>{livePricing ? formatPhpMinor(livePricing.wholeCondoNightlyRateMinor) : "Current rate"}/night</b>
                    </div>
                  </div>
                </section>
                <p className="booking-source-note">Free street parking is listed on Airbnb. Ask Rechel about parking, early arrival, or late checkout when you send your request.</p>
                <section className="booking-date-section">
                  <div className="booking-section-label">
                    <span>CALENDAR</span>
                    <small>Choose your preferred stay</small>
                  </div>
                  <div className="booking-modal-grid">
                    <label>
                      <span>Check-in</span>
                      <input
                        name="checkIn"
                        type="date"
                        value={selectedCheckIn}
                        onChange={(event) =>
                          setSelectedCheckIn(event.target.value)
                        }
                        required
                      />
                    </label>
                    <label>
                      <span>Check-out</span>
                      <input
                        name="checkOut"
                        type="date"
                        value={selectedCheckOut}
                        onChange={(event) =>
                          setSelectedCheckOut(event.target.value)
                        }
                        required
                      />
                    </label>
                  </div>
                </section>
                </div>
                <div data-booking-step="2" className={visibleStep === 2 ? "booking-step" : "booking-step booking-step-hidden"}>
                <section className="booking-stay-details">
                  <h3>
                    <UiIcon name="sparkles" size={17} /> Stay Details
                  </h3>
                  <div className="booking-guest-row">
                    <div>
                      <strong>Guests</strong>
                      <small>Final occupancy confirmed by host</small>
                    </div>
                    <div>
                      <button
                        type="button"
                        aria-label="Remove guest"
                        onClick={() => adjustGuests(-1)}
                      >
                        −
                      </button>
                      <output>{guests}</output>
                      <button
                        type="button"
                        aria-label="Add guest"
                        onClick={() => adjustGuests(1)}
                      >
                        +
                      </button>
                    </div>
                    <input type="hidden" name="guests" value={guests} />
                  </div>
                  <div className="booking-selected-room-copy">
                    <strong>Entire two-bedroom condo</strong>
                    <small>2 bedrooms · 5 beds · 2.5 baths · Maximum 6 guests</small>
                  </div>
                </section>
                <section className="booking-parking-section">
                  <div className="booking-section-label">
                    <span>PARKING</span>
                    <small>Free street parking is listed on Airbnb</small>
                  </div>
                  <p className="booking-source-note">Parking details and any building restrictions are confirmed by the host.</p>
                </section>
                <div className="booking-preview-photos">
                  <figure>
                    <Image
                      src="/images/rechel-s-place/airbnb-bedroom-1.webp"
                      alt="Primary bedroom with a queen bed and city view"
                      fill
                      sizes="220px"
                    />
                    <figcaption>Primary bedroom · Queen bed</figcaption>
                  </figure>
                  <figure>
                    <Image
                      src="/images/rechel-s-place/airbnb-living-room.webp"
                      alt="Living room with sofa, TV, and city view"
                      fill
                      sizes="220px"
                    />
                    <figcaption>Living room · 65-inch TV</figcaption>
                  </figure>
                </div>
                <section className="booking-contact-section">
                  <div className="booking-section-label">
                    <span>GUEST DETAILS</span>
                    <small>How should the host contact you?</small>
                  </div>
                  <label>
                    <span>Full name</span>
                    <input name="fullName" autoComplete="name" required />
                  </label>
                  <div className="booking-modal-grid">
                    <label>
                      <span>Email address (optional)</span>
                      <input name="email" type="email" autoComplete="email" />
                    </label>
                    <label>
                      <span>Contact number</span>
                      <input
                        name="phone"
                        type="tel"
                        autoComplete="tel"
                      inputMode="numeric"
                      placeholder="09xxxxxxxxx"
                      pattern="09[0-9]{9}"
                      minLength={11}
                      maxLength={11}
                      required
                      />
                    </label>
                  </div>
                  <label>
                    <span>Special requests (optional)</span>
                    <textarea
                      name="specialRequests"
                      rows={3}
                      maxLength={1000}
                      placeholder="Arrival time, celebration, or anything the host should know"
                    />
                  </label>
                </section>
                </div>
                <div data-booking-step="3" className={visibleStep === 3 ? "booking-step" : "booking-step booking-step-hidden"}>
                <>
                  {priceReviewRequired ? (
                    <div className="booking-price-change" role="alert">
                      <strong>Rates changed while you were booking.</strong>
                      <p>
                        Your previous estimate was {state.previousTotalMinor !== undefined ? formatPhpMinor(state.previousTotalMinor) : "the earlier amount"}; the updated estimate is {state.currentTotalMinor !== undefined ? formatPhpMinor(state.currentTotalMinor) : clientReceipt ? formatPhpMinor(clientReceipt.totalMinor) : "the current amount"}.
                      </p>
                      <label>
                        <input
                          type="checkbox"
                          checked={priceReviewed}
                          onChange={(event) => setReviewedPricingVersion(event.target.checked ? livePricing?.version ?? null : null)}
                        />
                        <span>I reviewed the updated total and want to continue.</span>
                      </label>
                    </div>
                  ) : null}
                  <BookingPriceReceipt
                    checkIn={selectedCheckIn}
                    checkOut={selectedCheckOut}
                    guests={guests}
                    bedroomChoice={bedroomChoice}
                    parkingType={parkingType}
                    earlyCheckInHours={earlyCheckInHours}
                    lateCheckoutHours={lateCheckoutHours}
                    pricing={livePricing}
                  />
                  <div className="booking-rate-note">
                    <UiIcon name="check" size={18} />
                    <div>
                      <strong>Current rate: {livePricing ? formatPhpMinor(livePricing.wholeCondoNightlyRateMinor) : "Unavailable"}/night</strong>
                      <small>
                        No payment is collected in this form. A {livePricing ? formatPricingPercent(livePricing.downPaymentPercent) : "configured"} down payment secures the accommodation balance, while the separate {livePricing ? formatPhpMinor(livePricing.refundableSecurityDepositMinor) : "refundable security deposit"} is due upon check-in on that day.
                      </small>
                    </div>
                  </div>
                  <label className="booking-modal-consent">
                    <input name="consent" type="checkbox" required />
                    <span>
                        I agree that Rechel’s Place may use my contact and stay
                      details to respond to this request. I have read the{" "}
                      <Link href="/privacy">Privacy Notice</Link> and{" "}
                      <Link href="/cookies">Cookie Notice</Link>.
                    </span>
                  </label>
                  <div className="booking-saved-note">
                    <UiIcon name="bookmark" size={17} />
                    <div>
                      <strong>Saved to this device</strong>
                      <small>
                        Your booking details remain available on this device.
                      </small>
                    </div>
                  </div>
                  <div className="booking-host-row">
                    <span>Questions? Host assistance</span>
                    <a
                      href={propertyProfile.messengerUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <UiIcon name="message" size={15} />
                      Reserve via Messenger
                    </a>
                  </div>
                </>
                </div>
                <div className={`booking-step-actions${visibleStep > 1 ? " has-back" : ""}`}>
                  {visibleStep > 1 && state.status !== "stale" ? <button className="booking-step-back" type="button" onClick={() => setStep((value) => (value - 1) as 1 | 2)}>Back</button> : null}
                  {visibleStep < 3 ? <button className="booking-step-next" type="button" onClick={continueToNextStep}>Continue <UiIcon name="arrow-right" size={16} /></button> : <button className="booking-modal-submit" type="submit" disabled={pending || !livePricing || (priceReviewRequired && !priceReviewed)}><UiIcon name="message" size={17} />{pending ? "Sending request…" : priceReviewRequired && !priceReviewed ? "Review updated total" : "Submit direct request"}</button>}
                </div>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
