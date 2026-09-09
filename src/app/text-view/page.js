import { Suspense } from 'react';
import TextViewContent from './TextViewContent';
import { loadLinkPreviewData, absoluteOgImageUrl } from '@/lib/linkPreview';

export async function generateMetadata({ searchParams }) {
  const params = await searchParams;
  const code = typeof params?.code === 'string' ? params.code : '';
  const username = typeof params?.username === 'string' ? params.username : '';
  if (!code) {
    return { title: '텍스트 보기 | 숏.한국', robots: { index: false, follow: false } };
  }
  const data = await loadLinkPreviewData({ code, username: username || undefined });
  if (!data) {
    return { title: '텍스트 보기 | 숏.한국', robots: { index: false, follow: false } };
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

export default function TextViewPage() {
  return (
    <Suspense fallback={null}>
      <TextViewContent />
    </Suspense>
  );
}
