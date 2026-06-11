# Murmur

一个使用 **Astro** 构建的轻量级个人动态主题，灵感来自朋友圈的简洁排版与浏览节奏。
所有内容以 Markdown 形式管理，所有视觉参数集中在 CSS 变量中。

> 本站地址：[https://izhch.com](https://izhch.com)

---

## ✨ 特性

- **动态流**：按时间倒序展示，文字 / 图片 / 音乐 / 视频 / 位置 / 点赞 / 评论统一卡片
- **动态详情页**：与卡片同款布局，底部提供上下页导航，点击图片可放大查看
- **归档页**：按月份聚合所有动态，支持进入单月查看
- **照片墙**：抽取所有动态中的图片，3 列网格展示
- **关于页**：个人简介
- **菜单导航**：About / Archive / Photos，统一在 ProfileHeader 中处理，全站可用
- **亮色 / 暗色主题**：用户偏好保存在 localStorage
- **可配置背景图**：`config.ts` 一行开关 + 透明度 / 模糊度

---

## 📂 项目结构

```
.
├── public/                          静态资源
│   ├── avatar/                      头像
│   ├── banner/                      封面
│   └── favicon.svg
├── src/
│   ├── components/                  可复用组件
│   │   ├── ProfileHeader.astro      封面 + 头像 + 昵称 + 签名 + 菜单
│   │   ├── MomentItem.astro         动态卡片
│   │   ├── ImageGrid.astro          图片网格（1 / 2 / 3 / 4+ 自动布局）
│   │   ├── Lightbox.astro           图片灯箱
│   │   ├── MusicPlayer.astro        音乐播放器
│   │   ├── VideoPlayer.astro        视频播放器
│   │   └── TextExpand.astro         长文字展开 / 收起
│   ├── content/moments/             动态内容（每条一个 .md）
│   ├── pages/                       页面
│   │   ├── index.astro              首页
│   │   ├── about.astro              关于
│   │   ├── archive.astro            归档
│   │   ├── archive/[month].astro    单月归档
│   │   ├── photos.astro             照片墙
│   │   ├── moments/[slug].astro     动态详情
│   │   └── 404.astro
│   ├── styles/global.css            全局样式 + CSS 变量
│   ├── config.ts                    站点配置
│   ├── content.config.ts            内容集合 schema
│   └── utils.ts                     工具函数
├── astro.config.mjs
├── tsconfig.json
└── package.json
```

---

## 🚀 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器
npm run dev          # http://localhost:4321

# 3. 生产构建
npm run build        # 产物在 dist/

# 4. 本地预览构建结果
npm run preview
```

要求：Node.js ≥ 22.12。

---

## ⚙️ 配置站点

所有内容相关配置集中在 `src/config.ts`：

```typescript
// 个人资料
export const siteProfile = {
  name: '向晚',
  avatar: '/avatar/avatar.jpeg',
  cover: '/banner/cover1.webp',
  signature: '一块属于自己的自留地 | 孤久则安',
};

// 背景图片（关闭后将使用纯色渐变背景）
export const siteBackground = {
  enable: true,                                    // 总开关
  opacity: 0.05,                                  // 透明度 0-1
  blur: 0,                                        // 模糊度（像素值）
  // 亮色模式：多个图片时随机显示一张
  lightMode: [
    '/banner/cover1.webp',
  ],
  // 暗色模式：多个图片时随机显示一张
  darkMode: [
    '/banner/cover11.webp',
  ],
};

// 比如
  darkMode: [
    '/banner/cover11.webp',
    '/banner/dark2.webp',
    '/banner/dark3.webp',
],

// 菜单项（封面右上角菜单）
export const menuItems = [
  { label: 'About',   href: '/about'   },
  { label: 'Archive', href: '/archive' },
  { label: 'Photos',  href: '/photos'  },
];
```

视觉参数（颜色 / 间距 / 字号 / 封面高度等）集中在 `src/styles/global.css` 的 `:root` 中，按页面布局顺序排列：

| 区块 | 变量前缀 | 说明 |
|------|---------|------|
| 封面 | `--cover_` | 高度、头像大小、昵称字号等 |
| 签名 | `--signature_` | 字号、颜色、上下间距 |
| 动态卡片 | `--card_` / `--avatar_` | 内边距、头像、间距 |
| 图片 | `--grid_` / `--image_` | 网格间距、单图最大高度 |
| 文字 / 背景 / 边框 | `--text_color_` / `--background_color_` / `--splitline_` | 颜色系统 |
| 字体 | `--font_size` / `--font_size_tall` / `--font_size_short` | 基础 / 中 / 小 |
| 间距 | `--spacing_xs` ~ `--spacing_xxxl` | 7 级间距 |
| 容器 | `--page_max_width` / `--page_max_width_container` | 页面宽度 |

修改后整站同步生效。

---

## ✍️ 写一条新动态

在 `src/content/moments/` 下新建 `YYYY-MM-DD-标识.md`：

```markdown
---
title: 美好的一天                  # 可选
date: 2024-10-18
location: "上海市 · 外滩"          # 可选
images:                           # 可选
  - "https://example.com/1.jpg"
  - "https://example.com/2.jpg"
music:                            # 可选
  title: 晴天
  artist: 周杰伦
  cover: https://example.com/cover.jpg
  url: https://example.com/music.mp3
video:                            # 可选
  cover: https://example.com/poster.jpg
  url: https://example.com/video.mp4
---

今天天气真好！
```

只填需要的字段即可，其他留空。Markdown 支持内联 HTML。

---

## ☁️ 部署到 Cloudflare Pages（推荐）

### 方式一：连接 GitHub 自动部署

1. 把代码推送到 GitHub 仓库
2. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
3. 选择 GitHub 仓库
4. 框架预设选择 **Astro**，构建命令 `npm run build`，输出目录 `dist`
5. 保存并部署

之后每次 `git push` 都会自动触发部署。

### 方式二：直接上传 dist/

```bash
npm run build
```

把 `dist/` 整个文件夹拖到 [Cloudflare Pages](https://pages.cloudflare.com/) 的 **Upload assets** 即可。适合不想用 Git 的场景。

### 方式三：wrangler CLI

```bash
npm install -g wrangler
wrangler login
npm run build
wrangler pages deploy dist/
```

> 自定义域名：Cloudflare Dashboard → Pages → 你的项目 → **Custom domains** → 添加即可，自动 HTTPS。

---

## ❓ FAQ

**图片灯箱怎么用？**
点击任意图片打开，支持左右切换、ESC 关闭、点击背景关闭。

**上一页 / 下一页怎么工作？**
按 Markdown 文件在 `src/content/moments/` 下的顺序自动生成。

**关闭背景图后页面会变样吗？**
不会。关闭后 `body` 只保留线性渐变背景，所有内容布局不受影响。

**Cloudflare Pages 收费吗？**
个人使用免费：无限带宽、每月 500 次构建、每天 100,000 次请求。

**构建失败？**
最常见原因是 Node.js 版本过低。Cloudflare Pages 默认使用较新版本，本地构建请确保 Node ≥ 22.12。
