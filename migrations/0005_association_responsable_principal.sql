PRAGMA foreign_keys = ON;

-- V2.7 : le responsable principal est porté directement par l'association.
-- La liste séparée des responsables d'association n'est plus utilisée par l'application.
ALTER TABLE associations ADD COLUMN responsible_name TEXT DEFAULT '';
ALTER TABLE association_members ADD COLUMN is_primary_responsible INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_assoc_members_primary
ON association_members(organization_id, association_id, is_primary_responsible DESC);
