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
