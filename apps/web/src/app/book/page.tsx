import { redirect } from "next/navigation";

// Keep old /book links working while the calendar owns the booking flow.
export default function BookingPage() {
  redirect("/#availability");
}
