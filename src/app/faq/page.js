'use client';
import { useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const faqs = [
  { q: '숏.한국이 무엇인가요?', a: '숏.한국은 긴 URL을 한글로 된 짧은 주소로 변환해주는 무료 URL 단축 서비스입니다. 텍스트·파일 공유도 가능하며, 원하는 한글·영문·숫자로 단축 코드를 직접 지정할 수 있습니다.' },
  { q: '회원가입을 하면 어떤 장점이 있나요?', a: '회원가입하면 영구적으로 유지되는 단축 URL·텍스트를 만들 수 있습니다. 비회원 링크는 최대 1개월 후 만료되지만, 회원 URL·텍스트는 만료되지 않습니다. (파일 공유는 스토리지 자원 관리를 위해 1GB 이하 7일, 1GB 초과 2일 보관 후 자동 삭제됩니다.) 대시보드에서 모든 링크를 관리하고 클릭 통계를 확인할 수 있습니다.' },
  { q: '파일 공유는 어떻게 하나요?', a: '메인 페이지 또는 대시보드에서 "파일 공유" 탭을 선택한 뒤 문서, 이미지, 압축파일(최대 5GB 지원)을 올리고 단축 코드를 정하면 됩니다. 3MB 이상 대용량 파일은 Cloudflare R2로 초고속 직접 업로드되며, 1GB 이하는 7일, 1GB 초과는 2일간 보관 후 자동 삭제됩니다.' },
  { q: '회원 파일 링크도 영구인가요?', a: '아니요. 스토리지 비용 및 자원 관리를 위해 URL·텍스트와 달리 파일 공유는 1GB 이하 7일, 1GB 초과 2일 보관 후 자동 삭제됩니다.' },
  { q: '한글로 된 단축 코드를 사용할 수 있나요?', a: '네! 숏.한국의 가장 큰 특징은 한글 단축 코드 지원입니다. 예를 들어 "숏.한국/수학" 처럼 기억하기 쉬운 한글 주소를 만들 수 있습니다.' },
  { q: '비회원 URL의 만료 기간은 어떻게 되나요?', a: '비회원 링크는 24시간, 48시간, 1주일, 1개월 중 선택할 수 있습니다. 기본값은 1주일입니다. 만료되면 링크(및 파일 공유인 경우 파일)가 삭제됩니다.' },
  { q: '회원 URL의 형태는 어떤가요?', a: '회원 URL은 "숏.한국/닉네임/단축코드" 형태입니다. 예를 들어 닉네임이 "교사"이고 코드가 "수학"이면 "숏.한국/교사/수학"이 됩니다.' },
  { q: 'API로 URL 단축을 할 수 있나요?', a: '네, REST API를 제공합니다. POST 요청으로 URL 단축이 가능합니다. 자세한 내용은 API 문서 페이지를 참고해주세요.' },
  { q: 'QR 코드도 제공되나요?', a: '네, URL 단축 후 자동으로 QR 코드가 생성됩니다. 이 QR 코드를 다운로드하여 인쇄물 등에 활용할 수 있습니다.' },
  { q: '단축 URL이 작동하지 않아요.', a: '비회원 링크는 만료 기간이 지나면 자동으로 삭제됩니다. 회원 URL·텍스트는 소유자가 삭제하지 않는 한 유지됩니다. 회원 파일 공유는 3개월 미접속 시 삭제될 수 있습니다. 문제가 계속되면 문의 페이지에서 연락해주세요.' },
];

export default function FAQPage() {
  const [open, setOpen] = useState(null);

  return (
    <>
      <Header />
      <main>
        <div className="static-page">
          <h1>자주 묻는 질문</h1>
          <p className="page-desc">숏.한국 서비스에 대해 자주 묻는 질문과 답변입니다.</p>

          {faqs.map((faq, i) => (
            <div key={i} className="faq-item">
              <div className="faq-question" onClick={() => setOpen(open === i ? null : i)}>
                <span>{faq.q}</span>
                <span style={{ transform: open === i ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }}>▼</span>
              </div>
              {open === i && <div className="faq-answer">{faq.a}</div>}
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
