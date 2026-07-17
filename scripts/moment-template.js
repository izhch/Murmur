/**
 * 动态卡片 HTML 模板生成器
 * 与 Astro 组件输出保持完全一致的 HTML 结构
 */
(function () {
  'use strict';

  // HTML 转义
  function esc(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // 头像
  function avatar(src) {
    return '<img src="' + esc(src) + '" alt="" class="rounded-[5px] object-cover bg-moments-divider shrink-0" style="width:36px;height:36px;" loading="lazy" />';
  }

  // 锁图标
  var LOCK_ICON = '<svg class="w-[18px] h-[18px] text-moments-link dark:text-moments-dark-link" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg"><g><path d="m160,96l0,-18c0,-16.63 -14.26001,-30 -32,-30s-32,13.37 -32,30l0,18" stroke-width="26" stroke-linejoin="round" stroke-linecap="round" stroke="currentColor" fill="none" /><path d="m176,208l-96,0a32,32 0 0 1 -32,-32l0,-48a32,32 0 0 1 32,-32l96,0a32,32 0 0 1 32,32l0,48a32,32 0 0 1 -32,32z" fill="currentColor" /></g></svg>';

  // 置顶图标
  var PIN_ICON = '<img src="/icons/post.pin.light.svg" alt="置顶" class="w-[18px] h-[18px]" />';

  // 私密图标
  var PRIVATE_ICON = '<img src="/icons/post.private.light.svg" alt="私密" class="w-[18px] h-[18px]" />';

  // 昵称（点击可进入详情页）
  function nickname(name, hasPassword, isPinned, isPrivate) {
    var icons = '';
    if (isPinned) icons += PIN_ICON;
    if (isPrivate) icons += PRIVATE_ICON;
    var displayName = esc(name);
    return '<p class="moment-nickname pt-[2px] text-[16px] font-medium leading-[24px] text-moments-link dark:text-moments-dark-link flex items-center gap-1">' +
      displayName + (hasPassword ? LOCK_ICON : '') + icons + '</p>';
  }

  // 文字内容
  function textContent(html, needsCollapse) {
    if (!html) return '';
    var style = needsCollapse ? ' style="max-height: 120px; overflow: hidden; transition: max-height 0.3s ease;"' : '';
    var expandBtn = needsCollapse
      ? '<button class="expand-btn mt-1.5 flex h-6 items-center text-[13px] text-moments-link dark:text-moments-dark-link' + (needsCollapse ? '' : ' hidden') + '">' +
        '<span class="expand-text">展开</span>' +
        '<svg class="expand-icon ml-0.5 h-3 w-3 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6" /></svg></button>'
      : '';
    return '<div class="moment-body-container mt-[3px]">' +
      '<div class="moment-body text-[15px] leading-[24px] text-moments-text dark:text-moments-dark-text break-words sm:text-[16px]"' + style + '>' +
      html + '</div>' + expandBtn + '</div>';
  }

  // 图片九宫格
  function imageGrid(images) {
    if (!images || images.length === 0) return '';
    var count = images.length;
    var wrapperClass = count === 1 ? 'w-2/3' : count === 2 ? 'w-2/3 grid-cols-2' : 'w-[calc(100%-50px)] grid-cols-3';
    var thumbClass = count === 1 ? 'aspect-[4/3]' : 'aspect-square';

    var thumbs = images.map(function (src, i) {
      return '<div class="image-thumb relative cursor-zoom-in overflow-hidden bg-moments-divider dark:bg-moments-dark-divider ' + thumbClass + '" data-index="' + i + '">' +
        '<img src="' + esc(src) + '" alt="图片 ' + (i + 1) + '" class="image-thumb-img absolute left-0 top-0 h-full w-full object-cover" loading="lazy" />' +
        '<div class="image-error-placeholder hidden absolute inset-0 items-center justify-center bg-moments-divider dark:bg-moments-dark-divider">' +
        '<svg class="h-8 w-8 text-moments-sub dark:text-moments-dark-sub opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>' +
        '</div></div>';
    }).join('');

    return '<div class="image-grid mt-2 grid gap-1 ' + wrapperClass + '" data-images="' + esc(JSON.stringify(images)) + '">' + thumbs + '</div>';
  }

  // 音乐播放器
  function musicPlayer(c) {
    return '<figure class="music-player-container relative z-0 mt-1 w-2/3 overflow-hidden">' +
      '<span class="absolute inset-0 z-[-2] bg-cover bg-left opacity-30" style="background-image: url(' + esc(c.music_cover) + ');"></span>' +
      '<span class="absolute inset-0 z-[-1] bg-gradient-to-r from-transparent to-moments-card backdrop-blur-[100px] dark:to-moments-dark-card"></span>' +
      '<div class="audio-meta relative flex items-center pr-[46px]">' +
      '<span class="music-cover block h-[72px] w-[72px] shrink-0 sm:h-[84px] sm:w-[84px]">' +
      '<img src="' + esc(c.music_cover) + '" alt="' + esc(c.music_title) + '" class="h-full w-full rounded-l-[4px] object-cover opacity-90" loading="lazy" /></span>' +
      '<figcaption class="music-meta min-w-0 px-2">' +
      '<span class="music-title block truncate text-[15px] leading-[22px] text-moments-text dark:text-moments-dark-text opacity-90">' + esc(c.music_title) + '</span>' +
      '<span class="music-artist mt-[2px] block truncate text-[13px] leading-[18px] text-moments-text dark:text-moments-dark-text opacity-60">' + esc(c.music_artist) + '</span>' +
      '</figcaption></div>' +
      '<button type="button" class="music-play-btn absolute top-1/2 right-[8px] flex h-[30px] w-[30px] -translate-y-1/2 items-center justify-center" aria-label="播放/暂停">' +
      '<img src="/icons/post.content.audio.play.light.svg" alt="" class="music-ico-play h-[30px] w-[30px]" />' +
      '<img src="/icons/post.content.audio.pause.light.svg" alt="" class="music-ico-pause hidden h-[30px] w-[30px]" /></button>' +
      '<audio class="music-audio hidden" preload="metadata"><source src="' + esc(c.music_src) + '" /></audio>' +
      '</figure>';
  }

  // 视频播放器
  function videoPlayer(c) {
    return '<div class="video-wrapper mt-2 w-[calc(100%-50px)] bg-black relative">' +
      '<video class="video-el max-h-[50vh] w-full rounded-[4px] bg-black object-contain" controls playsinline preload="metadata"><source src="' + esc(c.video_src) + '" /></video>' +
      '<div class="video-error hidden absolute inset-0 items-center justify-center bg-black/80"><div class="text-center text-white/70">' +
      '<svg class="mx-auto mb-2 h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="5 3 19 12 5 21 5 3" /></svg>' +
      '<span class="text-[13px]">视频加载失败</span></div></div></div>';
  }

  // 密码保护表单
  function passwordForm(momentId) {
    return '<form class="password-form" data-moment-id="' + esc(momentId) + '" onsubmit="return false;">' +
      '<div class="password-input-group"><input type="password" class="password-field" inputmode="numeric" placeholder="密码" autocomplete="off" />' +
      '<label class="password-label">输入密码显示内容</label><hr class="password-line" /></div>' +
      '<div class="password-submit-area"><button type="button" class="password-btn">提交</button></div></form>';
  }

  // 菜单弹出框（赞/评论）
  function menuPopover(momentId) {
    return '<div class="relative" data-menu-root="' + esc(momentId) + '">' +
      '<button type="button" class="menu-trigger flex h-[20px] w-[30px] items-center justify-center rounded-[4px] bg-moments-aside dark:bg-moments-dark-aside" aria-label="更多操作">' +
      '<img src="/icons/post.fun.ico.light.svg" alt="" class="menu-ico-light h-[20px] w-[20px]" />' +
      '<img src="/icons/post.fun.ico.dark.svg" alt="" class="menu-ico-dark hidden h-[20px] w-[20px]" /></button>' +
      '<div class="menu-popover absolute top-1/2 right-full z-30 hidden" style="transform: translateY(-50%); margin-right: 10px;" role="menu">' +
      '<div class="menu-popover-inner whitespace-nowrap rounded-[4px] bg-moments-menu dark:bg-moments-dark-menu" style="padding: 8px 0px; height: 40px; box-sizing: border-box;">' +
      '<div class="flex items-center h-full">' +
      '<div class="menu-action-like relative h-[24px] text-[16px] leading-[24px] text-white cursor-pointer" style="margin: 0 20px; padding-left: 22px; background-image: url(/icons/post.fun.btn.like.svg); background-position: 0 50%; background-repeat: no-repeat;" data-action="like" data-liked="0">赞</div>' +
      '<div class="w-[1px] h-[16px] bg-white/30"></div>' +
      '<div class="menu-action-comment h-[24px] text-[16px] leading-[24px] text-white cursor-pointer" style="margin: 0 20px; padding-left: 22px; background-image: url(/icons/post.fun.btn.comment.svg); background-position: 0 50%; background-repeat: no-repeat;" data-action="comment">评论</div>' +
      '</div></div></div></div>';
  }

  // 渲染单条动态卡片
  window.MomentTemplate = function (moment, isLast = false) {
    var c = moment.content || {};
    var hasPwd = !!moment.hasPassword;
    var isPinned = moment.sort_order > 0;
    var isPrivate = moment.isPrivate === true || moment.is_private === 1;

    // 内容区域 HTML
    var contentHtml = '';
    if (c.type === 'text' && c.html) {
      contentHtml = textContent(c.html, moment.needsCollapse);
    } else if (c.type === 'images') {
      if (c.html) contentHtml = textContent(c.html, moment.needsCollapse);
      contentHtml += imageGrid(c.images || []);
    } else if (c.type === 'music') {
      if (c.html) contentHtml = textContent(c.html, moment.needsCollapse);
      contentHtml += musicPlayer(c);
    } else if (c.type === 'video') {
      if (c.html) contentHtml = textContent(c.html, moment.needsCollapse);
      contentHtml += videoPlayer(c);
    }

    // 组装完整卡片（点击进入详情页需通过 CSS 开关 --moment-card-clickable 启用）
    var routeId = moment.routeId || moment.id;
    var html = '<article class="px-[20px] pt-[12px] sm:px-[25px] sm:pt-[15px] moment-card" data-moment-id="' + esc(moment.id) + '" data-moment-route-id="' + esc(routeId) + '">' +
      '<div class="flex gap-[12px] sm:gap-[14px]">' +
      avatar(moment.avatar) +
      '<div class="min-w-0 flex-1">' +
      nickname(moment.author, hasPwd, isPinned, isPrivate);

    // 内容包装器（有密码保护时隐藏）
    var wrapperClass = 'moment-content-wrapper';
    if (hasPwd) wrapperClass += ' moment-content-hidden';
    // 内容区添加 moment-clickable-content，阻止卡片整体点击时触发跳转
    html += '<div class="' + wrapperClass + ' moment-clickable-content" data-moment-id="' + esc(moment.id) + '" data-content-wrapper>' + contentHtml + '</div>';

    // 密码保护表单
    if (hasPwd) {
      html += passwordForm(moment.id);
    }

    // 时间 + 菜单
    var menuWrapperClass = 'shrink-0';
    if (hasPwd) menuWrapperClass += ' hidden';
    html += '<div class="py-3.5 flex items-center justify-between">' +
      '<div class="flex min-w-0 items-center gap-2 whitespace-nowrap text-[14px] leading-[22px] text-moments-sub dark:text-moments-dark-sub">' +
      '<span class="shrink-0 relative-time" data-date="' + esc(moment.createdAt) + '">' + esc(moment.createdAt) + '</span>' +
      (moment.location ? '<span class="truncate">' + esc(moment.location) + '</span>' : '') +
      '</div>' +
      '<div class="' + menuWrapperClass + '" data-menu-wrapper>' + menuPopover(moment.id) + '</div>' +
      '</div>';

    html += '</div></div></article>';

    // 分隔线
    if (!isLast) {
      html += '<div class="ml-[68px] mr-[20px] h-px bg-moments-divider dark:bg-moments-dark-divider sm:ml-[75px] sm:mr-[25px]"></div>';
    }

    return html;
  };
})();
