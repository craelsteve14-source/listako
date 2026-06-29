export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        forest: {
          50: '#E8F0EB',
          100: '#C8DDD0',
          200: '#a8c5af',
          300: '#6b9a74',
          400: '#2C5F3F',
          500: '#1A3D2B',
          600: '#1D3A2A',
          700: '#0F2620',
          800: '#0A1B1E',
          900: '#060F09',
          950: '#040a08',
        },
        gold: {
          50: '#FBF6E5',
          100: '#F7F0DC',
          200: '#E8D5A3',
          300: '#D6C35A',
          400: '#B9960C',
          500: '#B9960C',
          600: '#7A6010',
          700: '#7A6010',
          800: '#6b5520',
          900: '#5a471e',
        },
        ivory: {
          50: '#FFFFFF',
          100: '#F7F5E8',
          200: '#EDE8DE',
          300: '#E5E0D5',
          400: '#DDD8CE',
          500: '#CCC7BD',
        },
        surface: {
          light: '#F7F5E8',
          card: '#FFFFFF',
          dark: '#0A1B1E',
          'dark-card': '#1A3428',
          'dark-elevated': '#22412F',
        },
        navy: {
          700: '#0D1B2A',
          800: '#1B2D45',
        },
        deepred: {
          500: '#7A1515',
          100: '#F0E8E8',
          200: '#E0C8C8',
        },
      },
      fontFamily: {
        playfair: ['"Playfair Display"', 'serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        lato: ['"Lato"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
