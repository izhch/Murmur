/**
 * ====================================================================
 * 时间格式化工具
 * ====================================================================
 * 
 * 【功能】
 * - 将日期字符串（YYYY-MM-DD）格式化为相对时间（如"3天前"）
 * - 生成基于种子的固定随机数（用于点赞数、评论数等）
 * 
 * 【注意】
 * - 这些函数同时用于服务端（Astro 组件）和客户端（无限滚动 JS）
 * - 保持逻辑一致非常重要
 */

/**
 * 将日期字符串格式化为相对时间
 * 
 * @param dateStr 日期字符串（格式：YYYY-MM-DD 或 YYYY-MM-DD HH:mm:ss）
 * @returns 相对时间字符串（如"刚刚"、"3小时前"、"5天前"、"2024-03-15"）
 */
export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr.replace(/-/g, '/'));
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  // 1 分钟内
  if (diff < 60 * 1000) {
    return '刚刚';
  }

  // 1 小时内
  if (diff < 60 * 60 * 1000) {
    const minutes = Math.floor(diff / (60 * 1000));
    return `${minutes}分钟前`;
  }

  // 24 小时内
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    return `${hours}小时前`;
  }

  // 30 天内
  if (diff < 30 * 24 * 60 * 60 * 1000) {
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    return `${days}天前`;
  }

  // 30 天以上，显示具体日期
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  // 如果是同一年，只显示月-日
  if (year === now.getFullYear()) {
    return `${month}-${day}`;
  }

  // 不同年，显示完整日期
  return `${year}-${month}-${day}`;
}

/**
 * 生成基于种子的固定随机数
 * 
 * 【说明】
 * - 相同的种子会生成相同的随机数（可预测）
 * - 用于生成点赞数、评论数等需要稳定显示的值
 * 
 * @param seed 种子字符串（如动态 ID、slug）
 * @param min 最小值（包含）
 * @param max 最大值（包含）
 * @returns 在 [min, max] 范围内的整数
 */
export function generateFixedRandom(seed: string, min: number, max: number): number {
  // 简单的字符串哈希函数
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 保持 32 位整数
  }

  // 将哈希值转换为正数
  const positiveHash = Math.abs(hash);

  // 映射到 [min, max] 范围
  const range = max - min + 1;
  return min + (positiveHash % range);
}

/**
 * ====================================================================
 * 动态卡片 HTML 渲染函数
 * ====================================================================
 * 
 * 【用途】
 * - 客户端无限滚动时，动态生成卡片 HTML（纯 JS，无需 Astro 组件）
 * - 生成的 HTML 结构与 MomentItem.astro 完全一致
 * 
 * 【注意】
 * - 此函数必须与 MomentItem.astro 的输出保持一致
 * - 任何布局变更都需要同步修改这里和 MomentItem.astro
 */

export interface MomentLike {
  id: string;
  slug: string;
  date: string;
  title: string;
  content: string;
  images?: string[];
  music?: {
    title: string;
    artist: string;
    cover: string;
    url: string;
  };
  video?: {
    url: string;
    cover: string;
  };
  location?: string;
  author: {
    name: string;
    avatar: string;
  };
}

/**
 * 将图片数组渲染为图片网格 HTML
 * （与 ImageGrid.astro 保持一致）
 */
function renderImageGrid(images: string[]): string {
  if (!images || images.length === 0) return '';

  // 单图
  if (images.length === 1) {
    return `
      <div class="image-grid grid-1">
        <div class="image-cell">
          <img src="${images[0]}" alt="图片 1" loading="lazy" data-src="${images[0]}" data-images="${encodeURIComponent(JSON.stringify(images))}" data-index="0">
        </div>
      </div>
    `;
  }

  // 2 图或 3 图
  if (images.length === 2 || images.length === 3) {
    const gridClass = images.length === 2 ? 'grid-2' : 'grid-3';
    return `
      <div class="image-grid ${gridClass}">
        ${images.map((img, i) => `
          <div class="image-cell">
            <img src="${img}" alt="图片 ${i + 1}" loading="lazy" data-src="${img}" data-images="${encodeURIComponent(JSON.stringify(images))}" data-index="${i}">
          </div>
        `).join('')}
      </div>
    `;
  }

  // 4 图或更多（最多显示 9 图）
  const imagesToShow = images.slice(0, 9);
  const gridClass = imagesToShow.length <= 4 ? 'grid-4' : 'grid-multiple';
  return `
    <div class="image-grid ${gridClass}">
      ${imagesToShow.map((img, i) => `
        <div class="image-cell">
          <img src="${img}" alt="图片 ${i + 1}" loading="lazy" data-src="${img}" data-images="${encodeURIComponent(JSON.stringify(images))}" data-index="${i}">
        </div>
      `).join('')}
    </div>
  `;
}

/**
 * 将音乐对象渲染为音乐播放器 HTML
 * （与 MusicPlayer.astro 保持一致）
 */
function renderMusicPlayer(music: { title: string; artist: string; cover: string; url: string }): string {
  return `
    <div class="music-player">
      <div class="music-cover-container">
        <img src="${music.cover}" alt="${music.title}" class="music-cover" loading="lazy">
        <button class="music-play-btn" type="button" aria-label="播放/暂停" data-audio="${music.url}">
          <svg class="play-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
          <svg class="pause-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" style="display:none">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
          </svg>
        </button>
      </div>
      <div class="music-info">
        <span class="music-title">${music.title}</span>
        <span class="music-artist">${music.artist}</span>
      </div>
    </div>
  `;
}

/**
 * 将视频对象渲染为视频播放器 HTML
 * （与 VideoPlayer.astro 保持一致）
 */
function renderVideoPlayer(video: { url: string; cover: string }): string {
  return `
    <div class="video-player">
      <video controls poster="${video.cover}" preload="metadata">
        <source src="${video.url}" type="video/mp4">
        您的浏览器不支持视频播放
      </video>
    </div>
  `;
}

/**
 * 将文本内容渲染为展开/收起文本
 * （简化版，只做基本截断）
 */
function renderTextExpand(content: string): string {
  // 纯文本，直接返回（JS 侧会处理展开/收起逻辑）
  return content;
}

/**
 * 渲染单个动态卡片
 * 
 * 【说明】
 * - 生成的 HTML 结构与 MomentItem.astro 完全一致
 * - 用于客户端无限滚动时动态追加
 * 
 * @param moment 动态数据对象
 * @returns HTML 字符串
 */
export function renderMomentCard(moment: MomentLike): string {
  const seed = moment.id || moment.slug || moment.date;
  const formattedDate = formatRelativeTime(moment.date);
  const likeCount = generateFixedRandom(seed, 1, 50);
  const commentCount = generateFixedRandom(seed + 'comment', 0, 20);

  // 内容区域（只有当 content 不为空时才渲染）
  const contentHtml = moment.content
    ? `<p class="content">${renderTextExpand(moment.content)}</p>`
    : '';

  // 图片网格
  const imagesHtml = moment.images && moment.images.length > 0
    ? renderImageGrid(moment.images)
    : '';

  // 音乐播放器
  const musicHtml = moment.music ? renderMusicPlayer(moment.music) : '';

  // 视频播放器
  const videoHtml = moment.video ? renderVideoPlayer(moment.video) : '';

  // 位置信息
  const locationHtml = moment.location
    ? `<span class="location"> · ${moment.location}</span>`
    : '';

  return `
    <article class="moment" data-moment-id="${seed}" data-date="${moment.date}">
      <div class="avatar-container">
        <img class="avatar" src="${moment.author.avatar}" alt="${moment.author.name}" width="36" height="36" loading="lazy">
      </div>
      <div class="body">
        <span class="author">${moment.author.name}</span>
        ${contentHtml}
        ${imagesHtml}
        ${musicHtml}
        ${videoHtml}
        <div class="meta">
          <span class="time">
            ${formattedDate}${locationHtml}
          </span>
          <div class="actions">
            <button class="action-btn like-btn" type="button" aria-label="点赞" data-like-count="${likeCount}" data-moment-id="${seed}">
              <svg class="icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path>
              </svg>
              <span class="count">${likeCount}</span>
            </button>
            <button class="action-btn comment-btn" type="button" aria-label="评论" data-comment-count="${commentCount}">
              <svg class="icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
              </svg>
              <span class="count">${commentCount}</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  `;
}
