import Image from "next/image";

export function PartnerFooter({ className = "" }: { className?: string }) {
  return (
    <footer className={`site-partner-footer ${className}`.trim()}>
      <div className="partner-footer-inner">
        <span className="partner-footer-label">Udviklet i samarbejde med</span>
        <a
          className="partner-footer-link"
          href="https://digitaliseringsforeningen.dk/"
          target="_blank"
          rel="noreferrer"
          aria-label="Besøg Digitaliseringsforeningen Sjælland"
        >
          <Image
            className="partner-footer-logo"
            src="/brand/digit.svg"
            width={768}
            height={300}
            alt="DIGIT – Digitaliseringsforeningen Sjælland"
          />
        </a>
      </div>
    </footer>
  );
}
