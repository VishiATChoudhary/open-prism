/** Convert Windows separators to `/`, collapse duplicates and strip trailing separators. */
export function normalizeSeparators(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/+$/, '')
}

/** Return `path` relative to `dir`, or the normalized path when it is outside. */
export function relativeToProject(dir: string, path: string): string {
  const root = normalizeSeparators(dir)
  const target = normalizeSeparators(path)
  if (!root) return target
  if (target === root) return ''
  return target.startsWith(`${root}/`) ? target.slice(root.length + 1) : target
}

/** True when `child` is `parent` itself or lives underneath it. */
export function isSameOrInside(parent: string, child: string): boolean {
  const root = normalizeSeparators(parent)
  const target = normalizeSeparators(child)
  return target === root || target.startsWith(`${root}/`)
}

/** Join a directory and a file name using the directory's native separator. */
export function joinDisplayPath(dir: string, name: string): string {
  const separator = dir.includes('\\') ? '\\' : '/'
  const base = dir.replace(/[\\/]+$/, '')
  return base ? `${base}${separator}${name}` : name
}
