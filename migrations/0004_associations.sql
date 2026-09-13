PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS associations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  sector_id TEXT,
  name TEXT NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_assoc_resp_org_assoc ON association_responsibles(organization_id, association_id);
