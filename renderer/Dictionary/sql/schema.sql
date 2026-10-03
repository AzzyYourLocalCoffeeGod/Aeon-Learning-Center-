-- ── AEON LEARNING CENTER · DICTIONARY SCHEMA ──
CREATE TABLE IF NOT EXISTS languages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    native_name TEXT NOT NULL,
    direction   TEXT DEFAULT 'ltr',
    family TEXT,
    parent_lang TEXT
);
CREATE TABLE IF NOT EXISTS words (
   id INTEGER PRIMARY KEY AUTOINCREMENT,
   lang_code TEXT NOT NULL,
   word TEXT NOT NULL,
    FOREIGN KEY (lang_code) REFERENCES languages(code)

);
CREATE TABLE IF NOT EXISTS definitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word_id INTEGER NOT NULL,
    part_of_speech TEXT,
    definition TEXT NOT NULL,
    example TEXT,
    FOREIGN KEY (word_id) REFERENCES words(id)
);
CREATE TABLE IF NOT EXISTS etymology (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word_id INTEGER NOT NULL,
    origin_lang TEXT,
    origin_word TEXT,
    notes TEXT,
    FOREIGN KEY (word_id) REFERENCES words(id)
);
-- ── AEON LEARNING CENTER · LANGUAGE SEED DATA ──
INSERT INTO languages
  (code, name, native_name, direction, family, parent_lang)
VALUES
    ('en', 'English', 'English', 'ltr', 'Germanic', NULL),
    ('es', 'Spanish', 'Español', 'ltr', 'Romance', 'la'),
    ('fr', 'French', 'Français', 'ltr', 'Romance', 'la'),
    ('de', 'German', 'Deutsch', 'ltr', 'Germanic', NULL),
    ('pt', 'Portuguese', 'Português', 'ltr', 'Romance', 'la'),
    ('it', 'Italian', 'Italiano', 'ltr', 'Romance', 'la');
