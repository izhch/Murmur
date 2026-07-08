// 朋友圈主题数据处理函数

// 引入类型定义
import type { Moment, BlogModule, Profile } from './types';

/**
 * 解析 Markdown 文章数据，转换为统一的 Moment 对象数组
 * @param posts - import.meta.glob 导入的 Markdown 模块对象
 * @param profile - 用户资料，用于填充作者与头像
 * @returns 按发布时间倒序排列的动态数组
 */
export function parseMoments(
  posts: Record<string, BlogModule>,
  profile: Profile
): Moment[] {
  return Object.entries(posts)
    .map(([path, mod]) => {
      const post = mod as BlogModule;
      const fm = post.frontmatter;

      // ========== 字段校验 ==========
      // 检查必需字段：type 和 date
      if (!fm.type) {
        console.warn(`[parseMoments] 文章 ${path} 缺少必需字段 "type"，已跳过`);
        return null;
      }
      if (!fm.date) {
        console.warn(`[parseMoments] 文章 ${path} 缺少必需字段 "date"，已跳过`);
        return null;
      }

      // 验证 type 字段值是否合法
      const validTypes = ['text', 'images', 'music', 'video'];
      if (!validTypes.includes(fm.type)) {
        console.warn(`[parseMoments] 文章 ${path} 的 type 字段 "${fm.type}" 不合法，已跳过`);
        return null;
      }

      // 草稿文章跳过
      if (fm.draft === true || fm.draft === 'true') {
        console.warn(`[parseMoments] 文章 ${path} 为草稿，已跳过`);
        return null;
      }

      // images 类型校验：images 必须是非空数组
      if (fm.type === 'images' && (!Array.isArray(fm.images) || fm.images.length === 0)) {
        console.warn(`[parseMoments] 文章 ${path} type=images 但 images 非有效数组，已跳过`);
        return null;
      }

      // ========== ID 生成 ==========
      // 使用文件名（不含路径和扩展名）作为 id，正则匹配结尾 .md 确保只去掉后缀
      // 例如：src/content/2026-06-29.md → 2026-06-29
      // Windows 路径分隔符为反斜杠，需统一替换为正斜杠后再分割
      const normalizedPath = path.replace(/\\/g, '/');
      const id = normalizedPath.split('/').pop()?.replace(/\.md$/, '') || '';
      if (!id) {
        console.warn(`[parseMoments] 文章 ${path} 无法生成有效 id，已跳过`);
        return null;
      }

      // Astro 渲染组件可能以 default 或 Content 导出
      const Content = post.default || post.Content;

      // ========== 日期处理（容错） ==========
      const dateVal = fm.date;
      let dateStr = '';
      let parsedDate: Date | null = null;

      // 情况1：frontmatter 中 YYYY-MM-DD 会被 Astro 自动解析为 Date 对象
      if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
        parsedDate = dateVal;
      }
      // 情况2：日期为字符串格式（可能是 ISO 格式、YYYY-MM-DD、YYYY/MM/DD 等）
      else if (typeof dateVal === 'string') {
        const normalized = dateVal.replace(/\//g, '-');
        parsedDate = new Date(normalized);
        if (isNaN(parsedDate.getTime())) {
          parsedDate = null;
          console.warn(`[parseMoments] 文章 ${path} 日期 "${dateVal}" 格式无效，已保留原始值`);
          dateStr = dateVal;
        }
      }

      // 如果成功解析为 Date 对象，统一格式化为 YYYY-MM-DD
      if (parsedDate) {
        const y = parsedDate.getFullYear();
        const m = String(parsedDate.getMonth() + 1).padStart(2, '0');
        const d = String(parsedDate.getDate()).padStart(2, '0');
        dateStr = `${y}-${m}-${d}`;
      }

      const createdAt = dateStr;

      // 构建动态内容对象
      const content: Moment['content'] = {
        type: fm.type,
        Content,
        ...(fm.type === 'images' ? { images: (fm.images as string[]) || [] } : {}),
        ...(fm.type === 'music'
          ? {
              title: (fm.music_title as string) || '未知歌曲',
              artist: (fm.music_artist as string) || '未知歌手',
              cover: (fm.music_cover as string) || '',
              src: (fm.music_src as string) || '',
            }
          : {}),
        ...(fm.type === 'video'
          ? {
              src: (fm.video_src as string) || '',
              duration: fm.video_duration as string | undefined,
            }
          : {}),
      };

      return {
        id,
        // 作者与头像统一使用当前用户资料
        author: profile.nickname,
        avatar: profile.avatar,
        title: (fm.title as string) || '',
        content,
        location: (fm.location as string) || '',
        createdAt,
        // 密码哈希保护（可选）
        password_hash: (fm.password_hash as string) || undefined,
        // 折叠由 frontmatter 的 collapse 字段控制，简单直接
        needsCollapse: !!fm.collapse,
      };
    })
    // 过滤字段校验失败的文章（null 值）
    .filter((item): item is NonNullable<typeof item> => item !== null)
    // 按发布时间倒序排列，最新动态在前
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

