import { supabase } from './supabase.js'

// A 12-megapixel photo over a supermarket's cell signal will not finish
// uploading, and Dad will decide the app is stuck. Downscale in the browser
// first — 800px is plenty to recognise a product on a phone.
const MAX_EDGE = 800
const QUALITY = 0.72

export function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('resize failed'))),
        'image/jpeg',
        QUALITY,
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('could not read image'))
    }
    img.src = url
  })
}

export async function uploadImage(file, householdId, prefix = 'item') {
  const blob = await resizeImage(file)
  const path = `${householdId}/${prefix}-${Date.now()}.jpg`
  const { error } = await supabase.storage
    .from('photos')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false })
  if (error) throw error
  const { data } = supabase.storage.from('photos').getPublicUrl(path)
  return data.publicUrl
}
