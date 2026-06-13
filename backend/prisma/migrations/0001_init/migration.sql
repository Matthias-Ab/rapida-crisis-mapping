-- CreateTable based on db/init.sql + post-migration columns
-- This is a baseline migration — the actual DB was created via init.sql

-- Prisma reads this file but we mark it as already applied via baseline
-- Run: npx prisma migrate resolve --applied 0001_init

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS "reports" (
    "id"                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "created_at"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "coordinates"          GEOMETRY(POINT, 4326) NOT NULL,
    "latitude"             DOUBLE PRECISION NOT NULL,
    "longitude"            DOUBLE PRECISION NOT NULL,
    "building_id"          TEXT,
    "location_text"        TEXT,
    "what3words"           TEXT,
    "photo_url"            TEXT NOT NULL,
    "photo_key"            TEXT NOT NULL,
    "thumbnail_url"        TEXT,
    "damage_level"         TEXT NOT NULL CHECK (damage_level IN ('none', 'partial', 'complete')),
    "ai_damage_level"      TEXT,
    "ai_confidence"        FLOAT,
    "infra_type"           TEXT NOT NULL,
    "infra_name"           TEXT,
    "crisis_type"          TEXT NOT NULL,
    "description"          TEXT,
    "debris_present"       BOOLEAN,
    "electricity_status"   TEXT,
    "health_services_status" TEXT,
    "pressing_needs"       TEXT[],
    "session_id"           TEXT NOT NULL,
    "ip_hash"              TEXT,
    "language"             TEXT DEFAULT 'en',
    "is_flagged"           BOOLEAN DEFAULT FALSE,
    "is_verified"          BOOLEAN DEFAULT FALSE,
    "duplicate_of"         UUID REFERENCES "reports"("id"),
    "analyst_notes"        TEXT,
    "verified_at"          TIMESTAMPTZ,
    "additional_photos"    TEXT[] DEFAULT '{}'
);
