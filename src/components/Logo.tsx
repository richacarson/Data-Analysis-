/**
 * The Paradiem shield with a lens over it: the house mark, looked at closely.
 *
 * The knockout circle and stroke are the page's navy, separating the lens from
 * the shield, so the mark belongs on the navy surfaces it was drawn for.
 */
const NAVY = '#171738';
const LENS = '#FFFFFF';

export function ShieldMark({ className = 'h-6 w-auto' }: { className?: string }) {
  return (
    <svg viewBox="128 26 363 439" className={className} aria-hidden focusable="false">
      <g fill="#FFFFFF">
        <path d="M255 36C259 56 266 64 281 68C266 72 259 80 255 100C251 80 244 72 229 68C244 64 251 56 255 36Z" />
        <path d="M138 157L185 150V297L138 310C143 285 146 262 146 238C146 212 142 188 138 157Z" />
        <path d="M200 148L247 142V279L200 292Z" />
        <path d="M262 142L309 148V261L262 274Z" />
        <path d="M324 150L373 157C369 184 366 206 366 226C366 236 367 242 368 246L324 256Z" />
        <path d="M138 328L362 262C366 285 372 305 372 325C372 380 310 416 255 434C205 416 142 385 138 328Z" />
      </g>
      <line x1="388.0" y1="362.0" x2="466.0" y2="440.0" stroke={NAVY} strokeWidth={50.0} strokeLinecap="round" />
      <circle cx="388.0" cy="362.0" r="83.0" fill={NAVY} />
      <circle cx="388.0" cy="362.0" r="62.0" fill="none" stroke={LENS} strokeWidth={22.0} />
      <line x1="439.6" y1="413.6" x2="466.0" y2="440.0" stroke={LENS} strokeWidth={30.0} strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <ShieldMark className="h-8 w-auto shrink-0" />
      <span className="flex flex-col leading-none">
        <span className="font-serif text-[18px] tracking-tight text-t1">Equity Lens</span>
        <span className="mt-1 hidden text-[9px] font-semibold uppercase tracking-eyebrow text-gold sm:block">
          Paradiem
        </span>
      </span>
    </span>
  );
}
