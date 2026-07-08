(function () {
  'use strict';

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

  var relativeTime = {
    format: function (dateStr) {
      if (!dateStr) return '';
      var datePart = dateStr.split('T')[0];
      var parts = datePart.split('-');
      if (parts.length < 3) return dateStr;
      var year = parseInt(parts[0], 10);
      var month = parseInt(parts[1], 10) - 1;
      var day = parseInt(parts[2], 10);
      var date = new Date(year, month, day);
      var now = new Date();
      var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      var diffTime = today.getTime() - date.getTime();
      var diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays === 0) return '今天';
      if (diffDays === 1) return '昨天';
      if (diffDays < 30) return diffDays + '天前';
      if (diffDays < 365) return Math.floor(diffDays / 30) + '个月前';
      return Math.floor(diffDays / 365) + '年前';
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

  var passwordProtect = {
    sha256: async function (message) {
      var encoder = new TextEncoder();
      var data = encoder.encode(message);
      var hashBuffer = await crypto.subtle.digest('SHA-256', data);
      var hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(function (b) {
        return b.toString(16).padStart(2, '0');
      }).join('');
    },
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
      var correctHash = form.getAttribute('data-password-hash');
      var input = form.querySelector('.password-field');
      var submitBtn = form.querySelector('.password-btn');
      if (!momentId || !correctHash || !input || !submitBtn) return;
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
        var userHash = await self.sha256(input.value.trim());
        if (userHash === correctHash) {
          self.unlock(momentId);
          form.style.maxHeight = form.offsetHeight + 'px';
          form.offsetHeight;
          form.classList.add('unlocking');
          if (contentWrapper) {
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
          }
          if (menuWrapper) menuWrapper.classList.remove('hidden');
          setTimeout(function () { form.remove(); }, 300);
        } else {
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

  var musicPlayer = {
    pauseAll: function (exceptAudio) {
      var all = document.querySelectorAll('.music-audio');
      for (var i = 0; i < all.length; i++) {
        var audio = all[i];
        if (audio !== exceptAudio) {
          audio.pause();
          audio.currentTime = 0;
          var container = audio.closest('.music-player-container');
          if (container) {
            utils.toggleHidden(container.querySelector('.music-ico-play'), false);
            utils.toggleHidden(container.querySelector('.music-ico-pause'), true);
          }
        }
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
            utils.toggleHidden(playIconEl, true);
            utils.toggleHidden(pauseIconEl, false);
          });
          audioEl.addEventListener('pause', function () {
            utils.toggleHidden(playIconEl, false);
            utils.toggleHidden(pauseIconEl, true);
          });
          audioEl.addEventListener('ended', function () {
            utils.toggleHidden(playIconEl, false);
            utils.toggleHidden(pauseIconEl, true);
            audioEl.currentTime = 0;
          });
        })(btn, audio, playIcon, pauseIcon);
      }
    }
  };

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

  var coverDarkMode = {
    init: function () {
      var coverImg = document.querySelector('.cover-img');
      if (utils.isBound(coverImg)) return;
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

  var infiniteScroll = {
    init: function () {
      var container = document.getElementById('moments-container');
      if (!container || utils.isBound(container)) return;
      var pageSize = parseInt(container.dataset.pageSize) || 5;
      var hidden = Array.prototype.slice.call(container.querySelectorAll('.moment-hidden'));
      var loading = false;

      var loadMore = function () {
        if (loading || hidden.length === 0) return;
        loading = true;
        var loadingEl = document.querySelector('.loading-indicator');
        if (loadingEl) loadingEl.style.display = 'block';
        setTimeout(function () {
          var batch = hidden.splice(0, pageSize);
          for (var i = 0; i < batch.length; i++) {
            batch[i].classList.remove('hidden');
          }
          relativeTime.init();
          menu.init();
          musicPlayer.init();
          imageViewer.init();
          expandButton.init();
          passwordProtect.init();
          mediaError.init();
          if (hidden.length === 0) {
            if (loadingEl) loadingEl.style.display = 'none';
            var noMoreEl = document.createElement('div');
            noMoreEl.className = 'py-6 text-center text-[12px] text-moments-sub dark:text-moments-dark-sub';
            noMoreEl.innerHTML = '<span>—— 没有更多了 ——</span>';
            container.appendChild(noMoreEl);
          }
          loading = false;
        }, 500);
      };
      var handleScroll = function () {
        if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 100) {
          loadMore();
        }
      };
      window.addEventListener('scroll', utils.throttle(handleScroll, 200), { passive: true });
    }
  };

  var initAll = function () {
    relativeTime.init();
    coverDarkMode.init();
    musicPlayer.init();
    imageViewer.init();
    menu.init();
    expandButton.init();
    passwordProtect.init();
    mediaError.init();
    floatingButtons.init();
    infiniteScroll.init();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  document.addEventListener('astro:after-swap', initAll);
})();