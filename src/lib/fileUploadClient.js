import { R2_STORAGE_THRESHOLD_BYTES, formatFileSize } from './shortFilesShared.js';

/**
 * XHR 기반 R2 직접 PUT 업로드 및 실시간 진행률 콜백
 */
export function uploadToR2WithProgress(presignedUrl, file, onProgress, mimeType, signal) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let isAborted = false;

    const handleAbort = () => {
      isAborted = true;
      try {
        xhr.abort();
      } catch {}
      const err = new Error('업로드가 취소되었습니다.');
      err.name = 'AbortError';
      reject(err);
    };

    if (signal) {
      if (signal.aborted) {
        return handleAbort();
      }
      signal.addEventListener('abort', handleAbort, { once: true });
    }

    const cleanupSignal = () => {
      if (signal) {
        signal.removeEventListener('abort', handleAbort);
      }
    };

    xhr.open('PUT', presignedUrl, true);
    const ct = mimeType || file.type || 'application/octet-stream';
    xhr.setRequestHeader('Content-Type', ct);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress({
          percent,
          loaded: event.loaded,
          total: event.total,
        });
      }
    };

    xhr.onload = () => {
      cleanupSignal();
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`R2 스토리지 업로드 실패 (HTTP ${xhr.status})`));
      }
    };

    xhr.onerror = () => {
      cleanupSignal();
      if (isAborted) return;
      reject(new Error('네트워크 또는 CORS 오류로 Cloudflare R2 업로드에 실패했습니다. Cloudflare R2 버킷의 CORS 설정(PUT 메서드 및 도메인 허용)을 확인해주세요.'));
    };

    xhr.ontimeout = () => {
      cleanupSignal();
      if (isAborted) return;
      reject(new Error('R2 업로드 요청 시간이 초과되었습니다.'));
    };

    xhr.onabort = () => {
      cleanupSignal();
      if (!isAborted) {
        const err = new Error('업로드가 취소되었습니다.');
        err.name = 'AbortError';
        reject(err);
      }
    };

    xhr.send(file);
  });
}

/**
 * 파일 객체를 Cloudflare R2에 직접 업로드하고 스토리지 키 및 메타데이터 반환 (생성 및 수정 공용)
 */
export async function uploadFileToR2Only({
  file,
  customCode = '',
  onProgress,
  signal,
  isEdit = false,
}) {
  // 1. Presigned URL 발급
  if (onProgress) {
    onProgress({
      percent: 0,
      statusText: '업로드 준비 중...',
      detailText: 'Cloudflare R2 서명 URL 발급 중',
    });
  }

  const presignRes = await fetch('/api/upload/r2-presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type || 'application/octet-stream',
      customCode: customCode.trim(),
      isEdit: Boolean(isEdit),
    }),
    signal,
  });

  const presignData = await presignRes.json();
  if (presignData.status !== 'success') {
    throw new Error(presignData.message || 'Presigned URL 발급에 실패했습니다.');
  }

  const { presignedUrl, key, publicUrl, fileMime } = presignData.data;

  // 2. R2로 직접 PUT 업로드 (브라우저 -> Cloudflare R2)
  if (onProgress) {
    onProgress({
      percent: 0,
      statusText: 'R2로 초고속 직접 업로드 중...',
      detailText: `0% (0 B / ${formatFileSize(file.size)})`,
    });
  }

  await uploadToR2WithProgress(
    presignedUrl,
    file,
    ({ percent, loaded, total }) => {
      if (onProgress) {
        onProgress({
          percent,
          statusText: 'R2로 초고속 직접 업로드 중...',
          detailText: `${percent}% (${formatFileSize(loaded)} / ${formatFileSize(total)})`,
        });
      }
    },
    fileMime,
    signal
  );

  return {
    key,
    publicUrl,
    fileName: file.name,
    fileSize: file.size,
    fileMime,
  };
}

/**
 * 모든 파일을 Cloudflare R2로 초고속 직접 업로드 후 단축 주소 등록
 */
export async function uploadShortFileAuto({
  file,
  customCode,
  expireDuration = '1month',
  linkPasswordEnabled = false,
  linkPassword = '',
  onProgress,
  signal,
}) {
  const uploaded = await uploadFileToR2Only({
    file,
    customCode,
    onProgress,
    signal,
    isEdit: false,
  });

  // 3. 완료 및 DB 등록
  if (onProgress) {
    onProgress({
      percent: 100,
      statusText: '단축 주소 생성 중...',
      detailText: '데이터베이스에 링크 등록 중',
    });
  }

  const completeRes = await fetch('/api/shorten-file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      key: uploaded.key,
      publicUrl: uploaded.publicUrl,
      fileName: uploaded.fileName,
      fileSize: uploaded.fileSize,
      fileMime: uploaded.fileMime,
      customCode: customCode.trim(),
      expireDuration,
      linkPasswordEnabled,
      linkPassword: linkPasswordEnabled ? linkPassword.trim() : '',
    }),
    signal,
  });

  const completeData = await completeRes.json();
  if (completeData.status !== 'success') {
    throw new Error(completeData.message || '단축 주소 등록에 실패했습니다.');
  }

  return completeData;
}
