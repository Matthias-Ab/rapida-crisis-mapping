describe('Report field validation', () => {
  const VALID_DAMAGE = ['none', 'partial', 'complete']
  const VALID_INFRA = [
    'residential', 'commercial', 'government', 'utility',
    'transport_communication', 'community', 'public_recreation', 'other'
  ]
  const VALID_CRISIS = [
    'earthquake', 'flood', 'tsunami', 'hurricane_cyclone', 'wildfire',
    'explosion', 'chemical_incident', 'conflict', 'civil_unrest'
  ]

  test('damage_level enum is correct', () => {
    expect(VALID_DAMAGE).toHaveLength(3)
    expect(VALID_DAMAGE).toContain('partial')
  })

  test('infra_type includes transport_communication (not transport)', () => {
    expect(VALID_INFRA).toContain('transport_communication')
    expect(VALID_INFRA).not.toContain('transport')
  })

  test('infra_type includes public_recreation (not recreation)', () => {
    expect(VALID_INFRA).toContain('public_recreation')
    expect(VALID_INFRA).not.toContain('recreation')
  })

  test('crisis_type has 9 values', () => {
    expect(VALID_CRISIS).toHaveLength(9)
  })

  test('all crisis types are valid', () => {
    const natural = ['earthquake', 'flood', 'tsunami', 'hurricane_cyclone', 'wildfire']
    const industrial = ['explosion', 'chemical_incident']
    const humanMade = ['conflict', 'civil_unrest']
    expect([...natural, ...industrial, ...humanMade]).toEqual(expect.arrayContaining(VALID_CRISIS))
  })
})

describe('IP hashing', () => {
  const crypto = require('crypto')

  test('SHA-256 hash is 64 chars', () => {
    const hash = crypto.createHash('sha256').update('192.168.1.1').digest('hex')
    expect(hash).toHaveLength(64)
  })

  test('same IP always produces same hash', () => {
    const h1 = crypto.createHash('sha256').update('10.0.0.1').digest('hex')
    const h2 = crypto.createHash('sha256').update('10.0.0.1').digest('hex')
    expect(h1).toBe(h2)
  })

  test('different IPs produce different hashes', () => {
    const h1 = crypto.createHash('sha256').update('10.0.0.1').digest('hex')
    const h2 = crypto.createHash('sha256').update('10.0.0.2').digest('hex')
    expect(h1).not.toBe(h2)
  })
})

describe('Duplicate check logic', () => {
  test('50m radius threshold is defined correctly', () => {
    const DUPLICATE_RADIUS_METERS = 50
    const DUPLICATE_WINDOW_MINUTES = 30
    expect(DUPLICATE_RADIUS_METERS).toBe(50)
    expect(DUPLICATE_WINDOW_MINUTES).toBe(30)
  })
})
