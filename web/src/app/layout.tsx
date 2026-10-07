import type { Metadata } from "next";
import Nav from "@/components/Nav";
import "modeldispatcher-react-ui/styles.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Moatrics",
  description: "Moatrics: know how safe your investments are. Graded safety scores, your own risk rules, stress tests and an AI analyst.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <Nav />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
