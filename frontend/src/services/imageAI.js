let pipeline = null
let loadError = false
let loadAttempted = false

export async function classifyDamage(imageFile) {
  if (loadError) return null
  if (loadAttempted && !pipeline) return null

  try {
    if (!pipeline) {
      loadAttempted = true
      const { pipeline: createPipeline } = await import('@xenova/transformers')
      pipeline = await createPipeline(
        'image-classification',
        'Xenova/vit-base-patch16-224',
        { quantized: true }
      )
    }

    const imageUrl = URL.createObjectURL(imageFile)
    const results = await pipeline(imageUrl, { topk: 5 })
    URL.revokeObjectURL(imageUrl)

    if (!results || results.length === 0) return null

    const topLabel = results[0]?.label?.toLowerCase() || ''
    const score = results[0]?.score || 0

    // Heuristic mapping — a real deployment would use a fine-tuned damage-assessment model
    let damageLevel = 'partial'
    let confidence = score

    const destructionKeywords = ['ruin', 'wreck', 'debris', 'rubble', 'collapse', 'destruction', 'rubble']
    const intactKeywords = ['intact', 'house', 'home', 'office', 'building', 'store', 'church', 'mosque']

    if (destructionKeywords.some((kw) => topLabel.includes(kw))) {
      damageLevel = 'complete'
    } else if (intactKeywords.some((kw) => topLabel.includes(kw)) && score > 0.7) {
      damageLevel = 'none'
    }

    return {
      damageLevel,
      confidence: Math.round(confidence * 100),
      topLabel: results[0]?.label || ''
    }
  } catch {
    loadError = true
    return null
  }
}

export function isAIAvailable() {
  return !loadError
}
