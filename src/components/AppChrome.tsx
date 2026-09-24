'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SearchBar } from './SearchBar';
import { UserMenu } from './UserMenu';
import { Wordmark } from './Logo';

/** Sign-in pages get the mark alone: nothing behind the gate is reachable yet. */
function isAuthPage(pathname: string) {
  return pathname === '/login' || pathname.startsWith('/auth');
}

const NAV = [
  { href: '/', label: 'Sleeves', match: (p: string) => p === '/' },
  { href: '/screen', label: 'Screen', match: (p: string) => p.startsWith('/screen') },
  { href: '/account', label: 'Account', match: (p: string) => p.startsWith('/account') },
];

export function AppHeader() {
  const pathname = usePathname() ?? '/';
  const auth = isAuthPage(pathname);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-3 py-2.5 sm:gap-6 sm:px-5 sm:py-3">
        <Link href="/" className="shrink-0" aria-label="Home">
          <Wordmark />
        </Link>
        {!auth && (
          <>
            <nav className="hidden shrink-0 items-center gap-5 md:flex" aria-label="Main">
              {NAV.slice(0, 2).map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-[12px] font-medium transition-colors hover:text-gold ${
                    item.match(pathname) ? 'text-gold' : 'text-t3'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto min-w-0 flex-1 md:max-w-md">
              <SearchBar />
            </div>
            <div className="hidden md:block">
              <UserMenu />
            </div>
          </>
        )}
      </div>
    </header>
  );
}

/** Thumb-reach navigation on phones, where the header has no room for links. */
export function MobileTabBar() {
  const pathname = usePathname() ?? '/';
  if (isAuthPage(pathname)) return null;

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <div className="grid grid-cols-3">
        {NAV.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`relative flex h-14 items-center justify-center text-[11px] font-semibold uppercase tracking-label ${
                active ? 'text-gold' : 'text-t3'
              }`}
            >
              {active && <span className="absolute inset-x-6 top-0 h-0.5 bg-gold" aria-hidden />}
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
