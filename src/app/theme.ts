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
});
