import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { loadLinkPreviewData } from '@/lib/linkPreview';

export const runtime = 'nodejs';

async function loadLocalFont() {
  const path = join(process.cwd(), 'assets/fonts/Pretendard-Bold.woff');
  return readFile(path);
}

let cachedFontPromise = null;
function getFont() {
  if (!cachedFontPromise) {
    cachedFontPromise = loadLocalFont().catch((err) => {
      cachedFontPromise = null;
      throw err;
    });
  }
  return cachedFontPromise;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code') || '';
  const username = searchParams.get('username') || '';
  const kindHint = searchParams.get('kind') || '';

  const data = await loadLinkPreviewData({
    code,
    username: username || undefined,
  });

  const kind =
    kindHint ||
    (data?.passwordProtected
      ? 'locked'
      : !data?.found
        ? 'missing'
        : data?.type || 'url');

  const title =
    kind === 'locked'
      ? '비밀번호로 보호된 링크'
      : kind === 'missing'
        ? '링크를 찾을 수 없습니다'
        : kind === 'file'
          ? (data?.title || '파일 공유').replace(/\s*\|\s*숏\.한국$/, '')
          : kind === 'text'
            ? '텍스트 공유'
            : data?.code || '단축 주소';

  const subtitle =
    kind === 'locked'
      ? '비밀번호를 입력해야 열 수 있습니다'
      : kind === 'missing'
        ? '없거나 만료된 단축 주소입니다'
        : data?.description || '숏.한국';

  const badge =
    kind === 'locked'
      ? '잠긴 링크'
      : kind === 'file'
        ? '파일'
        : kind === 'text'
          ? '텍스트'
          : kind === 'missing'
            ? '없음'
            : 'URL';

  let fonts = [];
  try {
    const fontData = await getFont();
    fonts = [
      {
        name: 'Pretendard',
        data: fontData,
        style: 'normal',
        weight: 700,
      },
    ];
  } catch (err) {
    console.error('OG font load failed, falling back to system font:', err);
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '56px 64px',
          background: '#0f172a',
          color: '#f8fafc',
          fontFamily: fonts.length ? 'Pretendard' : 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontSize: 28,
            color: '#94a3b8',
          }}
        >
          <span
            style={{
              display: 'flex',
              padding: '6px 14px',
              borderRadius: 999,
              background: '#1e293b',
              color: '#38bdf8',
              fontSize: 22,
              fontWeight: 700,
            }}
          >
            {badge}
          </span>
          <span>숏.한국</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div
            style={{
              fontSize: 64,
              fontWeight: 700,
              lineHeight: 1.15,
              letterSpacing: '-0.02em',
              maxHeight: 160,
              overflow: 'hidden',
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 30,
              color: '#cbd5e1',
              lineHeight: 1.4,
              maxHeight: 90,
              overflow: 'hidden',
            }}
          >
            {subtitle}
          </div>
        </div>

        <div style={{ display: 'flex', fontSize: 26, color: '#64748b' }}>
          한글로 만드는 짧은 URL
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts }
  );
}
