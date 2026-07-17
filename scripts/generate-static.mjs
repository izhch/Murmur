#!/usr/bin/env node
/**
 * 静态站点生成脚本
 *
 * 在 astro build 之后运行，从 Worker API 抓取所有公开文章，
 * 使用 moment-template.js 的模板逻辑生成 HTML 卡片，注入到首页
 * dist/index.html 的 #moments-container 容器中。
 *
 * 详情页使用主页同一 HTML：/?id=xxx，由 moments.js 从 query 提取 ID
 * 并调用 Worker API 动态加载内容渲染。后台创建的文章立即可访问详情页。
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
const API_BASE = process.env.MURMUR_API || 'https://murmur.3103231032.workers.dev';
const API_URL = `${API_BASE}/api/public-moments`;

// 缓存文件路径（网络失败时使用缓存数据）
const CACHE_PATH = path.join(projectRoot, 'scripts', 'moments-cache.json');

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

// 替换 #moments-container 容器内部内容
function injectContainer(html, content) {
  // 匹配 <main ... id="moments-container" ...>...</main>，替换内部内容
  return html.replace(
    /(<main[^>]*\bid="moments-container"[^>]*>)[\s\S]*?(<\/main>)/,
    `$1\n${content}\n$2`
  );
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

  // 抓取公开文章（优先 fetch，失败时降级到 PowerShell，再失败时使用缓存）
  console.log('[generate-static] 抓取公开文章:', API_URL);
  var data;
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
    // 保存到缓存
    fs.writeFileSync(CACHE_PATH, JSON.stringify(data, null, 2), 'utf-8');
    console.log('[generate-static] 数据已缓存到', CACHE_PATH);
  } catch (fetchErr) {
    console.log('[generate-static] fetch 失败:', fetchErr.message);
    try {
      console.log('[generate-static] 尝试 PowerShell 降级...');
      data = fetchViaPowerShell(API_URL);
      fs.writeFileSync(CACHE_PATH, JSON.stringify(data, null, 2), 'utf-8');
    } catch (psErr) {
      console.log('[generate-static] PowerShell 也失败:', psErr.message);
      if (fs.existsSync(CACHE_PATH)) {
        console.log('[generate-static] 使用缓存数据...');
        data = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8'));
      } else {
        throw new Error('网络和缓存都不可用，无法生成静态站点');
      }
    }
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

  // 生成详情页静态兜底（每个公开文章生成独立 HTML 文件）
  const contentDir = path.join(distDir, 'content');
  if (!fs.existsSync(contentDir)) {
    fs.mkdirSync(contentDir, { recursive: true });
  }
  for (var i = 0; i < moments.length; i++) {
    var m = moments[i];
    var detailHtml = injectContainer(indexHtml, MomentTemplate(m, true));
    var detailPath = path.join(contentDir, m.id + '.html');
    fs.writeFileSync(detailPath, detailHtml, 'utf-8');
  }
  console.log(`[generate-static] 已生成 ${moments.length} 个详情页静态文件`);

  console.log('[generate-static] 静态站点生成完成（详情页使用 /content/:id.html 或 /?id= 路由）');
}

main().catch(function (err) {
  console.error('[generate-static] 生成失败:', err.message);
  process.exit(1);
});
