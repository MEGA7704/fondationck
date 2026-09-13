-- V2.16 : lieu de vote des responsables.
ALTER TABLE responsibles ADD COLUMN voting_place TEXT DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_responsibles_locality_function ON responsibles(organization_id, locality, function_title);
