// Metro resolves './sessions' to sessions.ts; bare Node does not. The self-check
// runs the real modules through Node's type stripping, so it registers this hook
// to add the extension back. App code keeps the import style Metro expects.
export async function resolve(specifier, context, next) {
  if (specifier.startsWith('.') && !/\.[cm]?[jt]sx?$/.test(specifier)) {
    try {
      return await next(`${specifier}.ts`, context);
    } catch {
      // fall through to the normal resolution and let Node report it
    }
  }
  return next(specifier, context);
}
