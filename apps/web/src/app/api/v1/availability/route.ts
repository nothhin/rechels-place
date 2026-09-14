import { createDatabase, findAvailableRoomTypes } from "@uppadar-hollie/db";
import { availabilitySearchSchema, calculateStayTotalMinor, stayNights } from "@uppadar-hollie/shared/booking";
import { parseDatabaseEnvironment } from "../../../../lib/server/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  const url = new URL(request.url);
  const parsed = availabilitySearchSchema.safeParse(Object.fromEntries(url.searchParams));

  if (!parsed.success) {
    return Response.json({
      requestId,
      error: {
        code: "INVALID_AVAILABILITY_SEARCH",
        message: "Check the stay dates and guest count.",
        fields: parsed.error.flatten().fieldErrors,
      },
    }, { status: 400, headers: noStoreHeaders });
  }

  const configuration = parseDatabaseEnvironment();
  if (!configuration.success) {
    return Response.json({
      requestId,
      error: { code: "SERVICE_NOT_CONFIGURED", message: "Live availability is not configured yet." },
    }, { status: 503, headers: noStoreHeaders });
  }

  const database = createDatabase(configuration.data.DATABASE_URL);

  try {
    const nights = stayNights(parsed.data.checkIn, parsed.data.checkOut);
    const roomTypes = await findAvailableRoomTypes(database.db, parsed.data);

    return Response.json({
      requestId,
      data: {
        stay: { ...parsed.data, nights },
        currency: "PHP",
        roomTypes: roomTypes.map((roomType) => ({
          ...roomType,
          stayTotalMinor: calculateStayTotalMinor(roomType.nightlyRateMinor, nights),
        })),
      },
    }, { headers: noStoreHeaders });
  } catch {
    return Response.json({
      requestId,
      error: { code: "AVAILABILITY_UNAVAILABLE", message: "Availability could not be checked. Please try again." },
    }, { status: 503, headers: noStoreHeaders });
  } finally {
    await database.close();
  }
}
