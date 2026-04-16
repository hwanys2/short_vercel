import './globals.css';
import Script from 'next/script';
import { getDefaultOgImageUrl } from '@/lib/ogImageUrl';
import { getMetadataBase } from '@/lib/siteUrl';
import { getThemeInitScript } from '@/lib/theme';

const ADSENSE_CLIENT = 'ca-pub-8902099051011521';

const defaultOgImage = getDefaultOgImageUrl();
const ogImageEntry = defaultOgImage
  ? [{ url: defaultOgImage, width: 1200, height: 630, alt: '숏.한국' }]
  : undefined;

export const metadata = {
  metadataBase: getMetadataBase(),
  title: '숏.한국 - 한글 URL 단축 서비스 | 긴 URL을 짧고 기억하기 쉬운 한글 주소로 변환',
  description: '숏.한국은 긴 URL을 한글로 된 짧은 주소로 변환해주는 무료 URL 단축 서비스입니다.',
  keywords: 'URL 단축, 한글 URL, 단축 URL, URL 줄이기, 짧은 URL, 한국 URL 단축, 무료 URL 단축',
  authors: [{ name: '숏.한국' }],
  openGraph: {
    type: 'website',
    url: '/',
    title: '숏.한국 - 한글 URL 단축 서비스',
    description: '긴 URL을 한글로 된 짧은 주소로 변환해보세요.',
    siteName: '숏.한국',
    locale: 'ko_KR',
    ...(ogImageEntry && { images: ogImageEntry }),
  },
  twitter: {
    card: 'summary_large_image',
    title: '숏.한국 - 한글 URL 단축 서비스',
    description: '긴 URL을 한글로 된 짧은 주소로 변환해보세요.',
    ...(defaultOgImage && { images: [defaultOgImage] }),
  },
  robots: 'index, follow',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <script id="theme-init" dangerouslySetInnerHTML={{ __html: getThemeInitScript() }} />
        {/* Google Analytics */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-F227R45H63" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-F227R45H63');
            `,
          }}
        />
        <Script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
          crossOrigin="anonymous"
          strategy="afterInteractive"
          id="adsbygoogle-js"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
