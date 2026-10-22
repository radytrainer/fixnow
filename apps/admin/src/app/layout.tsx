import type { Metadata } from "next";
import { Noto_Sans_Khmer, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AdminI18nProvider } from "@/lib/i18n";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });
const khmer = Noto_Sans_Khmer({ variable: "--font-khmer", subsets: ["khmer"] });

export const metadata: Metadata = {
  title: "FixNow Admin",
  description: "FixNow operations dashboard: technicians, bookings, payments and payouts.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${jakarta.variable} ${khmer.variable} h-full antialiased`}>
      <body className="min-h-full"><AdminI18nProvider>{children}</AdminI18nProvider></body>
    </html>
  );
}
