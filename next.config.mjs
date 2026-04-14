/** @type {import('next').NextConfig} */
const nextConfig = {
  // 한글 URL 인코딩 지원
  experimental: {},
  
  // 이미지 도메인 설정
  images: {
    domains: [],
  },
  
  // 환경 변수
  env: {
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || 'https://숏.한국/',
  },
};

export default nextConfig;
