/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        "accent-ink": "#7B1B4C",
        ink: { DEFAULT: "#101828", soft: "#182230", mute: "#475467" },
        plaster: { DEFAULT: "#F8FAFC", deep: "#EAEFF5" },
        weld: { DEFAULT: "#7B1B4C", dark: "#62143C", tint: "#FAEDF4" },
        gulf: { DEFAULT: "#182230", deep: "#101828", tint: "#EAEFF5" },
        sodium: { DEFAULT: "#7B1B4C", tint: "#FAEDF4" },
      },
      fontFamily: {
        display: ['"Manrope"', '"IBM Plex Sans Arabic"', "system-ui", "sans-serif"],
        sans: ['"Manrope"', '"IBM Plex Sans Arabic"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
        arabic: ['"IBM Plex Sans Arabic"', '"Manrope"', "system-ui", "sans-serif"],
      },
      boxShadow: {
        plate: "0 1px 0 0 rgba(18,24,29,.08), 0 12px 32px -12px rgba(18,24,29,.22)",
        lift: "0 24px 48px -16px rgba(18,24,29,.35)",
      },
      keyframes: {
        marquee: { "0%": { transform: "translateX(0)" }, "100%": { transform: "translateX(-50%)" } },
        pulseGlow: { "0%,100%": { opacity: "1" }, "50%": { opacity: ".55" } },
        photoPan: { "0%,100%": { backgroundPosition: "50% 40%" }, "50%": { backgroundPosition: "50% 60%" } },
        sheen: { "0%": { transform: "translateX(-120%) skewX(-18deg)" }, "100%": { transform: "translateX(220%) skewX(-18deg)" } },
        floatY: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-7px)" } },
      },
      animation: {
        marquee: "marquee 28s linear infinite",
        pulseGlow: "pulseGlow 2.4s ease-in-out infinite",
        photoPan: "photoPan 18s ease-in-out infinite",
        sheen: "sheen 0.9s ease-out",
        floatY: "floatY 5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
}

