import { getSiteOrigin } from '@/lib/siteUrl';

export default function robots() {
  const origin = getSiteOrigin();
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/dashboard'],
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
