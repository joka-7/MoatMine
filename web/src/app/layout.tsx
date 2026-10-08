import type { Metadata } from "next";
import AuthShell from "@/components/AuthShell";
import Nav from "@/components/Nav";
import "modeldispatcher-react-ui/styles.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "MoatMine",
  description: "MoatMine: dig for companies that can't be knocked down. Graded safety scores, your own risk rules, stress tests and an AI analyst.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthShell>
          <div className="shell">
            <Nav />
            <main>{children}</main>
          </div>
        </AuthShell>
      </body>
    </html>
  );
}
