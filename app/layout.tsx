import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RoomPilot Agent",
  description: "An AI agent for proof-backed product demo memory.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
