export interface ColorLutStyle {
  id: string
  name: string
  description: string
  css_gradient: string
  filter: string
  vignette?: boolean
}

export const COLOR_LUT_PRESETS: ColorLutStyle[] = [
  {
    id: 'none',
    name: 'Nguyên bản (Rec.709)',
    description: 'Màu gốc từ AI generator, không áp dụng bộ lọc',
    css_gradient: 'from-zinc-500 to-zinc-700',
    filter: 'none',
    vignette: false,
  },
  {
    id: 'teal_and_orange',
    name: 'Hollywood Teal & Orange',
    description: 'Tone bom tấn Hollywood kinh điển: da người ấm áp, bóng tối xanh ngọc',
    css_gradient: 'from-amber-600 to-cyan-700',
    filter: 'contrast(1.15) saturate(1.22) sepia(0.18) hue-rotate(-12deg)',
    vignette: true,
  },
  {
    id: 'kodachrome_1970',
    name: 'Vintage Kodachrome 1970s',
    description: 'Màu phim nhựa cổ điển thập niên 70: ấm áp vàng đồng hoài niệm',
    css_gradient: 'from-amber-700 to-rose-900',
    filter: 'contrast(1.1) saturate(1.12) sepia(0.32) brightness(0.98)',
    vignette: true,
  },
  {
    id: 'wes_anderson_pastel',
    name: 'Wes Anderson Pastel',
    description: 'Gam màu pastel mộng mơ, vàng dịu và hồng đào tinh tế đối xứng',
    css_gradient: 'from-yellow-500 to-pink-500',
    filter: 'contrast(0.96) saturate(1.15) brightness(1.04) sepia(0.12) hue-rotate(8deg)',
    vignette: false,
  },
  {
    id: 'cyberpunk_matrix',
    name: 'Cyberpunk Matrix Neon',
    description: 'Bóng tối xanh lục ma trận và ánh sáng neon tím viễn tưởng',
    css_gradient: 'from-emerald-500 to-fuchsia-600',
    filter: 'contrast(1.25) saturate(1.3) hue-rotate(85deg) brightness(0.96)',
    vignette: true,
  },
  {
    id: 'bleach_bypass',
    name: 'Bleach Bypass War Film',
    description: 'Khử bão hòa -45%, tương phản sắc nét, phong cách gai góc',
    css_gradient: 'from-zinc-500 to-stone-800',
    filter: 'contrast(1.35) saturate(0.55) brightness(0.98)',
    vignette: true,
  },
  {
    id: 'film_noir_bw',
    name: 'Silver Nitrate Noir (B&W)',
    description: 'Đen trắng tráng bạc kinh điển, tương phản cao, đổ bóng bí ẩn',
    css_gradient: 'from-zinc-200 to-zinc-900',
    filter: 'grayscale(1) contrast(1.3) brightness(0.96)',
    vignette: true,
  },
  {
    id: 'golden_sunset',
    name: 'Golden Sunset Glow',
    description: 'Nắng vàng cam hoàng hôn rực rỡ, lãng mạn dạt dào cảm xúc',
    css_gradient: 'from-yellow-400 to-orange-600',
    filter: 'contrast(1.1) saturate(1.25) sepia(0.28) brightness(1.02) hue-rotate(-8deg)',
    vignette: true,
  },
  {
    id: 'nordic_cold',
    name: 'Nordic Cold Mystery',
    description: 'Tông lạnh xanh xám Bắc Âu bí ẩn, băng giá và sâu thẳm',
    css_gradient: 'from-cyan-900 to-slate-900',
    filter: 'contrast(1.08) saturate(0.85) hue-rotate(185deg) brightness(0.98)',
    vignette: true,
  },
]

export function getColorLutCss(lutId: string): { filter: string; hasVignette: boolean } {
  const item = COLOR_LUT_PRESETS.find((p) => p.id === lutId)
  if (!item) {
    return { filter: 'none', hasVignette: false }
  }
  return {
    filter: item.filter,
    hasVignette: !!item.vignette,
  }
}
