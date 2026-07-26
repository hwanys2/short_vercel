import { Suspense } from 'react';
import FileViewContent from './FileViewContent';
import { buildPageMetadata } from '@/lib/siteMetadata';

export const metadata = buildPageMetadata({
  pathname: '/file-view',
  title: '파일 다운로드 | 숏.한국',
  description: '숏.한국 단축 주소로 공유된 파일을 다운로드합니다.',
});

export default function FileViewPage() {
  return (
    <Suspense
      fallback={
        <main>
          <div className="text-viewer-page">
            <div className="text-viewer-card">
              <div className="text-viewer-loading">
                <span className="spinner" style={{ borderTopColor: 'var(--primary)' }} />
                <p>파일을 불러오는 중...</p>
              </div>
            </div>
          </div>
        </main>
      }
    >
      <FileViewContent />
    </Suspense>
  );
}
