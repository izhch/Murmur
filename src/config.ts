// 朋友圈主题统一配置

// 引入个人资料类型
import type { Profile } from './types';

// 用户资料：昵称、个性签名、头像、封面图（含暗色模式封面）
export const profile: Profile = {
  siteName: '向晚的朋友圈',
  nickname: '向晚',
  signature: '你曾如烟花绽放在我的天空',
  avatar: '/avatar/avatar.jpeg',
  cover: '/banner/cover1.webp',
  coverDark: '/banner/cover11.webp',
};

// 网站标题（浏览器标签显示）
export const siteTitle = '向晚的朋友圈 · 一块属于自己的自留地';

// 分页配置：首页初始加载条数
export const PAGE_SIZE = 5;

// 高德地图 API Key（用于位置搜索）
export const AMAP_KEY = 'fa87d30b901b3e1d2d35749490720b4a';

// API 基础地址（前端调用 Worker API）
// 开发环境可通过 MURMUR_API 环境变量覆盖
export const API_BASE = 'https://murmur.3103231032.workers.dev';
