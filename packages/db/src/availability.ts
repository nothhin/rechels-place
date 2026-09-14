import { and, count, eq, gt, inArray, lt, notExists, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

export type AvailabilityQuery = {
  checkIn: string;
  checkOut: string;
  guests: number;
};

export async function findAvailableRoomTypes(
  db: PostgresJsDatabase<typeof schema>,
  query: AvailabilityQuery,
) {
  const inventoryConflict = db
    .select({ roomId: schema.reservations.roomId })
    .from(schema.reservations)
    .where(and(
      eq(schema.reservations.roomId, schema.rooms.id),
      inArray(schema.reservations.status, ["confirmed", "checked_in"]),
      lt(schema.reservations.checkIn, query.checkOut),
      gt(schema.reservations.checkOut, query.checkIn),
    ));

  return db
    .select({
      roomTypeId: schema.roomTypes.id,
      slug: schema.roomTypes.slug,
      name: schema.roomTypes.name,
      shortDescription: schema.roomTypes.shortDescription,
      maxAdults: schema.roomTypes.maxAdults,
      maxChildren: schema.roomTypes.maxChildren,
      bedConfiguration: schema.roomTypes.bedConfiguration,
      roomSizeSqm: schema.roomTypes.roomSizeSqm,
      nightlyRateMinor: schema.roomTypes.baseNightlyRateMinor,
      availableRooms: count(schema.rooms.id),
    })
    .from(schema.roomTypes)
    .innerJoin(schema.rooms, eq(schema.rooms.roomTypeId, schema.roomTypes.id))
    .where(and(
      eq(schema.roomTypes.status, "published"),
      eq(schema.rooms.status, "available"),
      sql`${schema.roomTypes.maxAdults} + ${schema.roomTypes.maxChildren} >= ${query.guests}`,
      notExists(inventoryConflict),
    ))
    .groupBy(schema.roomTypes.id)
    .orderBy(schema.roomTypes.displayOrder, schema.roomTypes.name);
}
