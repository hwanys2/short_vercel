import { randomUUID } from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  FILE_SHARE_NOTICE_GUEST,
  FILE_SHARE_NOTICE_MEMBER,
  formatFileSize,
  MAX_FILE_BYTES,
  SHORT_FILES_BUCKET_DEFAULT,
} from '@/lib/shortFilesShared';

export {
  FILE_SHARE_NOTICE_GUEST,
  FILE_SHARE_NOTICE_MEMBER,
  formatFileSize,
  MAX_FILE_BYTES,
};

export const SHORT_FILES_BUCKET =
  (typeof process !== 'undefined' && process.env.SHORT_FILES_BUCKET?.trim()) ||
  SHORT_FILES_BUCKET_DEFAULT;

/** MIME types we accept for light document / image sharing */
export const ALLOWED_FILE_MIMES = new Set([
  'application/pdf',
  'text/plain',
  'text/html',
  'text/markdown',
  'text/csv',
  'application/rtf',
  'text/rtf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/haansofthwp',
  'application/x-hwp',
  'application/haansofthwpx',
  'application/vnd.hancom.hwp',
  'application/vnd.hancom.hwpx',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
]);

const EXT_MIME_FALLBACK = {
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
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

const ALLOWED_EXTENSIONS = new Set(Object.keys(EXT_MIME_FALLBACK));

const BLOCKED_EXTENSIONS = new Set([
  'exe',
  'bat',
  'cmd',
  'com',
  'msi',
  'scr',
  'dll',
  'sh',
  'ps1',
  'jar',
  'apk',
  'dmg',
  'iso',
  'js',
  'mjs',
  'cjs',
  'svg',
  'php',
]);

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
 * Resolve MIME: prefer browser type when allowed; else extension fallback.
 * Rejects unknown / blocked types. `application/octet-stream` only for hwp/hwpx.
 */
export function resolveAllowedMime(file) {
  const name = file?.name || '';
  const ext = getFileExtension(name);
  const declared = (file?.type || '').toLowerCase().trim();

  if (BLOCKED_EXTENSIONS.has(ext)) {
    return { ok: false, message: '보안상 허용되지 않는 파일 형식입니다.' };
  }
  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
    return {
      ok: false,
      message:
        '허용되지 않는 파일 형식입니다. 문서(PDF, Office, HWP, TXT 등) 또는 이미지만 업로드할 수 있습니다.',
    };
  }

  const byExt = EXT_MIME_FALLBACK[ext];
  if (declared && ALLOWED_FILE_MIMES.has(declared)) {
    // octet-stream only accepted for Korean office docs
    if (declared === 'application/octet-stream' && ext !== 'hwp' && ext !== 'hwpx') {
      return { ok: false, message: '허용되지 않는 파일 형식입니다.' };
    }
    return { ok: true, mime: declared === 'image/jpg' ? 'image/jpeg' : declared };
  }

  if (declared === 'application/octet-stream' && (ext === 'hwp' || ext === 'hwpx')) {
    return { ok: true, mime: byExt };
  }

  if (!declared || declared === 'application/octet-stream') {
    return { ok: true, mime: byExt };
  }

  // Declared MIME not in allow-list
  return {
    ok: false,
    message:
      '허용되지 않는 파일 형식입니다. 문서(PDF, Office, HWP, TXT 등) 또는 이미지만 업로드할 수 있습니다.',
  };
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
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(SHORT_FILES_BUCKET).remove([filePath]);
  if (error) {
    console.error('Storage delete error:', error, filePath);
  }
}

export async function deleteShortFiles(filePaths) {
  const paths = (filePaths || []).filter(Boolean);
  if (paths.length === 0) return;
  const supabase = getSupabaseAdmin();
  // Supabase remove accepts batches; chunk to be safe
  const chunkSize = 100;
  for (let i = 0; i < paths.length; i += chunkSize) {
    const chunk = paths.slice(i, i + chunkSize);
    const { error } = await supabase.storage.from(SHORT_FILES_BUCKET).remove(chunk);
    if (error) {
      console.error('Storage batch delete error:', error);
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
