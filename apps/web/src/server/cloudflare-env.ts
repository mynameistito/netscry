/**
 * Load Cloudflare bindings from the active request's Worker context.
 * @returns The current request's native Worker environment.
 */
export const getCloudflareEnv = async () => {
  const worker = await import("cloudflare:workers");

  return worker.env;
};
