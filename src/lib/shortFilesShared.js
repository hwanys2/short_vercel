export const SHORT_FILES_BUCKET_DEFAULT = 'short_files';

export const SUPABASE_STORAGE_MAX_BYTES = 0; // 전체 파일 Cloudflare R2로 일원화
export const R2_STORAGE_THRESHOLD_BYTES = 0; // 모든 파일 R2 업로드
export const R2_SMALL_FOLDER_THRESHOLD_BYTES = 10 * 1024 * 1024; // 10MB
export const R2_LARGE_FOLDER_THRESHOLD_BYTES = 1024 * 1024 * 1024; // 1GB
export const MAX_FILE_BYTES = 5 * 1024 * 1024 * 1024; // 5GB

export function formatFileSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export const FILE_SHARE_NOTICE_GUEST =
  '파일 공유는 용량에 따라 10MB 이하는 30일, 10MB~1GB는 7일, 1GB 초과는 2일간 보관 후 자동 삭제됩니다.';

export const FILE_SHARE_NOTICE_MEMBER =
  '파일 공유는 10MB 이하 30일, 10MB~1GB 7일, 1GB 초과 2일간 보관 후 자동 삭제됩니다. (단축 주소는 영구 유지되며 만료 시 수정에서 새 파일을 등록할 수 있습니다.)';

/**
 * 용량별 스토리지 및 수명 주기(자동 삭제) 상세 안내 반환
 * - 0 ~ 10MB: 30일 보관 (small/)
 * - 10MB 초과 ~ 1GB: 7일 보관 (normal/)
 * - 1GB 초과 ~ 5GB: 2일 보관 (large/)
 */
export function getFileCapacityRetentionInfo(bytes, isMember = false) {
  const n = Number(bytes) || 0;
  if (n > R2_LARGE_FOLDER_THRESHOLD_BYTES) {
    return {
      tier: 'large',
      badge: '🔥 초대용량 (1GB 초과 ~ 5GB)',
      color: '#ef4444',
      bgColor: 'rgba(239, 68, 68, 0.1)',
      borderColor: 'rgba(239, 68, 68, 0.3)',
      storage: 'Cloudflare R2 (large/)',
      notice: '1GB 초과 초대용량 파일은 2일간 보관 후 자동 삭제됩니다.',
      retentionDays: 2,
    };
  }
  if (n > R2_SMALL_FOLDER_THRESHOLD_BYTES) {
    return {
      tier: 'normal',
      badge: '⚡ 대용량 (10MB 초과 ~ 1GB)',
      color: '#10b981',
      bgColor: 'rgba(16, 185, 129, 0.1)',
      borderColor: 'rgba(16, 185, 129, 0.3)',
      storage: 'Cloudflare R2 (normal/)',
      notice: '10MB 초과 ~ 1GB 대용량 파일은 7일간 보관 후 자동 삭제됩니다.',
      retentionDays: 7,
    };
  }
  return {
    tier: 'small',
    badge: '📄 일반 파일 (10MB 이하)',
    color: '#2563eb',
    bgColor: 'rgba(37, 99, 235, 0.08)',
    borderColor: 'rgba(37, 99, 235, 0.25)',
    storage: 'Cloudflare R2 (small/)',
    notice: '10MB 이하 일반 파일은 30일간 보관 후 자동 삭제됩니다.',
    retentionDays: 30,
  };
}
