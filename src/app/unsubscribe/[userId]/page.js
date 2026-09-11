'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function UnsubscribePage() {
  const params = useParams();
  const userId = params?.userId;
  const [status, setStatus] = useState('loading'); // loading | confirm | done | error | already
  const [errorMsg, setErrorMsg] = useState('');
  const [emailMasked, setEmailMasked] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let mounted = true;
    fetch(`/api/unsubscribe?userId=${encodeURIComponent(userId)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!mounted) return;
        if (!res.ok || !data.success) {
          setErrorMsg(data.error || '사용자 정보를 확인할 수 없습니다.');
          setStatus('error');
          return;
        }
        setEmailMasked(data.emailMasked || '');
        if (data.alreadyUnsubscribed) {
          setStatus('already');
          return;
        }
        setStatus('confirm');
      })
      .catch(() => {
        if (!mounted) return;
        setErrorMsg('서버와 통신할 수 없습니다.');
        setStatus('error');
      });
    return () => {
      mounted = false;
    };
  }, [userId]);

  const handleUnsubscribe = async () => {
    setSubmitting(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: Number(userId) }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || '처리에 실패했습니다.');
        setStatus('error');
        return;
      }
      setStatus(data.alreadyUnsubscribed ? 'already' : 'done');
    } catch {
      setErrorMsg('네트워크 오류가 발생했습니다.');
      setStatus('error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Header />
      <main>
        <div className="container-narrow" style={{ padding: '48px 24px' }}>
          <div className="card">
            <div className="card-body" style={{ textAlign: 'center' }}>
              <h1 style={{ fontSize: '1.35rem', marginBottom: 8 }}>선택 메일 수신 거부</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 24 }}>
                필수 안내 메일은 서비스 운영상 계속 받을 수 있으며, 선택 메일(메일수신동의)만
                해제합니다.
              </p>

              {status === 'loading' && (
                <p style={{ color: 'var(--text-muted)' }}>확인 중...</p>
              )}

              {status === 'confirm' && (
                <>
                  {emailMasked && (
                    <p style={{ marginBottom: 16 }}>
                      대상 계정: <strong>{emailMasked}</strong>
                    </p>
                  )}
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={handleUnsubscribe}
                    disabled={submitting}
                  >
                    {submitting ? '처리 중...' : '선택 메일 수신 거부하기'}
                  </button>
                </>
              )}

              {(status === 'done' || status === 'already') && (
                <>
                  <div className="alert alert-success" style={{ textAlign: 'left' }}>
                    {status === 'already'
                      ? '이미 선택 메일 수신을 거부하신 상태입니다.'
                      : '선택 메일 수신이 거부되었습니다.'}
                  </div>
                  <Link href="/profile" className="btn btn-secondary" style={{ marginTop: 8 }}>
                    프로필에서 설정 확인
                  </Link>
                </>
              )}

              {status === 'error' && (
                <>
                  <div className="alert alert-danger" style={{ textAlign: 'left' }}>
                    {errorMsg}
                  </div>
                  <Link href="/" className="btn btn-secondary" style={{ marginTop: 8 }}>
                    홈으로
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
