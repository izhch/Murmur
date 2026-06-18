# Murmur

一个使用 **Astro + Tailwind CSS v4** 构建的轻量级个人动态主题，灵感来自朋友圈的简洁排版与浏览节奏。

> 本站地址：[https://izhch.com](https://izhch.com)

## 特性

- **动态流**：按时间倒序展示，文字 / 图片 / 音乐 / 视频 / 位置 / 点赞 / 评论统一卡片
- **动态详情页**：与卡片同款布局，底部提供上下页导航，点击图片可放大查看
- **照片墙**：抽取所有动态中的图片，3 列网格展示
- **关于页**：个人简介
- **菜单导航**：About / Photos，统一在 ProfileHeader 中处理
- **亮色 / 暗色主题**：用户偏好保存在 localStorage，通过 CSS 变量自动切换
- **Tailwind CSS v4**：原子化 CSS，按需生成，样式更精简
- **可配置背景图**：`config.ts` 一行开关 + 透明度 / 模糊度

## 项目结构

```
.
├── public/                          静态资源
│   ├── avatar/                      头像
│   ├── banner/                      封面 / 背景图
│   └── favicon.ico
├── src/
│   ├── components/                  可复用组件
│   │   ├── BaseLayout.astro         基础布局（head + 脚本 + 公共元素）
│   │   ├── ProfileHeader.astro      封面 + 头像 + 昵称 + 签名 + 菜单
│   │   ├── MomentItem.astro         动态卡片
│   │   ├── ImageGrid.astro          图片网格（1/2/3/4+ 自动布局）
│   │   ├── Lightbox.astro           图片灯箱
│   │   ├── MusicPlayer.astro        音乐播放器
│   │   └── VideoPlayer.astro        视频播放器
│   ├── content/moments/             动态内容（每条一个 .md）
│   ├── pages/                       页面
│   │   ├── index.astro              首页
│   │   ├── about.astro              关于
│   │   ├── photos.astro             照片墙
│   │   ├── moments/[slug].astro     动态详情
│   │   └── 404.astro
│   ├── styles/global.css            Tailwind 入口 + 设计变量 + JS 交互样式
│   ├── config.ts                    站点配置
│   ├── content.config.ts            内容集合 schema
│   └── utils.ts                     工具函数
├── astro.config.mjs
├── package.json
└── README.md
```

## 快速开始

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

要求：Node.js >= 22.12。

## 配置站点

### 1. 基本配置（`src/config.ts`）

```typescript
// 网站元信息
export const siteMeta = {
  siteName: '向晚的朋友圈',
  description: '一块属于自己的自留地',
  titleSeparator: ' · ',
};

// 个人资料
export const siteProfile = {
  name: '向晚',
  avatar: '/avatar/avatar.jpeg',
  cover: '/banner/cover1.webp',
  coverDark: '/banner/cover11.webp',
  signature: '一块属于自己的自留地',
};
```

### 2. 设计变量（`src/styles/global.css`）

项目使用 **Tailwind CSS v4** 的 `@theme` 语法定义设计变量：

```css
@theme {
  /* 颜色（自动跟随亮/暗主题切换） */
  --color-primary: var(--c-primary);
  --color-secondary: var(--c-secondary);
  --color-highlight: var(--c-highlight);
  --color-container: var(--bg-container);
  --color-block: var(--bg-block);
  --color-split: var(--c-split);
  ...

  /* 字号 */
  --font-size-base: 16px;
  --font-size-tall: 14px;
  --font-size-short: 12px;

  /* 圆角 */
  --radius-card: 4px;
  --radius-card-lg: 6px;
}
```

**使用方式**：在组件中直接用 Tailwind 原子类

```html
<div class="bg-container text-primary rounded-card">
  <span class="text-tall text-highlight">内容</span>
</div>
```

### 3. 深色模式

通过 `:root.darkmode` 切换 CSS 变量，无需在每个 class 上写 `dark:`：

```css
:root { --c-primary: #191919; }
:root.darkmode { --c-primary: #eaeaea; }
```

## 写一条新动态

在 `src/content/moments/` 下新建 `YYYY-MM-DD-标识.md`：

```markdown
---
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
draft: false                      # 可选，true 则不显示
---

今天天气真好！
```

## 部署到 GitHub Pages

### 方式一：GitHub Actions 自动部署

1. 把代码推送到 GitHub 仓库
2. 在仓库设置中启用 GitHub Pages
3. 选择 GitHub Actions 作为部署源
4. 项目已配置 `.github/workflows/deploy.yml`，推送后会自动构建部署

### 方式二：手动部署

```bash
npm run build
```

把 `dist/` 文件夹内容上传到 GitHub Pages 或其他静态托管服务。

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| [Astro](https://astro.build/) | 6.x | 静态站点生成 |
| [Tailwind CSS](https://tailwindcss.com/) | 4.x | 原子化 CSS |
| [Content Collections](https://docs.astro.build/zh-cn/guides/content-collections/) | - | Markdown 内容管理 |

## License

MIT
