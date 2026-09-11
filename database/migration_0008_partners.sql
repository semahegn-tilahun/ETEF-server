-- Module 08: ETEF partners and sponsors
CREATE TABLE IF NOT EXISTS partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en VARCHAR(255) NOT NULL,
  name_am VARCHAR(255),
  description_en TEXT,
  description_am TEXT,
  category VARCHAR(30) NOT NULL DEFAULT 'PARTNER' CHECK (category IN ('PARTNER','SPONSOR','BOTH')),
  website_url TEXT,
  logo_url TEXT,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES admin_users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_partners_public_order ON partners(is_published, category, sort_order, name_en);
