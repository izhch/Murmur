CREATE TABLE IF NOT EXISTS moments (
  id TEXT PRIMARY KEY,
  title TEXT DEFAULT '',
  type TEXT NOT NULL DEFAULT 'text',
  content TEXT DEFAULT '',
  content_html TEXT DEFAULT '',
  location TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  password_hash TEXT DEFAULT '',
  collapse INTEGER DEFAULT 0,
  images TEXT DEFAULT '[]',
  music_title TEXT DEFAULT '',
  music_artist TEXT DEFAULT '',
  music_cover TEXT DEFAULT '',
  music_src TEXT DEFAULT '',
  video_src TEXT DEFAULT '',
  video_duration TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  is_deleted INTEGER DEFAULT 0,
  is_private INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_moments_sort ON moments(sort_order DESC);
CREATE INDEX IF NOT EXISTS idx_moments_created ON moments(created_at DESC);
