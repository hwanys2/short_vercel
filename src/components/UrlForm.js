'use client';
import Link from 'next/link';
import { useState } from 'react';

export default function UrlForm({ user, onResult }) {
  const [originalUrl, setOriginalUrl] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [expireDuration, setExpireDuration] = useState('1week');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const baseUrl = '숏.한국/';
  const prefix = user ? `${baseUrl}${user.username}/` : baseUrl;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/shorten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          original_url: originalUrl,
          custom_code: customCode,
          expire_duration: expireDuration,
        }),
      });

      const data = await res.json();

      if (data.status === 'success') {
        onResult(data.data);
        setOriginalUrl('');
        setCustomCode('');
      } else {
        setError(data.message);
      }
    } catch {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="url-form-container">
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="original-url">원본 URL</label>
          <input
            id="original-url"
            type="url"
            className="form-input"
            placeholder="https://example.com/very-long-url-here"
            value={originalUrl}
            onChange={(e) => setOriginalUrl(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="custom-code">단축 코드</label>
          <div className="code-input-group">
            <span className="url-prefix">{prefix}</span>
            <input
              id="custom-code"
              type="text"
              className="form-input"
              placeholder="원하는코드"
              value={customCode}
              onChange={(e) => setCustomCode(e.target.value)}
              required
              pattern="[가-힣a-zA-Z0-9_-]+"
              title="한글, 영문, 숫자, 밑줄(_), 하이픈(-)만 사용 가능"
            />
          </div>
        </div>

        {user ? (
          <div className="form-group" style={{ textAlign: 'center' }}>
            <div className="member-badge">
              ✨ 회원 URL은 영구적으로 유지됩니다
            </div>
          </div>
        ) : (
          <div className="form-group">
            <label className="form-label">만료 기간</label>
            <div className="duration-options">
              {[
                { value: '24h', label: '24시간' },
                { value: '48h', label: '48시간' },
                { value: '1week', label: '1주일' },
                { value: '1month', label: '1개월' },
              ].map((opt) => (
                <div key={opt.value} className="duration-option">
                  <input
                    type="radio"
                    id={`dur-${opt.value}`}
                    name="expire_duration"
                    value={opt.value}
                    checked={expireDuration === opt.value}
                    onChange={(e) => setExpireDuration(e.target.value)}
                  />
                  <label htmlFor={`dur-${opt.value}`}>{opt.label}</label>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <div className="alert alert-danger">⚠️ {error}</div>}

        <button type="submit" className="btn btn-primary btn-shorten" disabled={loading}>
          {loading ? (
            <><span className="spinner" /> 처리 중...</>
          ) : (
            <>🔗 URL 단축하기</>
          )}
        </button>
        {!user && (
          <p className="url-form-guest-note">
            좋은 단축 코드를 나눠 사용하기 위해 만료 기간이 설정됩니다. 영구 단축을 원하시면{' '}
            <Link href="/register">회원가입</Link>을 하세요. 숏.한국/닉네임/단축코드로 영구적인 단축주소를 가질 수
            있습니다.
          </p>
        )}
      </form>
    </div>
  );
}
