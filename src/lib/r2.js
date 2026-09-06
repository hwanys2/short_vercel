import { S3Client, PutObjectCommand, DeleteObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { R2_LARGE_FOLDER_THRESHOLD_BYTES } from './shortFilesShared.js';

let cachedS3Client = null;

export function getR2BucketName() {
  return process.env.R2_BUCKET_NAME?.trim() || 'short-kr-files';
}

export function isR2Configured() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY
  );
}

export function getR2Client() {
  if (cachedS3Client) return cachedS3Client;

  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('Cloudflare R2 환경 변수가 설정되지 않았습니다. (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)');
  }

  cachedS3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return cachedS3Client;
}

/**
 * R2 경로 또는 키인지 판별
 */
export function isR2Key(keyOrPath) {
  if (!keyOrPath || typeof keyOrPath !== 'string') return false;
  return (
    keyOrPath.startsWith('normal/') ||
    keyOrPath.startsWith('large/') ||
    keyOrPath.includes('.r2.dev/') ||
    keyOrPath.includes('.r2.cloudflarestorage.com/')
  );
}

/**
 * URL 형태에서 R2 객체 키만 추출
 */
export function extractR2Key(keyOrUrl) {
  if (!keyOrUrl || typeof keyOrUrl !== 'string') return '';
  if (keyOrUrl.startsWith('normal/') || keyOrUrl.startsWith('large/')) {
    return keyOrUrl;
  }
  try {
    const url = new URL(keyOrUrl);
    const pathname = url.pathname.replace(/^\/+/, '');
    if (pathname.startsWith('normal/') || pathname.startsWith('large/')) {
      return pathname;
    }
  } catch {}
  return keyOrUrl;
}

/**
 * R2 공개 다운로드 URL 반환
 */
export function getR2PublicUrl(key) {
  if (!key) return '';
  if (key.startsWith('http://') || key.startsWith('https://')) {
    return key;
  }
  const publicBase = (process.env.R2_PUBLIC_URL || '').trim().replace(/\/+$/, '');
  if (!publicBase) {
    return `https://${getR2BucketName()}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;
  }
  return `${publicBase}/${key}`;
}

/**
 * 안전한 R2 오브젝트 키 생성 (Prefix 분기: 3MB~1GB -> normal/, 1GB~ -> large/)
 */
export function generateR2Key({ fileName, fileSize }) {
  const prefix = Number(fileSize) >= R2_LARGE_FOLDER_THRESHOLD_BYTES ? 'large/' : 'normal/';
  const cleanName = String(fileName || 'file')
    .normalize('NFC')
    .split(/[/\\]/)
    .pop()
    .replace(/[^a-zA-Z0-9가-힣._-]/g, '_')
    .slice(0, 150);

  const timestamp = Date.now();
  return `${prefix}${timestamp}_${cleanName || 'file'}`;
}

/**
 * R2 직접 업로드를 위한 Presigned PUT URL 발급
 */
export async function createR2PresignedUploadUrl({ fileName, fileSize, mimeType, expiresIn = 3600 }) {
  const s3 = getR2Client();
  const bucket = getR2BucketName();
  const key = generateR2Key({ fileName, fileSize });

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: mimeType || 'application/octet-stream',
  });

  const presignedUrl = await getSignedUrl(s3, command, { expiresIn });
  const publicUrl = getR2PublicUrl(key);

  return {
    presignedUrl,
    key,
    publicUrl,
  };
}

/**
 * 단일 R2 객체 삭제
 */
export async function deleteR2Object(keyOrUrl) {
  const key = extractR2Key(keyOrUrl);
  if (!key || !isR2Key(key)) return;

  try {
    const s3 = getR2Client();
    const bucket = getR2BucketName();
    await s3.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );
  } catch (error) {
    console.error('R2 object delete error:', error, key);
  }
}

/**
 * 다중 R2 객체 배치 삭제
 */
export async function deleteR2Objects(keysOrUrls) {
  const keys = (keysOrUrls || [])
    .map(extractR2Key)
    .filter((k) => k && isR2Key(k));

  if (keys.length === 0) return;

  try {
    const s3 = getR2Client();
    const bucket = getR2BucketName();
    const chunkSize = 500;

    for (let i = 0; i < keys.length; i += chunkSize) {
      const chunk = keys.slice(i, i + chunkSize);
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: {
            Objects: chunk.map((Key) => ({ Key })),
            Quiet: true,
          },
        })
      );
    }
  } catch (error) {
    console.error('R2 batch delete error:', error);
  }
}
