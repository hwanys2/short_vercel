'use client';

import { useEffect, useRef } from 'react';

const AD_CLIENT = 'ca-pub-8902099051011521';
const AD_SLOT = '5801358149';

export default function AdSenseSlot() {
  const pushed = useRef(false);

  useEffect(() => {
    if (pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // 광고 차단·네트워크 등
    }
  }, []);

  return (
    <div className="ad-sense-region" aria-label="보조 콘텐츠">
      <div className="ad-sense-inner">
        <ins
          className="adsbygoogle"
          style={{ display: 'block' }}
          data-ad-client={AD_CLIENT}
          data-ad-slot={AD_SLOT}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    </div>
  );
}
