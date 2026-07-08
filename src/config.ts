// 朋友圈主题统一配置

// 引入个人资料类型
import type { Profile } from './types';

// 用户资料：昵称、个性签名、头像、封面图（含暗色模式封面）
export const profile: Profile = {
  siteName: '向晚的朋友圈',
  nickname: '向晚',
  signature: '没有什么感同身受，只有冷暖自知。',
  avatar: '/avatar/avatar.jpeg',
  cover: '/banner/cover1.webp',
  coverDark: '/banner/cover11.webp',
};

// 网站标题（浏览器标签显示）
export const siteTitle = '向晚的朋友圈 · 一块属于自己的自留地';

// 分页配置：首页初始加载条数
export const PAGE_SIZE = 5;
