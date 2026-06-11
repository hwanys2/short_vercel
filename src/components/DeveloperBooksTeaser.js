'use client';

import { useCallback, useEffect, useState } from 'react';
import { DEVELOPER_BOOKS } from '@/data/developerBooks';

const ROTATE_MS = 10_000;

const LEAD_INLINE =
  '숏한국 개발 교사의 책입니다. 책 구입은 서버 운영에 큰 힘이 됩니다.';
const LEAD_RAIL =
  '숏.한국을 만든 개발 교사가 집필한 책이에요. 편하실 때 한번 둘러봐 주세요.';

export default function DeveloperBooksTeaser({ layout = 'inline' }) {
  const isRail = layout === 'rail';
  const [index, setIndex] = useState(() => Math.floor(Math.random() * DEVELOPER_BOOKS.length));
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (reduceMotion || isRail) return undefined;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % DEVELOPER_BOOKS.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [reduceMotion, isRail]);

  const book = DEVELOPER_BOOKS[index];

  const advance = useCallback(() => {
    setIndex((i) => (i + 1) % DEVELOPER_BOOKS.length);
  }, []);

  const teaserClass = isRail
    ? 'developer-books-teaser developer-books-teaser--rail'
    : 'developer-books-teaser';

  return (
    <aside className={teaserClass} aria-label="개발자 소개 및 도서">
      <p className="developer-books-teaser-lead">{isRail ? LEAD_RAIL : LEAD_INLINE}</p>
      <div className="developer-books-teaser-card">
        <div
          key={book.id}
          className={
            reduceMotion
              ? 'developer-books-teaser-inner'
              : 'developer-books-teaser-inner developer-books-teaser-inner--animate'
          }
          aria-live="polite"
        >
          <a
            href={book.purchaseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="developer-books-teaser-cover-link"
          >
            <img
              src={book.coverImageUrl}
              alt={`${book.title} 표지`}
              className="developer-books-teaser-cover"
              loading="lazy"
              decoding="async"
            />
          </a>
          <div className="developer-books-teaser-meta">
            <p className="developer-books-teaser-label">추천 도서</p>
            <p className="developer-books-teaser-title">{book.title}</p>
            <div className="developer-books-teaser-actions">
              <a
                href={book.purchaseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm developer-books-teaser-cta"
              >
                YES24에서 보기
              </a>
              {!reduceMotion && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={advance}>
                  다음 책
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
