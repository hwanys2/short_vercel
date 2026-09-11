'use client';
import { useEffect, useRef } from 'react';

/**
 * Cloudflare Turnstile 위젯 컴포넌트
 * - NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY 환경변수가 설정되어 있을 때만 렌더링
 * - 미설정 시 아무것도 렌더링하지 않고 정상 폼 제출 가능
 */
export default function Turnstile({ onVerify, onError, onExpire }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const siteKey = process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;

    const scriptId = 'cf-turnstile-script';
    let script = document.getElementById(scriptId);

    const renderWidget = () => {
      if (window.turnstile && containerRef.current && widgetIdRef.current === null) {
        try {
          widgetIdRef.current = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            callback: (token) => onVerify?.(token),
            'error-callback': () => onError?.(),
            'expired-callback': () => onExpire?.(),
            theme: 'auto',
          });
        } catch (e) {
          console.error('Turnstile render error:', e);
        }
      }
    };

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.onload = renderWidget;
      document.head.appendChild(script);
    } else if (window.turnstile) {
      renderWidget();
    }

    return () => {
      if (widgetIdRef.current !== null && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {}
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, onVerify, onError, onExpire]);

  if (!siteKey) return null;

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        justifyContent: 'center',
        margin: '14px 0',
        minHeight: '65px',
      }}
    />
  );
}
