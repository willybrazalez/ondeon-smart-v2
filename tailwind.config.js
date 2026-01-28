/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './app/**/*.{js,jsx}',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        'ondeon-green': '#A2D9F7',
      },
      borderRadius: {
        lg: "var(--radius-lg)",
        md: "var(--radius)",
        sm: "var(--radius-sm)",
      },
      fontFamily: {
        sans: ['Quicksand', 'sans-serif'],
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
        "clean-float": {
          "0%, 100%": { transform: "translateY(0px)", textShadow: "0 2px 4px hsla(var(--primary-rgb), 0.1)" },
          "50%": { transform: "translateY(-3px)", textShadow: "0 4px 8px hsla(var(--primary-rgb), 0.15)" },
        },
        "clean-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 hsla(var(--primary-rgb), 0.1)" },
          "50%": { boxShadow: "0 0 0 8px hsla(var(--primary-rgb), 0.0)" },
        },
        "marquee": {
          "0%": { transform: "translateX(0%)" },
          "100%": { transform: "translateX(-50%)" }
        },
        "float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" }
        },
        "progress": {
          "0%": { transform: "translateX(-100%)" },
          "50%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(-100%)" }
        }
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "clean-float": "clean-float 4s ease-in-out infinite",
        "clean-pulse": "clean-pulse 2.5s infinite cubic-bezier(0.66, 0, 0, 1)",
        "marquee-slow": "marquee 20s linear infinite",
      },
      boxShadow: {
        'clean-main': '0 5px 15px rgba(var(--tw-color-foreground-rgb), 0.05), 0 2px 5px rgba(var(--tw-color-foreground-rgb), 0.03)',
        'clean-hover': '0 8px 25px rgba(var(--tw-color-primary-rgb), 0.08), 0 4px 10px rgba(var(--tw-color-secondary-rgb), 0.04)',
      }
    },
  },
  plugins: [require("tailwindcss-animate")],
}