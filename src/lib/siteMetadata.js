import { getDefaultOgImageUrl } from '@/lib/ogImageUrl';

const OG_DIM = { width: 1200, height: 630, alt: '숏.한국' };

/**
 * @param {{ pathname: string; title: string; description: string; robots?: import('next').Metadata['robots']; ogImage?: string }} opts pathname e.g. '/guide'
 */
export function buildPageMetadata({ pathname, title, description, robots, ogImage }) {
  const base = { title, description, alternates: { canonical: pathname } };
  const imageUrl = ogImage ?? getDefaultOgImageUrl();
  const images = imageUrl ? [{ url: imageUrl, ...OG_DIM }] : undefined;
  const og = {
    title,
    description,
    url: pathname,
    siteName: '숏.한국',
    locale: 'ko_KR',
    type: 'website',
    ...(images && { images }),
  };
  const tw = {
    card: 'summary_large_image',
    title,
    description,
    ...(imageUrl && { images: [imageUrl] }),
  };
  if (robots !== undefined) {
    return { ...base, openGraph: og, twitter: tw, robots };
  }
  return { ...base, openGraph: og, twitter: tw };
}
