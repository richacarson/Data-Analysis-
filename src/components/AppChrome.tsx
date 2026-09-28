'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SearchBar } from './SearchBar';
import { UserMenu } from './UserMenu';
import { Wordmark } from './Logo';
import { ThemeToggle } from './ThemeToggle';

function isAuthPage(pathname: string) {
  return pathname === '/login' || pathname.startsWith('/auth');
}

const NAV = [
  { href: '/', label: 'Sleeves', match: (p: string) => p === '/' || p.startsWith('/stock') },
  { href: '/screen', label: 'Screen', match: (p: string) => p.startsWith('/screen') },
  { href: '/account', label: 'Account', match: (p: string) => p.startsWith('/account') },
];

/**
 * 4a Hairline header: no bottom border or filled bar — logo, plain text nav,
 * and an underlined search field. Sits on the page colour in both themes.
 */
export function AppHeader() {
  const pathname = usePathname() ?? '/';
  const auth = isAuthPage(pathname);

  return (
    <header className="sticky top-0 z-30 bg-bg/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-4 py-3 sm:gap-10 sm:px-14 sm:py-[22px]">
        <Link href="/" className="shrink-0" aria-label="Home">
          <Wordmark />
        </Link>
        {!auth && (
          <>
            <nav className="hidden shrink-0 items-center gap-7 md:flex" aria-label="Main">
              {NAV.slice(0, 2).map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-[14px] font-medium transition-colors hover:text-t1 ${
                    item.match(pathname) ? 'text-t1' : 'text-t3'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto min-w-0 flex-1 md:max-w-[300px]">
              <SearchBar />
            </div>
            <div className="hidden items-center gap-6 md:flex">
              <ThemeToggle />
              <UserMenu />
            </div>
          </>
        )}
      </div>
    </header>
  );
}

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
              className={`relative flex h-14 items-center justify-center text-[12px] font-semibold ${
                active ? 'text-t1' : 'text-t3'
              }`}
            >
              {active && <span className="absolute inset-x-6 top-0 h-[3px] bg-gold" aria-hidden />}
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
