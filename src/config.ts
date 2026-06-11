/**
 * 站点统一配置文件
 *
 * 【修改位置】
 *  - 网站名称 / 网站描述 / 标签页标题格式：siteMeta 对象
 *  - 昵称 / 头像 / 封面 / 签名：siteProfile 对象
 *  - 菜单项：menuItems 数组
 *  - 背景图片：siteBackground 配置（开关 + 图片URL）
 *  - 主题颜色 / 字体大小 / 间距 / 封面高度：src/styles/global.css
 */

/** 网站元信息（标签页标题、SEO 描述等） */
export const siteMeta = {
    siteName: '向晚的朋友圈',
    description: '一块属于自己的自留地 | 孤久则安',
    titleSeparator: ' · ',
};

/** 个人资料配置（首页 & 详情页共享） */
export const siteProfile = {
    name: '向晚',
    avatar: '/avatar/avatar.jpeg',
    cover: '/banner/cover1.webp',
    signature: '一块属于自己的自留地 | 孤久则安',
};

/** 背景图片配置
 *  - enable:      是否启用背景图片（true = 启用，false = 关闭，使用纯色背景）
 *  - opacity:     背景图片的不透明度（0-1，0.02 = 很淡，0.1 = 明显一点）
 *  - blur:        背景图片的模糊程度（像素值，0 = 不模糊，5 = 柔和模糊）
 *  - lightMode:   亮色模式背景图片数组，会随机选取一张
 *  - darkMode:    暗色模式背景图片数组，会随机选取一张
 *
 *  图片来源：将图片放入 public/banner/ 目录，然后在下面数组中填写路径即可
 *  格式示例：'/banner/cover1.webp'
 */
export const siteBackground = {
    enable: true,
    opacity: 0.05,
    blur: 0,
    // 亮色模式：多个图片时随机显示
    lightMode: [
        '/banner/cover1.webp',
    ],
    // 暗色模式：多个图片时随机显示
    darkMode: [
        '/banner/cover11.webp',
    ],
};

/** 菜单项（封面右上角菜单按钮点开后显示） */
export const menuItems = [
    { label: 'About',   href: '/about'   },
    { label: 'Archive', href: '/archive' },
    { label: 'Photos',  href: '/photos'  },
];
