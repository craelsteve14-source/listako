export default {
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
          600: '#0A2818',
          700: '#0A2818',
          800: '#0A2818',
          900: '#060F09',
          950: '#040a08',
        },
        gold: {
          50: '#F7F0DC',
          100: '#F7F0DC',
          200: '#E8D5A3',
          300: '#D4AA14',
          400: '#B8960C',
          500: '#B8960C',
          600: '#7A6010',
          700: '#7A6010',
          800: '#6b5520',
          900: '#5a471e',
        },
        ivory: {
          50: '#FFFFFF',
          100: '#F5F0E8',
          200: '#EDE8DE',
          300: '#DDD8CE',
          400: '#DDD8CE',
          500: '#DDD8CE',
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
        lato: ['"Lato"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
