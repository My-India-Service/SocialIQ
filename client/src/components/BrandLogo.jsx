/** SocialAiDigital brand mark (wordmark included in image). */
export default function BrandLogo({ className = '' }) {
  return (
    <img
      src="/socialAiLogo.png?v=2"
      alt="SocialAiDigital"
      className={`brand-logo-img${className ? ` ${className}` : ''}`}
      width={160}
      height={160}
      decoding="async"
    />
  );
}
