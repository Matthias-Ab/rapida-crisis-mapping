import { describe, it, expect, beforeEach } from 'vitest'

// Test the badge milestone logic in isolation (no React needed)
const BADGE_MILESTONES = [
  { count: 1,  id: 'first_responder', icon: '🌱', name: 'First Responder' },
  { count: 5,  id: 'mapper',          icon: '🗺️', name: 'Mapper' },
  { count: 10, id: 'field_scout',     icon: '🔍', name: 'Field Scout' },
  { count: 25, id: 'correspondent',   icon: '🏅', name: 'Crisis Correspondent' },
  { count: 50, id: 'guardian',        icon: '🌍', name: 'Community Guardian' },
]

function checkBadge(submissionCount, existingBadges) {
  return BADGE_MILESTONES.find(
    b => b.count === submissionCount && !existingBadges.find(e => e.id === b.id)
  ) || null
}

describe('Badge milestone logic', () => {
  it('awards First Responder on 1st submission', () => {
    const badge = checkBadge(1, [])
    expect(badge?.id).toBe('first_responder')
  })

  it('awards Mapper on 5th submission', () => {
    const existing = [{ id: 'first_responder' }]
    const badge = checkBadge(5, existing)
    expect(badge?.id).toBe('mapper')
  })

  it('does not re-award an already earned badge', () => {
    const existing = [{ id: 'first_responder' }]
    const badge = checkBadge(1, existing)
    expect(badge).toBeNull()
  })

  it('returns null for non-milestone counts', () => {
    const badge = checkBadge(3, [])
    expect(badge).toBeNull()
  })

  it('has 5 milestones total', () => {
    expect(BADGE_MILESTONES).toHaveLength(5)
  })
})

describe('Damage levels', () => {
  const DAMAGE_LEVELS = ['none', 'partial', 'complete']

  it('has exactly 3 damage levels', () => {
    expect(DAMAGE_LEVELS).toHaveLength(3)
  })

  it('partial is the default fallback level', () => {
    const fallback = DAMAGE_LEVELS[1]
    expect(fallback).toBe('partial')
  })
})

describe('timeAgo utility', () => {
  function timeAgo(dateStr) {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return dateStr
    const diffMs = Date.now() - date.getTime()
    const diffSec = Math.floor(diffMs / 1000)
    if (diffSec < 60) return 'just now'
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return diffMin + ' minute' + (diffMin !== 1 ? 's' : '') + ' ago'
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return diffHr + ' hour' + (diffHr !== 1 ? 's' : '') + ' ago'
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  it('returns just now for very recent dates', () => {
    const recent = new Date(Date.now() - 10000).toISOString()
    expect(timeAgo(recent)).toBe('just now')
  })

  it('returns minutes ago for dates within an hour', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    expect(timeAgo(fiveMinAgo)).toBe('5 minutes ago')
  })

  it('returns singular minute correctly', () => {
    const oneMinAgo = new Date(Date.now() - 65 * 1000).toISOString()
    expect(timeAgo(oneMinAgo)).toBe('1 minute ago')
  })

  it('returns empty string for null', () => {
    expect(timeAgo(null)).toBe('')
  })
})
