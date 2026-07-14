#!/usr/bin/env node
/**
 * 数据迁移脚本：将 src/content/*.md 迁移到 D1 数据库
 *
 * 读取 Markdown 文件，解析 frontmatter 和正文，生成 SQL INSERT 语句，
 * 输出到 worker/migration.sql 文件。
 *
 * 用法：
 *   node scripts/migrate-to-d1.mjs
 *
 * 之后执行：
 *   cd worker
 *   wrangler d1 execute moments-db --remote --file=schema.sql
 *   wrangler d1 execute moments-db --remote --file=migration.sql
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 项目根目录（scripts 目录的上一级）
const projectRoot = path.resolve(__dirname, '..');
const contentDir = path.join(projectRoot, 'src', 'content');
const outputPath = path.join(projectRoot, 'worker', 'migration.sql');

// 合法的 type 值
const VALID_TYPES = ['text', 'images', 'music', 'video'];

// ========== 工具函数 ==========

// SQL 字符串转义：单引号 → 两个单引号
function sqlEscape(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/'/g, "''");
}

// 去除字符串首尾的引号（单引号或双引号）
function stripQuotes(str) {
  if (typeof str !== 'string') return str;
  const trimmed = str.trim();
  if (trimmed.length >= 2 &&
      ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
       (trimmed.startsWith("'") && trimmed.endsWith("'")))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

// 解析 YAML 标量值（布尔 / 数字 / 字符串）
function parseValue(value) {
  const v = value.trim();
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v === 'null' || v === '~') return '';
  if (/^-?\d+$/.test(v)) return parseInt(v, 10);
  if (/^-?\d+\.\d+$/.test(v)) return parseFloat(v);
  return stripQuotes(v);
}

// 解析 frontmatter（简单 YAML 解析，支持 key-value 和数组）
function parseFrontmatter(content) {
  const result = {};
  const lines = content.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // 跳过空行和注释
    if (!line.trim() || line.trim().startsWith('#')) {
      i++;
      continue;
    }
    // 匹配 key: value 或 key:
    const match = line.match(/^([\w-]+)\s*:\s*(.*)$/);
    if (!match) {
      i++;
      continue;
    }
    const key = match[1];
    const value = match[2].trim();
    if (value === '') {
      // 可能是数组，检查后续缩进的 - 行
      const arr = [];
      let j = i + 1;
      while (j < lines.length) {
        const arrLine = lines[j];
        // 数组项：以 - 开头，前面有空格缩进
        const arrMatch = arrLine.match(/^\s+-\s+(.*)$/);
        if (!arrMatch) break;
        arr.push(stripQuotes(arrMatch[1]));
        j++;
      }
      if (arr.length > 0) {
        result[key] = arr;
        i = j;
      } else {
        result[key] = '';
        i++;
      }
    } else {
      result[key] = parseValue(value);
      i++;
    }
  }
  return result;
}

// 从文件内容中提取 frontmatter 和正文
function extractParts(fileContent) {
  // 去除 UTF-8 BOM，统一换行符为 \n（兼容 CRLF）
  const normalized = fileContent.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  // 检查是否以 --- 开头
  if (!normalized.startsWith('---')) {
    return { frontmatter: null, body: normalized };
  }
  // 找到第二个 ---
  const lines = normalized.split('\n');
  let endLine = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      endLine = i;
      break;
    }
  }
  if (endLine === -1) {
    return { frontmatter: null, body: normalized };
  }
  const frontmatterStr = lines.slice(1, endLine).join('\n');
  const body = lines.slice(endLine + 1).join('\n').trim();
  return { frontmatter: frontmatterStr, body };
}

// 简单 Markdown 转 HTML（与 Worker 中的 mdToHtml 函数一致）
function mdToHtml(text) {
  if (!text) return '';
  // 1. HTML 转义（先转义 & < >）
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  // 2. 按空行分割段落
  const paragraphs = html.split(/\n\n+/);
  // 3. 处理每段内的行内格式
  html = paragraphs.map(para => {
    let p = para;
    // 粗体 **text** → <strong>text</strong>
    p = p.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // 斜体 *text* → <em>text</em>
    p = p.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // 链接 [text](url) → <a href="url" target="_blank">text</a>
    p = p.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank">$1</a>');
    // 行内代码 `code` → <code>code</code>
    p = p.replace(/`(.+?)`/g, '<code>$1</code>');
    // 单个换行 → <br>
    p = p.replace(/\n/g, '<br>');
    return `<p>${p}</p>`;
  }).join('\n');
  return html;
}

// 格式化日期为 YYYY-MM-DD
function formatDate(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ========== 主流程 ==========

// 读取 src/content 下所有 .md 文件
const mdFiles = fs.readdirSync(contentDir)
  .filter(f => f.endsWith('.md'))
  .sort();

let processedCount = 0;
let skippedDraftCount = 0;
let skippedInvalidCount = 0;
const sqlLines = [];

// SQL 文件头部注释
sqlLines.push('-- 数据迁移脚本自动生成');
sqlLines.push(`-- 生成时间：${new Date().toISOString()}`);
sqlLines.push('-- 源目录：src/content/*.md');
sqlLines.push('-- 目标表：moments（D1 数据库 moments-db）');
sqlLines.push('-- 说明：将 Markdown 内容迁移到 D1 moments 表');
sqlLines.push('');
sqlLines.push('-- D1 不支持 BEGIN/COMMIT 事务语句，直接执行 INSERT');
sqlLines.push('');

for (const fileName of mdFiles) {
  const filePath = path.join(contentDir, fileName);
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const { frontmatter, body } = extractParts(fileContent);

  // 没有 frontmatter 的文件跳过
  if (!frontmatter) {
    skippedInvalidCount++;
    console.warn(`[跳过] ${fileName}：没有 frontmatter`);
    continue;
  }

  const data = parseFrontmatter(frontmatter);

  // 草稿跳过
  if (data.draft === true) {
    skippedDraftCount++;
    continue;
  }

  // type 字段必须存在且合法
  if (!data.type || !VALID_TYPES.includes(data.type)) {
    skippedInvalidCount++;
    console.warn(`[跳过] ${fileName}：type 字段缺失或无效（${data.type}）`);
    continue;
  }

  // date 字段必须存在
  if (!data.date) {
    skippedInvalidCount++;
    console.warn(`[跳过] ${fileName}：缺少 date 字段`);
    continue;
  }

  // id = 文件名去掉 .md 后缀
  const id = fileName.replace(/\.md$/, '');

  // created_at = date 字段，格式化为 YYYY-MM-DD
  const createdAt = formatDate(String(data.date));

  // sort_order = new Date(date).getTime()（时间戳，用于排序）
  const sortOrder = new Date(String(data.date)).getTime();
  if (isNaN(sortOrder)) {
    skippedInvalidCount++;
    console.warn(`[跳过] ${fileName}：date 字段无法解析（${data.date}）`);
    continue;
  }

  // content = Markdown 正文（frontmatter 之后的内容，已 trim 首尾空白）
  const content = body || '';
  // content_html = 简单 Markdown 转 HTML
  const contentHtml = mdToHtml(content);

  // images 字段：有数组则 JSON.stringify，否则 '[]'
  const images = (Array.isArray(data.images) && data.images.length > 0)
    ? JSON.stringify(data.images)
    : '[]';

  // collapse 字段：frontmatter 有 collapse: true 则为 1，否则 0
  const collapse = data.collapse === true ? 1 : 0;

  // 其他字段
  const title = data.title ? String(data.title) : '';
  const type = String(data.type);
  const location = data.location ? String(data.location) : '';
  const passwordHash = data.password_hash ? String(data.password_hash) : '';
  const musicTitle = data.music_title ? String(data.music_title) : '';
  const musicArtist = data.music_artist ? String(data.music_artist) : '';
  const musicCover = data.music_cover ? String(data.music_cover) : '';
  const musicSrc = data.music_src ? String(data.music_src) : '';
  const videoSrc = data.video_src ? String(data.video_src) : '';
  const videoDuration = data.video_duration ? String(data.video_duration) : '';

  // 构建 INSERT 语句
  const sql = `INSERT INTO moments (id, title, type, content, content_html, location, created_at, password_hash, collapse, images, music_title, music_artist, music_cover, music_src, video_src, video_duration, sort_order, is_deleted) VALUES ('${sqlEscape(id)}', '${sqlEscape(title)}', '${sqlEscape(type)}', '${sqlEscape(content)}', '${sqlEscape(contentHtml)}', '${sqlEscape(location)}', '${sqlEscape(createdAt)}', '${sqlEscape(passwordHash)}', ${collapse}, '${sqlEscape(images)}', '${sqlEscape(musicTitle)}', '${sqlEscape(musicArtist)}', '${sqlEscape(musicCover)}', '${sqlEscape(musicSrc)}', '${sqlEscape(videoSrc)}', '${sqlEscape(videoDuration)}', ${sortOrder}, 0);`;

  sqlLines.push(sql);
  processedCount++;
}

sqlLines.push('');
sqlLines.push('-- 迁移完成');

// 写入 worker/migration.sql
const sqlContent = sqlLines.join('\n');
fs.writeFileSync(outputPath, sqlContent, 'utf-8');

console.log('========== 数据迁移完成 ==========');
console.log(`处理成功：${processedCount} 个文件`);
console.log(`跳过草稿：${skippedDraftCount} 个`);
console.log(`跳过无效：${skippedInvalidCount} 个`);
console.log(`输出文件：${outputPath}`);
