# Murmur - 朋友圈动态站点

仿微信朋友圈风格的个人动态站点。前端基于 Astro + Tailwind CSS v4 构建，后端基于 Cloudflare Workers + D1 + R2 实现纯动态架构。

---

## 功能特性

### 前端展示
- 响应式布局，完美适配手机与桌面端
- 亮色 / 暗色模式一键切换，封面图自动适配
- 支持**文字、图片、音乐、视频**四种动态类型
- 图片九宫格布局，点击放大预览
- 音乐播放器：渐变背景 + 毛玻璃 + 封面联动
- 视频播放器：懒加载 + 首帧封面
- 长文本手动收起，支持"展开 / 收起"
- 无限滚动加载，下拉加载更多
- 点赞 / 评论弹出交互
- 文章详情页，支持上一篇 / 下一篇导航

### 管理功能
- **前端编辑弹窗**：创建 / 编辑动态，支持 Markdown 工具栏
- **图片上传**：直接上传到 Cloudflare R2，按年/月自动组织
- **音频/视频上传**：支持上传到 R2 或填写外链 URL
- **位置搜索**：集成高德地图 API
- **密码保护**：SHA256 哈希验证，前端不暴露密码
- **置顶文章**：支持文章置顶排序
- **私密文章**：管理员可见的私密动态

---

## 技术栈

| 分类 | 技术 |
|------|------|
| 前端框架 | Astro 5 + Tailwind CSS v4 |
| 前端交互 | 原生 JavaScript |
| 后端 | Cloudflare Workers |
| 数据库 | Cloudflare D1 (SQLite) |
| 对象存储 | Cloudflare R2 |
| 缓存 | 腾讯云 EdgeOne |
| 部署 | EdgeOne Pages + Cloudflare Workers |

---

## 项目结构

```
├── public/                      # 静态资源
│   ├── avatar/                  # 头像
│   ├── banner/                  # 封面图
│   ├── icons/                   # SVG 图标
│   ├── scripts/                 # 前端交互脚本
│   │   ├── admin.js             # 管理员功能（编辑/删除/上传）
│   │   ├── moments.js           # 动态加载/滚动/暗色切换/详情页
│   │   └── moment-template.js   # 卡片渲染模板
│   ├── content/                 # 详情页 HTML（动态加载）
│   │   └── index.html
│   └── favicon.ico
│
├── src/
│   ├── components/              # Astro 组件
│   │   ├── CoverBanner.astro    # 封面横幅
│   │   ├── FloatingButtons.astro # 浮动按钮（编辑/删除）
│   │   ├── Footer.astro         # 页脚
│   │   └── MusicPlayer.astro    # 音乐播放器
│   │
│   ├── config.ts                # 全局配置（个人资料）
│   ├── types.ts                 # TypeScript 类型
│   │
│   ├── layouts/
│   │   └── Layout.astro
│   │
│   ├── pages/
│   │   ├── index.astro          # 主页
│   │   └── 404.astro            # 404 页面（老链接重定向）
│   │
│   └── styles/
│       └── global.css           # 全局样式 + 主题变量
│
├── worker/                      # Cloudflare Worker 后端
│   ├── src/
│   │   └── index.js             # Worker 入口（API 路由）
│   ├── schema.sql               # 数据库表结构
│   └── wrangler.toml            # Worker 配置
│
├── astro.config.mjs
├── package.json
└── README.md
```

---

## 快速开始

### 环境要求

- Node.js >= 18
- npm

### 安装依赖

```bash
npm install
```

### 本地开发

```bash
npm run dev
```

访问 http://localhost:4321

### 构建生产版本

```bash
npm run build
```

产物输出到 `dist/` 目录。

---

## 部署

### 1. 部署 Cloudflare Worker 后端

```bash
cd worker
npm install
npx wrangler deploy
```

### 2. 配置 D1 数据库

```bash
cd worker
npx wrangler d1 execute moments-db --remote --file=schema.sql
```

### 3. 配置 R2 存储桶

在 Cloudflare 控制台创建 R2 存储桶，绑定到 Worker。

### 4. 部署前端到 EdgeOne Pages

将 `dist/` 目录上传到腾讯云 EdgeOne Pages。

---

## 管理员功能

### 登录

- 点击封面左上角**用户图标**，输入密码登录
- 登录后再次点击用户图标，显示**个人资料弹窗**
- 包含：发布新动态、个人主页、退出登录

### 创建动态

1. 登录后点击用户图标 → "发布新动态"
2. 在弹窗中填写内容，选择媒体类型
3. 支持上传图片/音频/视频到 R2
4. 可设置：置顶、私密、展开收起、密码保护
5. 点击"发文章"发布

### 编辑 / 删除

- 登录后，每条动态右下角显示**编辑**和**删除**按钮
- 删除为**硬删除**（直接从数据库删除）

### 展开收起

- 创建文章时勾选"展开收起"，长文本将自动收起，显示"展开"按钮
- 用户点击展开后可再次收起

---

## 内容类型

### 文字（type: text）
纯文字动态，支持 Markdown 语法。

### 图片（type: images）
支持 1~9 张图片，支持本地上传到 R2 或填写外链 URL。

### 音乐（type: music）
需要填写：标题、歌手、封面 URL、音频 URL。支持上传音频到 R2。

### 视频（type: video）
需要填写：视频 URL、时长（可选）。支持上传视频到 R2。

### 密码保护
创建时勾选"密码保护"，输入密码。密码以 SHA256 哈希存储，前端不暴露明文。

---

## 配置说明

### 个人资料

修改 `src/config.ts`：

```ts
export const profile = {
  nickname: '向晚',
  signature: '你曾如烟花绽放在我的天空',
  avatar: '/avatar/avatar.jpeg',
  cover: '/banner/cover1.webp',
  coverDark: '/banner/cover11.webp',
};
```

### 主题色

在 `src/styles/global.css` 中修改 `@theme` 变量。

---

## License

MIT