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

// 格式化日期为 YYYY-MM-DD HH:mm:ss（使用北京时间 UTC+8）
function formatDate(date) {
  const options = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Shanghai' };
  const str = date.toLocaleString('zh-CN', options);
  const parts = str.split('/');
  const timePart = str.split(' ')[1] || '';
  const y = parts[0];
  const m = parts[1] || '01';
  const d = parts[2] ? parts[2].split(' ')[0] : '01';
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')} ${timePart}`;
}

// 格式化 ID 为 YYYY-MM-DD-HHmmss（使用北京时间 UTC+8）
function formatDateId(date) {
  const options = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Shanghai' };
  const str = date.toLocaleString('zh-CN', options);
  const parts = str.split('/');
  const timePart = str.split(' ')[1] || '';
  const y = parts[0];
  const m = parts[1] || '01';
  const d = parts[2] ? parts[2].split(' ')[0] : '01';
  const [h, min, s] = timePart.split(':').map(p => p.padStart(2, '0'));
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}-${h}${min}${s}`;
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
    // 协议白名单：只允许 http, https, mailto, tel
    p = p.replace(/\[(.+?)\]\((.+?)\)/g, function(match, text, url) {
      const safeProtocols = ['http:', 'https:', 'mailto:', 'tel:', ''];
      const protocol = url.split('://')[0] + ':' || '';
      if (!safeProtocols.includes(protocol.toLowerCase())) {
        return text;
      }
      return '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + text + '</a>';
    });
    // 行内代码 `code` → <code>code</code>
    p = p.replace(/`(.+?)`/g, '<code>$1</code>');
    // 单个换行 → <br>
    p = p.replace(/\n/g, '<br>');
    return `<p>${p}</p>`;
  }).join('\n');
  return html;
}

// SHA256 哈希（带盐值），返回 hex 字符串（用于密码验证）
// 使用环境变量 PWD_SALT 作为盐值，如果未配置则使用默认值
async function sha256HexString(message, env) {
  const salt = env && env.PWD_SALT ? env.PWD_SALT : 'murmur_default_salt_2026';
  const saltedMessage = salt + message;
  const msgBuffer = new TextEncoder().encode(saltedMessage);
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
    routeId: row['route_id'],
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
  // token = base64(JSON.stringify({timestamp, pwd}))，避免密码含冒号导致 split 失败
  // token 有效期 24 小时
  const timestamp = Date.now();
  const token = btoa(JSON.stringify({ timestamp, pwd }));
  return json({ ok: true, token });
}

// 验证 Authorization: Bearer token（有效期 24 小时）
function verifyAuth(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  const token = authHeader.slice(7);
  try {
    const decoded = atob(token);
    const data = JSON.parse(decoded);
    if (data.pwd !== env.ADMIN_PWD) return false;
    // token 有效期 24 小时（86400000 毫秒）
    if (Date.now() - data.timestamp > 86400000) return false;
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
      Targets: env.TEO_PURGE_TARGETS ? JSON.parse(env.TEO_PURGE_TARGETS) : ['izhch.com']
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

async function triggerRebuild(env) {
  try {
    const token = env.GH_TOKEN;
    const repo = env.GH_REPO;
    if (!token || !repo) {
      return;
    }
    await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Murmur-Worker'
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
    return buildMoment(row);
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
// id 可以是原始日期格式 ID（2026-07-13-235856）或 route_id（数字）
async function getMoment(id, env, request, password = null) {
  let moment;
  const isNumeric = /^\d+$/.test(id);
  
  if (isNumeric) {
    moment = await env.DB.prepare(
      `SELECT * FROM moments WHERE route_id = ? AND is_deleted = 0`
    ).bind(parseInt(id)).first();
    if (!moment) {
      moment = await env.DB.prepare(
        `SELECT * FROM moments WHERE id = ? AND is_deleted = 0`
      ).bind(id).first();
    }
  } else {
    moment = await env.DB.prepare(
      `SELECT * FROM moments WHERE id = ? AND is_deleted = 0`
    ).bind(id).first();
  }

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

  // 如果有密码保护，验证密码（兼容加盐哈希和无盐哈希两种格式）
  if (moment.password_hash && password) {
    const passwordHash = await sha256HexString(password, env);
    // 无盐SHA256（用于兼容旧数据）
    const unsaltedHash = await sha256Hex(password);
    if (passwordHash !== moment.password_hash && unsaltedHash !== moment.password_hash) {
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

  // 先检查文章是否存在且需要密码
  const isNumeric = /^\d+$/.test(id);
  let moment;
  if (isNumeric) {
    moment = await env.DB.prepare(
      `SELECT * FROM moments WHERE route_id = ? AND is_deleted = 0`
    ).bind(parseInt(id)).first();
    if (!moment) {
      moment = await env.DB.prepare(
        `SELECT * FROM moments WHERE id = ? AND is_deleted = 0`
      ).bind(id).first();
    }
  } else {
    moment = await env.DB.prepare(
      `SELECT * FROM moments WHERE id = ? AND is_deleted = 0`
    ).bind(id).first();
  }

  if (!moment) {
    return json({ error: '未找到' }, 404);
  }

  if (!moment.password_hash) {
    return json({ error: '该动态不需要密码' }, 400);
  }

  // 复用 getMoment 逻辑，传入密码参数
  const result = await getMoment(id, env, request, password);
  
  if (result.status === 200) {
    const data = await result.json();
    if (data.passwordError) {
      return json({ ok: false, error: '密码错误' }, 401);
    }
    return json({ ok: true, ...data });
  }
  
  return result;
}

// POST /api/moments — 新建动态（需鉴权）
async function createMoment(request, env, ctx) {
  if (!verifyAuth(request, env)) {
    return json({ error: '未授权' }, 401);
  }

  const body = await request.json();
  const now = new Date();

  // 自动生成 id 和时间
  // id 优先使用自定义，其次是递增数字（route_id），最后是日期格式
  const createdAt = body.createdAt || formatDate(now);
  const sortOrder = body.sort_order !== undefined ? body.sort_order : now.getTime();

  // 先获取下一个 route_id（用于数字ID和数据库插入）
  const routeIdResult = await env.DB.prepare(
    `SELECT COALESCE(MAX(route_id), 0) + 1 AS next_id FROM moments WHERE is_deleted = 0`
  ).first();
  const nextRouteId = routeIdResult ? routeIdResult.next_id : 1;

  // ID 优先级：自定义 > 递增数字（无论是否指定日期）
  let id;
  if (body.id) {
    id = body.id;
  } else {
    // 默认使用递增数字（1, 2, 3...）
    id = String(nextRouteId);
  }

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
  const passwordHash = passwordRaw ? await sha256HexString(passwordRaw, env) : '';
  const collapse = (body.needsCollapse || body.collapse) ? 1 : 0;
  const isPrivate = body.is_private ? 1 : 0;

  // 使用已获取的 route_id 插入，避免子查询并发问题
  await env.DB.prepare(
    `INSERT INTO moments (id, route_id, title, type, content, content_html, location, created_at, password_hash, collapse, images, music_title, music_artist, music_cover, music_src, video_src, video_duration, sort_order, is_deleted, is_private)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
  ).bind(
    id, nextRouteId, body.title || '', finalType, content, contentHtml,
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
  // 密码处理：只有前端明确发送了 password_hash 才重新哈希，否则保留原值（避免二次哈希）
  let passwordHash = existing.password_hash;
  if (body.password_hash !== undefined) {
    if (body.password_hash === '') {
      passwordHash = '';
    } else {
      passwordHash = await sha256HexString(body.password_hash, env);
    }
  }
  const collapse = body.needsCollapse !== undefined ? (body.needsCollapse ? 1 : 0) : existing.collapse;
  const isPrivate = body.is_private !== undefined ? (body.is_private ? 1 : 0) : existing.is_private;
  const sortOrder = body.sort_order !== undefined ? body.sort_order : existing.sort_order;
  const newId = body.id !== undefined ? body.id : existing.id;

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
      id = ?, title = ?, type = ?, content = ?, content_html = ?, location = ?,
      created_at = ?, password_hash = ?, collapse = ?, images = ?,
      music_title = ?, music_artist = ?, music_cover = ?, music_src = ?,
      video_src = ?, video_duration = ?, is_private = ?, sort_order = ?
     WHERE id = ?`
  ).bind(
    newId,
    body.title !== undefined ? body.title : existing.title,
    finalType,
    content,
    contentHtml,
    body.location !== undefined ? body.location : existing.location,
    body.createdAt !== undefined ? (body.createdAt === '' ? formatDate(new Date()) : body.createdAt) : existing.created_at,
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

  return json({ ok: true, id: newId });
}

// DELETE /api/moments/:id — 软删除（需鉴权）
async function deleteMoment(id, request, env, ctx) {
  if (!verifyAuth(request, env)) {
    return json({ error: '未授权' }, 401);
  }

  await env.DB.prepare(
    `UPDATE moments SET is_deleted = 1 WHERE id = ?`
  ).bind(id).run();

  // 清理 EdgeOne 缓存
  await purgeEdgeOneCache(env);

  // 触发 GitHub Actions 重建静态站点（不阻塞响应）
  if (ctx && ctx.waitUntil) {
    ctx.waitUntil(triggerRebuild(env));
    ctx.waitUntil(cleanupDeletedMoments(env));
  }

  return json({ ok: true });
}

// 清理 30 天前的软删除记录（硬删除）
async function cleanupDeletedMoments(env) {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dateStr = formatDate(thirtyDaysAgo);
    await env.DB.prepare(
      `DELETE FROM moments WHERE is_deleted = 1 AND created_at < ?`
    ).bind(dateStr).run();
  } catch (e) {
    console.warn('Cleanup deleted moments failed:', e.message);
  }
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

  // 文件类型校验：支持图片、音频、视频
  const allowedTypes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac',
    'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'
  ];
  if (!allowedTypes.includes(file.type)) {
    return json({ error: '只支持图片、音频、视频格式' }, 400);
  }

  // 文件大小校验：最大 10MB
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    return json({ error: '文件大小不能超过 10MB' }, 400);
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
