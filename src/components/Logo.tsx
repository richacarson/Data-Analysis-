/**
 * The Paradiem shield, traced from the brand mark: gold bars over a cream
 * base, which reads on the navy surfaces where the print mark's navy base
 * would disappear.
 */
export function ShieldMark({ className = 'h-6 w-auto' }: { className?: string }) {
  return (
    <svg viewBox="128 30 256 410" className={className} aria-hidden focusable="false">
      <g fill="#C9A84C">
        <path d="M255 36C259 56 266 64 281 68C266 72 259 80 255 100C251 80 244 72 229 68C244 64 251 56 255 36Z" />
        <path d="M138 157L185 150V297L138 310C143 285 146 262 146 238C146 212 142 188 138 157Z" />
        <path d="M200 148L247 142V279L200 292Z" />
        <path d="M262 142L309 148V261L262 274Z" />
        <path d="M324 150L373 157C369 184 366 206 366 226C366 236 367 242 368 246L324 256Z" />
      </g>
      <path
        fill="#F4EFE4"
        d="M138 328L362 262C366 285 372 305 372 325C372 380 310 416 255 434C205 416 142 385 138 328Z"
      />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <ShieldMark className="h-7 w-auto shrink-0" />
      <span className="flex flex-col leading-none">
        <span className="font-serif text-[18px] tracking-tight text-t1">Equity Lens</span>
        <span className="mt-1 hidden text-[9px] font-semibold uppercase tracking-eyebrow text-gold sm:block">
          Paradiem
        </span>
      </span>
    </span>
  );
}
