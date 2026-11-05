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

/**
 * Join a directory and a relative path using the directory's native separator.
 * The relative path's separators are normalized to match the directory, so a
 * nested entry such as `sub/main.tex` becomes `sub\main.tex` on Windows.
 */
export function joinDisplayPath(dir: string, name: string): string {
  const separator = dir.includes('\\') ? '\\' : '/'
  const base = dir.replace(/[\\/]+$/, '')
  const relative = separator === '\\' ? name.replace(/[\\/]+/g, '\\') : name
  return base ? `${base}${separator}${relative}` : relative
}

/**
 * Rewrite `path` when `oldPath` is renamed or moved to `newPath`.
 * Exact matches map to `newPath`; descendants keep their relative suffix and
 * adopt `newPath`'s native separator. Unrelated paths (including siblings that
 * merely share a prefix) are returned unchanged.
 */
export function movePath(path: string, oldPath: string, newPath: string): string {
  if (!isSameOrInside(oldPath, path)) return path
  const target = normalizeSeparators(oldPath)
  const normalized = normalizeSeparators(path)
  if (normalized === target) return newPath
  const suffix = normalized.slice(target.length + 1)
  return joinDisplayPath(newPath, suffix.replace(/\//g, newPath.includes('\\') ? '\\' : '/'))
}
