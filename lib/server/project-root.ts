import path from 'path';

/**
 * Raíz del proyecto sin que Turbopack/NFT tracee TODO el monorepo.
 * Usar en APIs que leen/escriben disco (admin QA).
 * @see https://nextjs.org/docs/app/api-reference/config/next-config-js/output
 */
export function projectRoot(): string {
  return path.join(/* turbopackIgnore: true */ process.cwd());
}

/** path.join(projectRoot(), ...segments) — scope estático a subcarpetas conocidas */
export function projectPath(...segments: string[]): string {
  return path.join(/* turbopackIgnore: true */ process.cwd(), ...segments);
}
