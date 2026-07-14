/**
 * 管理员功能脚本
 * 1. 登录验证（连续点击昵称 5 次触发登录弹窗）
 * 2. 登录后将赞/评论按钮替换为编辑/删除按钮（同一位置、同一布局）
 * 3. 发布/编辑弹窗（支持文字、图片、音乐、视频）
 * 4. 图片上传到 R2
 * 5. 删除确认
 */
(function () {
  'use strict';

  // Worker API 地址（部署后可通过 window.MURMUR_API 覆盖）
  var API_BASE = window.MURMUR_API || 'https://murmur.3103231032.workers.dev';
  // token 在 localStorage 的存储键
  var TOKEN_KEY = 'murmur_admin_token';

  // ========== 工具函数 ==========

  // 获取存储的 token
  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  // 判断是否已登录
  function isLoggedIn() {
    return !!getToken();
  }

  // 带鉴权头的 fetch 封装
  function authFetch(url, options) {
    options = options || {};
    options.headers = options.headers || {};
    options.headers['Authorization'] = 'Bearer ' + getToken();
    return fetch(url, options);
  }

  // HTML 转义
  function esc(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ========== 登录/登出 ==========

  var loginModal = {
    open: function () {
      var existing = document.getElementById('admin-login-modal');
      if (existing) existing.remove();

      var modal = document.createElement('div');
      modal.id = 'admin-login-modal';
      modal.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-black/50';
      modal.innerHTML =
        '<div class="w-[320px] rounded-[8px] bg-white p-6 shadow-xl dark:bg-moments-dark-card">' +
        '<h3 class="mb-5 text-center text-[16px] font-medium text-moments-text dark:text-moments-dark-text">管理员登录</h3>' +
        '<div class="mb-4">' +
        '<label class="mb-1.5 block text-[13px] text-moments-sub dark:text-moments-dark-sub">密码</label>' +
        '<div class="relative">' +
        '<input type="password" id="admin-pwd-input" placeholder="请输入密码" autocomplete="off" class="w-full rounded-[4px] border border-moments-divider px-3 py-2.5 pr-10 text-[14px] text-moments-text outline-none focus:border-moments-link focus:ring-1 focus:ring-moments-link/30 dark:border-moments-dark-divider dark:bg-moments-dark-bg dark:text-moments-dark-text" />' +
        '<button id="admin-pwd-toggle" type="button" class="absolute right-0 top-0 h-full w-10 flex items-center justify-center text-moments-sub dark:text-moments-dark-sub" title="显示密码">' +
        '<svg class="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>' +
        '</button>' +
        '</div>' +
        '</div>' +
        '<div class="mb-4 text-center text-[12px] text-red-500 hidden" id="admin-login-error"></div>' +
        '<div class="flex gap-2">' +
        '<button id="admin-login-cancel" class="flex-1 rounded-[4px] bg-moments-divider px-4 py-2.5 text-[14px] text-moments-text transition-colors hover:bg-moments-divider/80 dark:bg-moments-dark-divider dark:text-moments-dark-text">取消</button>' +
        '<button id="admin-login-confirm" class="flex-1 rounded-[4px] bg-moments-link px-4 py-2.5 text-[14px] text-white transition-colors hover:bg-moments-link/90">登录</button>' +
        '</div></div>';
      document.body.appendChild(modal);

      var pwdInput = modal.querySelector('#admin-pwd-input');
      var toggleBtn = modal.querySelector('#admin-pwd-toggle');
      var errorEl = modal.querySelector('#admin-login-error');
      pwdInput.focus();

      toggleBtn.addEventListener('click', function () {
        var type = pwdInput.type === 'password' ? 'text' : 'password';
        pwdInput.type = type;
        toggleBtn.innerHTML = type === 'password'
          ? '<svg class="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
          : '<svg class="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1 4.24 4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
      });

      var close = function () { modal.remove(); };
      modal.querySelector('#admin-login-cancel').addEventListener('click', close);
      modal.addEventListener('click', function (e) {
        if (e.target === modal) close();
      });

      var submit = async function () {
        var pwd = pwdInput.value.trim();
        if (!pwd) return;
        try {
          var res = await fetch(API_BASE + '/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pwd: pwd })
          });
          var data = await res.json();
          if (data.ok && data.token) {
            localStorage.setItem(TOKEN_KEY, data.token);
            close();
            admin.applyAdminMode();
          } else {
            errorEl.textContent = data.error || '登录失败';
            errorEl.classList.remove('hidden');
          }
        } catch (err) {
          errorEl.textContent = '网络错误';
          errorEl.classList.remove('hidden');
        }
      };
      modal.querySelector('#admin-login-confirm').addEventListener('click', submit);
      pwdInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') submit();
      });
    }
  };

  // ========== 个人资料弹窗 ==========

  var profileModal = {
    open: function () {
      var existing = document.getElementById('admin-profile-modal');
      if (existing) existing.remove();

      var modal = document.createElement('div');
      modal.id = 'admin-profile-modal';
      modal.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-black/50';
      modal.innerHTML =
        '<div class="w-[300px] rounded-[12px] bg-white shadow-[0_8px_40px_rgba(0,0,0,0.12)] dark:bg-moments-dark-card overflow-hidden" style="font-family: \'PingFang SC\', \'Hiragino Sans GB\', -apple-system, BlinkMacSystemFont, sans-serif;">' +
        '<div class="relative px-5 pt-5">' +
        '<button id="profile-close" type="button" class="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-[#a0a0a0] transition-colors hover:bg-[#f5f5f5] dark:text-moments-dark-sub dark:hover:bg-moments-dark-divider">' +
        '<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
        '</button>' +
        '</div>' +
        '<div class="px-6 pb-6 text-center">' +
        '<div class="mx-auto mb-3 h-[72px] w-[72px] rounded-full overflow-hidden bg-moments-divider dark:bg-moments-dark-divider">' +
        '<img src="/avatar/avatar.jpeg" alt="avatar" class="h-full w-full object-cover" />' +
        '</div>' +
        '<h3 class="mb-0.5 text-[18px] font-medium text-moments-text dark:text-moments-dark-text">向晚</h3>' +
        '<p class="mb-4 text-[13px] text-[#a0a0a0] dark:text-moments-dark-sub">管理员</p>' +
        '<div class="space-y-2">' +
        '<a href="/" class="flex items-center justify-center gap-2 w-full rounded-[6px] border border-[#e8e8e8] px-4 py-2.5 text-[13px] text-moments-text transition-colors hover:bg-[#f5f5f5] dark:border-moments-dark-divider dark:text-moments-dark-text dark:hover:bg-moments-dark-divider">' +
        '<svg class="h-[15px] w-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>' +
        '个人主页' +
        '</a>' +
        '<button id="profile-logout" class="flex items-center justify-center gap-2 w-full rounded-[6px] border border-[#e8e8e8] px-4 py-2.5 text-[13px] text-[#ff4d4f] transition-colors hover:bg-[#fff5f5] dark:border-moments-dark-divider dark:hover:bg-red-500/10">' +
        '<svg class="h-[15px] w-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>' +
        '退出登录' +
        '</button>' +
        '</div>' +
        '</div>' +
        '</div>';
      document.body.appendChild(modal);

      var close = function () { modal.remove(); };
      modal.querySelector('#profile-close').addEventListener('click', close);
      modal.addEventListener('click', function (e) {
        if (e.target === modal) close();
      });

      modal.querySelector('#profile-logout').addEventListener('click', function () {
        if (confirm('确定退出管理员模式？')) {
          close();
          admin.removeAdminMode();
        }
      });
    }
  };

  // ========== 管理员模式：替换赞/评论为编辑/删除 ==========

  var admin = {
    // 点击昵称计次
    _clickCount: 0,
    _clickTimer: null,

    initNicknameTrigger: function () {
      document.addEventListener('click', function (e) {
        var article = e.target.closest('article[data-moment-id]');
        if (!article) return;
        var nicknameEl = article.querySelector('p.text-moments-link, p[class*="text-moments-link"]');
        if (e.target !== nicknameEl) return;

        admin._clickCount++;
        if (admin._clickTimer) clearTimeout(admin._clickTimer);
        admin._clickTimer = setTimeout(function () {
          admin._clickCount = 0;
        }, 2000);

        if (admin._clickCount >= 5) {
          admin._clickCount = 0;
          if (isLoggedIn()) {
            profileModal.open();
          } else {
            loginModal.open();
          }
        }
      });
    },

    initLoginButton: function () {
      var loginBtn = document.getElementById('cover-login-btn');
      var editorBtn = document.getElementById('cover-editor-btn');
      if (loginBtn && !loginBtn.dataset.bound) {
        loginBtn.dataset.bound = '1';
        loginBtn.addEventListener('click', function () {
          if (isLoggedIn()) {
            profileModal.open();
          } else {
            loginModal.open();
          }
        });
      }
      if (editorBtn && !editorBtn.dataset.bound) {
        editorBtn.dataset.bound = '1';
        editorBtn.addEventListener('click', function () {
          if (isLoggedIn()) {
            editModal.open(null);
          } else {
            loginModal.open();
          }
        });
      }
    },

    // 应用管理员模式：替换所有卡片的赞/评论为编辑/删除
    applyAdminMode: function () {
      var menuRoots = document.querySelectorAll('[data-menu-root]');
      for (var i = 0; i < menuRoots.length; i++) {
        admin.replaceMenu(menuRoots[i]);
      }
      document.dispatchEvent(new CustomEvent('admin-mode-changed', { detail: { loggedIn: true } }));
    },

    // 移除管理员模式：恢复赞/评论
    removeAdminMode: function () {
      localStorage.removeItem(TOKEN_KEY);
      var menuRoots = document.querySelectorAll('[data-menu-root]');
      for (var i = 0; i < menuRoots.length; i++) {
        admin.restoreMenu(menuRoots[i]);
      }
      document.dispatchEvent(new CustomEvent('admin-mode-changed', { detail: { loggedIn: false } }));
    },

    // 替换单个菜单的赞/评论为编辑/删除
    replaceMenu: function (menuRoot) {
      if (menuRoot.dataset.adminReplaced === '1') return;
      menuRoot.dataset.adminReplaced = '1';

      var popover = menuRoot.querySelector('.menu-popover');
      if (!popover) return;

      // 保存原始内容以便恢复
      menuRoot.dataset.originalHtml = popover.innerHTML;

      // 替换为编辑/删除按钮（保持完全相同的布局结构）
      var momentId = menuRoot.getAttribute('data-menu-root');
      popover.innerHTML =
        '<div class="menu-popover-inner whitespace-nowrap rounded-[4px] bg-moments-menu dark:bg-moments-dark-menu" style="padding: 8px 0px; height: 40px; box-sizing: border-box;">' +
        '<div class="flex items-center h-full">' +
        // 编辑按钮（与"赞"完全相同的布局）
        '<div class="menu-action-edit relative h-[24px] text-[16px] leading-[24px] text-white cursor-pointer" style="margin: 0 20px; padding-left: 22px;" data-action="edit" data-moment-id="' + esc(momentId) + '">' +
        '<svg class="absolute left-0 top-1/2 -translate-y-1/2 h-[16px] w-[16px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' +
        '编辑</div>' +
        '<div class="w-[1px] h-[16px] bg-white/30"></div>' +
        '<div class="menu-action-delete relative h-[24px] text-[16px] leading-[24px] text-white cursor-pointer" style="margin: 0 20px; padding-left: 22px;" data-action="delete" data-moment-id="' + esc(momentId) + '">' +
        '<svg class="absolute left-0 top-1/2 -translate-y-1/2 h-[16px] w-[16px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
        '删除</div>' +
        '</div></div>';

      // 绑定编辑/删除事件
      var editBtn = popover.querySelector('.menu-action-edit');
      var deleteBtn = popover.querySelector('.menu-action-delete');
      if (editBtn) {
        editBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          popover.classList.add('hidden');
          editModal.open(momentId);
        });
      }
      if (deleteBtn) {
        deleteBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          popover.classList.add('hidden');
          deleteConfirm.open(momentId);
        });
      }
    },

    // 恢复单个菜单的赞/评论
    restoreMenu: function (menuRoot) {
      if (menuRoot.dataset.adminReplaced !== '1') return;
      delete menuRoot.dataset.adminReplaced;
      var popover = menuRoot.querySelector('.menu-popover');
      if (!popover) return;
      var original = menuRoot.dataset.originalHtml;
      if (original) {
        popover.innerHTML = original;
        delete menuRoot.dataset.originalHtml;
      }
    }
  };

  // ========== 删除确认 ==========

  var deleteConfirm = {
    open: function (momentId) {
      var modal = document.createElement('div');
      modal.id = 'admin-delete-modal';
      modal.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-black/50';
      modal.innerHTML =
        '<div class="w-[320px] rounded-[8px] bg-white p-6 shadow-xl dark:bg-moments-dark-card">' +
        '<div class="mb-4 flex justify-center">' +
        '<div class="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500 dark:bg-red-500/10">' +
        '<svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>' +
        '</div>' +
        '</div>' +
        '<h3 class="mb-2 text-center text-[16px] font-medium text-moments-text dark:text-moments-dark-text">确认删除？</h3>' +
        '<p class="mb-5 text-center text-[13px] text-moments-sub dark:text-moments-dark-sub">删除后无法恢复，此操作不可逆</p>' +
        '<div class="mb-4 text-center text-[12px] text-red-500 hidden" id="admin-delete-error"></div>' +
        '<div class="flex gap-2">' +
        '<button id="admin-delete-cancel" class="flex-1 rounded-[4px] bg-moments-divider px-4 py-2.5 text-[14px] text-moments-text transition-colors hover:bg-moments-divider/80 dark:bg-moments-dark-divider dark:text-moments-dark-text">取消</button>' +
        '<button id="admin-delete-confirm" class="flex-1 rounded-[4px] bg-red-500 px-4 py-2.5 text-[14px] text-white transition-colors hover:bg-red-600">删除</button>' +
        '</div></div>';
      document.body.appendChild(modal);

      var errorEl = modal.querySelector('#admin-delete-error');
      var close = function () { modal.remove(); };
      modal.querySelector('#admin-delete-cancel').addEventListener('click', close);
      modal.addEventListener('click', function (e) {
        if (e.target === modal) close();
      });

      modal.querySelector('#admin-delete-confirm').addEventListener('click', async function () {
        try {
          var res = await authFetch(API_BASE + '/api/moments/' + encodeURIComponent(momentId), {
            method: 'DELETE'
          });
          var data = await res.json();
          if (data.ok) {
            close();
            // 移除卡片元素
            var card = document.querySelector('article[data-moment-id="' + momentId + '"]');
            if (card) {
              // 同时移除紧跟的分隔线
              var next = card.nextElementSibling;
              if (next && next.classList.contains('bg-moments-divider') || (next && next.classList.contains('bg-moments-dark-divider'))) {
                next.remove();
              } else if (!next) {
                // 如果没有下一个元素，移除前一个分隔线
                var prev = card.previousElementSibling;
                if (prev && (prev.classList.contains('bg-moments-divider') || prev.classList.contains('bg-moments-dark-divider'))) {
                  prev.remove();
                }
              }
              card.remove();
            }
          } else {
            errorEl.textContent = data.error || '删除失败';
            errorEl.classList.remove('hidden');
          }
        } catch (err) {
          errorEl.textContent = '网络错误';
          errorEl.classList.remove('hidden');
        }
      });
    }
  };

  // ========== 编辑/发布弹窗 ==========

  var editModal = {
    // 打开弹窗：momentId 为 null 时是新建，否则是编辑
    open: async function (momentId) {
      var existing = document.getElementById('admin-edit-modal');
      if (existing) existing.remove();

      var isNew = !momentId;
      var moment = null;

      // 编辑模式：先拉取现有数据
      if (!isNew) {
        try {
          var res = await authFetch(API_BASE + '/api/moments/' + encodeURIComponent(momentId));
          var data = await res.json();
          if (data.moment) moment = data.moment;
        } catch (err) {
          alert('加载动态数据失败');
          return;
        }
      }

      var c = moment ? moment.content : {};
      var type = c.type || 'text';
      var html = c.html || '';
      // 从 HTML 反向提取纯文本（简单去标签）
      var plainText = html.replace(/<[^>]+>/g, '').replace(/<br>/g, '\n').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

      var modal = document.createElement('div');
      modal.id = 'admin-edit-modal';
      modal.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm';
      modal.innerHTML =
        '<div class="kam-modal relative max-h-[92vh] w-[480px] max-w-[95vw] overflow-y-auto rounded-[10px] bg-white shadow-[0_8px_40px_rgba(0,0,0,0.12)] dark:bg-moments-dark-card" style="font-family: \'PingFang SC\', \'Hiragino Sans GB\', -apple-system, BlinkMacSystemFont, \'Microsoft YaHei\', sans-serif; letter-spacing: 0.2px;">' +
        '<!-- 顶部导航栏 -->' +
        '<div class="flex items-center justify-end gap-3 border-b border-[#f0f0f0] px-4 py-2.5 text-[12px] text-[#a0a0a0] dark:border-moments-dark-divider dark:text-moments-dark-sub">' +
        '<button id="edit-logout" type="button" class="kam-topbar-btn" data-action="logout">' +
        '<svg class="h-[13px] w-[13px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>' +
        '<span>退出登录</span>' +
        '</button>' +
        '<button id="edit-close" type="button" class="kam-topbar-btn" data-action="close" title="关闭">' +
        '<svg class="h-[15px] w-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
        '</button>' +
        '</div>' +
        '<div class="px-6 pt-5 pb-6">' +

        '<!-- 内容 -->' +
        '<div class="mb-3">' +
        '<textarea id="edit-content" rows="4" placeholder="这一刻的想法..." class="kam-content-input">' + esc(plainText) + '</textarea>' +
        '</div>' +

        '<!-- 工具栏 -->' +
        '<div class="kam-toolbar mb-2.5 flex items-center gap-0.5 border-b border-[#f0f0f0] pb-2.5 dark:border-moments-dark-divider">' +
        '<button id="edit-tool-link" type="button" class="kam-tool-btn" title="链接">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M10 13a5 5 0 0 1 7.54.54l3-3a5 5 0 0 1-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 1-7.54-.54l-3 3a5 5 0 0 1 7.07 7.07l1.71-1.71"/></svg>' +
        '</button>' +
        '<button id="edit-tool-code" type="button" class="kam-tool-btn" title="代码">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>' +
        '</button>' +
        '<button id="edit-tool-bold" type="button" class="kam-tool-btn" title="加粗">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 4h7a4 4 0 0 1 0 8H6z"/><path d="M6 12h8a4 4 0 0 1 0 8H6z"/></svg>' +
        '</button>' +
        '<button id="edit-tool-italic" type="button" class="kam-tool-btn" title="斜体">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>' +
        '</button>' +
        '<button id="edit-tool-strike" type="button" class="kam-tool-btn" title="删除线">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M16 6.5a4 4 0 0 0-3.69-2H12a4 4 0 0 0 0 8h0a4 4 0 0 1 0 8h-1.5"/><line x1="4" y1="12" x2="20" y2="12"/></svg>' +
        '</button>' +
        '<button id="edit-tool-html" type="button" class="kam-tool-btn" title="HTML">' +
        '<span class="text-[13px] font-mono leading-none">&lt;/&gt;</span>' +
        '</button>' +
        '</div>' +

        '<!-- 位置选择器 -->' +
        '<div class="mb-3 relative">' +
        '<div id="edit-location-display" class="flex items-center gap-1.5 rounded-[4px] bg-[#f7f7f7] px-2.5 py-1.5 cursor-pointer transition-all hover:bg-[#f0f0f0] dark:bg-moments-dark-divider/50 dark:hover:bg-moments-dark-divider">' +
        '<svg class="h-[13px] w-[13px] text-[#999] dark:text-moments-dark-sub" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>' +
        '<span id="edit-location-label" class="flex-1 text-[11px] ' + (moment && moment.location ? 'text-[#666] dark:text-moments-dark-text' : 'text-[#999] dark:text-moments-dark-sub') + '">' + (moment && moment.location ? esc(moment.location) : '搜索附近位置') + '</span>' +
        '<svg class="h-[12px] w-[12px] text-[#999] dark:text-moments-dark-sub" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><polyline points="6 9 12 15 18 9"/></svg>' +
        '</div>' +
        '<div id="edit-location-search-wrap" class="hidden absolute left-0 right-0 top-full z-20 mt-1 rounded-[6px] border border-[#e8e8e8] bg-white shadow-md dark:border-moments-dark-divider dark:bg-moments-dark-card">' +
        '<div class="p-2">' +
        '<input id="edit-location" type="text" value="' + esc(moment ? moment.location : '') + '" placeholder="搜索位置..." class="w-full rounded-[4px] border border-[#e8e8e8] px-2.5 py-1.5 text-[12px] text-moments-text outline-none focus:border-[#576b95] dark:border-moments-dark-divider dark:bg-moments-dark-bg dark:text-moments-dark-text" />' +
        '</div>' +
        '<div id="edit-location-results" class="max-h-[160px] overflow-y-auto border-t border-[#f0f0f0] dark:border-moments-dark-divider"></div>' +
        '</div>' +
        '</div>' +

        '<!-- 媒体类型 -->' +
        '<div class="kam-radio-group mb-4 flex items-center gap-5 text-[13px] text-moments-text dark:text-moments-dark-text">' +
        '<label class="kam-radio-label"><input type="radio" name="edit-media-type" value="text" class="kam-radio" ' + (type === 'text' ? 'checked' : '') + ' /><span>文字</span></label>' +
        '<label class="kam-radio-label"><input type="radio" name="edit-media-type" value="image" class="kam-radio" ' + (type === 'images' ? 'checked' : '') + ' /><span>图像</span></label>' +
        '<label class="kam-radio-label"><input type="radio" name="edit-media-type" value="video" class="kam-radio" ' + (type === 'video' ? 'checked' : '') + ' /><span>视频</span></label>' +
        '<label class="kam-radio-label"><input type="radio" name="edit-media-type" value="audio" class="kam-radio" ' + (type === 'music' ? 'checked' : '') + ' /><span>音乐</span></label>' +
        '</div>' +

        '<!-- 图片区域 -->' +
        '<div id="edit-images-section" class="mb-3 ' + (type === 'images' ? '' : 'hidden') + '">' +
        '<div id="edit-images-list" class="kam-image-list mb-2 flex flex-wrap gap-1.5"></div>' +
        '<input id="edit-image-upload" type="file" accept="image/*" multiple class="hidden" />' +
        '<button id="edit-image-btn" type="button" class="kam-image-add" title="添加图片"><span>+</span></button>' +
        '<div class="kam-details-wrap mt-2">' +
        '<details class="kam-details">' +
        '<summary class="kam-details-summary">' +
        '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>' +
        '<span>输入外链 URL</span>' +
        '</summary>' +
        '<input id="edit-images-manual" type="text" placeholder="多个图片用逗号分隔" class="kam-input" />' +
        '</details>' +
        '</div>' +
        '</div>' +

        '<div id="edit-music-section" class="mb-3 ' + (type === 'music' ? '' : 'hidden') + '">' +
        '<div class="mb-1.5 grid grid-cols-2 gap-1.5">' +
        '<input id="edit-music-title" type="text" value="' + esc(c.music_title || '') + '" placeholder="标题" class="kam-input" />' +
        '<input id="edit-music-artist" type="text" value="' + esc(c.music_artist || '') + '" placeholder="歌手" class="kam-input" />' +
        '</div>' +
        '<input id="edit-music-cover" type="text" value="' + esc(c.music_cover || '') + '" placeholder="封面 URL" class="kam-input mb-1.5" />' +
        '<input id="edit-music-src" type="text" value="' + esc(c.music_src || '') + '" placeholder="音频 URL" class="kam-input mb-1.5" />' +
        '<input id="edit-music-upload" type="file" accept="audio/*" class="hidden" />' +
        '<button id="edit-music-btn" type="button" class="kam-image-add" title="上传音频"><span>+</span></button>' +
        '</div>' +

        '<div id="edit-video-section" class="mb-3 ' + (type === 'video' ? '' : 'hidden') + '">' +
        '<input id="edit-video-src" type="text" value="' + esc(c.video_src || '') + '" placeholder="视频 URL" class="kam-input mb-1.5" />' +
        '<input id="edit-video-duration" type="text" value="' + esc(c.video_duration || '') + '" placeholder="时长（可选）" class="kam-input mb-1.5" />' +
        '<input id="edit-video-upload" type="file" accept="video/*" class="hidden" />' +
        '<button id="edit-video-btn" type="button" class="kam-image-add" title="上传视频"><span>+</span></button>' +
        '</div>' +

        '<!-- 文章选项 -->' +
        '<div class="mb-3 flex items-center gap-4 pt-2 border-t border-[#f0f0f0] dark:border-moments-dark-divider">' +
        '<label class="kam-check-label flex items-center gap-1.5 text-[11px] text-[#999] dark:text-moments-dark-sub">' +
        '<input type="checkbox" id="edit-stick" class="kam-check" ' + (moment && moment.sort_order > 0 ? 'checked' : '') + ' />' +
        '<span>置顶</span>' +
        '</label>' +
        '<label class="kam-check-label flex items-center gap-1.5 text-[11px] text-[#999] dark:text-moments-dark-sub">' +
        '<input type="checkbox" id="edit-private" class="kam-check" ' + (moment && (moment.is_private === 1 || moment.isPrivate === true) ? 'checked' : '') + ' />' +
        '<span>私密</span>' +
        '</label>' +
        '<label class="kam-check-label flex items-center gap-1.5 text-[11px] text-[#999] dark:text-moments-dark-sub">' +
        '<input type="checkbox" id="edit-password-enable" class="kam-check" ' + (moment && moment.hasPassword ? 'checked' : '') + ' />' +
        '<span>密码保护</span>' +
        '</label>' +
        '</div>' +

        '<input id="edit-password" type="text" placeholder="' + (moment && moment.hasPassword ? '已设置密码，留空则不修改' : '设置密码') + '" class="kam-input mb-3 hidden" />' +

        '<div class="mb-3 hidden text-center text-[12px] text-red-500" id="edit-error"></div>' +

        '<!-- 发布按钮 -->' +
        '<div class="flex justify-between items-center">' +
        '<span class="text-[10px] text-[#ccc] dark:text-moments-dark-sub italic">让世界找到通向你的路。</span>' +
        '<button id="edit-save" class="kam-publish-btn" type="button">' +
        '<span>' + (isNew ? '发文章' : '保存') + '</span>' +
        '</button>' +
        '</div>' +
        '</div></div>';
      document.body.appendChild(modal);

      // 缓存当前图片列表
      var currentImages = c.images || [];

      // 渲染图片列表
      function renderImages() {
        var listEl = modal.querySelector('#edit-images-list');
        listEl.innerHTML = '';
        currentImages.forEach(function (url, idx) {
          var item = document.createElement('div');
          item.className = 'relative h-16 w-16 overflow-hidden rounded-[4px]';
          item.innerHTML =
            '<img src="' + esc(url) + '" class="h-full w-full object-cover" />' +
            '<button type="button" class="absolute right-0 top-0 flex h-5 w-5 items-center justify-center bg-black/60 text-white text-[12px]" data-remove-idx="' + idx + '">×</button>';
          listEl.appendChild(item);
        });
        // 绑定删除图片
        listEl.querySelectorAll('[data-remove-idx]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var idx = parseInt(btn.getAttribute('data-remove-idx'));
            currentImages.splice(idx, 1);
            renderImages();
          });
        });
        // 同步到手动输入框
        var manualInput = modal.querySelector('#edit-images-manual');
        manualInput.value = currentImages.join(', ');
      }
      renderImages();

      // 媒体类型切换（radio buttons）
      var mediaRadios = modal.querySelectorAll('input[name="edit-media-type"]');
      var getMediaType = function () {
        var checked = modal.querySelector('input[name="edit-media-type"]:checked');
        return checked ? checked.value : 'text';
      };
      var updateMediaSection = function () {
        var val = getMediaType();
        modal.querySelector('#edit-images-section').classList.toggle('hidden', val !== 'image');
        modal.querySelector('#edit-music-section').classList.toggle('hidden', val !== 'audio');
        modal.querySelector('#edit-video-section').classList.toggle('hidden', val !== 'video');
      };
      mediaRadios.forEach(function (radio) {
        radio.addEventListener('change', updateMediaSection);
      });

      // 图片上传
      var uploadInput = modal.querySelector('#edit-image-upload');
      modal.querySelector('#edit-image-btn').addEventListener('click', function () {
        uploadInput.click();
      });
      uploadInput.addEventListener('change', async function () {
        var files = Array.prototype.slice.call(uploadInput.files);
        if (files.length === 0) return;
        var errorEl = modal.querySelector('#edit-error');
        for (var i = 0; i < files.length; i++) {
          var file = files[i];
          var formData = new FormData();
          formData.append('file', file);
          try {
            var res = await authFetch(API_BASE + '/api/upload', {
              method: 'POST',
              body: formData
            });
            var data = await res.json();
            if (data.url) {
              currentImages.push(data.url);
            }
          } catch (err) {
            errorEl.textContent = '图片上传失败：' + file.name;
            errorEl.classList.remove('hidden');
          }
        }
        renderImages();
        uploadInput.value = '';
      });

      // 手动输入图片 URL
      modal.querySelector('#edit-images-manual').addEventListener('change', function () {
        var urls = this.value.split(',').map(function (s) { return s.trim(); }).filter(function (s) { return s; });
        currentImages = urls;
        renderImages();
      });

      // 音乐上传
      var musicUpload = modal.querySelector('#edit-music-upload');
      var musicBtn = modal.querySelector('#edit-music-btn');
      if (musicBtn) {
        musicBtn.addEventListener('click', function () { musicUpload.click(); });
      }
      musicUpload.addEventListener('change', async function () {
        var file = musicUpload.files[0];
        if (!file) return;
        var errorEl = modal.querySelector('#edit-error');
        var formData = new FormData();
        formData.append('file', file);
        try {
          var res = await authFetch(API_BASE + '/api/upload', {
            method: 'POST',
            body: formData
          });
          var data = await res.json();
          if (data.url) {
            modal.querySelector('#edit-music-src').value = data.url;
          }
        } catch (err) {
          errorEl.textContent = '音频上传失败：' + file.name;
          errorEl.classList.remove('hidden');
        }
        musicUpload.value = '';
      });

      // 视频上传
      var videoUpload = modal.querySelector('#edit-video-upload');
      var videoBtn = modal.querySelector('#edit-video-btn');
      if (videoBtn) {
        videoBtn.addEventListener('click', function () { videoUpload.click(); });
      }
      videoUpload.addEventListener('change', async function () {
        var file = videoUpload.files[0];
        if (!file) return;
        var errorEl = modal.querySelector('#edit-error');
        var formData = new FormData();
        formData.append('file', file);
        try {
          var res = await authFetch(API_BASE + '/api/upload', {
            method: 'POST',
            body: formData
          });
          var data = await res.json();
          if (data.url) {
            modal.querySelector('#edit-video-src').value = data.url;
          }
        } catch (err) {
          errorEl.textContent = '视频上传失败：' + file.name;
          errorEl.classList.remove('hidden');
        }
        videoUpload.value = '';
      });

      // 位置搜索交互
      var locationDisplay = modal.querySelector('#edit-location-display');
      var locationLabel = modal.querySelector('#edit-location-label');
      var locationInput = modal.querySelector('#edit-location');
      var locationSearchWrap = modal.querySelector('#edit-location-search-wrap');
      var locationResults = modal.querySelector('#edit-location-results');
      var searchTimer = null;

      locationDisplay.addEventListener('click', function (e) {
        e.stopPropagation();
        locationSearchWrap.classList.toggle('hidden');
        if (!locationSearchWrap.classList.contains('hidden')) {
          locationInput.focus();
        }
      });

      // 渲染搜索结果
      var renderLocationResults = function (pois) {
        if (!pois || pois.length === 0) {
          locationResults.innerHTML = '<div class="px-4 py-3 text-[12px] text-[#a0a0a0] dark:text-moments-dark-sub">未找到结果</div>';
          return;
        }
        var html = pois.map(function (item) {
          return '<div class="kam-location-item cursor-pointer px-4 py-2.5 text-[13px] text-moments-text hover:bg-[#f5f5f5] dark:text-moments-dark-text dark:hover:bg-moments-dark-divider transition-colors" data-name="' + esc(item.name) + '">' +
            '<div class="truncate font-medium">' + esc(item.name) + '</div>' +
            '<div class="truncate text-[11px] text-[#a0a0a0] dark:text-moments-dark-sub mt-0.5">' + esc(item.address || item.adname) + '</div>' +
            '</div>';
        }).join('');
        locationResults.innerHTML = html;

        locationResults.querySelectorAll('.kam-location-item').forEach(function (item) {
          item.addEventListener('click', function () {
            var name = item.getAttribute('data-name');
            locationLabel.textContent = name;
            locationLabel.classList.remove('text-[#a0a0a0]', 'dark:text-moments-dark-sub');
            locationLabel.classList.add('text-moments-text', 'dark:text-moments-dark-text');
            locationInput.value = name;
            locationSearchWrap.classList.add('hidden');
          });
        });
      };

      // 位置搜索（高德地图 API）
      locationInput.addEventListener('input', function () {
        if (searchTimer) clearTimeout(searchTimer);
        var val = this.value.trim();
        if (val.length < 2) {
          locationResults.innerHTML = '<div class="px-4 py-3 text-[12px] text-[#a0a0a0] dark:text-moments-dark-sub">输入关键词搜索位置</div>';
          return;
        }
        searchTimer = setTimeout(async function () {
          try {
            var amapKey = 'fa87d30b901b3e1d2d35749490720b4a';
            var res = await fetch('https://restapi.amap.com/v3/place/text?key=' + amapKey + '&keywords=' + encodeURIComponent(val) + '&output=json&offset=6&extensions=base', {
              headers: { 'Accept': 'application/json' }
            });
            var data = await res.json();
            renderLocationResults(data.pois || []);
          } catch (err) {
            locationResults.innerHTML = '<div class="px-4 py-3 text-[12px] text-red-500">搜索失败</div>';
          }
        }, 400);
      });

      // 点击外部关闭位置下拉
      document.addEventListener('click', function (e) {
        if (!locationSearchWrap.contains(e.target) && !locationDisplay.contains(e.target)) {
          locationSearchWrap.classList.add('hidden');
        }
      });

      // 工具栏按钮
      var insertMarkdown = function (before, after) {
        var textarea = modal.querySelector('#edit-content');
        var start = textarea.selectionStart;
        var end = textarea.selectionEnd;
        var text = textarea.value;
        var selected = text.substring(start, end);
        textarea.value = text.substring(0, start) + before + selected + after + text.substring(end);
        textarea.selectionStart = start + before.length;
        textarea.selectionEnd = start + before.length + selected.length;
        textarea.focus();
      };
      modal.querySelector('#edit-tool-bold').addEventListener('click', function () { insertMarkdown('**', '**'); });
      modal.querySelector('#edit-tool-italic').addEventListener('click', function () { insertMarkdown('*', '*'); });
      modal.querySelector('#edit-tool-strike').addEventListener('click', function () { insertMarkdown('~~', '~~'); });
      modal.querySelector('#edit-tool-code').addEventListener('click', function () { insertMarkdown('`', '`'); });
      modal.querySelector('#edit-tool-link').addEventListener('click', function () { insertMarkdown('[', '](url)'); });
      modal.querySelector('#edit-tool-html').addEventListener('click', function () { insertMarkdown('<', '>'); });

      // 密码保护开关
      var passwordEnable = modal.querySelector('#edit-password-enable');
      var passwordInput = modal.querySelector('#edit-password');
      passwordEnable.addEventListener('change', function () {
        passwordInput.classList.toggle('hidden', !this.checked);
        if (this.checked) passwordInput.focus();
      });
      if (passwordEnable.checked) {
        passwordInput.classList.remove('hidden');
      }

      // 关闭
      var close = function () { modal.remove(); };
      modal.querySelector('#edit-close').addEventListener('click', close);
      modal.querySelector('#edit-logout').addEventListener('click', function () {
        if (confirm('确定退出管理员模式？')) {
          close();
          admin.removeAdminMode();
        }
      });
      modal.addEventListener('click', function (e) {
        if (e.target === modal) close();
      });

      // 保存/发布
      modal.querySelector('#edit-save').addEventListener('click', async function () {
        var errorEl = modal.querySelector('#edit-error');
        errorEl.classList.add('hidden');

        var passwordEnable = modal.querySelector('#edit-password-enable');
        var passwordInput = modal.querySelector('#edit-password').value.trim();
        var body = {
          type: getMediaType() === 'image' ? 'images' : (getMediaType() === 'audio' ? 'music' : (getMediaType() === 'video' ? 'video' : 'text')),
          content: modal.querySelector('#edit-content').value.trim(),
          location: modal.querySelector('#edit-location').value.trim() || (moment && moment.location ? moment.location : ''),
          is_private: modal.querySelector('#edit-private').checked ? 1 : 0,
          sort_order: modal.querySelector('#edit-stick').checked ? Date.now() : 0
        };
        if (!passwordEnable.checked) {
          body.password_hash = ''; // 关闭密码保护，清除密码
        } else if (passwordInput) {
          body.password_hash = passwordInput; // 开启且输入了新密码
        }
        // 开启但未输入新密码时不发送 password_hash，后端保留原有密码

        if (!body.content && body.type === 'text') {
          errorEl.textContent = '内容不能为空';
          errorEl.classList.remove('hidden');
          return;
        }

        if (body.type === 'images') {
          body.images = currentImages;
        } else if (body.type === 'music') {
          body.music_title = modal.querySelector('#edit-music-title').value.trim();
          body.music_artist = modal.querySelector('#edit-music-artist').value.trim();
          body.music_cover = modal.querySelector('#edit-music-cover').value.trim();
          body.music_src = modal.querySelector('#edit-music-src').value.trim();
        } else if (body.type === 'video') {
          body.video_src = modal.querySelector('#edit-video-src').value.trim();
          body.video_duration = modal.querySelector('#edit-video-duration').value.trim();
        }

        try {
          var url, method;
          if (isNew) {
            url = API_BASE + '/api/moments';
            method = 'POST';
          } else {
            url = API_BASE + '/api/moments/' + encodeURIComponent(momentId);
            method = 'PUT';
          }
          var res = await authFetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });
          var data = await res.json();
          if (data.ok) {
            close();
            // 刷新页面以显示最新数据
            window.location.reload();
          } else {
            errorEl.textContent = data.error || '保存失败';
            errorEl.classList.remove('hidden');
          }
        } catch (err) {
          errorEl.textContent = '网络错误';
          errorEl.classList.remove('hidden');
        }
      });
    }
  };

  // ========== 初始化 ==========

  function init() {
    admin.initNicknameTrigger();
    admin.initLoginButton();
    if (isLoggedIn()) {
      setTimeout(function () {
        admin.applyAdminMode();
      }, 500);
    }

    document.addEventListener('moments-loaded', function () {
      if (isLoggedIn()) {
        setTimeout(function () {
          var menuRoots = document.querySelectorAll('[data-menu-root]:not([data-admin-replaced])');
          for (var i = 0; i < menuRoots.length; i++) {
            admin.replaceMenu(menuRoots[i]);
          }
        }, 100);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('astro:after-swap', init);
})();
