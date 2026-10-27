import { Barlow_Condensed, Inter } from "next/font/google";

/** Fonts of the printable documents (week overview, training sheets). */
export const displayFont = Barlow_Condensed({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-display" });
export const bodyFont = Inter({ subsets: ["latin"], variable: "--font-body" });

export const documentFonts = `${displayFont.variable} ${bodyFont.variable}`;
