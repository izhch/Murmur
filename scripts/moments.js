/**
 * 前端交互逻辑（纯动态版本）
 * 数据从 Worker API 加载，通过 MomentTemplate 渲染卡片
 * 所有交互模块（相对时间、密码保护、音乐播放器等）通过扫描 DOM 绑定
 */
(function () {
  'use strict';

  // Worker API 地址（部署后可通过 window.MURMUR_API 覆盖）
  var API_BASE = window.__CONFIG__ && window.__CONFIG__.apiBase ? window.__CONFIG__.apiBase : (window.MURMUR_API || 'https://murmur.3103231032.workers.dev');
  // 首页分页大小
  var PAGE_SIZE = 5;

  // ========== 工具函数 ==========

  var utils = {
    throttle: function (fn, wait) {
      var lastTime = 0;
      return function () {
        var now = Date.now();
        if (now - lastTime >= wait) {
          lastTime = now;
          fn.apply(this, arguments);
        }
      };
    },
    isBound: function (el) {
      if (!el) return true;
      if (el.dataset.bound) return true;
      el.dataset.bound = '1';
      return false;
    },
    toggleHidden: function (el, hide) {
      if (!el) return;
      el.classList.toggle('hidden', hide);
    },
    getErrorReason: function (err) {
      if (!err) return '加载失败，请稍后重试';
      var msg = err.message || String(err);
      if (err.name === 'AbortError') return '请求超时，请稍后重试';
      if (msg.indexOf('Failed to fetch') >= 0 || msg.indexOf('NetworkError') >= 0 || msg.indexOf('Load failed') >= 0) {
        return '网络连接失败，请检查网络后重试';
      }
      if (msg.indexOf('CORS') >= 0) return '跨域访问被阻止，请检查 API 配置';
      if (msg.indexOf('HTTP 5') >= 0) return '服务器内部错误，请稍后重试';
      if (msg.indexOf('HTTP 404') >= 0) return '资源不存在';
      if (msg.indexOf('HTTP 403') >= 0) return '没有访问权限';
      if (msg.indexOf('HTTP 4') >= 0) return '请求失败 (' + msg + ')';
      return '加载失败，请稍后重试';
    }
  };

  var eventBus = {
    on: function (eventName, handler) {
      document.addEventListener(eventName, handler);
    },
    emit: function (eventName, detail) {
      var event = new CustomEvent(eventName, { detail: detail });
      document.dispatchEvent(event);
    }
  };

  // ========== 相对时间 ==========

  var relativeTime = {
    format: function (dateStr) {
      if (!dateStr) return '';
      var date = new Date(dateStr.replace(/-/g, '/'));
      if (isNaN(date.getTime())) return dateStr;
      var now = new Date();
      var diff = now.getTime() - date.getTime();
      var diffSeconds = Math.floor(diff / 1000);
      var diffMinutes = Math.floor(diffSeconds / 60);
      var diffHours = Math.floor(diffMinutes / 60);
      var diffDays = Math.floor(diffHours / 24);

      if (diffSeconds < 60) return '刚刚';
      if (diffMinutes < 60) return diffMinutes + '分钟前';
      if (diffHours < 24) return diffHours + '小时前';
      if (diffDays < 30) return diffDays + '天前';
      // 超过30天显示年月日
      return date.getFullYear() + '-' +
        String(date.getMonth() + 1).padStart(2, '0') + '-' +
        String(date.getDate()).padStart(2, '0');
    },
    init: function () {
      var els = document.querySelectorAll('.relative-time');
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (utils.isBound(el)) continue;
        var dateStr = el.getAttribute('data-date');
        if (dateStr) el.textContent = this.format(dateStr);
      }
    }
  };

  // ========== 密码保护 ==========

  var passwordProtect = {
    isUnlocked: function (momentId) {
      return sessionStorage.getItem('moment_unlocked_' + momentId) === 'true';
    },
    unlock: function (momentId) {
      sessionStorage.setItem('moment_unlocked_' + momentId, 'true');
      eventBus.emit('moment-unlocked', { momentId: momentId });
    },
    init: function () {
      var forms = document.querySelectorAll('.password-form');
      for (var i = 0; i < forms.length; i++) {
        var form = forms[i];
        if (utils.isBound(form)) continue;
        this._setupForm(form);
      }
    },
    _setupForm: function (form) {
      var momentId = form.getAttribute('data-moment-id');
      var input = form.querySelector('.password-field');
      var submitBtn = form.querySelector('.password-btn');
      if (!momentId || !input || !submitBtn) return;
      var card = form.closest('article[data-moment-id]');
      var contentWrapper = card ? card.querySelector('[data-content-wrapper]') : null;
      var menuWrapper = card ? card.querySelector('[data-menu-wrapper]') : null;

      if (this.isUnlocked(momentId)) {
        if (contentWrapper) contentWrapper.classList.remove('moment-content-hidden');
        if (menuWrapper) menuWrapper.classList.remove('hidden');
        form.remove();
        return;
      }

      var self = this;
      var verifyPassword = async function () {
        var password = input.value.trim();
        if (!password) return;
        submitBtn.disabled = true;
        submitBtn.textContent = '验证中...';
        try {
          var res = await fetch(API_BASE + '/api/moments/' + encodeURIComponent(momentId) + '/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: password })
          });
          var data = await res.json();
          if (data.ok && data.moment) {
            self.unlock(momentId);
            form.style.maxHeight = form.offsetHeight + 'px';
            form.offsetHeight;
            form.classList.add('unlocking');
            if (contentWrapper) {
              var fullMoment = data.moment;
              var templateHtml = window.MomentTemplate(fullMoment, true);
              var tempDiv = document.createElement('div');
              tempDiv.innerHTML = templateHtml;
              var newContent = tempDiv.querySelector('[data-content-wrapper]');
              contentWrapper.innerHTML = newContent ? newContent.innerHTML : '';
              contentWrapper.classList.remove('moment-content-hidden');
              var originalHeight = contentWrapper.scrollHeight;
              contentWrapper.style.maxHeight = '0';
              contentWrapper.classList.add('unlocking');
              contentWrapper.offsetHeight;
              requestAnimationFrame(function () {
                contentWrapper.style.maxHeight = originalHeight + 'px';
                contentWrapper.classList.add('shown');
              });
              setTimeout(function () {
                contentWrapper.style.maxHeight = '';
                contentWrapper.classList.remove('unlocking', 'shown');
              }, 400);
              document.dispatchEvent(new CustomEvent('moments-loaded', { detail: { page: 0, count: 1 } }));
            }
            if (menuWrapper) menuWrapper.classList.remove('hidden');
            setTimeout(function () { form.remove(); }, 300);
          } else {
            submitBtn.disabled = false;
            submitBtn.textContent = '提交';
            form.classList.add('error');
            input.value = '';
            input.focus();
            setTimeout(function () { form.classList.remove('error'); }, 300);
          }
        } catch (err) {
          submitBtn.disabled = false;
          submitBtn.textContent = '提交';
          form.classList.add('error');
          input.value = '';
          input.focus();
          setTimeout(function () { form.classList.remove('error'); }, 300);
        }
      };
      submitBtn.addEventListener('click', verifyPassword);
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') verifyPassword();
      });
    }
  };

  // ========== 音乐播放器 ==========

var musicPlayer = {
  _currentPlaying: null,
  pauseAll: function (exceptAudio) {
    if (this._currentPlaying && this._currentPlaying !== exceptAudio) {
      this._currentPlaying.pause();
      this._currentPlaying.currentTime = 0;
      var container = this._currentPlaying.closest('.music-player-container');
      if (container) {
        utils.toggleHidden(container.querySelector('.music-ico-play'), false);
        utils.toggleHidden(container.querySelector('.music-ico-pause'), true);
      }
      this._currentPlaying = null;
    }
  },
    init: function () {
      var btns = document.querySelectorAll('.music-play-btn');
      for (var i = 0; i < btns.length; i++) {
        var btn = btns[i];
        if (utils.isBound(btn)) continue;
        var container = btn.closest('.music-player-container');
        if (!container) continue;
        var audio = container.querySelector('.music-audio');
        var playIcon = container.querySelector('.music-ico-play');
        var pauseIcon = container.querySelector('.music-ico-pause');
        if (!audio || !playIcon || !pauseIcon) continue;

        (function (btnEl, audioEl, playIconEl, pauseIconEl) {
          btnEl.addEventListener('click', function () {
            if (audioEl.paused) {
              musicPlayer.pauseAll(audioEl);
              audioEl.play().catch(function () {});
            } else {
              audioEl.pause();
            }
          });
          audioEl.addEventListener('play', function () {
            musicPlayer._currentPlaying = audioEl;
            utils.toggleHidden(playIconEl, true);
            utils.toggleHidden(pauseIconEl, false);
          });
          audioEl.addEventListener('pause', function () {
            musicPlayer._currentPlaying = null;
            utils.toggleHidden(playIconEl, false);
            utils.toggleHidden(pauseIconEl, true);
          });
          audioEl.addEventListener('ended', function () {
            musicPlayer._currentPlaying = null;
            utils.toggleHidden(playIconEl, false);
            utils.toggleHidden(pauseIconEl, true);
            audioEl.currentTime = 0;
          });
        })(btn, audio, playIcon, pauseIcon);
      }
    }
  };

  // ========== 展开/收起 ==========

  var expandButton = {
    init: function () {
      var containers = document.querySelectorAll('.moment-body-container');
      for (var i = 0; i < containers.length; i++) {
        var container = containers[i];
        if (utils.isBound(container)) continue;
        var body = container.querySelector('.moment-body');
        var btn = container.querySelector('.expand-btn');
        var text = container.querySelector('.expand-text');
        var icon = container.querySelector('.expand-icon');
        if (!body || !btn || !text || !icon) continue;

        (function (bodyEl, btnEl, textEl, iconEl) {
          var maxHeight = 120;
          var isExpanded = false;
          btnEl.addEventListener('click', function (e) {
            e.stopPropagation();
            isExpanded = !isExpanded;
            bodyEl.style.maxHeight = isExpanded ? bodyEl.scrollHeight + 'px' : maxHeight + 'px';
            textEl.textContent = isExpanded ? '收起' : '展开';
            iconEl.style.transform = isExpanded ? 'rotate(180deg)' : 'rotate(0deg)';
          });
        })(body, btn, text, icon);
      }
    }
  };

  // ========== 媒体加载失败处理 ==========

  var mediaError = {
    init: function () {
      var imgs = document.querySelectorAll('.image-thumb-img');
      for (var i = 0; i < imgs.length; i++) {
        var img = imgs[i];
        if (utils.isBound(img)) continue;
        img.addEventListener('error', function () {
          this.style.display = 'none';
          var placeholder = this.parentElement.querySelector('.image-error-placeholder');
          if (placeholder) {
            placeholder.classList.remove('hidden');
            placeholder.style.display = 'flex';
          }
        });
      }
      var videos = document.querySelectorAll('.video-el');
      for (var k = 0; k < videos.length; k++) {
        var video = videos[k];
        if (utils.isBound(video)) continue;
        video.addEventListener('error', function () {
          var errEl = this.parentElement.querySelector('.video-error');
          if (errEl) {
            errEl.classList.remove('hidden');
            errEl.style.display = 'flex';
          }
        });
      }
    }
  };

  // ========== 图片查看器 ==========

  var imageViewer = {
    _cleanup: null,
    open: function (images, startIndex) {
      var existing = document.getElementById('image-viewer');
      if (existing) {
        existing.remove();
        if (this._cleanup) { this._cleanup(); this._cleanup = null; }
      }
      var viewer = document.createElement('div');
      viewer.id = 'image-viewer';
      viewer.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/90';
      viewer.innerHTML =
        '<button class="viewer-close absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white" aria-label="关闭">\u00d7</button>' +
        '<button class="viewer-prev absolute left-4 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white" aria-label="上一张">\u2039</button>' +
        '<button class="viewer-next absolute right-4 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white" aria-label="下一张">\u203a</button>' +
        '<img class="viewer-img max-h-[90vh] max-w-[90vw] object-contain" src="' + images[startIndex] + '" alt="" />';
      document.body.appendChild(viewer);

      var current = startIndex;
      var img = viewer.querySelector('.viewer-img');
      var closeBtn = viewer.querySelector('.viewer-close');
      var prevBtn = viewer.querySelector('.viewer-prev');
      var nextBtn = viewer.querySelector('.viewer-next');

      var show = function (idx) {
        current = idx;
        if (current < 0) current = images.length - 1;
        if (current >= images.length) current = 0;
        img.src = images[current];
      };
      var onClose = function () { viewer.remove(); cleanup(); };
      var onPrev = function (e) { e.stopPropagation(); show(current - 1); };
      var onNext = function (e) { e.stopPropagation(); show(current + 1); };

      closeBtn.addEventListener('click', onClose);
      prevBtn.addEventListener('click', onPrev);
      nextBtn.addEventListener('click', onNext);

      var cleanup = function () {
        closeBtn.removeEventListener('click', onClose);
        prevBtn.removeEventListener('click', onPrev);
        nextBtn.removeEventListener('click', onNext);
        imageViewer._cleanup = null;
      };
      this._cleanup = cleanup;
    },
    init: function () {
      var grids = document.querySelectorAll('.image-grid');
      for (var i = 0; i < grids.length; i++) {
        var grid = grids[i];
        if (utils.isBound(grid)) continue;
        var images;
        try {
          images = JSON.parse(grid.dataset.images);
        } catch (e) { continue; }
        var thumbs = grid.querySelectorAll('.image-thumb');
        for (var j = 0; j < thumbs.length; j++) {
          (function (idx, imgs) {
            thumbs[idx].addEventListener('click', function () {
              imageViewer.open(imgs, idx);
            });
          })(j, images);
        }
      }
      if (window.__imageViewerBound) return;
      window.__imageViewerBound = true;
      document.addEventListener('click', function (e) {
        var viewer = document.getElementById('image-viewer');
        if (viewer && e.target === viewer) {
          viewer.remove();
          if (imageViewer._cleanup) imageViewer._cleanup();
        }
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          var viewer = document.getElementById('image-viewer');
          if (viewer) {
            viewer.remove();
            if (imageViewer._cleanup) imageViewer._cleanup();
          }
        }
      });
    }
  };

  // ========== 赞/评论菜单 ==========

  var menu = {
    init: function () {
      var roots = document.querySelectorAll('[data-menu-root]');
      for (var i = 0; i < roots.length; i++) {
        var root = roots[i];
        if (utils.isBound(root)) continue;
        var trigger = root.querySelector('.menu-trigger');
        var popover = root.querySelector('.menu-popover');
        if (!trigger || !popover) continue;

        (function (triggerEl, popoverEl) {
          triggerEl.addEventListener('click', function (e) {
            e.stopPropagation();
            var all = document.querySelectorAll('.menu-popover');
            for (var j = 0; j < all.length; j++) {
              if (all[j] !== popoverEl) all[j].classList.add('hidden');
            }
            popoverEl.classList.toggle('hidden');
          });

          var likeBtn = popoverEl.querySelector('.menu-action-like');
          if (likeBtn) {
            likeBtn.addEventListener('click', function (e) {
              e.stopPropagation();
              var isLiked = this.dataset.liked === '1';
              this.dataset.liked = isLiked ? '0' : '1';
              this.textContent = isLiked ? '赞' : '取消';
              this.style.backgroundImage = isLiked ? 'url(/icons/post.fun.btn.like.svg)' : 'url(/icons/post.fun.btn.liked.svg)';
            });
          }
        })(trigger, popover);
      }
      if (window.__menuOutsideBound) return;
      window.__menuOutsideBound = true;
      document.addEventListener('click', function (e) {
        if (e.target.closest('[data-menu-root]')) return;
        var all = document.querySelectorAll('.menu-popover');
        for (var i = 0; i < all.length; i++) {
          all[i].classList.add('hidden');
        }
      });
    }
  };

  // ========== 封面暗色模式 ==========

  var coverDarkMode = {
    init: function () {
      var coverImg = document.querySelector('.cover-img');
      if (!coverImg || utils.isBound(coverImg)) return;
      var lightSrc = coverImg.dataset.coverLight || coverImg.src;
      var darkSrc = coverImg.dataset.coverDark || coverImg.src;
      var applyCover = function () {
        coverImg.src = document.documentElement.classList.contains('darkmode') ? darkSrc : lightSrc;
      };
      applyCover();
      var observer = new MutationObserver(applyCover);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    }
  };

  // ========== 浮动按钮 ==========

  var floatingButtons = {
    init: function () {
      var misc = document.getElementById('misc');
      var appearance = document.getElementById('appearance');
      var totop = document.getElementById('totop');
      if (!misc || !appearance || !totop || utils.isBound(misc)) return;

      appearance.addEventListener('click', function (e) {
        e.stopPropagation();
        document.documentElement.classList.toggle('darkmode');
      });
      totop.addEventListener('click', function (e) {
        e.stopPropagation();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      var handleScroll = function () {
        misc.classList.toggle('show', window.scrollY > document.documentElement.clientHeight / 2);
      };
      window.addEventListener('scroll', utils.throttle(handleScroll, 100), { passive: true });
      handleScroll();
    }
  };

  // ========== 动态加载器（替代原 infiniteScroll）==========

  var dynamicLoader = {
    _currentPage: 1,
    _hasMore: true,
    _loading: false,
    _isDetailPage: false,
    _container: null,

    init: function () {
      this._container = document.getElementById('moments-container');
      if (!this._container || utils.isBound(this._container)) return;

      // 判断是否是详情页（URL 存在 ?id= 查询参数，或路径以 /content/ 开头）
      var url = new URL(window.location.href);
      this._isDetailPage = url.searchParams.has('id') || url.pathname.startsWith('/content/');

      if (this._isDetailPage) {
        this._loadDetailPage();
      } else {
        this._loadHomePage();
      }
    },

    // 加载首页：支持静态降级
    // - 若 #moments-container 已有静态预渲染卡片，先绑定交互，再尝试 fetch API
    // - API 成功：清空容器用动态数据重新渲染（含私密/密码保护文章）
    // - API 失败：保留静态内容，不显示错误
    _loadHomePage: async function () {
      var self = this;

      // 检查容器是否已有静态预渲染的卡片
      var hasStaticContent = !!this._container.querySelector('article[data-moment-id]');

      if (hasStaticContent) {
        // 已有静态内容，先绑定交互（让用户立即可用）
        this._bindCardInteractions();
        // 移除可能存在的 loading-indicator（静态页已替换，保险起见）
        this._hideLoading();
      } else {
        // 无静态内容，显示加载提示
        this._showLoading();
      }

      this._loading = true;

      try {
        var headers = { 'Accept': 'application/json' };
        var token = localStorage.getItem('murmur_admin_token');
        if (token) headers['Authorization'] = 'Bearer ' + token;
        var res = await fetch(API_BASE + '/api/moments?page=1&size=' + PAGE_SIZE, {
          headers: headers
        });
        if (!res.ok) {
          throw new Error('HTTP ' + res.status);
        }
        var data = await res.json();
        var moments = data.moments || [];

        // API 成功：清空容器，用动态数据重新渲染
        self._container.innerHTML = '';
        self._hasMore = !!data.hasMore;
        self._currentPage = 1;

        for (var i = 0; i < moments.length; i++) {
          var isLast = !data.hasMore && i === moments.length - 1;
          var html = window.MomentTemplate(moments[i], isLast);
          self._container.insertAdjacentHTML('beforeend', html);
        }

        self._bindCardInteractions();
        eventBus.emit('moments-loaded', { page: 1, count: moments.length });

        if (!self._hasMore) {
          self._showNoMore();
        }
      } catch (err) {
        if (!hasStaticContent) {
          // 没有静态内容兜底，显示错误并提供重试
          console.error('加载动态失败:', err);
          var reason = utils.getErrorReason(err);
          self._showError(reason, function () { self._loadHomePage(); });
        } else {
          // 有静态内容兜底，保留静态内容，不显示错误
          console.warn('API 加载失败，保留静态内容:', err.message);
        }
      } finally {
        self._loading = false;
        self._hideLoading();
      }

      // 绑定滚动加载（用于加载后续分页）
      var handleScroll = function () {
        if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 100) {
          self._loadMore();
        }
      };
      window.addEventListener('scroll', utils.throttle(handleScroll, 200), { passive: true });
    },

    // 加载更多
    _loadMore: async function () {
      if (this._loading || !this._hasMore) return;
      await this._fetchAndRender(this._currentPage + 1);
    },

    // 获取并渲染一页数据
    _fetchAndRender: async function (page) {
      var self = this;
      this._loading = true;
      this._showLoading();

      try {
        var headers = { 'Accept': 'application/json' };
        var token = localStorage.getItem('murmur_admin_token');
        if (token) headers['Authorization'] = 'Bearer ' + token;
        var res = await fetch(API_BASE + '/api/moments?page=' + page + '&size=' + PAGE_SIZE, {
          headers: headers
        });
        if (!res.ok) {
          throw new Error('HTTP ' + res.status);
        }
        var data = await res.json();
        var moments = data.moments || [];
        self._hasMore = !!data.hasMore;
        self._currentPage = page;

        // 渲染卡片
        for (var i = 0; i < moments.length; i++) {
          var isLast = !data.hasMore && i === moments.length - 1;
          var html = window.MomentTemplate(moments[i], isLast);
          self._container.insertAdjacentHTML('beforeend', html);
        }

        // 绑定新卡片的交互
        self._bindCardInteractions();

        // 通知 admin.js 有新卡片加载完成
        eventBus.emit('moments-loaded', { page: page, count: moments.length });
      } catch (err) {
        console.error('加载动态失败:', err);
        var reason = utils.getErrorReason(err);
        self._showError(reason, function () { self._fetchAndRender(page); });
      } finally {
        self._loading = false;
        self._hideLoading();
        if (!self._hasMore && self._currentPage > 0) {
          self._showNoMore();
        }
      }
    },

    // 加载详情页：单条动态 + 上下篇导航，支持静态降级
    // - 若 #moments-container 已有静态预渲染卡片，先绑定交互，再尝试 fetch API
    // - API 成功：清空容器用动态数据重新渲染
    // - API 失败：保留静态内容，不显示错误
    _loadDetailPage: async function () {
      var self = this;
      var url = new URL(window.location.href);
      // 从 URL query 提取动态 ID：/?id=xxx → xxx
      // 或从路径提取：/content/xxx.html → xxx
      var id = url.searchParams.get('id');
      if (!id) {
        // 从 /content/xxx.html 提取 xxx
        var match = url.pathname.match(/^\/content\/([^/]+)\.html$/);
        if (match) {
          id = match[1];
        }
      }
      if (!id) {
        self._showError('无效的动态地址');
        return;
      }

      // 检查容器是否已有静态预渲染的卡片
      var hasStaticContent = !!this._container.querySelector('article[data-moment-id]');

      if (hasStaticContent) {
        // 已有静态内容，先绑定交互
        this._bindCardInteractions();
        this._hideLoading();
      } else {
        this._showLoading();
      }

      try {
        var detailHeaders = { 'Accept': 'application/json' };
        var detailToken = localStorage.getItem('murmur_admin_token');
        if (detailToken) detailHeaders['Authorization'] = 'Bearer ' + detailToken;
        var res = await fetch(API_BASE + '/api/moments/' + encodeURIComponent(id), {
          headers: detailHeaders
        });
        if (!res.ok) {
          if (!hasStaticContent) {
            self._showError('未找到该动态');
          }
          return;
        }
        var data = await res.json();
        var moment = data.moment;
        if (!moment) {
          if (!hasStaticContent) {
            self._showError('未找到该动态');
          }
          return;
        }

        // API 成功：清空容器，用动态数据重新渲染
        self._container.innerHTML = '';

        // 渲染单条卡片（isLast=true，不显示分隔线）
        var html = window.MomentTemplate(moment, true);
        self._container.insertAdjacentHTML('beforeend', html);

        // 渲染上下篇导航（使用 data-nav-id 避免整页刷新）
        if (data.prevId !== null && data.prevId !== undefined || data.nextId !== null && data.nextId !== undefined) {
          var navHtml = '<footer id="navigation" class="py-[10px]">' +
            '<nav class="ml-[68px] mr-[20px] flex items-center justify-between text-[14px] text-moments-sub dark:text-moments-dark-sub sm:ml-[75px] sm:mr-[25px]">';
          if (data.prevId) {
            navHtml += '<span data-nav-id="' + encodeURIComponent(data.prevId) + '" class="cursor-pointer hover:opacity-70">上一页</span>';
          } else {
            navHtml += '<span></span>';
          }
          if (data.nextId) {
            navHtml += '<span data-nav-id="' + encodeURIComponent(data.nextId) + '" class="cursor-pointer hover:opacity-70">下一页</span>';
          } else {
            navHtml += '<span></span>';
          }
          navHtml += '</nav></footer>';
          self._container.insertAdjacentHTML('beforeend', navHtml);
        }

        // 绑定交互
        self._bindCardInteractions();
        self._bindNavClick();
        eventBus.emit('moments-loaded', { detail: true });
      } catch (err) {
        if (!hasStaticContent) {
          console.error('加载详情失败:', err);
          var reason = utils.getErrorReason(err);
          self._showError(reason, function () { window.location.reload(); });
        } else {
          // 有静态内容兜底，保留静态内容
          console.warn('API 加载失败，保留静态内容:', err.message);
        }
      } finally {
        self._hideLoading();
      }
    },

    // 绑定所有卡片相关交互
    _bindCardInteractions: function () {
      relativeTime.init();
      menu.init();
      musicPlayer.init();
      imageViewer.init();
      expandButton.init();
      passwordProtect.init();
      mediaError.init();
      this._bindCardClick();
    },

    _bindCardClick: function () {
      var enabled = localStorage.getItem('moment-link-to-inner') !== '0';
      if (!enabled) return;
      var self = this;
      var articles = this._container.querySelectorAll('article[data-moment-id]');
      for (var i = 0; i < articles.length; i++) {
        var article = articles[i];
        if (article.dataset.clickBound) continue;
        article.dataset.clickBound = 'true';
        article.addEventListener('click', function (e) {
          if (self._isDetailPage) return;
          if (!e.target.closest('.moment-nickname')) return;
          var momentId = this.dataset.momentId;
          if (momentId) {
            window.location.href = '/?id=' + encodeURIComponent(momentId);
          }
        });
      }
    },

    // 绑定详情页上下篇导航点击（不刷新页面）
    _bindNavClick: function () {
      var self = this;
      var navItems = document.querySelectorAll('[data-nav-id]');
      for (var i = 0; i < navItems.length; i++) {
        var item = navItems[i];
        if (item.dataset.navBound) continue;
        item.dataset.navBound = 'true';
        item.addEventListener('click', function () {
          var navId = this.getAttribute('data-nav-id');
          if (navId) {
            if (window.history && window.history.pushState) {
              window.history.pushState(null, '', '/?id=' + navId);
            }
            self._loadDetailPage();
          }
        });
      }
    },

    // 显示加载中提示
    _showLoading: function () {
      var existing = this._container.querySelector('.loading-indicator');
      if (existing) return;
      var el = document.createElement('div');
      el.className = 'loading-indicator py-6 text-center';
      el.innerHTML = '<span class="loading-breath text-[14px] text-moments-sub dark:text-moments-dark-sub">正在加载...</span>';
      this._container.appendChild(el);
    },

    _hideLoading: function () {
      var el = this._container.querySelector('.loading-indicator');
      if (el) el.remove();
    },

    _showNoMore: function () {
      var existing = this._container.querySelector('.no-more-indicator');
      if (existing) return;
      var el = document.createElement('div');
      el.className = 'no-more-indicator py-6 text-center text-[12px] text-moments-sub dark:text-moments-dark-sub';
      el.innerHTML = '<span>—— 没有更多了 ——</span>';
      this._container.appendChild(el);
    },

    _showError: function (msg, onRetry) {
      this._hideError();
      var el = document.createElement('div');
      el.className = 'moments-error py-8 text-center text-[13px] text-red-500';
      el.innerHTML =
        '<div class="mb-1">' + msg + '</div>' +
        (onRetry ? '<button class="moments-retry-btn mt-2 rounded-[4px] border border-red-300 px-4 py-1.5 text-[12px] text-red-500 transition-colors hover:bg-red-50 dark:border-red-500/40 dark:hover:bg-red-500/10">重试</button>' : '');
      if (onRetry) {
        el.querySelector('.moments-retry-btn').addEventListener('click', function () {
          onRetry();
        });
      }
      this._container.appendChild(el);
    },

    _hideError: function () {
      var el = this._container.querySelector('.moments-error');
      if (el) el.remove();
    }
  };

  // ========== 初始化 ==========

  // 初始化页面级组件（不依赖卡片）
  function initPage() {
    coverDarkMode.init();
    floatingButtons.init();
  }

  // 初始化所有卡片交互（兼容旧调用方式）
  function initAll() {
    relativeTime.init();
    musicPlayer.init();
    imageViewer.init();
    menu.init();
    expandButton.init();
    passwordProtect.init();
    mediaError.init();
    bindCardClick();
  }

  // 绑定昵称点击跳转（受 moment-link-to-inner 设置控制）
  function bindCardClick() {
    var enabled = localStorage.getItem('moment-link-to-inner') !== '0';
    if (!enabled) return;
    var articles = document.querySelectorAll('article[data-moment-id]');
    for (var i = 0; i < articles.length; i++) {
      var article = articles[i];
      if (article.dataset.clickBound) continue;
      article.dataset.clickBound = 'true';
      article.addEventListener('click', function (e) {
        if (!e.target.closest('.moment-nickname')) return;
        var momentId = this.dataset.momentId;
        if (momentId && window.location.pathname === '/') {
          window.location.href = '/?id=' + encodeURIComponent(momentId);
        }
      });
    }
  }

  // 完整初始化流程
  function init() {
    initPage();
    dynamicLoader.init();
  }

  document.addEventListener('moment-saved', function () {
    var container = document.getElementById('moments-container');
    if (container) {
      container.innerHTML = '<div class="loading-indicator py-6 text-center"><span class="loading-breath text-[14px] text-moments-sub dark:text-moments-dark-sub">正在加载...</span></div>';
      dynamicLoader._currentPage = 1;
      dynamicLoader._hasMore = true;
      dynamicLoader._loadHomePage();
    }
  });

  document.addEventListener('moment-deleted', function () {
    var container = document.getElementById('moments-container');
    if (container) {
      container.innerHTML = '<div class="loading-indicator py-6 text-center"><span class="loading-breath text-[14px] text-moments-sub dark:text-moments-dark-sub">正在加载...</span></div>';
      dynamicLoader._currentPage = 1;
      dynamicLoader._hasMore = true;
      dynamicLoader._loadHomePage();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('astro:after-swap', init);
})();
