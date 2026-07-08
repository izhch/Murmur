// @ts-check
// 引入 Astro 配置辅助函数
import { defineConfig } from 'astro/config';
// 用于计算当前文件目录，以设置路径别名
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// 当前文件所在目录
const __dirname = dirname(fileURLToPath(import.meta.url));

// https://astro.build/config
// 使用 @ 别名避免 Windows 含空格路径导致的 Vite import 解析双重拼接 bug
export default defineConfig({
  // 站点域名，用于生成 sitemap 等绝对链接
  site: 'https://izhch.com',
  vite: {
    resolve: {
      alias: {
        // 将 @ 指向项目 src 目录
        '@': resolve(__dirname, 'src'),
      },
    },
  },
});
