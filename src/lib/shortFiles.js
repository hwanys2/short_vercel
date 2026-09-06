import { randomUUID } from 'crypto';
import { getSupabaseAdmin } from './supabase.js';
import { isR2Key, deleteR2Object, deleteR2Objects } from './r2.js';
import {
  FILE_SHARE_NOTICE_GUEST,
  FILE_SHARE_NOTICE_MEMBER,
  formatFileSize,
  MAX_FILE_BYTES,
  SHORT_FILES_BUCKET_DEFAULT,
} from './shortFilesShared.js';

export {
  FILE_SHARE_NOTICE_GUEST,
  FILE_SHARE_NOTICE_MEMBER,
  formatFileSize,
  MAX_FILE_BYTES,
};

export const SHORT_FILES_BUCKET =
  (typeof process !== 'undefined' && process.env.SHORT_FILES_BUCKET?.trim()) ||
  SHORT_FILES_BUCKET_DEFAULT;

/**
 * 보안상 직접 업로드가 차단되는 확장자 (실행 파일, 스크립트 등)
 * 악성코드/스미싱 유포 및 도메인 차단 방지를 위해 직접 실행 파일은 차단하고, ZIP 압축 파일로 공유하도록 유도
 */
export const BLOCKED_EXTENSIONS = new Set([
  // 윈도우 실행/설치 파일
  'exe', 'bat', 'cmd', 'com', 'msi', 'scr', 'dll', 'sys', 'hta', 'reg', 'cpl',
  // 모바일/macOS 설치 패키지
  'apk', 'dmg', 'pkg', 'iso', 'img',
  // 스크립트 및 런타임
  'sh', 'bash', 'ps1', 'vbs', 'jar',
  // 서버/웹 스크립트 및 XSS 위험
  'js', 'mjs', 'cjs', 'php', 'phtml', 'asp', 'aspx', 'jsp', 'cgi', 'svg',
]);

/**
 * 주요 확장자별 표준 MIME 타입 매핑 (동영상, 오디오, 문서, 이미지, 압축 등)
 */
export const EXT_MIME_FALLBACK = {
  // 동영상 (Video)
  mov: 'video/quicktime',
  mp4: 'video/mp4',
  m4v: 'video/x-m4v',
  avi: 'video/x-msvideo',
  mkv: 'video/x-matroska',
  webm: 'video/webm',
  wmv: 'video/x-ms-wmv',
  flv: 'video/x-flv',
  '3gp': 'video/3gpp',
  ts: 'video/mp2t',

  // 오디오 (Audio)
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  flac: 'audio/flac',
  ogg: 'audio/ogg',
  wma: 'audio/x-ms-wma',
  mid: 'audio/midi',
  midi: 'audio/midi',

  // 이미지 (Images)
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  tiff: 'image/tiff',
  tif: 'image/tiff',
  heic: 'image/heic',
  heif: 'image/heif',
  ico: 'image/x-icon',

  // 문서 및 텍스트 (Documents & Text)
  pdf: 'application/pdf',
  txt: 'text/plain',
  html: 'text/html',
  htm: 'text/html',
  md: 'text/markdown',
  markdown: 'text/markdown',
  csv: 'text/csv',
  rtf: 'application/rtf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  hwp: 'application/x-hwp',
  hwpx: 'application/haansofthwpx',
  epub: 'application/epub+zip',

  // 압축 및 아카이브 (Archives)
  zip: 'application/zip',
  '7z': 'application/x-7z-compressed',
  tar: 'application/x-tar',
  gz: 'application/gzip',
  rar: 'application/vnd.rar',
  xz: 'application/x-xz',
  bz2: 'application/x-bzip2',

  // 디자인 / 데이터 (Design & Data)
  psd: 'image/vnd.adobe.photoshop',
  ai: 'application/postscript',
  json: 'application/json',
  xml: 'application/xml',
  yaml: 'text/yaml',
  yml: 'text/yaml',
  sql: 'text/plain',
  log: 'text/plain',
};

export const BLOCKED_FILE_MESSAGE =
  '보안상 직접 실행 파일(.exe, .apk, .dmg 등) 및 스크립트는 업로드할 수 없습니다. 프로그램 공유는 ZIP 압축 파일로 묶어서 업로드해주세요.';

export function getFileExtension(filename) {
  const base = String(filename || '').normalize('NFC').split(/[/\\]/).pop() || '';
  const parts = base.split('.');
  if (parts.length < 2) return '';
  return parts.pop().toLowerCase();
}

export function normalizeDisplayFileName(filename) {
  const raw = String(filename || 'file').normalize('NFC').split(/[/\\]/).pop() || 'file';
  const cleaned = raw.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 255);
  return cleaned || 'file';
}

/**
 * Resolve MIME: 위험 확장자(직접 실행파일, 웹셸 스크립트 등)만 차단하고,
 * 그 외의 모든 파일(동영상, 오디오, 문서, 이미지, 디자인 등)은 유연하게 허용합니다.
 */
export function resolveAllowedMime(file) {
  const name = file?.name || '';
  const ext = getFileExtension(name);
  const declared = (file?.type || '').toLowerCase().trim();

  if (!ext) {
    return { ok: false, message: '확장자가 없는 파일은 업로드할 수 없습니다.' };
  }

  if (BLOCKED_EXTENSIONS.has(ext)) {
    return {
      ok: false,
      message: BLOCKED_FILE_MESSAGE,
    };
  }

  // 위험 MIME 타입 차단 (확장자를 속여 업로드하려는 시도 방지)
  if (
    declared.includes('svg') ||
    declared.includes('javascript') ||
    declared.includes('x-sh') ||
    declared.includes('x-msdownload')
  ) {
    return {
      ok: false,
      message: BLOCKED_FILE_MESSAGE,
    };
  }

  // 브라우저에서 보낸 MIME이 있고 올바른 형식이면 우선 적용
  if (declared && declared !== 'application/octet-stream' && declared.includes('/')) {
    const cleanMime = declared === 'image/jpg' ? 'image/jpeg' : declared;
    return { ok: true, mime: cleanMime };
  }

  // 매핑 테이블 조회 또는 기본 octet-stream 부여 (모든 일반 파일 통과)
  const mime = EXT_MIME_FALLBACK[ext] || 'application/octet-stream';
  return { ok: true, mime };
}

export function validateUploadFile(file) {
  if (!file || typeof file !== 'object' || typeof file.size !== 'number') {
    return { ok: false, message: '파일을 선택해주세요.' };
  }
  if (file.size <= 0) {
    return { ok: false, message: '빈 파일은 업로드할 수 없습니다.' };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, message: `파일 크기는 최대 ${formatFileSize(MAX_FILE_BYTES)}까지 가능합니다.` };
  }
  const mimeResult = resolveAllowedMime(file);
  if (!mimeResult.ok) return mimeResult;
  return {
    ok: true,
    mime: mimeResult.mime,
    fileName: normalizeDisplayFileName(file.name),
    fileSize: file.size,
  };
}

export function buildStoragePath({ userId, fileName }) {
  const extension = getFileExtension(fileName);
  const id = randomUUID();
  const objectName = `${id}.${extension}`;
  if (userId) {
    return `user/${userId}/${id}/${objectName}`;
  }
  return `guest/${id}/${objectName}`;
}

export async function uploadShortFile({ file, path, mime }) {
  const supabase = getSupabaseAdmin();
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await supabase.storage.from(SHORT_FILES_BUCKET).upload(path, buffer, {
    contentType: mime,
    upsert: false,
  });
  if (error) {
    console.error('Storage upload error:', error);
    const storageError = new Error('파일 저장소 업로드에 실패했습니다. 잠시 후 다시 시도해주세요.');
    storageError.name = 'ShortFileStorageError';
    throw storageError;
  }
  return path;
}

export async function deleteShortFile(filePath) {
  if (!filePath) return;
  if (isR2Key(filePath)) {
    await deleteR2Object(filePath);
    return;
  }
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(SHORT_FILES_BUCKET).remove([filePath]);
  if (error) {
    console.error('Storage delete error:', error, filePath);
  }
}

export async function deleteShortFiles(filePaths) {
  const paths = (filePaths || []).filter(Boolean);
  if (paths.length === 0) return;

  const r2Paths = paths.filter((p) => isR2Key(p));
  const supabasePaths = paths.filter((p) => !isR2Key(p));

  if (r2Paths.length > 0) {
    await deleteR2Objects(r2Paths);
  }

  if (supabasePaths.length > 0) {
    const supabase = getSupabaseAdmin();
    // Supabase remove accepts batches; chunk to be safe
    const chunkSize = 100;
    for (let i = 0; i < supabasePaths.length; i += chunkSize) {
      const chunk = supabasePaths.slice(i, i + chunkSize);
      const { error } = await supabase.storage.from(SHORT_FILES_BUCKET).remove(chunk);
      if (error) {
        console.error('Storage batch delete error:', error);
      }
    }
  }
}

/**
 * Delete a short_urls row and its storage object when type=file.
 */
export async function deleteShortUrlWithFile(rowOrId) {
  const supabase = getSupabaseAdmin();
  let row = rowOrId;
  if (typeof rowOrId === 'number' || typeof rowOrId === 'bigint' || typeof rowOrId === 'string') {
    const { data } = await supabase
      .from('short_urls')
      .select('id, type, file_path')
      .eq('id', rowOrId)
      .maybeSingle();
    row = data;
  }
  if (!row?.id) return;

  if ((row.type || '') === 'file' && row.file_path) {
    await deleteShortFile(row.file_path);
  }

  const { error } = await supabase.from('short_urls').delete().eq('id', row.id);
  if (error) {
    console.error('Delete short_url error:', error);
    throw error;
  }
}

export async function createSignedDownloadUrl(filePath, expiresIn = 60, downloadFileName) {
  const supabase = getSupabaseAdmin();
  const download =
    typeof downloadFileName === 'string' && downloadFileName.trim()
      ? downloadFileName.trim()
      : true;
  const { data, error } = await supabase.storage
    .from(SHORT_FILES_BUCKET)
    .createSignedUrl(filePath, expiresIn, { download });
  if (error || !data?.signedUrl) {
    console.error('Signed URL error:', error);
    throw new Error('다운로드 링크를 만들 수 없습니다.');
  }
  return data.signedUrl;
}
