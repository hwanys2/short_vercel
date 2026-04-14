import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-this';
const COOKIE_NAME = 'short_auth_token';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7일

// PHP $2y$ 해시를 Node.js $2a$로 변환하여 검증
export async function verifyPassword(plainPassword, phpHash) {
  // PHP password_hash()는 $2y$ prefix를 사용하지만
  // bcryptjs는 $2a$ prefix를 사용합니다. 둘은 호환됩니다.
  const nodeHash = phpHash.replace(/^\$2y\$/, '$2a$');
  return await bcrypt.compare(plainPassword, nodeHash);
}

// 새 비밀번호 해시 생성
export async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}

// JWT 토큰 생성
export function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// JWT 토큰 검증
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// 쿠키에 토큰 설정
export async function setAuthCookie(token) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
}

// 쿠키에서 토큰 삭제
export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
}

// 현재 로그인한 사용자 가져오기
export async function getCurrentUser() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;

    const decoded = verifyToken(token);
    if (!decoded) return null;

    return {
      id: decoded.id,
      username: decoded.username,
      email: decoded.email,
    };
  } catch {
    return null;
  }
}

// 요청에서 사용자 정보 추출 (API Route용)
export function getUserFromRequest(request) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}
