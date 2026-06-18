import Link from "next/link";

const LOGO_SRC = "/logo.svg";

interface AppLogoProps {
  className?: string;
  imageClassName?: string;
  showWordmark?: boolean;
  wordmarkClassName?: string;
  href?: string;
}

export default function AppLogo({
  className = "",
  imageClassName = "h-10 w-auto",
  showWordmark = false,
  wordmarkClassName = "text-xl font-bold text-primary leading-tight",
  href,
}: AppLogoProps) {
  const content = (
    <div className={`flex items-center gap-2 min-w-0 ${className}`}>
      <img
        src={LOGO_SRC}
        alt="The Lighthouse"
        className={`shrink-0 ${imageClassName}`}
      />
      {showWordmark && (
        <span className={wordmarkClassName}>The Lighthouse</span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="flex-1 hover:opacity-90 transition-opacity">
        {content}
      </Link>
    );
  }

  return content;
}
