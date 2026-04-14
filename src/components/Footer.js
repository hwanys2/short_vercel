import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <nav className="footer-nav" aria-label="서비스 안내">
            <div className="footer-nav-columns">
              <div className="footer-nav-col">
                <Link href="/faq" className="footer-link">
                  자주 묻는 질문
                </Link>
                <Link href="/guide" className="footer-link">
                  사용 가이드
                </Link>
                <Link href="/api-docs" className="footer-link">
                  API 문서
                </Link>
              </div>
              <div className="footer-nav-col">
                <Link href="/terms" className="footer-link">
                  이용약관
                </Link>
                <Link href="/privacy" className="footer-link">
                  개인정보처리방침
                </Link>
              </div>
            </div>
          </nav>

          <div className="footer-aside">
            <section className="footer-aside-block" aria-labelledby="footer-contact-heading">
              <h2 id="footer-contact-heading" className="footer-aside-title">
                Contact
              </h2>
              <ul className="footer-aside-list">
                <li>
                  <span className="footer-aside-muted">개발교사 : </span>
                  <a
                    href="https://proximal-stranger-fa0.notion.site/1cb53a4832438028be97d7cb1b2ddb5f?pvs=4"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="footer-link"
                  >
                    박진환
                  </a>
                </li>
                <li>
                  <span className="footer-aside-muted">Email : </span>
                  <a href="mailto:hwanys2@naver.com" className="footer-link">
                    hwanys2@naver.com
                  </a>
                </li>
                <li>
                  <span className="footer-aside-muted">인스타 : </span>
                  <a
                    href="https://www.instagram.com/foreducator/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="footer-link"
                  >
                    @foreducator
                  </a>
                </li>
              </ul>
            </section>

            <section className="footer-aside-block" aria-labelledby="footer-sites-heading">
              <h2 id="footer-sites-heading" className="footer-aside-title">
                개발자의 다른 사이트
              </h2>
              <ul className="footer-aside-list">
                <li>
                  <a href="https://pimath.kr" target="_blank" rel="noopener noreferrer" className="footer-link">
                    수학하는 즐거움
                  </a>
                </li>
                <li>
                  <a href="https://foreducator.com/" target="_blank" rel="noopener noreferrer" className="footer-link">
                    교사들을 위한 웹사이트
                  </a>
                </li>
                <li>
                  <a href="https://classpoint.kr" target="_blank" rel="noopener noreferrer" className="footer-link">
                    학급 상벌점 관리 ClassPoint
                  </a>
                </li>
                <li>
                  <a href="https://oxit.run" target="_blank" rel="noopener noreferrer" className="footer-link">
                    실시간 O/X와 워드클라우드
                  </a>
                </li>
                <li>
                  <a href="https://maramap.kr" target="_blank" rel="noopener noreferrer" className="footer-link">
                    마라톤 정보 확인
                  </a>
                </li>
              </ul>
            </section>
          </div>
        </div>

        <p className="footer-bottom">
          &copy; {new Date().getFullYear()} 숏.한국 - 한국어 URL 단축 서비스
        </p>
      </div>
    </footer>
  );
}
