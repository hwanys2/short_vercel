export const SHORT_FILES_BUCKET_DEFAULT = 'short_files';

export const SUPABASE_STORAGE_MAX_BYTES = 3 * 1024 * 1024; // 3MB
export const R2_STORAGE_THRESHOLD_BYTES = 3 * 1024 * 1024; // 3MB
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
  '파일 공유는 용량에 따라 1GB 이하는 7일, 1GB 초과는 2일간 보관 후 자동 삭제됩니다.';

export const FILE_SHARE_NOTICE_MEMBER =
  '파일 공유는 용량에 따라 1GB 이하는 7일, 1GB 초과는 2일간 보관 후 자동 삭제됩니다. (URL·텍스트는 회원 영구 유지)';

/**
 * 용량별 스토리지 및 수명 주기(자동 삭제) 상세 안내 반환
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
  if (n >= R2_STORAGE_THRESHOLD_BYTES) {
    return {
      tier: 'normal',
      badge: '⚡ 대용량 (3MB ~ 1GB)',
      color: '#10b981',
      bgColor: 'rgba(16, 185, 129, 0.1)',
      borderColor: 'rgba(16, 185, 129, 0.3)',
      storage: 'Cloudflare R2 (normal/)',
      notice: '1GB 이하 대용량 파일은 7일간 보관 후 자동 삭제됩니다.',
      retentionDays: 7,
    };
  }
  return {
    tier: 'small',
    badge: '📄 일반 파일 (3MB 미만)',
    color: '#64748b',
    bgColor: 'rgba(100, 116, 139, 0.1)',
    borderColor: 'rgba(100, 116, 139, 0.3)',
    storage: 'Supabase Storage',
    notice: '3MB 미만 일반 파일은 7일간 보관 후 자동 삭제됩니다.',
    retentionDays: 7,
  };
}
