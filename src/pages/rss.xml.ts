import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { getPublishedPosts, getPostUrl } from '../utils/blog';

export async function GET(context: { site?: string }) {
  const posts = getPublishedPosts(await getCollection('blog'));

  return rss({
    title: 'Noir Trace // Writeups Database',
    description: 'Technical security writeups, low-level reverse engineering, and malware analysis logs.',
    site: context.site ?? 'https://noir-trace.github.io',
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.date,
      description: post.data.description,
      customData: `<category>${post.data.category}</category>`,
      link: getPostUrl(post),
    })),
  });
}
