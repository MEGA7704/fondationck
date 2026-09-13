-- V2.9 — Secteurs synchronisés, responsable principal et informations électorales.
-- Les nouvelles installations reçoivent les colonnes directement via 0001_schema.sql.
-- Les bases D1 déjà en production sont mises à niveau de façon idempotente par
-- ensureSectorVotingMigration() dans public/_worker.js au premier appel API.
SELECT 1;
