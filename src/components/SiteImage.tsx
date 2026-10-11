import Image, { type ImageProps } from 'next/image';

/** Consistent lazy loading and dimensions. Uploaded and third-party media are
 * served directly: they may not be reachable by the server-side optimizer. */
export default function SiteImage({ src, alt, width = 1200, height = 900, sizes = '(max-width: 768px) 100vw, 50vw', ...props }: ImageProps) {
  const direct = typeof src === 'string' && /^(https?:|blob:|data:|\/media\/|\/uploads\/)/.test(src);
  return <Image src={src} alt={alt} width={width} height={height} sizes={sizes} unoptimized={direct} {...props} />;
}
