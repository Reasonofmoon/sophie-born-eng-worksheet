declare module 'pagedjs' {
  /** Minimal typing for the bits we use — paged.js ships no .d.ts. */
  export class Previewer {
    preview(
      content?: string | Node,
      stylesheets?: Array<string | { url: string }>,
      renderTo?: Element | null,
    ): Promise<{ total: number; pages: unknown[] } & Record<string, unknown>>
  }
}
