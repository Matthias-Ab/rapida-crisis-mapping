-- ============================================================
-- RAPIDA Crisis Mapping — PostgreSQL / PostGIS schema
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Core reports table
-- ============================================================
CREATE TABLE reports (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Geo
    coordinates     GEOMETRY(POINT, 4326) NOT NULL,
    latitude        DOUBLE PRECISION NOT NULL,
    longitude       DOUBLE PRECISION NOT NULL,
    building_id     TEXT,
    location_text   TEXT,
    what3words      TEXT,

    -- Media
    photo_url       TEXT NOT NULL,
    photo_key       TEXT NOT NULL,
    thumbnail_url   TEXT,

    -- Damage assessment
    damage_level    TEXT NOT NULL CHECK (damage_level IN ('none', 'partial', 'complete')),
    ai_damage_level TEXT,
    ai_confidence   FLOAT,

    -- Infrastructure
    infra_type      TEXT NOT NULL CHECK (infra_type IN (
                        'residential',
                        'commercial',
                        'government',
                        'utility',
                        'transport_communication',
                        'community',
                        'public_recreation',
                        'other'
                    )),
    infra_name      TEXT,

    -- Crisis context
    crisis_type     TEXT NOT NULL CHECK (crisis_type IN (
                        'earthquake',
                        'flood',
                        'tsunami',
                        'hurricane_cyclone',
                        'wildfire',
                        'explosion',
                        'chemical_incident',
                        'conflict',
                        'civil_unrest'
                    )),
    description     TEXT,
    debris_present          BOOLEAN,
    electricity_status      TEXT,
    health_services_status  TEXT,
    pressing_needs          TEXT[],

    -- Session / audit
    session_id      TEXT NOT NULL,
    ip_hash         TEXT,
    language        TEXT DEFAULT 'en',

    -- Moderation
    is_flagged          BOOLEAN DEFAULT FALSE,
    is_verified         BOOLEAN DEFAULT FALSE,
    duplicate_of        UUID REFERENCES reports(id),
    confirmation_count  INTEGER DEFAULT 0  -- crowd-sourced confirmations from other reporters
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX reports_coords_idx       ON reports USING GIST(coordinates);
CREATE INDEX reports_created_at_idx   ON reports(created_at DESC);
CREATE INDEX reports_damage_level_idx ON reports(damage_level);
CREATE INDEX reports_building_id_idx  ON reports(building_id);
CREATE INDEX reports_session_id_idx   ON reports(session_id);
CREATE INDEX reports_crisis_type_idx  ON reports(crisis_type);
CREATE INDEX reports_infra_type_idx   ON reports(infra_type);
CREATE INDEX reports_is_verified_idx  ON reports(is_verified);

-- ============================================================
-- Materialized view: per-building damage summary
-- ============================================================
CREATE MATERIALIZED VIEW building_damage_summary AS
SELECT
    building_id,
    COUNT(*)                                                        AS report_count,
    MAX(created_at)                                                 AS last_reported_at,
    (
        SELECT damage_level
        FROM   reports r2
        WHERE  r2.building_id = r.building_id
        ORDER  BY created_at DESC
        LIMIT  1
    )                                                               AS current_damage_level,
    AVG(latitude)                                                   AS avg_lat,
    AVG(longitude)                                                  AS avg_lng
FROM  reports r
WHERE building_id IS NOT NULL
GROUP BY building_id;

CREATE UNIQUE INDEX ON building_damage_summary(building_id);

-- ============================================================
-- updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_reports_updated_at
    BEFORE UPDATE ON reports
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Added post-initial migration: analyst workflow + multi-photo support
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS analyst_notes    TEXT,
  ADD COLUMN IF NOT EXISTS verified_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS additional_photos TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS reports_is_verified_idx ON reports(is_verified);
CREATE INDEX IF NOT EXISTS reports_is_flagged_idx  ON reports(is_flagged);
