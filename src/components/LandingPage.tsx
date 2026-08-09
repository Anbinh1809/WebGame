import { useEffect } from 'react'
import type { JSX } from 'react'
import { POLY_HAVEN_CREDIT, POLY_HAVEN_URL } from '../assets/manifest'
import { COMMERCIAL_OFFERS } from '../commerce/catalog'
import { PlayerAccountPanel } from './PlayerAccountPanel'

function setMetadata(): void {
  document.title = 'Aetheria: World Shaper — kiến tạo một thế giới sống'
  const description = document.querySelector('meta[name="description"]')
  description?.setAttribute('content', 'Aetheria: World Shaper là sandbox 3D theo seed, nơi bạn tạo địa hình, dẫn dắt cư dân và ghi nên biên niên sử của một thế giới sống.')
  let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!canonical) {
    canonical = document.createElement('link')
    canonical.rel = 'canonical'
    document.head.append(canonical)
  }
  canonical.href = `${window.location.origin}/`
}

const faqEntries = [
  ['1K/2K/4K/8K nghĩa là gì?', 'Đây là độ phân giải texture trong gói asset, không phải độ phân giải màn hình. Chất lượng kết xuất và độ phân giải texture là hai thiết lập độc lập.'],
  ['Máy yếu có chơi được không?', 'Bản chơi thử dùng texture 1K và tự hạ về 512 px khi WebGL/GPU yếu. Chế độ tự động theo dõi tốc độ khung hình, giới hạn chất lượng phù hợp trên di động và thay đổi dần để tránh giật.'],
  ['8K có bắt buộc không?', 'Không. Aetheria Cinema 8K là gói trả phí dành cho chế độ chụp ảnh hoặc điện ảnh; chỉ mở khi ứng dụng desktop xác minh quyền mua, gói cục bộ có sẵn và GPU đạt yêu cầu. Game luôn tự chuyển về 4K hoặc 2K an toàn.'],
  ['Gói hết hạn thì sao?', 'Bản game cơ bản và thế giới đã lưu không bị khóa. Nếu Cinema hoặc Patron trở thành gói định kỳ, thời gian gia hạn, sử dụng ngoại tuyến, hủy và hoàn tiền sẽ được công bố trước khi mở bán.'],
  ['Poly Haven là gì?', 'Poly Haven cung cấp asset CC0 thuộc phạm vi công cộng. Aetheria sẽ ghi nhận nguồn asset, không ngụ ý hợp tác và chỉ dùng các asset đã tuyển chọn, đóng gói trong bản game.'],
  ['Quyền riêng tư của demo ra sao?', 'Không có suy luận AI tại máy khách và không thu thập dữ liệu sử dụng mặc định. Bản chơi thử không yêu cầu đăng nhập.'],
] as const

const faqStructuredData = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqEntries.map(([name, text]) => ({
    '@type': 'Question',
    name,
    acceptedAnswer: { '@type': 'Answer', text },
  })),
})

export function LandingPage(): JSX.Element {
  useEffect(() => {
    setMetadata()
  }, [])

  return (
    <main className="marketing-shell">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqStructuredData }} />
      <a className="marketing-skip-link" href="#main-content">Đến nội dung chính</a>
      <header className="marketing-nav" aria-label="Điều hướng Aetheria">
        <a className="marketing-wordmark" href="/" aria-label="Aetheria: World Shaper, trang chủ"><span aria-hidden="true">A</span> Aetheria</a>
        <nav aria-label="Điều hướng trang">
          <a href="#gameplay">Lối chơi</a>
          <a href="#graphics">Đồ họa</a>
          <a href="#offers">Gói phát hành</a>
          <a href="#player-account">Hồ sơ</a>
        </nav>
      </header>

      <section className="marketing-hero" id="main-content" aria-labelledby="hero-title">
        <div className="marketing-copy">
          <p className="marketing-kicker">World Shaper · thế giới 3D theo seed</p>
          <h1 id="hero-title">Aetheria: World Shaper</h1>
          <p className="marketing-lede">Kiến tạo địa hình, gieo rừng, gọi mưa và xem từng quyết định để lại dấu ấn trong một thế giới sống có thể tái tạo.</p>
          <div className="marketing-actions">
            <a className="marketing-primary" href="/play">Chơi thử miễn phí (bản web 1K)</a>
            <a className="marketing-secondary" href="#offers">Tải bản cho máy tính 2K/4K <span>(sắp ra mắt)</span></a>
          </div>
          <p className="marketing-note">Không cần đăng nhập · không thu thập dữ liệu sử dụng mặc định · Bản web chỉ dùng 1K · Cinema 8K cần quyền mua đã xác minh.</p>
        </div>
        <figure className="marketing-poster">
          <img src="/aetheria-poster.svg" width="1200" height="630" alt="Minh họa Aetheria: các hòn đảo, rừng, làng và ánh sáng bình minh theo phong cách stylized naturalism." />
          <figcaption>Poster minh họa nguyên bản, tối ưu nhẹ cho trang giới thiệu.</figcaption>
        </figure>
      </section>

      <section id="player-account" className="marketing-section marketing-account" aria-labelledby="player-account-title">
        <p className="marketing-kicker">Hồ sơ trên thiết bị</p>
        <h2 id="player-account-title">Chơi ngay; đăng nhập khi bạn muốn giữ tên người chơi trong phiên này.</h2>
        <PlayerAccountPanel className="marketing-account-card" />
      </section>

      <section id="gameplay" className="marketing-section marketing-gameplay" aria-labelledby="gameplay-title">
        <p className="marketing-kicker">Một thế giới, vô số lần bắt đầu</p>
        <h2 id="gameplay-title">Tạo một quy luật sống, không chỉ một khung cảnh.</h2>
        <div className="marketing-feature-grid">
          <article><h3>Quyền năng có hệ quả</h3><p>Nâng đất, gọi nước, gieo rừng, đổi độ phì và dẫn cư dân tới vùng đất mới. Hệ sinh thái quanh làng tác động trực tiếp đến thu hoạch và sức chống chịu.</p></article>
          <article><h3>Thế giới theo seed</h3><p>Seed tái tạo địa hình, biến thể khung cảnh, mục tiêu và biên niên sử dựa trên quy tắc để bạn thử lại một quyết định trong cùng điều kiện.</p></article>
          <article><h3>Thời tiết và biên niên sử</h3><p>Bão, hội đồng và các dấu mốc xã hội được mô phỏng theo nhịp tick cố định; biên niên sử dùng bản tóm lược xác định của thế giới, không điều khiển mô phỏng.</p></article>
        </div>
      </section>

      <section id="graphics" className="marketing-section" aria-labelledby="graphics-title">
        <p className="marketing-kicker">Độ phân giải texture độc lập với chất lượng kết xuất</p>
        <h2 id="graphics-title">Chọn gói asset phù hợp với GPU; chất lượng kết xuất là một thiết lập riêng.</h2>
        <div className="marketing-table-wrap" role="region" aria-label="So sánh các asset pack" tabIndex={0}>
          <table>
            <caption>So sánh các gói đồ họa của Aetheria</caption>
            <thead><tr><th scope="col">Gói</th><th scope="col">Nơi dùng</th><th scope="col">Mục tiêu</th><th scope="col">Giới hạn an toàn</th></tr></thead>
            <tbody>
              <tr><th scope="row">Web 1K</th><td>Bản chơi thử trên web</td><td>Chơi ngay, tối đa 1K; dùng bản dự phòng 512 px khi GPU/WebGL yếu.</td><td>Không tải, đóng gói hoặc nạp sẵn 2K/4K/8K.</td></tr>
              <tr><th scope="row">Desktop 2K</th><td>Bản cài đặt chất lượng HD</td><td>Mục tiêu 60 FPS ở 1080p trên máy tầm trung.</td><td>Chỉ mở sau khi gói 2K đã tải về và manifest cục bộ hợp lệ.</td></tr>
              <tr><th scope="row">Desktop 4K</th><td>Bản cài đặt chất lượng cao</td><td>Chi tiết vật liệu gần camera, với LOD, mipmap và culling.</td><td>Chỉ mở sau khi gói 4K đã tải về; không tăng DPR chỉ vì texture lớn hơn.</td></tr>
              <tr><th scope="row">Aetheria Cinema 8K</th><td>Chụp ảnh/chế độ điện ảnh trả phí</td><td>Asset trung tâm gần camera, bộ sưu tập và preset đặc biệt.</td><td>Cần quyền mua được xác minh, gói cục bộ, kiểm tra GPU/VRAM và tự chuyển về 4K/2K.</td></tr>
            </tbody>
          </table>
        </div>
        <a className="marketing-text-link" href="#hardware">Kiểm tra yêu cầu phần cứng và phương án dự phòng</a>
      </section>

      <section className="marketing-section marketing-how" aria-labelledby="how-title">
        <p className="marketing-kicker">Cách bắt đầu</p>
        <h2 id="how-title">Đi từ bản web đến bản cài đặt theo nhịp của bạn.</h2>
        <ol>
          <li><strong>1. Chơi thử trên web.</strong><span>Khám phá mô phỏng cốt lõi với Web 1K và phương án dự phòng thân thiện.</span></li>
          <li><strong>2. Tải gói cho máy tính khi sẵn sàng.</strong><span>2K/4K chỉ mở khi trình cài đặt đã đặt gói và manifest cục bộ hợp lệ.</span></li>
          <li><strong>3. Mở Cinema nếu đã sở hữu.</strong><span>8K cần quyền mua do dịch vụ bản cài đặt xác minh, rồi mới kiểm tra tệp và GPU; không phải cờ bật/tắt ở phía trình khách.</span></li>
        </ol>
      </section>

      <section id="offers" className="marketing-section" aria-labelledby="offers-title">
        <p className="marketing-kicker">Phát hành minh bạch</p>
        <h2 id="offers-title">Các gói đang được chuẩn bị; chưa có hệ thống thanh toán hoặc mức giá giả định.</h2>
        <div className="marketing-offer-grid">
          {COMMERCIAL_OFFERS.map((offer) => (
            <article key={offer.id} className="marketing-offer-card">
              <p className="marketing-status">{offer.state === 'coming-soon' ? 'Sắp ra mắt' : 'Đã mở'}</p>
              <h3>{offer.title}</h3>
              <p>{offer.summary}</p>
              <p className="marketing-price">{offer.priceLabel ?? 'Giá chỉ được công bố sau khi chủ dự án chốt phương án phát hành, hoàn tiền và nhà cung cấp thanh toán.'}</p>
              <a href="#updates">Đăng ký nhận thông tin</a>
            </article>
          ))}
        </div>
      </section>

      <section id="hardware" className="marketing-section marketing-hardware" aria-labelledby="hardware-title">
        <h2 id="hardware-title">Yêu cầu phần cứng và an toàn bộ nhớ</h2>
        <p>Bản chơi thử ưu tiên tải nhanh và vẫn vận hành khi asset gặp lỗi. Cinema 8K không dành cho HUD, biểu tượng hay asset xa camera; chỉ được tải sau khi quyền mua được xác minh. Nếu gói hoặc GPU không đạt yêu cầu, game khóa lựa chọn đó và tự chuyển về 4K/2K, không để canvas trắng hoặc dừng đột ngột.</p>
      </section>

      <section className="marketing-section marketing-faq" aria-labelledby="faq-title">
        <h2 id="faq-title">Câu hỏi thường gặp</h2>
        <div>{faqEntries.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div>
      </section>

      <footer id="updates" className="marketing-footer">
        <p>{POLY_HAVEN_CREDIT} <a href={POLY_HAVEN_URL} rel="noreferrer">Poly Haven</a>.</p>
        <nav aria-label="Thông tin pháp lý"><a href="#legal">Điều khoản (đang chuẩn bị)</a><a href="#legal">Quyền riêng tư (đang chuẩn bị)</a><a href="#legal">Hoàn tiền và liên hệ (đang chuẩn bị)</a></nav>
        <p id="legal">Bản chơi thử chưa cấu hình nhà cung cấp thanh toán, pháp nhân bán hàng, khoản gia hạn tự động hoặc hệ thống xác minh quyền mua chính thức; vì vậy Cinema 8K vẫn khóa cho đến khi chủ dự án phê duyệt dịch vụ phát hành.</p>
      </footer>
    </main>
  )
}
