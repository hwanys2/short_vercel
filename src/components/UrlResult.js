'use client';
import { QRCodeSVG } from 'qrcode.react';

export default function UrlResult({ data, user }) {
  const copyToClipboard = () => {
    navigator.clipboard.writeText(data.short_url).then(() => {
      alert('URL이 복사되었습니다!');
    });
  };

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
        <div className="result-icon">✅</div>
        <h3>URL이 성공적으로 단축되었습니다!</h3>
      </div>

      <div className="result-content">
        <div className="qr-section">
          <QRCodeSVG
            value={data.short_url}
            size={160}
            level="M"
            bgColor="var(--qr-bg)"
            fgColor="var(--qr-fg)"
          />
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
    </div>
  );
}
