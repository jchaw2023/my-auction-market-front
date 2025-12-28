/**
 * 生成占位图片的 data URI
 * 使用 SVG 创建，避免外部请求
 */
export function getPlaceholderImage(width: number = 400, height: number = 400, text?: string): string {
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#e0e0e0"/>
      <text 
        x="50%" 
        y="50%" 
        font-family="Arial, sans-serif" 
        font-size="16" 
        fill="#999" 
        text-anchor="middle" 
        dominant-baseline="middle"
      >${text || 'No Image'}</text>
    </svg>
  `.trim();
  
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * 默认占位图片
 */
export const PLACEHOLDER_IMAGE = getPlaceholderImage(400, 400, 'No Image');
export const PLACEHOLDER_IMAGE_LARGE = getPlaceholderImage(600, 600, 'No Image');

