PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  full_name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('superadmin','admin','member')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled')),
  plan TEXT NOT NULL DEFAULT 'free' CHECK(plan IN ('free','standard','business')),
  plan_started_at TEXT NOT NULL,
  plan_expires_at TEXT NOT NULL,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  access_json TEXT NOT NULL DEFAULT '{}',
  session_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Les secrets d'authentification sont isolés des données générales des utilisateurs.
CREATE TABLE IF NOT EXISTS credentials (
  user_id TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sectors (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  locality TEXT DEFAULT '',
  village TEXT DEFAULT '',
  description TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS responsibles (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  sector_id TEXT,
  full_name TEXT NOT NULL,
  function_title TEXT DEFAULT 'Responsable de secteur',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  locality TEXT DEFAULT '',
  village TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (sector_id) REFERENCES sectors(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS girls (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  sector_id TEXT,
  full_name TEXT NOT NULL,
  birth_date TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  locality TEXT DEFAULT '',
  occupation TEXT DEFAULT '',
  status_label TEXT DEFAULT 'Active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (sector_id) REFERENCES sectors(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS boys (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  sector_id TEXT,
  full_name TEXT NOT NULL,
  birth_date TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  locality TEXT DEFAULT '',
  occupation TEXT DEFAULT '',
  status_label TEXT DEFAULT 'Actif',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (sector_id) REFERENCES sectors(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS news (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT DEFAULT '',
  content TEXT NOT NULL,
  image_key TEXT DEFAULT '',
  published INTEGER NOT NULL DEFAULT 1,
  published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS site_content (
  organization_id TEXT PRIMARY KEY,
  presentation TEXT NOT NULL DEFAULT '',
  mission TEXT NOT NULL DEFAULT '',
  vision TEXT NOT NULL DEFAULT '',
  perspectives TEXT NOT NULL DEFAULT '',
  contact_phone TEXT DEFAULT '',
  whatsapp TEXT DEFAULT '',
  contact_email TEXT DEFAULT '',
  address TEXT DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS password_reset_requests (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  user_id TEXT,
  email TEXT NOT NULL,
  target_role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','resolved','rejected')),
  requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT,
  resolved_by TEXT,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  subject TEXT DEFAULT '',
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id TEXT,
  actor_user_id TEXT,
  actor_role TEXT,
  action TEXT NOT NULL,
  target_type TEXT DEFAULT '',
  target_id TEXT DEFAULT '',
  ip_address TEXT DEFAULT '',
  details_json TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_sectors_org ON sectors(organization_id);
CREATE INDEX IF NOT EXISTS idx_responsibles_org ON responsibles(organization_id);
CREATE INDEX IF NOT EXISTS idx_girls_org ON girls(organization_id);
CREATE INDEX IF NOT EXISTS idx_boys_org ON boys(organization_id);
CREATE INDEX IF NOT EXISTS idx_news_org_pub ON news(organization_id, published, published_at);
CREATE INDEX IF NOT EXISTS idx_reset_status ON password_reset_requests(status, target_role);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);

INSERT OR IGNORE INTO organizations (id, name, slug, status)
VALUES ('org_fondation_ck', 'LA FONDATION CK', 'la-fondation-ck', 'active');

INSERT OR IGNORE INTO site_content (
  organization_id, presentation, mission, vision, perspectives,
  contact_phone, whatsapp, contact_email, address
) VALUES (
  'org_fondation_ck',
  'LA FONDATION CK agit au service de la solidarité, de la cohésion sociale et du développement humain, avec une attention particulière portée aux jeunes filles, aux jeunes garçons et aux communautés locales.',
  'Créer des actions utiles, inclusives et durables qui renforcent l’autonomie, la dignité et la participation citoyenne des bénéficiaires.',
  'Construire une communauté solidaire dans laquelle chaque jeune peut accéder à des opportunités, être accompagné et contribuer au développement de son milieu.',
  'Étendre progressivement les secteurs d’intervention, structurer les responsables locaux, renforcer la formation, l’accompagnement social et les partenariats de proximité.',
  '0757577542 / 0545202646', '', 'oukami011@gmail.com', 'Côte d’Ivoire'
);


-- Migration de sécurité complémentaire.
-- Les nouveaux déploiements stockent exclusivement les empreintes de mot de passe dans `credentials`.
-- Le Worker contient aussi une migration défensive qui détecte une ancienne colonne `users.password_hash`,
-- copie les empreintes dans `credentials`, puis efface la valeur de la colonne héritée.

CREATE INDEX IF NOT EXISTS idx_credentials_user ON credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_org_created ON contact_messages(organization_id, created_at DESC);
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS associations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  sector_id TEXT,
  name TEXT NOT NULL,
  responsible_name TEXT DEFAULT '',
  acronym TEXT DEFAULT '',
  activity_area TEXT DEFAULT '',
  creation_date TEXT DEFAULT '',
  registration_number TEXT DEFAULT '',
  headquarters TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  locality TEXT DEFAULT '',
  village TEXT DEFAULT '',
  description TEXT DEFAULT '',
  status_label TEXT DEFAULT 'Active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (sector_id) REFERENCES sectors(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS association_members (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  association_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  gender TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  locality TEXT DEFAULT '',
  village TEXT DEFAULT '',
  occupation TEXT DEFAULT '',
  joined_at TEXT DEFAULT '',
  status_label TEXT DEFAULT 'Actif',
  is_primary_responsible INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (association_id) REFERENCES associations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS association_responsibles (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  association_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  function_title TEXT DEFAULT 'Responsable',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  locality TEXT DEFAULT '',
  village TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (association_id) REFERENCES associations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_associations_org ON associations(organization_id);
CREATE INDEX IF NOT EXISTS idx_assoc_members_org_assoc ON association_members(organization_id, association_id);
CREATE INDEX IF NOT EXISTS idx_assoc_members_primary ON association_members(organization_id, association_id, is_primary_responsible DESC);
CREATE INDEX IF NOT EXISTS idx_assoc_resp_org_assoc ON association_responsibles(organization_id, association_id);
