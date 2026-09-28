import type { Metadata } from "next";
import Link from "next/link";
import { ExperienceProvider } from "./experience-provider";
import { Icon } from "../components/icon";
import "./globals.css";

export const metadata: Metadata = {
  title: "SignalTrace — From interaction to insight",
  description: "Help Nova understand its shopping journey. See what changes when the app works but its analytics do not.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><ExperienceProvider><main>
    <header className="site-header"><Link className="wordmark" href="/" aria-label="SignalTrace home"><span className="brand-icon"><Icon name="trace" /></span>SignalTrace</Link><div className="header-note"><span>An interactive product exercise</span><span className="version">MVP 01</span></div></header>
    {children}
  </main></ExperienceProvider></body></html>;
}
