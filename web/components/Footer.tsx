import { site } from '@/lib/data';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="top">
        <span className="flogo"><span className="logo-mark" />{site.name}</span>
        <a className="partner" href={`tel:${site.phone}`}>기업 검진 문의</a>
      </div>
      <h5>고객센터</h5>
      <p>대표번호 {site.phone}</p>
      <h5>Company</h5>
      <p>{site.clinic} &nbsp;|&nbsp; 대표자 {site.ceo}</p>
      <p>사업자등록번호 {site.bizNo}</p>
      <p>{site.address} {site.addressDetail}</p>
      <p style={{ marginTop: 8 }}>© 2026 {site.clinic}. All rights reserved.</p>
      <div className="links">
        <a href="#">이용약관</a>
        <a href="#">개인정보처리방침</a>
      </div>
    </footer>
  );
}
