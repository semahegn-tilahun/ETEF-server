CREATE TABLE IF NOT EXISTS news_posts (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 title_en VARCHAR(255) NOT NULL, title_am VARCHAR(255),
 excerpt_en TEXT, excerpt_am TEXT, body_en TEXT, body_am TEXT,
 image_url TEXT, is_published BOOLEAN NOT NULL DEFAULT FALSE,
 published_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_by UUID REFERENCES admin_users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_news_posts_public ON news_posts(is_published, published_at DESC);
