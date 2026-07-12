// Astro 构建后插件：移除所有 HTML 文件中的注释
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

function walkDir(dir, callback) {
  const files = readdirSync(dir);
  for (const file of files) {
    const fullPath = join(dir, file);
    if (statSync(fullPath).isDirectory()) {
      walkDir(fullPath, callback);
    } else if (file.endsWith('.html')) {
      callback(fullPath);
    }
  }
}

export default function removeHtmlComments() {
  return {
    name: 'remove-html-comments',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        const distPath = fileURLToPath(dir);
        let count = 0;

        walkDir(distPath, (filePath) => {
          let html = readFileSync(filePath, 'utf-8');
          const before = html.length;
          html = html.replace(/<!--[\s\S]*?-->/g, '');
          const after = html.length;
          if (before !== after) {
            writeFileSync(filePath, html, 'utf-8');
            count++;
          }
        });

        console.log(`\n✅ 已移除 ${count} 个 HTML 文件中的注释`);
      },
    },
  };
}
