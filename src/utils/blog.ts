import type { CollectionEntry } from 'astro:content';

export const POSTS_PER_PAGE = 5;

export type BlogPost = CollectionEntry<'blog'>;

export function getPublishedPosts(posts: BlogPost[]): BlogPost[] {
  return posts
    .filter((post) => !post.data.draft)
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export function getReadingTime(body: string | undefined): string {
  const wordCount = (body ?? '').split(/\s+/g).filter(Boolean).length;
  return `${Math.max(1, Math.ceil(wordCount / 200))} min read`;
}

export function getPostUrl(post: BlogPost): string {
  return `/blog/${post.id}/`;
}

export function getOgImageUrl(post: BlogPost, site: URL | string): string {
  return new URL(`/og/${post.id}.png`, site).href;
}

export function getRelatedPosts(
  current: BlogPost,
  allPosts: BlogPost[],
  limit = 3,
): BlogPost[] {
  const currentTags = new Set(current.data.tags);

  return allPosts
    .filter((post) => post.id !== current.id)
    .map((post) => ({
      post,
      score: post.data.tags.filter((tag) => currentTags.has(tag)).length,
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.post.data.date.valueOf() - a.post.data.date.valueOf();
    })
    .slice(0, limit)
    .map(({ post }) => post);
}

export function paginatePosts<T>(items: T[], page: number, perPage: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * perPage;

  return {
    items: items.slice(start, start + perPage),
    currentPage,
    totalPages,
    totalItems: items.length,
  };
}
