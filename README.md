# Moments Theme

仿微信朋友圈风格的个人动态站点，基于 Astro + Tailwind CSS v4 构建。轻量、响应式、支持图文音视频多种动态类型。

---

## 功能特性

- ✅ 响应式布局，完美适配手机与桌面端
- ✅ 亮色 / 暗色模式一键切换，封面图自动适配
- ✅ 支持**文字、图片、音乐、视频**四种动态类型
- ✅ 图片九宫格布局，点击放大预览
- ✅ 音乐播放器：渐变背景 + 毛玻璃 + 封面联动缩放
- ✅ 视频播放器：懒加载 + 首帧封面
- ✅ 长文本手动收起，支持"展开 / 收起"（frontmatter `collapse: true`）
- ✅ 无限滚动加载，下拉加载更多
- ✅ 点赞 / 评论弹出交互
- ✅ 浮动按钮：暗色切换 + 返回顶部
- ✅ 文章详情页，支持上一篇 / 下一篇导航
- ✅ 纯静态站点，部署即用，零后端依赖

---

## 技术栈

| 分类 | 技术 |
|------|------|
| 框架 | Astro 5 |
| 样式 | Tailwind CSS v4 |
| 内容 | Markdown (frontmatter + 正文) |
| 交互 | 原生 JavaScript（无框架依赖） |
| 部署 | Cloudflare Pages / Vercel / 任意静态托管 |

---

## 项目结构

```
├── public/                      # 静态资源（直接映射到站点根目录）
│   ├── avatar/                  # 头像图片（本地存储，不走 CDN）
│   │   └── avatar.jpeg
│   ├── banner/                  # 封面图（本地存储，不走 CDN）
│   │   ├── cover1.webp          # 亮色模式封面
│   │   └── cover11.webp         # 暗色模式封面
│   ├── icons/                   # SVG 图标
│   ├── scripts/                 # 前端交互脚本
│   │   └── moments.js           # 点赞/展开/滚动/暗色切换等逻辑
│   ├── _headers                 # Cloudflare Pages 缓存策略
│   └── _redirects               # 路径重定向规则
│
├── src/
│   ├── components/              # Astro 组件
│   │   ├── Avatar.astro         # 头像组件（支持圆角配置）
│   │   ├── CoverBanner.astro    # 封面横幅（封面图 + 头像 + 昵称 + 个签）
│   │   ├── FloatingButtons.astro # 右下角浮动按钮组
│   │   ├── ImageGrid.astro      # 图片九宫格（1~9 张自适应布局）
│   │   ├── MenuPopover.astro    # 点赞 / 评论弹出菜单
│   │   ├── MomentCard.astro     # 动态卡片（首页 & 详情页复用）
│   │   ├── MusicPlayer.astro    # 音乐播放器
│   │   └── VideoPlayer.astro    # 视频播放器
│   │
│   ├── config.ts                # 全局配置（个人资料、分页等）
│   ├── types.ts                 # TypeScript 类型定义
│   ├── utils.ts                 # 工具函数（Markdown 解析、数据处理）
│   │
│   ├── content/                 # Markdown 动态内容（文件名即日期）
│   │   ├── 2026-06-27.md
│   │   ├── 2026-06-28.md
│   │   └── ...
│   │
│   ├── layouts/
│   │   └── Layout.astro         # 页面布局（头部、主体、暗色变量注入）
│   │
│   ├── pages/
│   │   ├── index.astro          # 主页（动态列表 + 无限滚动）
│   │   └── content/[id].astro   # 详情页（路由 /content/:id）
│   │
│   └── styles/
│       └── global.css           # 全局样式 + 主题色变量
│
├── astro.config.mjs             # Astro 配置
├── tailwind.config.mjs          # Tailwind 配置（通过 @theme 内联在 CSS 中）
├── tsconfig.json                # TypeScript 配置
├── postcss.config.mjs           # PostCSS 配置
└── package.json
```

---

## 快速开始

### 环境要求

- Node.js >= 18
- npm 或 pnpm

### 安装依赖

```bash
npm install
```

### 本地开发

```bash
npm run dev
```

启动后访问 http://localhost:4321

### 构建生产版本

```bash
npm run build
```

构建产物输出到 `dist/` 目录，可直接部署到任意静态托管服务。

### 预览构建结果

```bash
npm run preview
```

---

## 内容类型说明

所有动态文章均以 Markdown 文件形式存放在 `src/content/` 目录下，文件名格式为 `YYYY-MM-DD.md`。

每种类型通过 frontmatter 中的 `type` 字段区分，以下分别说明：

---

### 📝 纯文字动态（type: text）

最简单的动态类型，只有文字内容。

```yaml
---
title: 工作反思
date: 2026-06-30
location: 成都
type: text
collapse: true  # 可选，设为 true 时正文默认收起，显示「展开」按钮
---

正文内容，支持 Markdown 语法。

超过一定长度的文字可通过 `collapse: true` 设为默认收起。
```

**说明：**
- `title` 可选，用于详情页标题
- `location` 可选，显示时间旁的位置信息
- `collapse` 可选，设为 `true` 时正文默认收起，显示「展开」按钮
- 正文支持标准 Markdown 语法

---

### 🖼️ 图片动态（type: images）

支持 1~9 张图片，自适应九宫格布局。

```yaml
---
title: 四姑娘山徒步
date: 2026-06-28
location: 四川 · 阿坝
type: images
images:
  - https://images.izhch.com/images/1.jpg
  - https://images.izhch.com/images/2.jpg
  - https://images.izhch.com/images/3.jpg
  - https://images.izhch.com/images/4.jpg
  - https://images.izhch.com/images/5.jpg
  - https://images.izhch.com/images/6.jpg
---

每一步都是风景，每一眼都是震撼。
```

**布局规则：**
| 图片数量 | 宽度 | 布局 |
|---------|------|------|
| 1 张 | 66% 宽度，4:3 纵横比 | 单列 |
| 2 张 | 66% 宽度 | 2 列，gap 4px |
| 3~9 张 | calc(100% - 50px) | 3 列，gap 4px |

**交互：**
- 点击任意图片可放大查看
- 支持左右切换（详情页）
- 支持关闭（点击背景或 ESC）
- 图片加载失败自动显示占位图

---

### 🎵 音乐动态（type: music）

内嵌音乐播放器，支持播放/暂停。

```yaml
---
title: 今日推荐
date: 2026-06-30
location:
type: music
music_title: 起风了
music_artist: 买辣椒也用券
music_cover: https://images.izhch.com/music/qifengle.jpg
music_src: https://images.izhch.com/music/qifengle.mp3
---

今天听的一首歌，旋律悠扬，歌词动人。
```

**播放器特性：**
- 宽度 66%，左对齐
- 左侧封面，圆角 4px
- 背景：封面图 30% 透明度 + 从左到右渐变透明 + 毛玻璃
- 播放按钮 30px，右侧间距 8px
- 封面尺寸随容器宽度平滑缩放（60px ~ 84px）
- 标题 15px / 行高 22px / 90% 不透明度
- 歌手 13px / 行高 18px / 60% 不透明度

---

### 🎬 视频动态（type: video）

内嵌视频播放器，懒加载优化性能。

```yaml
---
title: 海边日落
date: 2026-07-01
location: 三亚
type: video
video_src: https://images.izhch.com/videos/sunset.mp4
video_duration: "02:30"
---

波光粼粼，美不胜收。
```

**播放器特性：**
- 宽度：`calc(100% - 50px)`（响应式）
- 左对齐，圆角 4px
- 首帧自动作为封面
- 居中半透明播放按钮
- `loading="lazy"` 懒加载
- 父容器相对定位，避免全屏 bug

---

### 🔒 密码保护动态（任意类型）

支持为任意动态添加密码保护。密码不直接存储在代码中，而是存储 **SHA256 哈希值**，普通用户无法在开发者工具中直接看到明文密码。

```yaml
---
date: 2026-07-07
type: text
password_hash: 03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4
location: 测试地点 · 密码示例
---

这是一篇需要输入密码才能查看的动态。
```

**说明：**
- 使用 `password_hash` 字段，值为密码的 SHA256 哈希值（小写十六进制）
- 示例中 `03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4` 是 `1234` 的 SHA256 哈希
- 可通过浏览器控制台生成哈希：

```js
async function sha256(message) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

sha256('你的密码').then(console.log);
```

> 注意：前端密码保护仍属于"防君子不防小人"的社交功能，无法防御专业用户通过修改 JS 绕过验证。真正安全需要后端鉴权。

---

## 配置说明

### 个人资料配置

修改 `src/config.ts` 中的 `profile` 对象，全站生效：

```ts
export const profile: Profile = {
  nickname: '林深时见鹿',          // 昵称
  signature: '海蓝时见鲸，梦醒时见你', // 个性签名
  avatar: '/avatar/avatar.jpeg',   // 头像（本地路径）
  cover: '/banner/cover1.webp',    // 亮色模式封面（本地路径）
  coverDark: '/banner/cover11.webp', // 暗色模式封面（可选）
};
```

> 头像和封面建议放在 `public/avatar/` 和 `public/banner/` 目录本地存储，加载更快。

### 分页配置

```ts
export const PAGE_SIZE = 5; // 首页初始加载条数
```

向下滚动自动加载下一页（也是 5 条），直到全部加载完毕。

### 主题色自定义

在 `src/styles/global.css` 中通过 `@theme` 修改变量：

```css
@theme {
  /* 亮色模式 */
  --color-moments-bg: #f0f0f0;           /* 页面背景 */
  --color-moments-card: #ffffff;         /* 卡片背景 */
  --color-moments-text: #191919;         /* 正文文字 */
  --color-moments-sub: #b2b2b2;          /* 次要文字（时间、位置） */
  --color-moments-link: #576b95;         /* 昵称、链接色 */
  --color-moments-like: #f04848;         /* 点赞红色 */
  --color-moments-divider: #ececec;      /* 分割线 */
  --color-moments-menu: #4b5153;         /* 弹出菜单背景 */

  /* 暗色模式 */
  --color-moments-dark-bg: #1a1a1a;
  --color-moments-dark-card: #2c2c2c;
  --color-moments-dark-text: #eaeaea;
  --color-moments-dark-sub: #6c6c6c;
  --color-moments-dark-link: #7d90a9;
  --color-moments-dark-divider: #3a3a3a;
  --color-moments-dark-menu: #606060;
}
```

---

## 媒体资源建议

**本地存储（走服务器）：**
- 头像、封面图 → `public/avatar/`、`public/banner/`
- 体积小，访问频率高，本地加载更快

**R2 / CDN 存储：**
- 文章图片、音乐、视频 → `https://images.izhch.com/`
- 体积大，数量多，走对象存储 + CDN 更省流量

在 Markdown 文章中直接填写完整 URL 即可。

---

## 部署指南

### 方式一：Cloudflare Pages（推荐）

1. 将代码推送到 GitHub 仓库
2. 登录 Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages**
3. 点击 **Connect to Git**，选择你的仓库
4. 构建设置：
   - **Framework preset**: `Astro`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
5. 点击 **Save and Deploy**，等待构建完成
6. **Custom domains** 中绑定你的域名

### 方式二：Vercel

1. 推送代码到 GitHub
2. 登录 Vercel → **Add New** → **Project**
3. Import 你的仓库
4. Framework Preset 选 `Astro`，其他默认
5. 点击 **Deploy**

### 方式三：手动部署

```bash
npm run build
```

将 `dist/` 目录上传到任意静态托管服务（Nginx、OSS 静态网站等）。

---

## 日常更新

### 发布新动态

1. 在 `src/content/` 下新建 `YYYY-MM-DD.md` 文件
2. 填写 frontmatter 和正文
3. 提交并推送：

```bash
git add src/content/2026-07-07.md
git commit -m "新增动态：xxx"
git push origin master
```

4. 等待自动部署完成（Cloudflare Pages / Vercel 约 1~2 分钟）

---

## 设计规范

### 封面区

| 元素 | 尺寸 / 位置 | 字号 / 样式 |
|------|------------|------------|
| 封面图 | 600 × 325px（max-w 容器内自适应） | - |
| 头像 | 60 × 60px，圆角 7px<br>right: 25px，底部溢出封面 12px | - |
| 昵称 | right: 95px，底部距封面底边 10px | 18px / 26px，font-weight: 700，白色 |
| 个签 | right: 25px，底部距封面底边 44px<br>max-width: 333px，右对齐 | 14px / 22px，#b2b2b2 |

### 内容区

| 元素 | 尺寸 / 间距 | 字号 / 样式 |
|------|------------|------------|
| 卡片内边距 | padding: 15px 25px 0 | - |
| 头像 | 36 × 36px，圆角 5px<br>margin-right: 14px | - |
| 昵称 | 顶部比头像顶部低 2px | 16px / 24px，font-weight: 500，#576b95 |
| 正文 | 昵称底部下方 6px | 16px / 24px，#191919 |
| 时间/位置 | - | 14px / 22px，#b2b2b2 |
| 分割线 | left: 75px，right: 25px | - |

### 弹出菜单

- 高度：40px，圆角 4px，宽度自适应
- 背景：#4b5153
- 按钮：margin 0 20px，padding-left: 22px
- 字号：16px，白色，行高 24px
- 点赞 / 评论之间有 1px 竖线分隔

---

## 常见微调

### 内容距昵称的高度

四种内容类型（文字、图片、音乐、视频）分别在以下文件中调整顶部间距（`mt-*` 值）：

| 类型 | 文件 | 位置 | 当前值 |
|------|------|------|--------|
| 文字 | `src/components/MomentCard.astro` | `.moment-body-container` 的 `mt-[6px]` | 6px |
| 图片 | `src/components/ImageGrid.astro` | `.image-grid` 的 `mt-2` | 8px |
| 音乐 | `src/components/MusicPlayer.astro` | `.music-player-container` 的 `mt-2` | 8px |
| 视频 | `src/components/VideoPlayer.astro` | `.video-wrapper` 的 `mt-2` | 8px |

往上移用负值（如 `-mt-[2px]`），往下移用正值（如 `mt-[2px]`）。

### 网站标题

修改 `src/config.ts` 中的 `siteTitle`：

```ts
export const siteTitle = '向晚的朋友圈';
```

---

## License

MIT
