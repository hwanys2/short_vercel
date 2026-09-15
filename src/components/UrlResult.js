'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import QrModal from '@/components/QrModal';
import { formatTempExpiryDate, formatTempRemaining } from '@/lib/tempLinks';

const QR_PREVIEW = 160;
const QR_EXPORT = 512;

function readQrColors() {
  if (typeof document === 'undefined') {
    return { bg: '#ffffff', fg: '#20284f' };
  }
  const root = document.documentElement;
  const bg = getComputedStyle(root).getPropertyValue('--qr-bg').trim() || '#ffffff';
  const fg = getComputedStyle(root).getPropertyValue('--qr-fg').trim() || '#20284f';
  return { bg, fg };
}

function downloadFilename(shortUrl) {
  try {
    const u = new URL(shortUrl);
    const last = u.pathname.split('/').filter(Boolean).pop() || 'link';
    const safe = last.replace(/[^\w.\-가-힣]/g, '_').slice(0, 48);
    return `qr-${safe}.png`;
  } catch {
    return 'qrcode.png';
  }
}

export default function UrlResult({ data, user }) {
  const [qrColors, setQrColors] = useState(() => readQrColors());
  const [modalOpen, setModalOpen] = useState(false);
  const exportCanvasRef = useRef(null);

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setQrColors(readQrColors());
    const raf = requestAnimationFrame(() => sync());
    const obs = new MutationObserver((records) => {
      if (records.some((r) => r.attributeName === 'data-theme')) sync();
    });
    obs.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      cancelAnimationFrame(raf);
      obs.disconnect();
    };
  }, []);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(data.short_url).then(() => {
      alert('URL이 복사되었습니다!');
    });
  };

  const openModal = useCallback(() => setModalOpen(true), []);
  const closeModal = useCallback(() => setModalOpen(false), []);

  const downloadPng = useCallback(() => {
    const canvas = exportCanvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadFilename(data.short_url);
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [data.short_url]);

  // 회원 본인 코드 링크만 영구. 임시 주소(is_temp)와 비회원 링크는 만료일 표시
  const isTemp = Boolean(data.is_temp);
  const isMemberPermanent = Boolean(user?.id) && !isTemp;
  const expirationText =
    data.type === 'file' && isMemberPermanent
      ? '최근 3개월 미접속 시 자동 삭제'
      : isMemberPermanent
        ? '영구적으로 사용 가능'
        : (() => {
            const remaining = formatTempRemaining(data.expiration_date);
            const at = formatTempExpiryDate(data.expiration_date);
            if (!remaining) return '만료 기간 있음';
            return at ? `${remaining} (${at})` : remaining;
          })();

  const resultIcon = data.type === 'text' ? '📋' : data.type === 'file' ? '📎' : '✅';
  const resultTitle =
    data.type === 'text'
      ? '텍스트 공유 주소가 만들어졌습니다!'
      : data.type === 'file'
        ? '파일 공유 주소가 만들어졌습니다!'
        : 'URL이 성공적으로 단축되었습니다!';

  return (
    <div className="result-container">
      <div className="result-header">
        <div className="result-icon">{resultIcon}</div>
        <h3>{resultTitle}</h3>
      </div>

      <div className="result-content">
        <div className="qr-section">
          <button
            type="button"
            className="qr-preview-trigger"
            onClick={openModal}
            aria-haspopup="dialog"
            aria-expanded={modalOpen}
            aria-label="QR 코드 크게 보기"
          >
            <QRCodeSVG
              value={data.short_url}
              size={QR_PREVIEW}
              level="M"
              bgColor={qrColors.bg}
              fgColor={qrColors.fg}
              title="단축 URL QR 코드"
            />
            <span className="qr-preview-hint">탭하여 크게 보기</span>
          </button>

          <div className="qr-actions" role="group" aria-label="QR 코드 저장">
            <button type="button" className="btn btn-secondary btn-sm qr-action-btn" onClick={downloadPng}>
              PNG 저장
            </button>
          </div>

          <div className="qr-export-canvas-wrap" aria-hidden="true">
            <QRCodeCanvas
              ref={exportCanvasRef}
              value={data.short_url}
              size={QR_EXPORT}
              level="M"
              marginSize={2}
              bgColor={qrColors.bg}
              fgColor={qrColors.fg}
            />
          </div>
        </div>

        <div className="url-content">
          <div className="url-display">
            <input type="text" value={data.short_url} readOnly id="shortened-url" />
            <button onClick={copyToClipboard} className="btn btn-primary btn-sm">
              📋 복사
            </button>
          </div>
          <p className="short-url-mobile-hint">
            모바일 주소창에 직접 입력할 때는 주소 끝에 <code>/</code>를 붙여 주세요.{' '}
            <code>/</code> 없이 입력하면 구글 검색으로 연결될 수 있습니다.
          </p>
          <div className="result-actions">
            <a href={data.short_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
              {data.type === 'html' ? '🌐 웹사이트 열기' : '🔗 링크 열기'}
            </a>
            <span className="expiration-info">
              ⏰ {expirationText}
            </span>
          </div>
          {isTemp && user?.id && (
            <p className="result-temp-note">
              ⏳ 임시 주소입니다. <Link href="/dashboard?scope=temp">대시보드</Link>에서 만료 전까지 수정·삭제하거나
              기간을 다시 설정할 수 있고, 내 코드 주소로 전환할 수도 있어요.
            </p>
          )}
        </div>
      </div>

      {modalOpen && (
        <QrModal
          isOpen={modalOpen}
          onClose={closeModal}
          url={data.short_url}
          code={data.code}
          title="QR 코드"
        />
      )}
    </div>
  );
}
