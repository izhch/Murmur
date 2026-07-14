#!/usr/bin/env node
/**
 * 静态站点生成脚本
 *
 * 在 astro build 之后运行，从 Worker API 抓取所有公开文章，
 * 使用 moment-template.js 的模板逻辑生成 HTML 卡片，注入到：
 *   1. dist/index.html 的 #moments-container 容器（替换 loading-indicator）
 *   2. dist/content/{id}/index.html 详情页（每篇公开文章一个）
 *
 * 用法：
 *   node scripts/generate-static.mjs
 *
 * 该脚本由 package.json 的 build 脚本（astro build && node scripts/generate-static.mjs）调用，
 * 也会在 GitHub Actions 工作流中通过 npm run build 触发。
 */

import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');

// 公开文章 API（不需要鉴权）
const API_URL = 'https://murmur.3103231032.workers.dev/api/public-moments';

// ========== 加载 moment-template.js ==========

// moment-template.js 通过 IIFE 将 MomentTemplate 挂到 window 上，
// 在 Node 中用 vm 模块创建带 window 的沙箱执行，复用同一份模板代码，
// 确保静态生成的 HTML 与浏览器动态渲染完全一致。
function loadMomentTemplate() {
  const templatePath = path.join(projectRoot, 'public', 'scripts', 'moment-template.js');
  const templateCode = fs.readFileSync(templatePath, 'utf-8');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(templateCode, sandbox);
  if (typeof sandbox.window.MomentTemplate !== 'function') {
    throw new Error('MomentTemplate 函数加载失败');
  }
  return sandbox.window.MomentTemplate;
}

// ========== 工具函数 ==========

// 替换 #moments-container 容器内部内容
function injectContainer(html, content) {
  // 匹配 <main ... id="moments-container" ...>...</main>，替换内部内容
  return html.replace(
    /(<main[^>]*\bid="moments-container"[^>]*>)[\s\S]*?(<\/main>)/,
    `$1\n${content}\n$2`
  );
}

// 生成详情页上下篇导航 HTML（参考 moments.js _loadDetailPage）
function buildNavHtml(prevId, nextId) {
  if (prevId === null && nextId === null) return '';
  var html = '<footer id="navigation" class="py-[10px]">' +
    '<nav class="ml-[68px] mr-[20px] flex items-center justify-between text-[14px] text-moments-sub dark:text-moments-dark-sub sm:ml-[75px] sm:mr-[25px]">';
  if (prevId) {
    html += '<a href="/content/' + encodeURIComponent(prevId) + '" class="cursor-pointer hover:opacity-70">上一页</a>';
  } else {
    html += '<span></span>';
  }
  if (nextId) {
    html += '<a href="/content/' + encodeURIComponent(nextId) + '" class="cursor-pointer hover:opacity-70">下一页</a>';
  } else {
    html += '<span></span>';
  }
  html += '</nav></footer>';
  return html;
}

// 降级方案：Node.js fetch 失败时用 PowerShell 获取数据（Windows 环境兼容）
// 使用 Base64 编码避免编码问题
function fetchViaPowerShell(url) {
  try {
    var cmd = 'powershell -Command "$json = Invoke-RestMethod -Uri \'' + url + '\' -Method Get | ConvertTo-Json -Depth 10; [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($json))"';
    var base64 = execSync(cmd, { encoding: 'utf-8', timeout: 30000 }).trim();
    var content = Buffer.from(base64, 'base64').toString('utf-8');
    return JSON.parse(content);
  } catch (e) {
    throw new Error('PowerShell 请求失败: ' + e.message);
  }
}

// ========== 主流程 ==========

async function main() {
  // 检查 dist 目录是否存在
  if (!fs.existsSync(distDir)) {
    throw new Error('dist 目录不存在，请先运行 astro build');
  }

  // 加载模板函数
  const MomentTemplate = loadMomentTemplate();

  // 抓取公开文章（优先 fetch，失败时降级到 https 模块）
  console.log('[generate-static] 抓取公开文章:', API_URL);
  var data;
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (fetchErr) {
    console.log('[generate-static] fetch 失败，尝试 PowerShell 降级...');
    data = fetchViaPowerShell(API_URL);
  }
  const moments = data.moments || [];
  console.log(`[generate-static] 获取到 ${moments.length} 篇公开文章`);

  // 读取 dist/index.html 作为基础模板
  const indexPath = path.join(distDir, 'index.html');
  if (!fs.existsSync(indexPath)) {
    throw new Error('dist/index.html 不存在');
  }
  const indexHtml = fs.readFileSync(indexPath, 'utf-8');

  // 生成首页卡片 HTML（按 sort_order DESC 顺序，最后一条不显示分隔线）
  const cardsHtml = moments.map(function (m, i) {
    var isLast = i === moments.length - 1;
    return MomentTemplate(m, isLast);
  }).join('\n');

  // 注入首页
  const homeHtml = injectContainer(indexHtml, cardsHtml);
  fs.writeFileSync(indexPath, homeHtml, 'utf-8');
  console.log('[generate-static] 已注入首页 dist/index.html');

  // 生成详情页
  const contentDir = path.join(distDir, 'content');
  if (!fs.existsSync(contentDir)) {
    fs.mkdirSync(contentDir, { recursive: true });
  }

  for (let i = 0; i < moments.length; i++) {
    const m = moments[i];
    // 静态详情页的上下篇只链接到公开文章（确保链接目标都有静态页）
    const prevId = i > 0 ? moments[i - 1].id : null;
    const nextId = i < moments.length - 1 ? moments[i + 1].id : null;

    // 渲染单条卡片（isLast=true，不显示分隔线）
    const cardHtml = MomentTemplate(m, true);
    const navHtml = buildNavHtml(prevId, nextId);
    const detailContent = cardHtml + navHtml;

    const detailHtml = injectContainer(indexHtml, detailContent);

    // 写入 dist/content/{id}/index.html
    const detailDir = path.join(contentDir, m.id);
    fs.mkdirSync(detailDir, { recursive: true });
    fs.writeFileSync(path.join(detailDir, 'index.html'), detailHtml, 'utf-8');
  }
  console.log(`[generate-static] 已生成 ${moments.length} 个详情页 dist/content/{id}/index.html`);

  console.log('[generate-static] 静态站点生成完成');
}

main().catch(function (err) {
  console.error('[generate-static] 生成失败:', err.message);
  process.exit(1);
});
