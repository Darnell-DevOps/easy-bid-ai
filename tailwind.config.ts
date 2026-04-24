import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
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
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        purple: {
          DEFAULT: "hsl(var(--purple))",
          foreground: "hsl(var(--purple-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        "shimmer": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "page-in": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "progress-indeterminate": {
          "0%": { transform: "translateX(-100%) scaleX(0.4)" },
          "50%": { transform: "translateX(20%) scaleX(0.6)" },
          "100%": { transform: "translateX(120%) scaleX(0.4)" },
        },
        "hero-glow": {
          "0%, 100%": { transform: "translate(-50%, -50%) scale(1)", opacity: "0.55" },
          "50%": { transform: "translate(-48%, -52%) scale(1.08)", opacity: "0.75" },
        },
        "flow-pulse": {
          "0%, 100%": { transform: "scale(1)", boxShadow: "0 0 0 0 hsl(var(--accent) / 0)" },
          "50%": { transform: "scale(1.06)", boxShadow: "0 0 28px 4px hsl(var(--accent) / 0.45)" },
        },
        "sticky-cta-in": {
          "0%": { opacity: "0", transform: "translateY(120%)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "float-slow": {
          "0%, 100%": { transform: "translateY(0px) rotate(var(--tw-rotate, 0deg))" },
          "50%": { transform: "translateY(-14px) rotate(var(--tw-rotate, 0deg))" },
        },
        "float-slower": {
          "0%, 100%": { transform: "translateY(0px) rotate(var(--tw-rotate, 0deg))" },
          "50%": { transform: "translateY(10px) rotate(var(--tw-rotate, 0deg))" },
        },
        "gradient-shift": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        "hero-fade-up": {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "hero-card-glow": {
          "0%, 22%, 100%": {
            boxShadow: "0 10px 30px -10px hsl(var(--accent) / 0.10)",
            borderColor: "hsl(var(--border) / 0.6)",
            filter: "brightness(1)",
          },
          "8%, 14%": {
            boxShadow: "0 0 0 1px hsl(var(--accent) / 0.45), 0 18px 60px -10px hsl(var(--accent) / 0.55), 0 0 80px -10px hsl(var(--purple) / 0.45)",
            borderColor: "hsl(var(--accent) / 0.55)",
            filter: "brightness(1.06)",
          },
        },
        "flow-hint": {
          "0%, 100%": { opacity: "0.15", transform: "translateY(-30%) scaleY(0.6)" },
          "50%": { opacity: "0.55", transform: "translateY(30%) scaleY(1)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "shimmer": "shimmer 2s ease-in-out infinite",
        "page-in": "page-in 0.35s cubic-bezier(0.22, 1, 0.36, 1)",
        "progress-indeterminate": "progress-indeterminate 1.1s ease-in-out infinite",
        "hero-glow": "hero-glow 9s ease-in-out infinite",
        "flow-pulse": "flow-pulse 1.6s ease-in-out infinite",
        "sticky-cta-in": "sticky-cta-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) both",
        "float-slow": "float-slow 7s ease-in-out infinite",
        "float-slower": "float-slower 9s ease-in-out infinite",
        "gradient-shift": "gradient-shift 14s ease infinite",
        "hero-fade-up": "hero-fade-up 0.9s cubic-bezier(0.16, 1, 0.3, 1) both",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
