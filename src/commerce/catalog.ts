export type OfferId = 'desktop' | 'cinema' | 'patron'
export type OfferState = 'coming-soon' | 'available'

export interface CommercialOffer {
  id: OfferId
  title: string
  state: OfferState
  summary: string
  priceLabel?: string
  renewalLabel?: string
}

/** Prices, renewal policy, and checkout stay unset until the owner approves them. */
export const COMMERCIAL_OFFERS: readonly CommercialOffer[] = [
  {
    id: 'desktop',
    title: 'Bản game cho máy tính',
    state: 'coming-soon',
    summary: 'Bản cài đặt với gói 2K HD và 4K chất lượng cao, phù hợp với khả năng GPU.',
  },
  {
    id: 'cinema',
    title: 'Aetheria Cinema 8K',
    state: 'coming-soon',
    summary: 'Gói chụp ảnh/chế độ điện ảnh trả phí, chỉ mở sau khi quyền mua được xác minh; luôn tự chuyển về 4K/2K an toàn.',
  },
  {
    id: 'patron',
    title: 'Aetheria Patron',
    state: 'coming-soon',
    summary: 'Ủng hộ dự án qua quyền truy cập sớm, vật phẩm trang trí, bỏ phiếu lộ trình và thử nghiệm beta; không tạo lợi thế trong mô phỏng.',
  },
]
