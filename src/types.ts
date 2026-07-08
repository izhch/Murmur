// 朋友圈主题统一类型定义

// 用户资料类型
export interface Profile {
  // 站点名称（封面区显示，如"向晚的朋友圈"）
  siteName: string;
  // 昵称（卡片作者名，如"向晚"）
  nickname: string;
  // 个性签名
  signature: string;
  // 头像图片地址
  avatar: string;
  // 亮色模式封面图地址
  cover: string;
  // 暗色模式封面图地址（可选）
  coverDark?: string;
}

// 单条动态类型
export interface Moment {
  // 动态唯一标识（Markdown 文件名）
  id: string;
  // 作者昵称
  author: string;
  // 作者头像
  avatar: string;
  // 动态标题（可选）
  title?: string;
  // 动态内容：正文、图片、音乐或视频
  content: MomentContent;
  // 位置信息（可选）
  location?: string;
  // 发布时间字符串
  createdAt: string;
  // 密码哈希保护（可选，前端实现的简单保护）
  password_hash?: string;
  // 是否需要折叠（由 Markdown frontmatter 的 collapse 字段控制）
  needsCollapse: boolean;
}

// ========== 动态内容联合类型 ==========
// 基础内容接口
interface BaseContent {
  // Markdown 渲染组件（Astro 提供）
  Content?: any;
}

// 文字内容
export interface TextContent extends BaseContent {
  type: 'text';
}

// 图片内容
export interface ImagesContent extends BaseContent {
  type: 'images';
  // 图片 URL 数组
  images: string[];
}

// 音乐内容
export interface MusicContent extends BaseContent {
  type: 'music';
  // 歌曲标题
  title: string;
  // 歌手名
  artist: string;
  // 封面图地址
  cover: string;
  // 音频文件地址
  src: string;
}

// 视频内容
export interface VideoContent extends BaseContent {
  type: 'video';
  // 视频文件地址
  src: string;
  // 视频时长文本（可选）
  duration?: string;
}

// 动态内容联合类型：根据 type 自动推断具体字段
export type MomentContent = TextContent | ImagesContent | MusicContent | VideoContent;

// ========== Markdown 相关类型 ==========

// Markdown frontmatter 类型定义
export interface BlogFrontmatter {
  // 文章标题
  title?: string;
  // 发布日期
  date?: string;
  // 位置信息
  location?: string;
  // 内容类型
  type?: 'text' | 'images' | 'music' | 'video';
  // 图片类型：图片 URL 数组
  images?: string[];
  // 音乐类型：歌曲标题
  music_title?: string;
  // 音乐类型：歌手名
  music_artist?: string;
  // 音乐类型：封面图地址
  music_cover?: string;
  // 音乐类型：音频文件地址
  music_src?: string;
  // 视频类型：视频文件地址
  video_src?: string;
  // 视频类型：时长文本
  video_duration?: string;
  // 允许其他自定义字段
  [key: string]: any;
}

// Markdown 模块类型（import.meta.glob 导入结果）
export interface BlogModule {
  // 文章 frontmatter 数据（类型安全）
  frontmatter: BlogFrontmatter;
  // 默认导出（Astro 渲染组件）
  default?: any;
  // Markdown 内容组件
  Content?: any;
}
