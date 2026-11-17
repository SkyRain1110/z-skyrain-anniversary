-- 留言板 D1 建表语句
-- 用法：npx wrangler d1 execute zsky-messages --remote --file=./schema.sql
-- 本地预览时可去掉 --remote 来初始化本地 D1（配合 wrangler pages dev）。

CREATE TABLE IF NOT EXISTS messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  content    TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_id_desc ON messages (id DESC);
