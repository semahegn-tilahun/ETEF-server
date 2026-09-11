CREATE TABLE IF NOT EXISTS site_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_key VARCHAR(100) NOT NULL UNIQUE,
  title_en TEXT,
  title_am TEXT,
  body_en TEXT,
  body_am TEXT,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES admin_users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_site_content_published_key
  ON site_content(is_published, content_key);

INSERT INTO site_content (content_key, title_en, title_am, body_en, body_am)
VALUES
('about', 'About ETEF', 'ስለ ETEF',
 'The Ethiopian Transport Employers Federation is a premier apex organization established in accordance with international conventions and local laws, dedicated to safeguarding the rights and benefits of its members within the transportation sector.',
 'የኢትዮጵያ ትራንስፖርት አሰሪዎች ፌዴሬሽን በዓለም አቀፍ ስምምነቶችና በአገር ውስጥ ሕጎች መሠረት የተቋቋመ ከፍተኛ የዘርፉ ድርጅት ሲሆን በትራንስፖርት ዘርፍ የአባላቱን መብትና ጥቅም ለመጠበቅ ይሰራል.'),
('vision', 'Vision', 'ራዕይ',
 'Seeing strong and representing voice in Ethiopian transport industry.',
 'በኢትዮጵያ የትራንስፖርት ኢንዱስትሪ ጠንካራ እና ተወካይ ድምፅ ማየት።'),
('mission', 'Mission', 'ተልዕኮ',
 'ETEF will work to safeguard the Economical, legal, social and other rights and benefits of its members and supporting the performance of its members by delivering different trainings, education and legal support using current technologies and working with its local, international and social partners towards Industrial peace.',
 'ETEF የአባላቱን ኢኮኖሚያዊ፣ ሕጋዊ፣ ማህበራዊና ሌሎች መብቶችና ጥቅሞች ለመጠበቅ እና በሥልጠና፣ ትምህርት፣ የሕግ ድጋፍ፣ ዘመናዊ ቴክኖሎጂና ከአገር ውስጥ፣ ከዓለም አቀፍ እና ከማህበራዊ አጋሮች ጋር በመስራት የኢንዱስትሪ ሰላምን ለማስፈን ይሰራል.')
ON CONFLICT (content_key) DO NOTHING;
