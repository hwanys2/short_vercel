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
  '링크가 만료되면 업로드된 파일도 함께 삭제됩니다. (개인정보 보호)';

export const FILE_SHARE_NOTICE_MEMBER =
  '파일 공유 링크는 최근 3개월간 접속이 없으면 링크와 파일이 자동 삭제됩니다. (개인정보 보호·용량 관리)';

/**
 * 용량별 스토리지 및 수명 주기(자동 삭제) 상세 안내 반환
 */
export function getFileCapacityRetentionInfo(bytes, isMember = false) {
  const n = Number(bytes) || 0;
  if (n >= R2_LARGE_FOLDER_THRESHOLD_BYTES) {
    return {
      tier: 'large',
      badge: '🔥 초대용량 (1GB ~ 5GB)',
      color: '#ef4444',
      bgColor: 'rgba(239, 68, 68, 0.1)',
      borderColor: 'rgba(239, 68, 68, 0.3)',
      storage: 'Cloudflare R2 (large/)',
      notice: '1GB 이상 초대용량 파일은 서버 자원 관리를 위해 단기 보관(1~3일) 후 빠르게 자동 삭제됩니다.',
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
      notice: isMember
        ? '3MB 이상 대용량 파일은 Cloudflare R2에 안전하게 보관되며, 수명 주기 규칙 및 3개월 미접속 시 자동 삭제됩니다.'
        : '3MB 이상 대용량 파일은 Cloudflare R2에 안전하게 보관되며, 링크 만료 시 또는 수명 주기 규칙에 따라 자동 삭제됩니다.',
    };
  }
  return {
    tier: 'small',
    badge: '📄 일반 파일 (3MB 미만)',
    color: '#64748b',
    bgColor: 'rgba(100, 116, 139, 0.1)',
    borderColor: 'rgba(100, 116, 139, 0.3)',
    storage: 'Supabase Storage',
    notice: isMember ? FILE_SHARE_NOTICE_MEMBER : FILE_SHARE_NOTICE_GUEST,
  };
}
