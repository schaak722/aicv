import "./globals.css";

export const metadata = {
  title: process.env.APP_NAME ?? "Applicant Screening",
  description: "Applicant Screening System"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
