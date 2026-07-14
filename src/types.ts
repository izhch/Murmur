export interface Profile {
  siteName: string;
  nickname: string;
  signature: string;
  avatar: string;
  cover: string;
  coverDark?: string;
}

interface BlogFrontmatter {
  type?: string;
}

export interface BlogModule {
  frontmatter: BlogFrontmatter;
}