import { getSiteOrigin } from '@/lib/siteUrl';

const PATHS = [
  { path: '/', changeFrequency: 'weekly', priority: 1 },
  { path: '/guide', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/faq', changeFrequency: 'monthly', priority: 0.85 },
  { path: '/api-docs', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/blog', changeFrequency: 'monthly', priority: 0.75 },
  { path: '/contact', changeFrequency: 'yearly', priority: 0.7 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.65 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.65 },
];

export default function sitemap() {
  const origin = getSiteOrigin();
  const now = new Date();
  return PATHS.map(({ path, changeFrequency, priority }) => ({
    url: path === '/' ? `${origin}/` : `${origin}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));
}
