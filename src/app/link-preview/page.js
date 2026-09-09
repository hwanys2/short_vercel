import Link from 'next/link';
import { loadLinkPreviewData, absoluteOgImageUrl } from '@/lib/linkPreview';

export async function generateMetadata({ searchParams }) {
  const params = await searchParams;
  const code = typeof params?.code === 'string' ? params.code : '';
  const username = typeof params?.username === 'string' ? params.username : '';
  const data = await loadLinkPreviewData({ code, username: username || undefined });

  if (!data) {
    return {
      title: '숏.한국',
      robots: { index: false, follow: false },
    };
  }

  const ogImage = absoluteOgImageUrl(data.ogImagePath);

  return {
    title: data.title,
    description: data.description,
    robots: { index: false, follow: false },
    openGraph: {
      title: data.title,
      description: data.description,
      url: data.shortUrl,
      siteName: '숏.한국',
      locale: 'ko_KR',
      type: 'website',
      ...(ogImage && { images: [{ url: ogImage, width: 1200, height: 630, alt: data.title }] }),
    },
    twitter: {
      card: 'summary_large_image',
      title: data.title,
      description: data.description,
      ...(ogImage && { images: [ogImage] }),
    },
  };
}

export default async function LinkPreviewPage({ searchParams }) {
  const params = await searchParams;
  const code = typeof params?.code === 'string' ? params.code : '';
  const username = typeof params?.username === 'string' ? params.username : '';
  const data = await loadLinkPreviewData({ code, username: username || undefined });

  return (
    <main style={{ padding: '48px 24px', maxWidth: 560, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: '1.35rem', marginBottom: 12 }}>{data?.title || '숏.한국'}</h1>
      <p style={{ color: '#64748b', lineHeight: 1.6, marginBottom: 24 }}>
        {data?.description || '단축 주소 미리보기입니다.'}
      </p>
      {data?.shortUrl && (
        <p style={{ marginBottom: 16 }}>
          <a href={data.shortUrl} style={{ color: '#2563eb' }}>
            {data.shortUrl}
          </a>
        </p>
      )}
      <Link href="/" style={{ color: '#64748b' }}>
        숏.한국 홈
      </Link>
    </main>
  );
}
