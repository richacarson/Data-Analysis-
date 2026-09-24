import type { Config } from 'tailwindcss';

/**
 * Paradiem brand tokens, matching the web system used by the Dashboard
 * (richacarson/Dashboard) rather than the Georgia/Calibri print companion.
 *
 * The brand is flat and square-edged: no rounded corners, gradients or drop
 * shadows anywhere in this file by design.
 */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Surfaces — navy, ascending in elevation.
        bg: '#171738',
        surface: '#1F1F45',
        card: '#252551',
        cardHover: '#2F2F5F',
        elevated: '#38386B',

        // Gold-tinted hairlines, the brand's signature division.
        line: 'rgba(201,168,76,0.12)',
        // Row separators inside a panel, a step quieter than the panel's own edge.
        // (An opacity modifier on an rgba token replaces its alpha, so line/60
        // would render five times stronger than the hairline it is meant to soften.)
        hairline: 'rgba(201,168,76,0.07)',
        lineHover: 'rgba(201,168,76,0.24)',
        lineActive: 'rgba(201,168,76,0.40)',

        // Ink, brightest to most recessive.
        t1: '#FAF7F2',
        t2: '#F4EFE4',
        t3: '#B8B4AC',
        t4: '#8B7355',

        // Aged Gold — the one accent.
        gold: '#C9A84C',
        goldSoft: 'rgba(201,168,76,0.12)',
        goldGlow: 'rgba(201,168,76,0.30)',

        // Status. Reserved for numeric state; never decorative, never a series.
        up: '#34D399',
        dn: '#F87171',
        warn: '#D9A441',

        // Chart series. Validated for the dark navy surface — gold and
        // periwinkle clear CVD separation; a third hue does not, so charts
        // carry at most two series plus a recessive backdrop.
        s1: '#AE8E2F',
        s2: '#5D82D8',
        backdrop: '#38386B',
      },
      fontFamily: {
        sans: ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-plex-mono)', 'ui-monospace', 'monospace'],
        serif: ['Georgia', 'Times New Roman', 'serif'],
      },
      letterSpacing: {
        // The signature letterspaced label from the brand guide.
        label: '0.14em',
        eyebrow: '0.22em',
      },
      borderRadius: {
        none: '0',
      },
    },
  },
  plugins: [],
} satisfies Config;
