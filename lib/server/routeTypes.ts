// Shared types for Next.js App Router route handlers (Next 16+)
// Dynamic route params are provided as a Promise in Next 16 types.
export type RouteContext<P extends Record<string, string>> = {
  params: Promise<P>;
};
