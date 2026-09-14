"use client";
import {
  useActionState,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { formatStayRange } from "@/lib/date-format";
import {
  manageDateBlock,
  recordPartialPayment,
  reversePayment,
  type OperationActionState,
} from "../actions";
import { showError, showSuccess } from "@/lib/sweetalert";
import styles from "../admin.module.css";
const initial: OperationActionState = { status: "idle" };
const money = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});
const PAGE_SIZE = 6;
const DATE_BLOCK_PAGE_SIZE = 4;
type OpsPayment = {
  id: string;
  direction: string;
  category: string;
  amountMinor: number;
  method: string;
  reference: string;
  status: string;
  recordedAt: string;
  reversalReason?: string | null;
};
export type OpsBooking = {
  id: string;
  reference: string;
  fullName: string;
  phone: string;
  email: string;
  checkIn: string;
  checkOut: string;
  guestCount: number;
  bedroomChoice: string;
  bookingStatus: string;
  stayStatus: string;
  totalMinor: number;
  paidMinor: number;
  remainingMinor: number;
  idType: string | null;
  idLast4: string | null;
  payments: OpsPayment[];
};
export type DateBlock = {
  id: string;
  checkIn: string;
  checkOut: string;
  reason: string;
  status: string;
};
export type OpsNotification = {
  id: string;
  type: string;
  recipient: string;
  channel: string;
  status: string;
  dueAt: string;
  attempts: number;
};
function useActionNotice(state: OperationActionState) {
  const router = useRouter();
  useEffect(() => {
    if (state.status === "success") {
      void showSuccess(state.message ?? "Saved.");
      window.dispatchEvent(new Event("snowaz:admin-changed"));
      router.refresh();
    } else if (state.status === "error")
      void showError(state.message ?? "Could not save.");
  }, [state, router]);
}
function BookingModal({
  booking,
  onClose,
}: {
  booking: OpsBooking;
  onClose: () => void;
}) {
  const [payState, payAction, paying] = useActionState(
    recordPartialPayment,
    initial,
  );
  const [reverseState, reverseAction, reversing] = useActionState(
    reversePayment,
    initial,
  );
  const [paymentMethod, setPaymentMethod] = useState("cash");
  useActionNotice(payState);
  useActionNotice(reverseState);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", close);
    };
  }, [onClose]);
  return createPortal(
    <div
      className={styles.bookingModalBackdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className={`${styles.bookingInfoModal} ${styles.operationsModal}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="operations-booking-title"
      >
        <header>
          <div>
            <p className={styles.eyebrow}>{booking.reference}</p>
            <h2 id="operations-booking-title">{booking.fullName}</h2>
          </div>
          <button
            type="button"
            aria-label="Close booking operations"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className={styles.bookingModalBody}>
          <section className={styles.operationsSummary}>
            <div>
              <span>Total</span>
              <strong>{money.format(booking.totalMinor / 100)}</strong>
            </div>
            <div>
              <span>Paid</span>
              <strong>{money.format(booking.paidMinor / 100)}</strong>
            </div>
            <div data-due={booking.remainingMinor > 0}>
              <span>Remaining</span>
              <strong>{money.format(booking.remainingMinor / 100)}</strong>
            </div>
          </section>
          <div className={styles.operationsFormsGrid}>
            <section className={styles.operationsForm}>
              <div>
                <p className={styles.eyebrow}>Payment ledger</p>
                <h3>Record or correct payments</h3>
              </div>
              <form action={payAction} className={styles.operationsPaymentForm}>
                <input type="hidden" name="bookingId" value={booking.id} />
                <label>
                  <span>Amount (PHP)</span>
                  <input
                    name="amount"
                    type="number"
                    min="1"
                    max={booking.remainingMinor / 100}
                    required
                  />
                </label>
                <label>
                  <span>Method</span>
                  <select
                    name="method"
                    value={paymentMethod}
                    onChange={(event) => setPaymentMethod(event.target.value)}
                  >
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank transfer</option>
                    <option value="e_wallet">E-wallet</option>
                  </select>
                </label>
                {paymentMethod !== "cash" ? (
                  <label>
                    <span>Receipt/reference</span>
                    <input
                      name="reference"
                      minLength={3}
                      maxLength={80}
                      required
                    />
                  </label>
                ) : null}
                <button disabled={paying || booking.remainingMinor === 0}>
                  {booking.remainingMinor === 0
                    ? "Fully paid"
                    : paying
                      ? "Recording…"
                      : "Record payment"}
                </button>
              </form>
              <div className={styles.ledgerList}>
                {booking.payments.length ? (
                  booking.payments.map((payment) => (
                    <article key={payment.id} data-status={payment.status}>
                      <div>
                        <span>
                          {payment.category.replaceAll("_", " ")} ·{" "}
                          {payment.method.replaceAll("_", " ")}
                        </span>
                        <strong>
                          {money.format(payment.amountMinor / 100)}
                        </strong>
                        <small>{payment.reference}</small>
                      </div>
                      {payment.status === "recorded" ? (
                        <form action={reverseAction}>
                          <input
                            type="hidden"
                            name="paymentId"
                            value={payment.id}
                          />
                          <input
                            name="reason"
                            minLength={5}
                            maxLength={240}
                            placeholder="Reason for reversal"
                            required
                          />
                          <button disabled={reversing}>Reverse</button>
                        </form>
                      ) : (
                        <span>Reversed</span>
                      )}
                    </article>
                  ))
                ) : (
                  <p>No payment entries yet.</p>
                )}
              </div>
            </section>
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}
export function BookingOperations({ bookings }: { bookings: OpsBooking[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("active");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId
    ? (bookings.find((item) => item.id === selectedId) ?? null)
    : null;
  const filtered = useMemo(
    () =>
      bookings.filter((item) => {
        const matchesQuery =
          !query ||
          [item.reference, item.fullName, item.phone, item.email].some(
            (value) => value?.toLowerCase().includes(query.toLowerCase()),
          );
        const matchesFilter =
          filter === "all" ||
          (filter === "active" &&
            !["cancelled", "declined"].includes(item.bookingStatus)) ||
          (filter === "balance_due" && item.remainingMinor > 0) ||
          item.stayStatus === filter;
        return matchesQuery && matchesFilter;
      }),
    [bookings, query, filter],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = filtered.slice(
    (current - 1) * PAGE_SIZE,
    current * PAGE_SIZE,
  );
  return (
    <section className={`${styles.panel} ${styles.operationsPanel}`}>
      <div className={styles.panelHeading}>
        <div>
          <p className={styles.eyebrow}>Booking workspace</p>
          <h2>Stay and payment operations</h2>
          <p>
            Choose a booking card to review its payment ledger and record a
            remaining balance.
          </p>
        </div>
        <span className={styles.countBadge}>{filtered.length} shown</span>
      </div>
      <div className={styles.operationsToolbar}>
        <label>
          <span>Search</span>
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Reference, guest, phone, or email"
          />
        </label>
        <label>
          <span>View</span>
          <select
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="active">Active bookings</option>
            <option value="balance_due">Balance due</option>
            <option value="upcoming">Upcoming</option>
            <option value="checked_in">Checked in</option>
            <option value="checked_out">Completed</option>
            <option value="no_show">No-show</option>
            <option value="all">All records</option>
          </select>
        </label>
      </div>
      {visible.length ? (
        <>
          <div className={styles.operationsCardGrid}>
            {visible.map((booking) => (
              <article
                key={booking.id}
                className={styles.operationsBookingCard}
              >
                <header>
                  <div>
                    <span>{booking.reference}</span>
                    <strong>{booking.fullName}</strong>
                  </div>
                  <b data-status={booking.stayStatus}>
                    {booking.stayStatus.replaceAll("_", " ")}
                  </b>
                </header>
                <p>
                  {formatStayRange(booking.checkIn, booking.checkOut)} ·{" "}
                  {booking.guestCount} guest
                  {booking.guestCount === 1 ? "" : "s"}
                </p>
                <dl>
                  <div>
                    <dt>Total</dt>
                    <dd>{money.format(booking.totalMinor / 100)}</dd>
                  </div>
                  <div>
                    <dt>Paid</dt>
                    <dd>{money.format(booking.paidMinor / 100)}</dd>
                  </div>
                  <div data-due={booking.remainingMinor > 0}>
                    <dt>Balance</dt>
                    <dd>{money.format(booking.remainingMinor / 100)}</dd>
                  </div>
                </dl>
                <button type="button" onClick={() => setSelectedId(booking.id)}>
                  Manage booking
                </button>
              </article>
            ))}
          </div>
          {pages > 1 ? (
            <nav
              className={styles.pagination}
              aria-label="Operations booking pages"
            >
              <button
                type="button"
                disabled={current === 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                Previous
              </button>
              <span>
                Page {current} of {pages}
              </span>
              <button
                type="button"
                disabled={current === pages}
                onClick={() => setPage((value) => Math.min(pages, value + 1))}
              >
                Next
              </button>
            </nav>
          ) : null}
        </>
      ) : (
        <div className={styles.emptyState}>
          <span aria-hidden="true">⌁</span>
          <h3>No matching bookings</h3>
          <p>Try another search or filter.</p>
        </div>
      )}
      {selected ? (
        <BookingModal booking={selected} onClose={() => setSelectedId(null)} />
      ) : null}
    </section>
  );
}
export function DateBlocks({ blocks }: { blocks: DateBlock[] }) {
  const [state, action, pending] = useActionState(manageDateBlock, initial);
  const [activePage, setActivePage] = useState(1);
  const [releasedPage, setReleasedPage] = useState(1);
  useActionNotice(state);
  const activeBlocks = useMemo(
    () => blocks.filter((block) => block.status === "active"),
    [blocks],
  );
  const releasedBlocks = useMemo(
    () => blocks.filter((block) => block.status !== "active"),
    [blocks],
  );
  const activePages = Math.max(
    1,
    Math.ceil(activeBlocks.length / DATE_BLOCK_PAGE_SIZE),
  );
  const releasedPages = Math.max(
    1,
    Math.ceil(releasedBlocks.length / DATE_BLOCK_PAGE_SIZE),
  );
  const currentActivePage = Math.min(activePage, activePages);
  const currentReleasedPage = Math.min(releasedPage, releasedPages);
  const visibleActiveBlocks = activeBlocks.slice(
    (currentActivePage - 1) * DATE_BLOCK_PAGE_SIZE,
    currentActivePage * DATE_BLOCK_PAGE_SIZE,
  );
  const visibleReleasedBlocks = releasedBlocks.slice(
    (currentReleasedPage - 1) * DATE_BLOCK_PAGE_SIZE,
    currentReleasedPage * DATE_BLOCK_PAGE_SIZE,
  );
  const renderPagination = (
    currentPage: number,
    pages: number,
    setPage: Dispatch<SetStateAction<number>>,
    label: string,
  ) =>
    pages > 1 ? (
      <nav className={styles.pagination} aria-label={`${label} pages`}>
        <button
          type="button"
          disabled={currentPage === 1}
          onClick={() => setPage((page) => Math.max(1, page - 1))}
        >
          Previous
        </button>
        <span>
          Page {currentPage} of {pages}
        </span>
        <button
          type="button"
          disabled={currentPage === pages}
          onClick={() => setPage((page) => Math.min(pages, page + 1))}
        >
          Next
        </button>
      </nav>
    ) : null;
  const renderBlock = (block: DateBlock, canRelease: boolean) => (
    <article key={block.id}>
      <div>
        <strong>{formatStayRange(block.checkIn, block.checkOut)}</strong>
        <span>
          {block.reason} · {block.status}
        </span>
      </div>
      {canRelease ? (
        <form action={action}>
          <input type="hidden" name="blockId" value={block.id} />
          <input type="hidden" name="release" value="true" />
          <button disabled={pending}>Release</button>
        </form>
      ) : null}
    </article>
  );
  return (
    <section className={`${styles.panel} ${styles.operationsSidePanel}`}>
      <div className={styles.panelHeading}>
        <div>
          <p className={styles.eyebrow}>Availability</p>
          <h2>Date blocks</h2>
          <p>
            Prevent booking during maintenance or owner-use dates. The reopening
            date remains available.
          </p>
          <p>
            There is no date-count limit. “Block from” includes the arrival
            date; “Reopen on” is exclusive, so the unit becomes available that
            morning. Existing bookings still cannot be blocked.
          </p>
        </div>
      </div>
      <form action={action} className={styles.operationsBlockForm}>
        <div>
          <label>
            <span>Block from</span>
            <input name="checkIn" type="date" required />
          </label>
          <label>
            <span>Reopen on</span>
            <input name="checkOut" type="date" required />
          </label>
        </div>
        <label>
          <span>Reason</span>
          <input
            name="reason"
            minLength={3}
            maxLength={240}
            placeholder="Maintenance, owner use…"
            required
          />
        </label>
        <button disabled={pending}>
          {pending ? "Saving…" : "Block dates"}
        </button>
      </form>
      <section className={styles.operationsBlockSection} aria-labelledby="active-date-blocks">
        <div className={styles.operationsListHeading}>
          <h3 id="active-date-blocks">Active blocks</h3>
          <span>{activeBlocks.length}</span>
        </div>
        <div className={styles.operationsList}>
          {visibleActiveBlocks.length ? (
            visibleActiveBlocks.map((block) => renderBlock(block, true))
          ) : (
            <p>No active date blocks.</p>
          )}
        </div>
        {renderPagination(
          currentActivePage,
          activePages,
          setActivePage,
          "Active date block",
        )}
      </section>
      {releasedBlocks.length ? (
        <details className={styles.operationsHistory}>
          <summary>
            <span>Released history</span>
            <b>{releasedBlocks.length}</b>
          </summary>
          <div className={styles.operationsHistoryBody}>
            <div className={styles.operationsList}>
              {visibleReleasedBlocks.map((block) => renderBlock(block, false))}
            </div>
            {renderPagination(
              currentReleasedPage,
              releasedPages,
              setReleasedPage,
              "Released date block",
            )}
          </div>
        </details>
      ) : null}
    </section>
  );
}
export function NotificationQueue({
  notifications,
}: {
  notifications: OpsNotification[];
}) {
  return (
    <section className={`${styles.panel} ${styles.operationsSidePanel}`}>
      <div className={styles.panelHeading}>
        <div>
          <p className={styles.eyebrow}>Guest follow-up</p>
          <h2>Notification audit</h2>
          <p>Updates queued after booking and payment changes.</p>
        </div>
      </div>
      <div className={styles.operationsList}>
        {notifications.length ? (
          notifications.slice(0, 8).map((item) => (
            <article key={item.id}>
              <div>
                <strong>{item.type.replaceAll("_", " ")}</strong>
                <span>
                  {item.channel} · {item.recipient}
                </span>
              </div>
              <b data-status={item.status}>{item.status}</b>
            </article>
          ))
        ) : (
          <p>No notification events yet.</p>
        )}
      </div>
    </section>
  );
}
