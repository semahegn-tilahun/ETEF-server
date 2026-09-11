CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'ADMIN',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS membership_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_name VARCHAR(255) NOT NULL,
  organization_type VARCHAR(100),
  transport_sector VARCHAR(100),
  region VARCHAR(120),
  city VARCHAR(120),
  sub_city VARCHAR(120),
  woreda VARCHAR(120),
  office_address TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  member_count INTEGER,
  vehicle_count INTEGER,
  general_manager_name VARCHAR(180),
  general_manager_phone VARCHAR(50),
  general_manager_email VARCHAR(255),
  federation_representative_name VARCHAR(180),
  federation_representative_phone VARCHAR(50),
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES admin_users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_en TEXT NOT NULL,
  answer_en TEXT NOT NULL,
  question_am TEXT,
  answer_am TEXT,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gallery_albums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_en VARCHAR(255) NOT NULL,
  title_am VARCHAR(255),
  description_en TEXT,
  description_am TEXT,
  cover_image_url TEXT,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  event_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gallery_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id UUID NOT NULL REFERENCES gallery_albums(id) ON DELETE CASCADE,
  title_en VARCHAR(255),
  title_am VARCHAR(255),
  image_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_vacancies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_en VARCHAR(255) NOT NULL,
  title_am VARCHAR(255),
  description_en TEXT,
  description_am TEXT,
  requirements_en TEXT,
  requirements_am TEXT,
  location VARCHAR(255),
  employment_type VARCHAR(100),
  closing_date DATE,
  status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_membership_status ON membership_applications(status);
CREATE INDEX IF NOT EXISTS idx_membership_submitted_at ON membership_applications(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_faq_published_order ON faqs(is_published, sort_order);
CREATE INDEX IF NOT EXISTS idx_gallery_published_date ON gallery_albums(is_published, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_gallery_items_album ON gallery_items(album_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_vacancies_status_date ON job_vacancies(status, closing_date);

INSERT INTO site_settings (setting_key, setting_value)
VALUES
  ('organization_email', ''),
  ('facebook_url', ''),
  ('telegram_url', ''),
  ('linkedin_url', ''),
  ('youtube_url', '')
ON CONFLICT (setting_key) DO NOTHING;


CREATE TABLE IF NOT EXISTS admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  csrf_token CHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_token_hash ON admin_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON admin_sessions(expires_at);
