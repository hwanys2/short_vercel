import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  PutBucketCorsCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  R2_SMALL_FOLDER_THRESHOLD_BYTES,
  R2_LARGE_FOLDER_THRESHOLD_BYTES,
} from './shortFilesShared.js';

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
    // R2 Presigned URL에 비어있는 바디 체크섬(AAAAAA==) 강제 삽입 방지
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });

  return cachedS3Client;
}

/**
 * R2 경로 또는 키인지 판별
 */
export function isR2Key(keyOrPath) {
  if (!keyOrPath || typeof keyOrPath !== 'string') return false;
  return (
    keyOrPath.startsWith('small/') ||
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
  if (
    keyOrUrl.startsWith('small/') ||
    keyOrUrl.startsWith('normal/') ||
    keyOrUrl.startsWith('large/')
  ) {
    return keyOrUrl;
  }
  try {
    const url = new URL(keyOrUrl);
    const pathname = url.pathname.replace(/^\/+/, '');
    if (
      pathname.startsWith('small/') ||
      pathname.startsWith('normal/') ||
      pathname.startsWith('large/')
    ) {
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
 * 안전한 R2 오브젝트 키 생성 (Prefix 분기: <=10MB -> small/, 10MB~1GB -> normal/, 1GB~ -> large/)
 */
export function generateR2Key({ fileName, fileSize }) {
  const n = Number(fileSize) || 0;
  let prefix = 'small/';
  if (n > R2_LARGE_FOLDER_THRESHOLD_BYTES) {
    prefix = 'large/';
  } else if (n > R2_SMALL_FOLDER_THRESHOLD_BYTES) {
    prefix = 'normal/';
  }

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

  // Note: ContentType을 PutObjectCommand에 명시하지 않으면 AWS SDK가 X-Amz-SignedHeaders에
  // content-type을 강제하지 않아 브라우저-서버 간 MIME 사소한 불일치로 인한 403 SignatureDoesNotMatch 오류를 방지합니다.
  // 브라우저가 PUT 요청 시 전송하는 Content-Type으로 R2에 정상 기록됩니다.
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
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
 * R2 버킷에 CORS 정책 자동 적용 시도 (API 토큰에 Admin 권한이 있는 경우 자동 설정)
 */
export async function configureR2BucketCors() {
  try {
    const s3 = getR2Client();
    const bucket = getR2BucketName();
    await s3.send(
      new PutBucketCorsCommand({
        Bucket: bucket,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedOrigins: ['*'],
              AllowedMethods: ['GET', 'PUT', 'HEAD'],
              AllowedHeaders: ['*'],
              ExposeHeaders: ['ETag'],
              MaxAgeSeconds: 3600,
            },
          ],
        },
      })
    );
    return { ok: true };
  } catch (error) {
    // API 토큰이 Object Read/Write 전용인 경우 권한 부족 오류(403) 발생 가능 -> 대시보드 수동 설정 안내로 보완
    return { ok: false, error: error.message };
  }
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
