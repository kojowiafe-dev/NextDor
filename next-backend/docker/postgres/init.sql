-- PostgreSQL initialization script
-- Runs once on the very first `docker compose up`.
--
-- DESIGN: Enable extensions here rather than in migrations.
-- Extensions are server-level and need superuser privileges —
-- the Docker postgres user has them; the app user (nextdor) may not.

-- uuid-ossp: provides gen_random_uuid() used as PK default in Prisma schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- pg_trgm: enables trigram-based full-text similarity search
-- Used later for product search: "samung" → "samsung" (fuzzy match)
-- WHAT IF: We only use ILIKE for search? ILIKE can't do fuzzy matching —
-- "laptop" won't find "laptops" or "labtop" (typo). pg_trgm handles these.
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- citext: case-insensitive text type (useful for email columns)
-- With citext, "User@EXAMPLE.com" = "user@example.com" at the DB level,
-- eliminating a class of "duplicate email" bugs caused by case differences.
CREATE EXTENSION IF NOT EXISTS "citext";
