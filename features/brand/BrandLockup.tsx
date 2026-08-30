import Image from "next/image";

type BrandLockupProps = {
  tone?: "default" | "inverse";
};

export function BrandLockup({
  tone = "default",
}: BrandLockupProps) {
  return (
    <span className={`brand-lockup brand-lockup-${tone}`}>
      <Image
        className="brand-municipality-logo"
        src={
          tone === "inverse"
            ? "/brand/kalundborg-kommune-inverse.svg"
            : "/brand/kalundborg-kommune.svg"
        }
        width={176}
        height={58}
        alt="Kalundborg Kommune"
      />

      <span className="brand-lockup-divider" aria-hidden="true" />

      <span
        className="brand-product-logo"
        role="img"
        aria-label="D-GITA – Den Gode IT-Anskaffelse"
      >
        <span className="brand-product-mark" aria-hidden="true">D</span>
        <span className="brand-product-copy" aria-hidden="true">
          <strong>D-GITA</strong>
          <small>Den Gode IT-Anskaffelse</small>
        </span>
      </span>

      <span className="brand-lockup-divider brand-partner-divider" aria-hidden="true" />

      <Image
        className="brand-digit-logo"
        src="/brand/digit.svg"
        width={768}
        height={300}
        alt="DIGIT – Digitaliseringsforeningen Sjælland"
      />
    </span>
  );
}
