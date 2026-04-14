/**
 * @param {{ pathname: string; title: string; description: string; robots?: import('next').Metadata['robots'] }} opts pathname e.g. '/guide'
 */
export function buildPageMetadata({ pathname, title, description, robots }) {
  const base = { title, description, alternates: { canonical: pathname } };
  const og = {
    title,
    description,
    url: pathname,
    siteName: '숏.한국',
    locale: 'ko_KR',
    type: 'website',
  };
  const tw = {
    card: 'summary_large_image',
    title,
    description,
  };
  if (robots !== undefined) {
    return { ...base, openGraph: og, twitter: tw, robots };
  }
  return { ...base, openGraph: og, twitter: tw };
}
