import { pgTable, serial, text, real, timestamp } from "drizzle-orm/pg-core";

export const transactions = pgTable("transactions", {
  id: serial().primaryKey(),
  type: text().notNull(),
  amount: real().notNull(),
  category: text().notNull(),
  description: text(),
  date: text().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
