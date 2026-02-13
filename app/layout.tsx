import "./globals.css";

export const metadata = {
  title: process.env.APP_NAME ?? "Applicant Screening",
  description: "Applicant Screening System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Theme switch (reversible without code changes):
  // - Default: dark (current look)
  // - Set APP_THEME=blush in Koyeb to enable Blush theme
  const theme = process.env.APP_THEME ?? "dark";

  return (
    <html lang="en" data-theme={theme}>
      <body>{children}</body>
    </html>
  );
}
