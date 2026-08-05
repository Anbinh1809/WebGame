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
    title: 'Desktop Game',
    state: 'coming-soon',
    summary: 'Bản cài đặt với pack 2K HD và 4K Ultra theo khả năng GPU.',
  },
  {
    id: 'cinema',
    title: 'Aetheria Cinema 8K',
    state: 'coming-soon',
    summary: 'Pack cinematic/photo mode chỉ dùng hero asset gần camera, với fallback 4K/2K an toàn.',
  },
  {
    id: 'patron',
    title: 'Aetheria Patron',
    state: 'coming-soon',
    summary: 'Ủng hộ dự án qua early access, cosmetic, roadmap vote và beta test; không tạo lợi thế simulation.',
  },
]
