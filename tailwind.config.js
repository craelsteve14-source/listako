export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        forest: {
          50: '#f0f5f1',
          100: '#d4e2d7',
          200: '#a8c5af',
          300: '#6b9a74',
          400: '#3d7249',
          500: '#1e5631',
          600: '#173f25',
          700: '#122e1c',
          800: '#0d1f17',
          900: '#081210',
          950: '#040a08',
        },
        gold: {
          50: '#fdf8ed',
          100: '#f9eece',
          200: '#f2dda0',
          300: '#e8c86a',
          400: '#d4af37',
          500: '#c9a84c',
          600: '#a8872a',
          700: '#866a22',
          800: '#6b5520',
          900: '#5a471e',
        },
        ivory: {
          50: '#fefdfb',
          100: '#fdf9f2',
          200: '#f8f5ef',
          300: '#f0ebe0',
          400: '#e5ddd0',
          500: '#d4c9b8',
        },
      },
      fontFamily: {
        playfair: ['"Playfair Display"', 'serif'],
      },
    },
  },
  plugins: [],
}
