'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SearchResult } from '@/lib/fmp/types';

export function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced lookup, with the in-flight request aborted whenever the query
  // changes so a slow response can't overwrite a newer one.
  useEffect(() => {
    if (query.trim().length < 1) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data)) {
          setResults(data);
          setActive(0);
          setOpen(true);
        }
      } catch {
        // Aborted or offline — leave the previous results in place.
      }
    }, 180);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const go = (symbol: string) => {
    setOpen(false);
    setQuery('');
    router.push(`/stock/${symbol.toUpperCase()}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = results[active];
      // Typing a ticker and pressing enter should work even before results land.
      go(chosen ? chosen.symbol : query);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search ticker or company"
        aria-label="Search for a stock"
        className="w-full border border-line bg-surface px-3 py-2 text-[16px] text-t1 outline-none placeholder:text-t3 focus:border-lineActive sm:py-1.5 sm:text-[13px]"
      />
      {open && results.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-40 mt-1 max-h-80 overflow-auto border border-line bg-card py-1 shadow-xl">
          {results.map((r, i) => (
            <li key={`${r.symbol}-${i}`}>
              <button
                onClick={() => go(r.symbol)}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-[13px] sm:py-1.5 ${
                  i === active ? 'bg-gold/[0.15]' : ''
                }`}
              >
                <span className="font-semibold text-t1">{r.symbol}</span>
                <span className="truncate text-[12px] text-t3">{r.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
