'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import RichTextEditor from '@/components/RichTextEditor';

const ACTIVE_STATUSES = new Set(['preparing', 'queued', 'running']);

const STATUS_LABELS = {
  draft: '초안',
  preparing: '준비 중',
  queued: '대기',
  running: '발송 중',
  paused: '일시정지',
  completed: '완료',
  failed: '실패',
  cancelled: '취소됨',
};

function formatDateTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('ko-KR');
}

function htmlHasContent(html) {
  const raw = String(html || '');
  if (/<img\b/i.test(raw)) return true;
  return raw
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim().length > 0;
}

async function mailingFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(data.error || data.message || '요청에 실패했습니다.');
  }
  return data;
}

export default function AdminMailingPage() {
  const router = useRouter();
  const [authState, setAuthState] = useState('loading'); // loading | ok | denied
  const [activeTab, setActiveTab] = useState('compose');

  const [audiences, setAudiences] = useState([]);
  const [selectedAudience, setSelectedAudience] = useState('');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);
  const [audiencesError, setAudiencesError] = useState(null);
  const [loadingAudiences, setLoadingAudiences] = useState(false);

  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [failures, setFailures] = useState([]);
  const [failuresTotal, setFailuresTotal] = useState(0);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) {
          router.push('/login');
          return;
        }
        if (data.needsOnboarding) {
          router.push('/onboarding');
          return;
        }
        if (!data.user?.is_admin) {
          setAuthState('denied');
          return;
        }
        setAuthState('ok');
      })
      .catch(() => router.push('/login'));
  }, [router]);

  const fetchAudiences = useCallback(async () => {
    setLoadingAudiences(true);
    setAudiencesError(null);
    try {
      const result = await mailingFetch('/api/admin/mailing/audiences');
      const list = result.audiences || [];
      setAudiences(list);
      setSelectedAudience((current) => {
        if (current && list.some((a) => a.id === current)) return current;
        return list.some((a) => a.id === 'admin') ? 'admin' : current;
      });
    } catch (err) {
      setAudiences([]);
      setAudiencesError(err.message);
    } finally {
      setLoadingAudiences(false);
    }
  }, []);

  useEffect(() => {
    if (authState === 'ok') fetchAudiences();
  }, [authState, fetchAudiences]);

  const selectedMemberCount =
    audiences.find((a) => a.id === selectedAudience)?.memberCount ?? null;

  const loadCampaigns = useCallback(async () => {
    setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      const result = await mailingFetch('/api/admin/mailing/campaigns?limit=50');
      setCampaigns(result.campaigns || []);
      setSelectedCampaignId((current) => {
        if (current) return current;
        const list = result.campaigns || [];
        if (list.length === 0) return null;
        const active = list.find((c) => ACTIVE_STATUSES.has(c.status));
        return active?.id ?? list[0].id;
      });
    } catch (err) {
      setHistoryError(err.message);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  const loadCampaignDetail = useCallback(async (campaignId) => {
    try {
      const result = await mailingFetch(`/api/admin/mailing/campaigns/${campaignId}`);
      setSelectedCampaign(result.campaign);
      if (result.campaign.failedCount > 0) {
        const failuresResult = await mailingFetch(
          `/api/admin/mailing/campaigns/${campaignId}/failures?limit=100`
        );
        setFailures(failuresResult.failures || []);
        setFailuresTotal(failuresResult.total || 0);
      } else {
        setFailures([]);
        setFailuresTotal(0);
      }
    } catch (err) {
      setHistoryError(err.message);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'history' && authState === 'ok') {
      loadCampaigns();
    }
  }, [activeTab, authState, loadCampaigns]);

  useEffect(() => {
    if (!selectedCampaignId || activeTab !== 'history') return;
    loadCampaignDetail(selectedCampaignId);
  }, [selectedCampaignId, activeTab, loadCampaignDetail]);

  useEffect(() => {
    if (!selectedCampaignId || activeTab !== 'history' || !selectedCampaign) return;
    if (!ACTIVE_STATUSES.has(selectedCampaign.status)) return;
    const timer = setInterval(() => {
      loadCampaignDetail(selectedCampaignId);
      loadCampaigns();
    }, 3000);
    return () => clearInterval(timer);
  }, [
    selectedCampaignId,
    selectedCampaign?.status,
    activeTab,
    loadCampaignDetail,
    loadCampaigns,
  ]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!selectedAudience || !subject.trim() || !htmlHasContent(content)) {
      setStatusMsg({ type: 'error', text: '모든 입력란을 채워주세요.' });
      return;
    }
    if (selectedMemberCount === 0) {
      setStatusMsg({ type: 'error', text: '선택한 대상에 수신자가 없습니다.' });
      return;
    }

    setIsSubmitting(true);
    setStatusMsg(null);
    try {
      const created = await mailingFetch('/api/admin/mailing/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          audience: selectedAudience,
          subject: subject.trim(),
          message: content,
        }),
      });
      const started = await mailingFetch(
        `/api/admin/mailing/campaigns/${created.campaign.id}/start`,
        { method: 'POST' }
      );

      setSelectedCampaignId(started.campaign.id);
      setSelectedCampaign(started.campaign);
      setActiveTab('history');
      setSubject('');
      setContent('');

      if (started.warning === 'NO_RECIPIENTS' || started.campaign.totalRecipients === 0) {
        setStatusMsg({
          type: 'error',
          text: started.campaign.errorMessage || '발송 대상 수신자가 없습니다.',
        });
      } else {
        setStatusMsg({
          type: 'success',
          text: `백그라운드 발송이 시작되었습니다. (${started.campaign.totalRecipients.toLocaleString()}명)`,
        });
      }
      await loadCampaigns();
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || '발송 시작에 실패했습니다.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const runCampaignAction = async (action) => {
    if (!selectedCampaignId) return;
    setIsActionLoading(true);
    setHistoryError(null);
    try {
      const paths = {
        pause: 'pause',
        resume: 'start',
        resumeWorker: 'resume',
        cancel: 'cancel',
        retry: 'retry-failed',
      };
      await mailingFetch(
        `/api/admin/mailing/campaigns/${selectedCampaignId}/${paths[action]}`,
        { method: 'POST' }
      );
      await loadCampaignDetail(selectedCampaignId);
      await loadCampaigns();
    } catch (err) {
      setHistoryError(err.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  if (authState === 'loading') {
    return (
      <>
        <Header />
        <main>
          <div className="container" style={{ padding: '48px 24px', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)' }}>권한 확인 중...</p>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  if (authState === 'denied') {
    return (
      <>
        <Header />
        <main>
          <div className="container" style={{ padding: '48px 24px', maxWidth: 640 }}>
            <div className="card">
              <div className="card-body" style={{ textAlign: 'center' }}>
                <h1 style={{ fontSize: '1.25rem', marginBottom: 8 }}>접근 권한 없음</h1>
                <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
                  이 페이지는 관리자만 이용할 수 있습니다.
                </p>
                <Link href="/dashboard" className="btn btn-primary">
                  대시보드로
                </Link>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <main>
        <div className="container mailing-admin" style={{ padding: '32px 24px 64px', maxWidth: 1040 }}>
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 6 }}>단체 메일 발송</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
              서버 백그라운드에서 발송됩니다. 브라우저를 닫아도 계속되며, 발신 주소는{' '}
              <code>noreply@숏.한국</code> 입니다.
            </p>
          </div>

          <div className="mailing-tabs" style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'compose' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('compose')}
            >
              새 발송
            </button>
            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('history')}
            >
              발송 내역
            </button>
          </div>

          {statusMsg && activeTab === 'compose' && (
            <div
              className={`alert ${statusMsg.type === 'success' ? 'alert-success' : 'alert-danger'}`}
              style={{ marginBottom: 16 }}
            >
              {statusMsg.text}
            </div>
          )}

          {activeTab === 'compose' && (
            <div className="card">
              <form onSubmit={handleSend}>
                <div className="card-body" style={{ display: 'grid', gap: 20 }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="audience">
                      수신 대상
                    </label>
                    <select
                      id="audience"
                      className="form-input"
                      value={selectedAudience}
                      onChange={(e) => setSelectedAudience(e.target.value)}
                      disabled={isSubmitting || loadingAudiences}
                      required
                    >
                      <option value="" disabled>
                        {loadingAudiences ? '불러오는 중...' : '대상을 선택하세요'}
                      </option>
                      {audiences.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.memberCount.toLocaleString()}명)
                        </option>
                      ))}
                    </select>
                    {audiencesError && (
                      <p style={{ marginTop: 8, fontSize: '0.85rem', color: 'var(--danger)' }}>
                        {audiencesError}{' '}
                        <button type="button" className="btn btn-ghost btn-sm" onClick={fetchAudiences}>
                          다시 시도
                        </button>
                      </p>
                    )}
                    {selectedAudience && (
                      <p style={{ marginTop: 8, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {audiences.find((a) => a.id === selectedAudience)?.description}
                        {selectedMemberCount != null &&
                          ` · ${selectedMemberCount.toLocaleString()}명`}
                      </p>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="subject">
                      메일 제목
                    </label>
                    <input
                      id="subject"
                      type="text"
                      className="form-input"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      disabled={isSubmitting}
                      placeholder="제목을 입력하세요"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">메일 본문</label>
                    <p style={{ margin: '0 0 8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      시각 편집과 HTML을 함께 사용할 수 있습니다. 발송 시 숏.한국 헤더·푸터·수신거부
                      링크가 자동으로 붙습니다.
                    </p>
                    <RichTextEditor
                      value={content}
                      onChange={setContent}
                      disabled={isSubmitting}
                      placeholder="메일 본문을 작성하세요."
                    />
                  </div>
                </div>
                <div
                  className="card-header"
                  style={{
                    borderTop: '1px solid var(--border)',
                    borderBottom: 'none',
                    justifyContent: 'flex-end',
                  }}
                >
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSubmitting || loadingAudiences || selectedMemberCount === 0}
                  >
                    {isSubmitting
                      ? '발송 준비 중...'
                      : selectedAudience === 'admin'
                        ? '테스트 발송 시작'
                        : '백그라운드 발송 시작'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'history' && (
            <div style={{ display: 'grid', gap: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '1.1rem', margin: 0 }}>발송 내역</h2>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    loadCampaigns();
                    if (selectedCampaignId) loadCampaignDetail(selectedCampaignId);
                  }}
                  disabled={isLoadingHistory}
                >
                  새로고침
                </button>
              </div>

              {historyError && (
                <div className="alert alert-danger">{historyError}</div>
              )}

              <div
                className="mailing-history-grid"
              >
                <div className="card" style={{ maxHeight: 520, overflow: 'auto' }}>
                  {isLoadingHistory && campaigns.length === 0 ? (
                    <div className="card-body" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      불러오는 중...
                    </div>
                  ) : campaigns.length === 0 ? (
                    <div className="card-body" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      발송 내역이 없습니다.
                    </div>
                  ) : (
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                      {campaigns.map((campaign) => (
                        <li key={campaign.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <button
                            type="button"
                            onClick={() => setSelectedCampaignId(campaign.id)}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: '14px 16px',
                              border: 'none',
                              background:
                                selectedCampaignId === campaign.id
                                  ? 'var(--bg-card-hover)'
                                  : 'transparent',
                              cursor: 'pointer',
                              color: 'inherit',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                              <strong style={{ fontSize: '0.9rem' }}>{campaign.subject}</strong>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                                {STATUS_LABELS[campaign.status] || campaign.status}
                              </span>
                            </div>
                            <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {campaign.audienceName} · {formatDateTime(campaign.createdAt)}
                            </p>
                            <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              {campaign.sentCount.toLocaleString()} /{' '}
                              {campaign.totalRecipients.toLocaleString()}명
                              {campaign.failedCount > 0 && (
                                <span style={{ color: 'var(--danger)' }}>
                                  {' '}
                                  · 실패 {campaign.failedCount}
                                </span>
                              )}
                            </p>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="card">
                  <div className="card-body">
                    {!selectedCampaign ? (
                      <p style={{ textAlign: 'center', color: 'var(--text-muted)', margin: '40px 0' }}>
                        왼쪽에서 캠페인을 선택하세요.
                      </p>
                    ) : (
                      <div style={{ display: 'grid', gap: 16 }}>
                        <div>
                          <h3 style={{ margin: '0 0 4px', fontSize: '1.1rem' }}>
                            {selectedCampaign.subject}
                          </h3>
                          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            {selectedCampaign.audienceName} ·{' '}
                            {STATUS_LABELS[selectedCampaign.status] || selectedCampaign.status}
                          </p>
                        </div>

                        {ACTIVE_STATUSES.has(selectedCampaign.status) &&
                          selectedCampaign.totalRecipients > 0 && (
                            <div
                              style={{
                                padding: 14,
                                borderRadius: 'var(--radius-md)',
                                background: 'var(--surface)',
                                border: '1px solid var(--border)',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  fontSize: '0.85rem',
                                  marginBottom: 8,
                                }}
                              >
                                <span>
                                  {selectedCampaign.status === 'preparing'
                                    ? '수신자 준비 중...'
                                    : '발송 중...'}
                                </span>
                                <span>{selectedCampaign.progressPercent}%</span>
                              </div>
                              <div
                                style={{
                                  height: 8,
                                  borderRadius: 999,
                                  background: 'var(--border)',
                                  overflow: 'hidden',
                                }}
                              >
                                <div
                                  style={{
                                    width: `${selectedCampaign.progressPercent}%`,
                                    height: '100%',
                                    background: 'var(--gradient-primary)',
                                  }}
                                />
                              </div>
                            </div>
                          )}

                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
                            gap: 10,
                            fontSize: '0.85rem',
                          }}
                        >
                          <Stat label="전체" value={selectedCampaign.totalRecipients} />
                          <Stat label="발송" value={selectedCampaign.sentCount} />
                          <Stat label="실패" value={selectedCampaign.failedCount} />
                          <Stat label="건너뜀" value={selectedCampaign.skippedCount} />
                          <Stat label="대기" value={selectedCampaign.pendingCount} />
                        </div>

                        {selectedCampaign.errorMessage && (
                          <div className="alert alert-danger" style={{ fontSize: '0.85rem' }}>
                            {selectedCampaign.errorMessage}
                          </div>
                        )}

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {selectedCampaign.status === 'running' && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              disabled={isActionLoading}
                              onClick={() => runCampaignAction('pause')}
                            >
                              일시정지
                            </button>
                          )}
                          {selectedCampaign.status === 'paused' && (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              disabled={isActionLoading}
                              onClick={() => runCampaignAction('resume')}
                            >
                              재개
                            </button>
                          )}
                          {(selectedCampaign.status === 'running' ||
                            selectedCampaign.status === 'failed') && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              disabled={isActionLoading}
                              onClick={() => runCampaignAction('resumeWorker')}
                            >
                              워커 재시작
                            </button>
                          )}
                          {['completed', 'failed', 'paused'].includes(selectedCampaign.status) &&
                            selectedCampaign.failedCount > 0 && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                disabled={isActionLoading}
                                onClick={() => runCampaignAction('retry')}
                              >
                                실패자 재발송
                              </button>
                            )}
                          {!['completed', 'cancelled', 'failed'].includes(
                            selectedCampaign.status
                          ) && (
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              disabled={isActionLoading}
                              onClick={() => runCampaignAction('cancel')}
                            >
                              취소
                            </button>
                          )}
                        </div>

                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          <div>시작: {formatDateTime(selectedCampaign.startedAt)}</div>
                          <div>완료: {formatDateTime(selectedCampaign.completedAt)}</div>
                          <div>생성: {formatDateTime(selectedCampaign.createdAt)}</div>
                        </div>

                        {failuresTotal > 0 && (
                          <div>
                            <h4 style={{ margin: '0 0 8px', fontSize: '0.95rem' }}>
                              실패 목록 ({failuresTotal})
                            </h4>
                            <div className="table-wrapper">
                              <table>
                                <thead>
                                  <tr>
                                    <th>이메일</th>
                                    <th>시도</th>
                                    <th>오류</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {failures.map((f) => (
                                    <tr key={f.id}>
                                      <td>{f.email}</td>
                                      <td>
                                        {f.attemptCount}/{f.maxAttempts}
                                      </td>
                                      <td style={{ fontSize: '0.8rem' }}>{f.lastError || '-'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

function Stat({ label, value }) {
  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border)',
        background: 'var(--surface)',
      }}
    >
      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{label}</div>
      <div style={{ fontWeight: 700, marginTop: 2 }}>{Number(value || 0).toLocaleString()}</div>
    </div>
  );
}
