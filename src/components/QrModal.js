'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';

const QR_MODAL_SIZE = 280;
const QR_EXPORT_SIZE = 512;

function readQrColors() {
  if (typeof document === 'undefined') {
    return { bg: '#ffffff', fg: '#20284f' };
  }
  const root = document.documentElement;
  const bg = getComputedStyle(root).getPropertyValue('--qr-bg').trim() || '#ffffff';
  const fg = getComputedStyle(root).getPropertyValue('--qr-fg').trim() || '#20284f';
  return { bg, fg };
}

export function IconQrCode({ size = 18, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="5.5" y="5.5" width="2" height="2" fill="currentColor" stroke="none" />
      <rect x="16.5" y="5.5" width="2" height="2" fill="currentColor" stroke="none" />
      <rect x="5.5" y="16.5" width="2" height="2" fill="currentColor" stroke="none" />
      <rect x="14" y="14" width="2.5" height="2.5" fill="currentColor" stroke="none" />
      <rect x="18.5" y="14" width="2.5" height="2.5" fill="currentColor" stroke="none" />
      <rect x="14" y="18.5" width="2.5" height="2.5" fill="currentColor" stroke="none" />
      <rect x="18.5" y="18.5" width="2.5" height="2.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function QrModal({
  isOpen,
  onClose,
  url,
  code,
  username,
  displayName,
  label,
  title = 'QR 코드',
}) {
  const [qrColors, setQrColors] = useState(() => readQrColors());
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
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

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose]);

  const copyUrl = useCallback(() => {
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [url]);

  const downloadPng = useCallback(() => {
    const canvas = exportCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;

    let filename = 'qrcode.png';
    if (code) {
      const safeCode = decodeURIComponent(code).replace(/[^\w.\-가-힣]/g, '_');
      const safeUser = username ? `${decodeURIComponent(username).replace(/[^\w.\-가-힣]/g, '_')}_` : '';
      filename = `qr-${safeUser}${safeCode}.png`;
    } else if (url) {
      try {
        const u = new URL(url);
        const last = u.pathname.split('/').filter(Boolean).pop() || 'link';
        const safe = decodeURIComponent(last).replace(/[^\w.\-가-힣]/g, '_').slice(0, 48);
        filename = `qr-${safe}.png`;
      } catch {
        filename = 'qrcode.png';
      }
    }

    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();

    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  }, [code, username, url]);

  if (!isOpen || !url) return null;

  return (
    <div
      className="qr-modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="qr-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="qr-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="qr-modal-header">
          <h4 id="qr-modal-title">
            {title} {displayName ? `· ${displayName}` : ''}
          </h4>
          <button
            type="button"
            className="qr-modal-close"
            onClick={onClose}
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <div className="qr-modal-body">
          <div className="qr-modal-figure">
            <QRCodeSVG
              value={url}
              size={QR_MODAL_SIZE}
              level="M"
              marginSize={1}
              bgColor={qrColors.bg}
              fgColor={qrColors.fg}
              title={`QR 코드: ${url}`}
            />
          </div>

          <div className="qr-modal-url-box">
            <span className="qr-modal-url" title={url}>
              {url}
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm qr-modal-copy-btn"
              onClick={copyUrl}
            >
              {copied ? '✓ 복사됨' : '복사'}
            </button>
          </div>

          {label && (
            <p className="qr-modal-sublabel" title={label}>
              {label}
            </p>
          )}

          <div className="qr-export-canvas-wrap" aria-hidden="true">
            <QRCodeCanvas
              ref={exportCanvasRef}
              value={url}
              size={QR_EXPORT_SIZE}
              level="M"
              marginSize={2}
              bgColor={qrColors.bg}
              fgColor={qrColors.fg}
            />
          </div>
        </div>

        <div className="qr-modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            닫기
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={downloadPng}
          >
            {downloaded ? '✓ 다운로드 완료' : '📥 QR 다운로드 (PNG)'}
          </button>
        </div>
      </div>
    </div>
  );
}
