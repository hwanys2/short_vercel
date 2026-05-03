'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';

const QR_PREVIEW = 160;
const QR_MODAL = 320;
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

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') closeModal();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [modalOpen, closeModal]);

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

  const expirationText = user
    ? '영구적으로 사용 가능'
    : (() => {
        const exp = new Date(data.expiration_date);
        const now = new Date();
        const diff = exp - now;
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        if (days <= 1) return '24시간 후 만료';
        if (days <= 2) return '48시간 후 만료';
        if (days <= 7) return '1주일 후 만료';
        return '1개월 후 만료';
      })();

  return (
    <div className="result-container">
      <div className="result-header">
        <div className="result-icon">{data.type === 'text' ? '📋' : '✅'}</div>
        <h3>{data.type === 'text' ? '텍스트 공유 주소가 만들어졌습니다!' : 'URL이 성공적으로 단축되었습니다!'}</h3>
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
          <div className="result-actions">
            <a href={data.short_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
              🔗 링크 열기
            </a>
            <span className="expiration-info">
              ⏰ {expirationText}
            </span>
          </div>
        </div>
      </div>

      {modalOpen && (
        <div
          className="qr-modal-backdrop"
          role="presentation"
          onClick={closeModal}
        >
          <div
            className="qr-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="qr-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="qr-modal-header">
              <h4 id="qr-modal-title">QR 코드</h4>
              <button type="button" className="qr-modal-close" onClick={closeModal} aria-label="닫기">
                ×
              </button>
            </div>
            <div className="qr-modal-body">
              <div className="qr-modal-figure">
                <QRCodeSVG
                  value={data.short_url}
                  size={QR_MODAL}
                  level="M"
                  bgColor={qrColors.bg}
                  fgColor={qrColors.fg}
                  title="단축 URL QR 코드 (크게)"
                />
              </div>
              <p className="qr-modal-url" title={data.short_url}>
                {data.short_url}
              </p>
            </div>
            <div className="qr-modal-footer">
              <button type="button" className="btn btn-secondary" onClick={closeModal}>
                닫기
              </button>
              <button type="button" className="btn btn-primary" onClick={downloadPng}>
                PNG로 저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
