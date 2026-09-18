/**
 * Node/tsc compatibility surface for the Supabase Edge runtime.
 *
 * Production Edge imports remain pinned to JSR and Deno. This declaration only
 * teaches the repository-wide TypeScript qualification how those exact runtime
 * imports and globals are typed; it does not replace or weaken Edge validation.
 */
declare module "jsr:@supabase/functions-js@2.4.4/edge-runtime.d.ts" {}

declare module "jsr:@supabase/supabase-js@2.108.1" {
  export const createClient: typeof import("@supabase/supabase-js").createClient;
}

declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};
