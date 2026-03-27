import type { Metadata } from "next";
import { Providers } from "@/providers";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "Garden Club",
  description: "Community garden club web application",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
