import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SignalTrace — From interaction to insight",
  description: "Help Nova understand its shopping journey. See what changes when the app works but its analytics do not.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
