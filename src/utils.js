export const EXAM_QUESTION_COUNT = 30

export function qid(q) {
  return q.id || `q${String(q.number || 1).padStart(3, '0')}`
}

export function shuffleArray(arr) {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function imagePath(q) {
  return q.image || q.image_path || q.imageFile || ''
}

export function resolveImageUrl(path) {
  if (!path) return null
  const name = path.split('/').pop()
  return `/image/${name}`
}

export function categoryTitle(categories, cid) {
  const c = (categories || []).find((x) => x.id === cid)
  return c ? c.title : cid
}

export function filterQuestionIndexes(questions, categories, search) {
  const s = search.trim().toLowerCase()
  if (!s) return questions.map((_, i) => i)

  return questions
    .map((q, i) => ({ q, i }))
    .filter(({ q }) => {
      const txt = [
        qid(q),
        q.number,
        q.question || '',
        categoryTitle(categories, q.category_id || ''),
        ...(q.answers || []).map((a) => a.text || ''),
      ]
        .join(' ')
        .toLowerCase()
      return txt.includes(s)
    })
    .map(({ i }) => i)
}
