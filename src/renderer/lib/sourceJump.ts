export interface SourceMatch {
  from: number
  to: number
}

function normalizeQuery(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

function makeWhitespaceCollapsedIndex(text: string) {
  let value = ''
  const map: number[] = []
  let inWhitespace = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (/\s/.test(char)) {
      if (!inWhitespace) {
        value += ' '
        map.push(i)
        inWhitespace = true
      }
      continue
    }

    value += char
    map.push(i)
    inWhitespace = false
  }

  return { value, map }
}

export function findSourceMatch(source: string, selectedText: string): SourceMatch | null {
  const query = normalizeQuery(selectedText)
  if (query.length < 2) return null

  const exactIndex = source.indexOf(query)
  if (exactIndex >= 0) return { from: exactIndex, to: exactIndex + query.length }

  const lowerSource = source.toLocaleLowerCase()
  const lowerQuery = query.toLocaleLowerCase()
  const caseInsensitiveIndex = lowerSource.indexOf(lowerQuery)
  if (caseInsensitiveIndex >= 0) {
    return { from: caseInsensitiveIndex, to: caseInsensitiveIndex + query.length }
  }

  const collapsed = makeWhitespaceCollapsedIndex(source)
  const collapsedIndex = collapsed.value.toLocaleLowerCase().indexOf(lowerQuery)
  if (collapsedIndex < 0) return null

  const from = collapsed.map[collapsedIndex]
  const to = collapsed.map[collapsedIndex + lowerQuery.length - 1] + 1
  return { from, to }
}
