import Link from 'next/link';

export const metadata = { title: 'Not found — Equity Lens' };

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-20">
      <div className="panel px-6 py-7">
        <p className="eyebrow">Error 404</p>
        <h1 className="mt-2 font-serif text-[22px] tracking-tight text-t1">
          That page doesn&apos;t exist
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-t3">
          The link may be mistyped, or the ticker may not be covered.
        </p>
        <Link href="/" className="mt-5 inline-block bg-gold px-3 py-2 text-[13px] font-semibold text-bg">
          Back to Equity Lens
        </Link>
      </div>
    </div>
  );
}
