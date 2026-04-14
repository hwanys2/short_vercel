'use client';

import { useCallback, useEffect, useState } from 'react';
import { DEVELOPER_BOOKS } from '@/data/developerBooks';

const ROTATE_MS = 10_000;

export default function DeveloperBooksTeaser() {
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
    if (reduceMotion) return undefined;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % DEVELOPER_BOOKS.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [reduceMotion]);

  const book = DEVELOPER_BOOKS[index];

  const advance = useCallback(() => {
    setIndex((i) => (i + 1) % DEVELOPER_BOOKS.length);
  }, []);

  return (
    <aside className="developer-books-teaser" aria-label="개발자 소개 및 도서">
      <p className="developer-books-teaser-lead">
        숏.한국은 현직 교사가 수업·업무에 쓰려고 직접 만들어 무료로 돌리고 있어요. 서버와 유지에 부담이 될 때도 있는데, 같은 저자의 책을
        필요하실 때 사 주시면 그만큼 여유 있게 이어 가는 데 도움이 됩니다. 부담 없이 둘러만 보셔도 괜찮아요.
      </p>
      <div className="developer-books-teaser-card">
        <div
          key={book.id}
          className={reduceMotion ? 'developer-books-teaser-inner' : 'developer-books-teaser-inner developer-books-teaser-inner--animate'}
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
            <p className="developer-books-teaser-label">이번에 보여 드리는 책</p>
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
