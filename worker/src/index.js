/**
 * Murmur - Cloudflare Worker 后端
 * 仿微信朋友圈动态 API，数据存 D1，图片存 R2，缓存走 EdgeOne
 */

// ========== 工具函数 ==========

// CORS 响应头
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}

// 返回 JSON 响应（带 CORS 头，确保 UTF-8 编码）
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders() }
  });
}

// 格式化日期为 YYYY-MM-DD HH:mm:ss
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}:${s}`;
}

// 格式化 ID 为 YYYY-MM-DD-HHmmss
function formatDateId(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d}-${h}${min}${s}`;
}

// 简单 Markdown 转 HTML
function mdToHtml(text) {
  if (!text) return '';
  // 1. HTML 转义（先转义 < > &）
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

// SHA256 哈希，返回 hex 字符串（用于密码验证）
async function sha256HexString(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function buildMoment(row, includeContent) {
  if (includeContent === undefined) includeContent = true;
  var rowType = row['type'] || 'text';
  var rowContentHtml = row['content_html'] || '';
  var rowImages = row['images'] || '[]';
  var images = [];
  if (rowImages) {
    try { images = JSON.parse(rowImages); } catch (e) { images = []; }
  }
  var result = {
    id: row['id'],
    author: '向晚',
    avatar: '/avatar/avatar.jpeg',
    title: row['title'] || '',
    location: row['location'] || '',
    createdAt: row['created_at'],
    hasPassword: !!row['password_hash'],
    needsCollapse: row['collapse'] === 1,
    isPrivate: row['is_private'] === 1,
    sort_order: row['sort_order'] !== undefined ? row['sort_order'] : 0
  };
  if (includeContent) {
    result.content = {
      type: rowType,
      html: rowContentHtml,
      images: images,
      music_title: row['music_title'] || '',
      music_artist: row['music_artist'] || '',
      music_cover: row['music_cover'] || '',
      music_src: row['music_src'] || '',
      video_src: row['video_src'] || '',
      video_duration: row['video_duration'] || ''
    };
  } else {
    result.content = { type: 'text', html: '', images: [] };
  }
  return result;
}

// 安全序列化 images 字段（兼容数组或字符串）
function stringifyImages(images) {
  if (!images) return '[]';
  if (typeof images === 'string') return images;
  return JSON.stringify(images);
}

// ========== 鉴权 ==========

// POST /api/auth — 验证密码，返回 token
async function auth(request, env) {
  const body = await request.json();
  const pwd = body.pwd;
  if (pwd !== env.ADMIN_PWD) {
    return json({ ok: false, error: '密码错误' }, 401);
  }
  // token = base64(timestamp:pwd)
  const timestamp = Date.now();
  const token = btoa(timestamp + ':' + pwd);
  return json({ ok: true, token });
}

// 验证 Authorization: Bearer token
function verifyAuth(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  const token = authHeader.slice(7);
  try {
    const decoded = atob(token);
    const [timestamp, pwd] = decoded.split(':');
    if (pwd !== env.ADMIN_PWD) return false;
    return true;
  } catch {
    return false;
  }
}

// ========== EdgeOne 缓存清理（TC3-HMAC-SHA256 签名）==========

// SHA256 哈希，返回 hex 字符串
async function sha256Hex(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// HMAC-SHA256，返回 Uint8Array（可链式传递作为下一次 HMAC 的 key）
async function hmacSha256(key, message) {
  const keyData = typeof key === 'string' ? new TextEncoder().encode(key) : key;
  const msgBuffer = new TextEncoder().encode(message);
  const keyObj = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', keyObj, msgBuffer);
  return new Uint8Array(sigBuffer);
}

// HMAC-SHA256，返回 hex 字符串
async function hmacSha256Hex(key, message) {
  const sig = await hmacSha256(key, message);
  return Array.from(sig).map(b => b.toString(16).padStart(2, '0')).join('');
}

// 调用 EdgeOne CreatePurgeTask 接口清理缓存
async function purgeEdgeOneCache(env) {
  try {
    const secretId = env.TEO_SECRET_ID;
    const secretKey = env.TEO_SECRET_KEY;
    const zoneId = env.TEO_ZONE_ID;
    if (!secretId || !secretKey || !zoneId) {
      return;
    }
    const service = 'teo';
    const action = 'CreatePurgeTask';
    const version = '2022-09-01';
    const host = `${service}.tencentcloudapi.com`;
    const endpoint = `https://${host}`;

    const payload = JSON.stringify({
      ZoneId: zoneId,
      Type: 'host',
      Targets: ['izhch.com']
    });

    const timestamp = Math.floor(Date.now() / 1000);
    const dateStr = new Date(timestamp * 1000).toISOString().slice(0, 10);

    const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n`;
    const signedHeaders = 'content-type;host;x-tc-action';
    const hashedRequestPayload = await sha256Hex(payload);
    const canonicalRequest = `POST\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${hashedRequestPayload}`;

    const credentialScope = `${dateStr}/${service}/tc3_request`;
    const hashedCanonicalRequest = await sha256Hex(canonicalRequest);
    const stringToSign = `TC3-HMAC-SHA256\n${timestamp}\n${credentialScope}\n${hashedCanonicalRequest}`;

    const secretDate = await hmacSha256('TC3' + secretKey, dateStr);
    const secretService = await hmacSha256(secretDate, service);
    const secretSigning = await hmacSha256(secretService, 'tc3_request');
    const signature = await hmacSha256Hex(secretSigning, stringToSign);

    const authorization = `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': authorization,
        'X-TC-Action': action,
        'X-TC-Version': version,
        'X-TC-Timestamp': timestamp.toString()
      },
      body: payload
    });

    return response;
  } catch (e) {
    console.warn('EdgeOne cache purge failed:', e.message);
  }
}

// ========== GitHub Actions 触发（静态站点重建）==========

// 调用 GitHub repository_dispatch 触发 Actions 重建静态站点
// 使用环境变量 GH_TOKEN（GitHub PAT）和 GH_REPO（owner/repo）
// 通过 ctx.waitUntil 调用，不阻塞响应
async function triggerRebuild(env) {
  try {
    const token = env.GH_TOKEN;
    const repo = env.GH_REPO; // 格式：owner/repo
    if (!token || !repo) {
      return;
    }
    await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      body: JSON.stringify({ event_type: 'rebuild' })
    });
  } catch (e) {
    console.warn('GitHub rebuild trigger failed:', e.message);
  }
}

// ========== API 路由处理 ==========

// GET /api/moments?page=1&size=5 — 分页获取动态列表
async function getMoments(url, env, request) {
  const page = parseInt(url.searchParams.get('page') || '1');
  const size = parseInt(url.searchParams.get('size') || '5');
  const offset = (page - 1) * size;
  const isAdmin = verifyAuth(request, env);

  const whereClause = isAdmin
    ? 'WHERE is_deleted = 0'
    : 'WHERE is_deleted = 0 AND is_private = 0';

  const result = await env.DB.prepare(
    `SELECT * FROM moments ${whereClause} ORDER BY sort_order DESC, created_at DESC LIMIT ? OFFSET ?`
  ).bind(size, offset).all();

  const countResult = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM moments ${whereClause}`
  ).first();

  const moments = result.results.map(function(row) {
    var rowType = row['type'] || 'text';
    var rowContentHtml = row['content_html'] || '';
    var rowImages = row['images'] || '[]';
    var images = [];
    if (rowImages) {
      try { images = JSON.parse(rowImages); } catch (e) { images = []; }
    }
    return {
        id: row['id'],
        author: '向晚',
        avatar: '/avatar/avatar.jpeg',
        title: row['title'] || '',
        content: {
          type: rowType,
          html: rowContentHtml,
          images: images,
          music_title: row['music_title'] || '',
          music_artist: row['music_artist'] || '',
          music_cover: row['music_cover'] || '',
          music_src: row['music_src'] || '',
          video_src: row['video_src'] || '',
          video_duration: row['video_duration'] || ''
        },
        location: row['location'] || '',
        createdAt: row['created_at'],
        hasPassword: !!row['password_hash'],
        needsCollapse: row['collapse'] === 1,
        isPrivate: row['is_private'] === 1,
        sort_order: row['sort_order'] !== undefined ? row['sort_order'] : 0
      };
  });

  return json({
    moments,
    total: countResult.total,
    page,
    size,
    hasMore: offset + moments.length < countResult.total
  });
}

// GET /api/public-moments — 获取所有公开文章（不需要鉴权，不分页）
// 返回 is_private=0 的文章（包含密码保护的文章），按 sort_order DESC, created_at DESC 排序
// 用于静态站点生成（GitHub Actions）抓取公开内容
// 密码保护文章在静态页面显示密码表单，但不返回密码哈希和内容
async function getPublicMoments(env) {
  const result = await env.DB.prepare(
    `SELECT * FROM moments WHERE is_deleted = 0 AND is_private = 0 ORDER BY sort_order DESC, created_at DESC`
  ).all();

  const moments = result.results.map(function (row) {
    var m = buildMoment(row);
    if (m.hasPassword) {
      m.content = { type: 'text', html: '', images: [] };
    }
    return m;
  });

  return json({ moments });
}

// GET /api/moments/:id — 获取单条动态 + 上一篇/下一篇（支持密码验证）
async function getMoment(id, env, request, password = null) {
  const moment = await env.DB.prepare(
    `SELECT * FROM moments WHERE id = ? AND is_deleted = 0`
  ).bind(id).first();

  if (!moment) {
    return json({ error: '未找到' }, 404);
  }

  // 私密文章：非管理员不可见
  if (moment.is_private === 1 && !verifyAuth(request, env)) {
    return json({ error: '未找到' }, 404);
  }

  // 如果有密码保护且未提供密码且非管理员，返回摘要信息（不含内容）
  if (moment.password_hash && !password && !verifyAuth(request, env)) {
    return json({
      moment: buildMoment(moment, false),
      prevId: null,
      nextId: null,
      needPassword: true
    });
  }

  // 如果有密码保护，验证密码
  if (moment.password_hash && password) {
    const passwordHash = await sha256HexString(password);
    if (passwordHash !== moment.password_hash) {
      return json({
        moment: buildMoment(moment, false),
        prevId: null,
        nextId: null,
        needPassword: true,
        passwordError: true
      });
    }
  }

  // 上一篇（sort_order 更大 = 更新，或 sort_order 相同但 created_at 更新）
  const prev = await env.DB.prepare(
    `SELECT id FROM moments WHERE is_deleted = 0 AND (sort_order > ? OR (sort_order = ? AND created_at > ?)) ORDER BY sort_order ASC, created_at ASC LIMIT 1`
  ).bind(moment.sort_order, moment.sort_order, moment.created_at).first();

  // 下一篇（sort_order 更小 = 更旧，或 sort_order 相同但 created_at 更旧）
  const next = await env.DB.prepare(
    `SELECT id FROM moments WHERE is_deleted = 0 AND (sort_order < ? OR (sort_order = ? AND created_at < ?)) ORDER BY sort_order DESC, created_at DESC LIMIT 1`
  ).bind(moment.sort_order, moment.sort_order, moment.created_at).first();

  return json({
    moment: buildMoment(moment),
    prevId: prev ? prev.id : null,
    nextId: next ? next.id : null,
    needPassword: false
  });
}

// POST /api/moments/:id/verify — 验证密码，获取完整内容
async function verifyPassword(id, request, env) {
  const body = await request.json();
  const password = body.password;

  if (!password) {
    return json({ error: '请输入密码' }, 400);
  }

  const moment = await env.DB.prepare(
    `SELECT * FROM moments WHERE id = ? AND is_deleted = 0`
  ).bind(id).first();

  if (!moment) {
    return json({ error: '未找到' }, 404);
  }

  if (!moment.password_hash) {
    return json({ error: '该动态不需要密码' }, 400);
  }

  const passwordHash = await sha256HexString(password);
  if (passwordHash !== moment.password_hash) {
    return json({ ok: false, error: '密码错误' }, 401);
  }

  // 验证成功，返回完整内容
  const prev = await env.DB.prepare(
    `SELECT id FROM moments WHERE is_deleted = 0 AND (sort_order > ? OR (sort_order = ? AND created_at > ?)) ORDER BY sort_order ASC, created_at ASC LIMIT 1`
  ).bind(moment.sort_order, moment.sort_order, moment.created_at).first();

  const next = await env.DB.prepare(
    `SELECT id FROM moments WHERE is_deleted = 0 AND (sort_order < ? OR (sort_order = ? AND created_at < ?)) ORDER BY sort_order DESC, created_at DESC LIMIT 1`
  ).bind(moment.sort_order, moment.sort_order, moment.created_at).first();

  return json({
    ok: true,
    moment: buildMoment(moment),
    prevId: prev ? prev.id : null,
    nextId: next ? next.id : null
  });
}

// POST /api/moments — 新建动态（需鉴权）
async function createMoment(request, env, ctx) {
  if (!verifyAuth(request, env)) {
    return json({ error: '未授权' }, 401);
  }

  const body = await request.json();
  const now = new Date();

  // 自动生成 id 和时间
  const id = body.id || formatDateId(now);
  const createdAt = body.createdAt || formatDate(now);
  const sortOrder = body.sort_order !== undefined ? body.sort_order : now.getTime();

  // 内容处理：有 content 则生成 content_html
  const content = body.content || '';
  const contentHtml = body.content_html || mdToHtml(content);

  // images 兼容数组或字符串
  const images = stringifyImages(body.images);

  // 类型自动修正：如果是 images 类型但没有图片，自动改为 text
  let finalType = body.type || 'text';
  if (finalType === 'images') {
    try {
      const imgArr = JSON.parse(images);
      if (!imgArr || imgArr.length === 0) {
        finalType = 'text';
      }
    } catch (e) {
      finalType = 'text';
    }
  }

  // 密码处理：如果是明文密码则转换为 SHA256 哈希
  const passwordRaw = body.password_hash || body.password || '';
  const passwordHash = passwordRaw ? await sha256HexString(passwordRaw) : '';
  const collapse = (body.needsCollapse || body.collapse) ? 1 : 0;
  const isPrivate = body.is_private ? 1 : 0;

  await env.DB.prepare(
    `INSERT INTO moments (id, title, type, content, content_html, location, created_at, password_hash, collapse, images, music_title, music_artist, music_cover, music_src, video_src, video_duration, sort_order, is_deleted, is_private)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
  ).bind(
    id, body.title || '', finalType, content, contentHtml,
    body.location || '', createdAt, passwordHash, collapse, images,
    body.music_title || '', body.music_artist || '', body.music_cover || '',
    body.music_src || '', body.video_src || '', body.video_duration || '',
    sortOrder, isPrivate
  ).run();

  // 清理 EdgeOne 缓存
  await purgeEdgeOneCache(env);

  // 触发 GitHub Actions 重建静态站点（不阻塞响应）
  if (ctx && ctx.waitUntil) {
    ctx.waitUntil(triggerRebuild(env));
  }

  return json({ ok: true, id });
}

// PUT /api/moments/:id — 编辑动态（需鉴权）
async function updateMoment(id, request, env, ctx) {
  if (!verifyAuth(request, env)) {
    return json({ error: '未授权' }, 401);
  }

  const body = await request.json();

  // 查询现有数据
  const existing = await env.DB.prepare(
    `SELECT * FROM moments WHERE id = ? AND is_deleted = 0`
  ).bind(id).first();

  if (!existing) {
    return json({ error: '未找到' }, 404);
  }

  // 内容处理：content 变了就重新生成 html
  const content = body.content !== undefined ? body.content : existing.content;
  const contentHtml = body.content_html || (body.content !== undefined ? mdToHtml(content) : existing.content_html);

  const images = body.images ? stringifyImages(body.images) : existing.images;
  // 密码处理：如果是明文密码则转换为 SHA256 哈希
  const passwordRaw = body.password_hash !== undefined ? body.password_hash : existing.password_hash;
  const passwordHash = passwordRaw ? await sha256HexString(passwordRaw) : '';
  const collapse = body.needsCollapse !== undefined ? (body.needsCollapse ? 1 : 0) : existing.collapse;
  const isPrivate = body.is_private !== undefined ? (body.is_private ? 1 : 0) : existing.is_private;
  const sortOrder = body.sort_order !== undefined ? body.sort_order : existing.sort_order;

  // 类型自动修正：如果是 images 类型但没有图片，自动改为 text
  let finalType = body.type !== undefined ? body.type : existing.type;
  if (finalType === 'images') {
    try {
      const imgArr = JSON.parse(images);
      if (!imgArr || imgArr.length === 0) {
        finalType = 'text';
      }
    } catch (e) {
      finalType = 'text';
    }
  }

  await env.DB.prepare(
    `UPDATE moments SET
      title = ?, type = ?, content = ?, content_html = ?, location = ?,
      password_hash = ?, collapse = ?, images = ?,
      music_title = ?, music_artist = ?, music_cover = ?, music_src = ?,
      video_src = ?, video_duration = ?, is_private = ?, sort_order = ?
     WHERE id = ?`
  ).bind(
    body.title !== undefined ? body.title : existing.title,
    finalType,
    content,
    contentHtml,
    body.location !== undefined ? body.location : existing.location,
    passwordHash,
    collapse,
    images,
    body.music_title !== undefined ? body.music_title : existing.music_title,
    body.music_artist !== undefined ? body.music_artist : existing.music_artist,
    body.music_cover !== undefined ? body.music_cover : existing.music_cover,
    body.music_src !== undefined ? body.music_src : existing.music_src,
    body.video_src !== undefined ? body.video_src : existing.video_src,
    body.video_duration !== undefined ? body.video_duration : existing.video_duration,
    isPrivate,
    sortOrder,
    id
  ).run();

  // 清理 EdgeOne 缓存
  await purgeEdgeOneCache(env);

  // 触发 GitHub Actions 重建静态站点（不阻塞响应）
  if (ctx && ctx.waitUntil) {
    ctx.waitUntil(triggerRebuild(env));
  }

  return json({ ok: true, id });
}

// DELETE /api/moments/:id — 硬删除（需鉴权）
async function deleteMoment(id, request, env, ctx) {
  if (!verifyAuth(request, env)) {
    return json({ error: '未授权' }, 401);
  }

  await env.DB.prepare(
    `DELETE FROM moments WHERE id = ?`
  ).bind(id).run();

  // 清理 EdgeOne 缓存
  await purgeEdgeOneCache(env);

  // 触发 GitHub Actions 重建静态站点（不阻塞响应）
  if (ctx && ctx.waitUntil) {
    ctx.waitUntil(triggerRebuild(env));
  }

  return json({ ok: true });
}

// POST /api/upload — 上传图片到 R2（需鉴权）
async function uploadImage(request, env) {
  if (!verifyAuth(request, env)) {
    return json({ error: '未授权' }, 401);
  }

  const formData = await request.formData();
  const file = formData.get('file');

  if (!file) {
    return json({ error: '未找到文件' }, 400);
  }

  // 按年份/月份组织路径：2026/07/1234567890.jpg
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const ext = file.name.split('.').pop() || 'jpg';
  const fileName = `${Date.now()}.${ext}`;
  const filePath = `${year}/${month}/${fileName}`;

  // 存入 R2 桶
  await env.IMG_BUCKET.put(filePath, file.stream(), {
    httpMetadata: { contentType: file.type }
  });

  return json({
    url: `https://images.izhch.com/${filePath}`,
    fileName: filePath
  });
}

// ========== 主入口 ==========

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS 预检
    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    try {
      // 路由匹配
      if (path === '/api/public-moments' && method === 'GET') {
        return await getPublicMoments(env);
      }
      if (path === '/api/moments' && method === 'GET') {
        return await getMoments(url, env, request);
      }
      if (path.startsWith('/api/moments/') && method === 'GET') {
        const id = decodeURIComponent(path.split('/')[3]);
        return await getMoment(id, env, request);
      }
      if (path === '/api/auth' && method === 'POST') {
        return await auth(request, env);
      }
      if (path === '/api/moments' && method === 'POST') {
        return await createMoment(request, env, ctx);
      }
      if (path.startsWith('/api/moments/') && method === 'PUT') {
        const id = decodeURIComponent(path.split('/')[3]);
        return await updateMoment(id, request, env, ctx);
      }
      if (path.startsWith('/api/moments/') && method === 'DELETE') {
        const id = decodeURIComponent(path.split('/')[3]);
        return await deleteMoment(id, request, env, ctx);
      }
      if (path.match(/^\/api\/moments\/.+\/verify$/) && method === 'POST') {
        const parts = path.split('/');
        const id = decodeURIComponent(parts[3]);
        return await verifyPassword(id, request, env);
      }
      if (path === '/api/upload' && method === 'POST') {
        return await uploadImage(request, env);
      }

      return json({ error: 'Not Found' }, 404);
    } catch (err) {
      return json({ error: err.message }, 500);
    }
  }
};
