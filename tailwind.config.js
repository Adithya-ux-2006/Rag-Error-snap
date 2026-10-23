/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'hsl(240 4% 96%)',
        foreground: 'hsl(20 10% 12%)',
        card: 'hsl(0 0% 100%)',
        'card-foreground': 'hsl(20 10% 12%)',
        primary: 'hsl(214 76% 43%)',
        'primary-foreground': 'hsl(0 0% 100%)',
        secondary: 'hsl(240 4% 95%)',
        'secondary-foreground': 'hsl(20 10% 12%)',
        muted: 'hsl(240 4% 95%)',
        'muted-foreground': 'hsl(210 8% 42%)',
        accent: 'hsl(240 4% 95%)',
        'accent-foreground': 'hsl(20 10% 12%)',
        destructive: 'hsl(0 70% 54%)',
        'destructive-foreground': 'hsl(0 0% 100%)',
        border: 'hsl(210 8% 83%)',
        input: 'hsl(210 8% 83%)',
        ring: 'hsl(214 76% 43%)',
      },
      borderRadius: {
        sm: '6px',
        md: '8px',
      },
    },
  },
  plugins: [],
}