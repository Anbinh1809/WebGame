import { useEffect } from 'react'
import type { JSX } from 'react'
import { POLY_HAVEN_CREDIT, POLY_HAVEN_URL } from '../assets/manifest'
import { COMMERCIAL_OFFERS } from '../commerce/catalog'

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
  ['1K/2K/4K/8K nghĩa là gì?', 'Đó là độ phân giải texture source/asset pack, không phải độ phân giải màn hình của bạn. Render quality và texture-pack quality là hai thiết lập tách biệt.'],
  ['Máy yếu có chơi được không?', 'Web demo ưu tiên 1K và có fallback 512px khi WebGL/GPU yếu. Render Auto giữ DPR, mobile cap và hysteresis riêng với asset pack.'],
  ['8K có bắt buộc không?', 'Không. Cinema 8K chỉ dành cho cinematic/photo mode và hero asset gần camera, cần kiểm tra capability/VRAM và luôn fallback 4K hoặc 2K an toàn.'],
  ['Gói hết hạn thì sao?', 'Base game và world save không bị khóa. Nếu Cinema/Patron trở thành subscription, grace period, offline behavior, cancellation và refund sẽ được công bố trước khi mở bán.'],
  ['Poly Haven là gì?', 'Poly Haven cung cấp asset CC0/public-domain. Aetheria sẽ ghi nhận nguồn asset và không gợi ý partnership; file chạy game chỉ dùng asset đã curate/đóng gói.'],
  ['Privacy của demo ra sao?', 'Không có inference trong client và không có telemetry mặc định. Demo không yêu cầu đăng nhập để chơi.'],
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
          <a href="#gameplay">Gameplay</a>
          <a href="#graphics">Đồ họa</a>
          <a href="#offers">Gói phát hành</a>
        </nav>
      </header>

      <section className="marketing-hero" id="main-content" aria-labelledby="hero-title">
        <div className="marketing-copy">
          <p className="marketing-kicker">World Shaper · sandbox 3D theo seed</p>
          <h1 id="hero-title">Aetheria: World Shaper</h1>
          <p className="marketing-lede">Kiến tạo địa hình, gieo rừng, gọi mưa và xem từng quyết định để lại dấu ấn trong một thế giới sống có thể tái tạo.</p>
          <div className="marketing-actions">
            <a className="marketing-primary" href="/play">Chơi thử miễn phí (Web 1K)</a>
            <a className="marketing-secondary" href="#offers">Tải bản desktop 2K/4K <span>(sắp ra mắt)</span></a>
          </div>
          <p className="marketing-note">Không cần đăng nhập · không telemetry mặc định · 8K không tự bật khi chọn High.</p>
        </div>
        <figure className="marketing-poster">
          <img src="/aetheria-poster.svg" width="1200" height="630" alt="Minh họa Aetheria: các hòn đảo, rừng, làng và ánh sáng bình minh theo phong cách stylized naturalism." />
          <figcaption>Poster minh họa nguyên bản, tối ưu nhẹ cho trang giới thiệu.</figcaption>
        </figure>
      </section>

      <section id="gameplay" className="marketing-section marketing-gameplay" aria-labelledby="gameplay-title">
        <p className="marketing-kicker">Một thế giới, vô số lần bắt đầu</p>
        <h2 id="gameplay-title">Tạo một quy luật sống, không chỉ một khung cảnh.</h2>
        <div className="marketing-feature-grid">
          <article><h3>God-simulator có hậu quả</h3><p>Nâng đất, gọi nước, gieo rừng, đổi độ phì và dẫn cư dân tới vùng đất mới. Ecology gần làng tác động trực tiếp đến thu hoạch và sức chống chịu.</p></article>
          <article><h3>Thế giới theo seed</h3><p>Seed tái tạo địa hình, biến thể scene, mục tiêu và biên niên sử procedural để bạn thử lại một quyết định trong cùng điều kiện.</p></article>
          <article><h3>Weather & Chronicle</h3><p>Bão, hội đồng và các dấu mốc xã hội được mô phỏng fixed-tick; biên niên sử dùng chính digest deterministic của thế giới, không điều khiển simulation.</p></article>
        </div>
      </section>

      <section id="graphics" className="marketing-section" aria-labelledby="graphics-title">
        <p className="marketing-kicker">Texture-pack quality ≠ render quality</p>
        <h2 id="graphics-title">Chọn asset pack hợp với GPU, còn render quality vẫn là một setting riêng.</h2>
        <div className="marketing-table-wrap" role="region" aria-label="So sánh các asset pack" tabIndex={0}>
          <table>
            <caption>So sánh pack đồ họa Aetheria</caption>
            <thead><tr><th scope="col">Pack</th><th scope="col">Nơi dùng</th><th scope="col">Mục tiêu</th><th scope="col">Giới hạn an toàn</th></tr></thead>
            <tbody>
              <tr><th scope="row">Web 1K</th><td>Browser demo</td><td>Chơi ngay, tối đa 1K; fallback 512px khi GPU/WebGL yếu.</td><td>Không tải, bundle hoặc preload 2K/4K/8K.</td></tr>
              <tr><th scope="row">Desktop 2K</th><td>HD desktop</td><td>60 FPS mục tiêu ở 1080p desktop tầm trung.</td><td>Load on demand, không pay-to-win.</td></tr>
              <tr><th scope="row">Desktop 4K</th><td>Ultra desktop</td><td>Material gần/cần thiết với LOD, mipmap và culling.</td><td>Không thay DPR chỉ vì texture lớn hơn.</td></tr>
              <tr><th scope="row">Cinema 8K</th><td>Photo/cinematic</td><td>Hero asset gần camera, collection/preset có giá trị mới.</td><td>Capability/VRAM check, resident limit và fallback 4K/2K.</td></tr>
            </tbody>
          </table>
        </div>
        <a className="marketing-text-link" href="#hardware">Kiểm tra yêu cầu phần cứng và chính sách fallback</a>
      </section>

      <section className="marketing-section marketing-how" aria-labelledby="how-title">
        <p className="marketing-kicker">Cách bắt đầu</p>
        <h2 id="how-title">Đi từ browser đến bản desktop theo nhịp của bạn.</h2>
        <ol>
          <li><strong>1. Chơi thử trên web.</strong><span>Khám phá core simulation với Web 1K và fallback thân thiện.</span></li>
          <li><strong>2. Chọn desktop khi sẵn sàng.</strong><span>Pack 2K/4K sẽ chỉ mở sau khi distribution và installer được owner chốt.</span></li>
          <li><strong>3. Ghép pack với GPU.</strong><span>Capability, entitlement hợp lệ và file availability quyết định pack; không phải client-side flag.</span></li>
        </ol>
      </section>

      <section id="offers" className="marketing-section" aria-labelledby="offers-title">
        <p className="marketing-kicker">Phát hành minh bạch</p>
        <h2 id="offers-title">Các gói đang được chuẩn bị, chưa có checkout hoặc giá giả.</h2>
        <div className="marketing-offer-grid">
          {COMMERCIAL_OFFERS.map((offer) => (
            <article key={offer.id} className="marketing-offer-card">
              <p className="marketing-status">{offer.state === 'coming-soon' ? 'Coming soon' : 'Available'}</p>
              <h3>{offer.title}</h3>
              <p>{offer.summary}</p>
              <p className="marketing-price">{offer.priceLabel ?? 'Giá sẽ được công bố sau khi owner chốt distribution, refund và payment provider.'}</p>
              <a href="#updates">Đăng ký nhận thông tin</a>
            </article>
          ))}
        </div>
      </section>

      <section id="hardware" className="marketing-section marketing-hardware" aria-labelledby="hardware-title">
        <h2 id="hardware-title">Yêu cầu phần cứng và an toàn bộ nhớ</h2>
        <p>Web demo ưu tiên tải nhanh và giữ gameplay chạy được ngay cả khi asset lỗi. Cinema 8K không dành cho HUD, icon hay asset xa camera; nếu GPU không đạt, game vô hiệu hóa lựa chọn đó và quay về 4K/2K, không làm canvas trắng hay crash.</p>
      </section>

      <section className="marketing-section marketing-faq" aria-labelledby="faq-title">
        <h2 id="faq-title">Câu hỏi thường gặp</h2>
        <div>{faqEntries.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div>
      </section>

      <footer id="updates" className="marketing-footer">
        <p>{POLY_HAVEN_CREDIT} <a href={POLY_HAVEN_URL} rel="noreferrer">Poly Haven</a>.</p>
        <nav aria-label="Thông tin pháp lý"><a href="#legal">Điều khoản (đang chuẩn bị)</a><a href="#legal">Privacy (đang chuẩn bị)</a><a href="#legal">Refund/contact (đang chuẩn bị)</a></nav>
        <p id="legal">Không có payment provider, merchant entity, recurring charge hay entitlement production nào được cấu hình trong bản demo này.</p>
      </footer>
    </main>
  )
}
