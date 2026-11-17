/** The drawing or video of a bank exercise (signed URL), or nothing. */
export function BankMedia({ kind, url, alt, className = "" }: { kind: string | null; url: string | null; alt: string; className?: string }) {
  if (!url) return null;
  return kind === "video" ? (
    <video src={url} controls preload="metadata" className={`w-full rounded-lg bg-black ${className}`} />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={alt} className={`w-full rounded-lg bg-white object-contain ${className}`} />
  );
}
