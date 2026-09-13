-- Migration de sécurité complémentaire.
-- Les nouveaux déploiements stockent exclusivement les empreintes de mot de passe dans `credentials`.
-- Le Worker contient aussi une migration défensive qui détecte une ancienne colonne `users.password_hash`,
-- copie les empreintes dans `credentials`, puis efface la valeur de la colonne héritée.

CREATE INDEX IF NOT EXISTS idx_credentials_user ON credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_org_created ON contact_messages(organization_id, created_at DESC);
