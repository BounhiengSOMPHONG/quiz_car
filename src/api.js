async function request(url, options) {
  const res = await fetch(url, options)
  let json = null
  try {
    json = await res.json()
  } catch {
    json = null
  }
  if (!res.ok) {
    throw new Error((json && json.error) || `ขอข้อมูลไม่สำเร็จ (${res.status})`)
  }
  return json
}

export function fetchQuestions() {
  return request('/api/questions')
}

// image: { dataUrl } -> อัปโหลดรูปใหม่; null -> ลบรูป; undefined -> คงรูปเดิม
export function saveQuestion(id, question, image) {
  return request(`/api/questions/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, image }),
  })
}

export function addQuestion(question, image) {
  return request('/api/questions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, image }),
  })
}
