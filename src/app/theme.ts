import { definePreset } from '@primeng/themes';
import Aura from '@primeng/themes/aura';

// Hivemind palette: primary is the brand honey-amber (#E8920C / #FBB040).
export const HivemindPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#FDF6E9',
      100: '#FBEAC6',
      200: '#F7D78C',
      300: '#F3C152',
      400: '#EFAA2A',
      500: '#E8920C',
      600: '#C8790A',
      700: '#A06109',
      800: '#7E4D0B',
      900: '#68400C',
      950: '#3B2406',
    },
    colorScheme: {
      light: {
        // Dark text on the amber buttons keeps contrast high and reads
        // intentionally "honey".
        primary: {
          color: '{primary.500}',
          contrastColor: '#3B2406',
          hoverColor: '{primary.600}',
          activeColor: '{primary.700}',
        },
        surface: {
          0: '#ffffff',
          50: '#f4f5fa',
          100: '#eceef4',
          200: '#e2e4ea',
          300: '#cdd0da',
          400: '#9da3b4',
          500: '#6c7392',
          600: '#4d5375',
          700: '#3a3f5c',
          800: '#262a40',
          900: '#1b1c21',
          950: '#111218',
        },
      },
    },
  },
  components: {
    button: {
      // AWS-console feel: squared corners, bold labels, crisp tiers.
      root: {
        borderRadius: '2px',
        paddingX: '0.95rem',
        paddingY: '0.55rem',
        label: { fontWeight: '600' },
      },
      colorScheme: {
        light: {
          root: {
            // "Normal" button (severity="secondary"): white with a defined
            // border and dark text — clearly distinct from the solid amber
            // primary, instead of the washed grey default.
            secondary: {
              background: '{surface.0}',
              hoverBackground: '{surface.100}',
              activeBackground: '{surface.200}',
              borderColor: '{surface.300}',
              hoverBorderColor: '{surface.400}',
              activeBorderColor: '{surface.400}',
              color: '{surface.700}',
              hoverColor: '{surface.800}',
              activeColor: '{surface.800}',
            },
          },
        },
      },
    },
    tabs: {
      // Compact, flush tab strip on the page background (no white band). Panel
      // padding is dropped only for table panels via :has() CSS (keeps form
      // panels padded).
      tablist: { background: 'transparent' },
      tab: { padding: '0.55rem 0.9rem' },
    },
    tag: {
      // Cloud-console badges: small, medium weight, soft tinted pill.
      root: {
        fontSize: '0.6875rem', // 11px
        fontWeight: '600',
        padding: '0.1rem 0.5rem',
        borderRadius: '1rem', // pill
      },
      colorScheme: {
        light: {
          secondary: { background: '#eceef2', color: '#4d5375' },
          success: { background: '#e7f6ec', color: '#1a7f4b' },
          info: { background: '#e6f0fb', color: '#0b62c4' },
          warn: { background: '#fdf2e3', color: '#946708' },
          danger: { background: '#fdeceb', color: '#c0392b' },
        },
      },
    },
  },
});
