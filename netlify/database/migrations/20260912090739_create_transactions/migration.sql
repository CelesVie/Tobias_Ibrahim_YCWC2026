CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY,
	"type" text NOT NULL,
	"amount" real NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"date" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
