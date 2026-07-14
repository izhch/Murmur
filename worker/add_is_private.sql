-- 为现有 moments 表添加 is_private 字段
-- 在 D1 控制台或 wrangler d1 execute 中执行

ALTER TABLE moments ADD COLUMN is_private INTEGER DEFAULT 0;
