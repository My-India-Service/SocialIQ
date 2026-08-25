/** SocialAiDigital brand mark (wordmark included in image). */
export default function BrandLogo({ className = '', variant = 'default' }) {
  const img = (
    <img
      src="/socialAiLogo.png?v=2"
      alt="SocialAiDigital"
      className={`brand-logo-img${className ? ` ${className}` : ''}`}
      width={160}
      height={160}
      decoding="async"
    />
  );

  if (variant === 'onDark') {
    return <span className="brand-logo brand-logo--on-dark">{img}</span>;
  }

  return img;
}
