import markMint from "../../assets/brand/mark/patternly-mark-mint.svg";

export function Brand({ href = "/", className = "", ariaLabel = "Patternly home" }) {
  return (
    <a className={`brand ${className}`.trim()} href={href} aria-label={ariaLabel}>
      <img src={markMint} alt="" width="24" height="24" />
      <span className="brand-wordmark">Patternly</span>
    </a>
  );
}
