import type { Config } from 'tailwindcss';

/**
 * Paradiem brand tokens. Values live in CSS variables (src/app/globals.css) so
 * the same class names serve the dark theme and the light 4a "Hairline" theme.
 * Solid colours are stored as RGB channels so opacity modifiers (bg-dn/10,
 * bg-gold/[0.15], bg-bg/95) keep working.
 *
 * Flat and square-edged: no rounded corners, gradients or drop shadows.
 */
const ch = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: ch('bg'),
        surface: ch('surface'),
        card: ch('card'),
        cardHover: ch('card-hover'),
        elevated: ch('elevated'),

        line: 'var(--line)',
        hairline: 'var(--hairline)',
        lineHover: 'var(--line-hover)',
        lineActive: 'var(--line-active)',
        // The strong 1px rule above each hero figure in 4a.
        rule: ch('rule'),

        t1: ch('t1'),
        t2: ch('t2'),
        t3: ch('t3'),
        t4: ch('t4'),

        gold: ch('gold'),
        // Gold used as text. On parchment the true gold fails contrast, so the
        // light theme swaps in Warm Taupe here; rules and fills keep real gold.
        goldInk: ch('gold-ink'),
        goldSoft: 'var(--gold-soft)',
        goldGlow: 'var(--gold-glow)',

        // Text on a gold fill: always Navy, whatever the theme.
        onGold: '#171738',

        up: ch('up'),
        dn: ch('dn'),
        warn: ch('warn'),

        s1: ch('s1'),
        s2: ch('s2'),
        backdrop: ch('elevated'),
      },
      fontFamily: {
        sans: ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-plex-mono)', 'ui-monospace', 'monospace'],
        serif: ['Georgia', 'Times New Roman', 'serif'],
      },
      letterSpacing: {
        label: '0.14em',
        eyebrow: '0.22em',
        hero: '-0.04em',
      },
      borderRadius: {
        none: '0',
      },
    },
  },
  plugins: [],
} satisfies Config;
