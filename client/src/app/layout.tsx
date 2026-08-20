import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { Toaster } from "@/components/ui/Toaster";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "PropGuard AI",
  description: "Property Transaction Intelligence and Verification Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} h-full scroll-smooth antialiased`}
    >
      <body
        className={`${poppins.className} font-sans flex h-full min-h-full flex-col bg-background text-text-primary`}
      >
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
