import { describe, it, expect } from 'vitest'
import {
  GYNOCCI_CLINICS,
  findClinicByCity,
  formatClinicCard,
  formatAllClinicsList,
  formatNoClinicCityMessage,
  findNearbyClinic,
} from './clinics'

describe('clinics directory and formatting', () => {
  it('contains exactly 9 physical clinic locations with valid Google Maps URLs', () => {
    const keys = Object.keys(GYNOCCI_CLINICS)
    expect(keys).toHaveLength(9)

    for (const key of keys) {
      const clinic = GYNOCCI_CLINICS[key]
      expect(clinic.googleMapsUrl).toMatch(/^https:\/\/maps\.google\.com\/\?q=Gynocci\+/)
      expect(clinic.helpline).toBe('+91 8450000845')
      expect(clinic.timings).toContain('10:00')
      expect(clinic.timings).toContain('6:30')
    }
  })

  it('correctly finds clinics by english name, hindi name, or aliases', () => {
    expect(findClinicByCity('jaipur')?.city).toBe('Jaipur')
    expect(findClinicByCity('जयपुर')?.city).toBe('Jaipur')
    expect(findClinicByCity('Delhi')?.city).toBe('Delhi')
    expect(findClinicByCity('New Delhi')?.city).toBe('Delhi')
    expect(findClinicByCity('नई दिल्ली')?.city).toBe('Delhi')
    expect(findClinicByCity('Rajouri Garden')?.city).toBe('Delhi')
    expect(findClinicByCity('Lucknow')?.city).toBe('Lucknow')
    expect(findClinicByCity('Amritsar')?.city).toBe('Amritsar')
    expect(findClinicByCity('Ludhiana')?.city).toBe('Ludhiana')
    expect(findClinicByCity('Patna')?.city).toBe('Patna')
    expect(findClinicByCity('Ranchi')?.city).toBe('Ranchi')
    expect(findClinicByCity('Hisar')?.city).toBe('Hisar')
    expect(findClinicByCity('Rewari')?.city).toBe('Rewari')
    expect(findClinicByCity('Surat')).toBeNull()
  })

  it('formats clinic card with exact verified Google Maps URL in Hindi and English', () => {
    const jaipurCardHindi = formatClinicCard('Jaipur', false)
    expect(jaipurCardHindi).toContain('Gynocci Clinic - जयपुर (Head Office)')
    expect(jaipurCardHindi).toContain('45, हनुमान वाटिका, चित्रकूट मार्ग')
    expect(jaipurCardHindi).toContain('https://maps.google.com/?q=Gynocci+Tagore+Nagar+Vaishali+Nagar+Jaipur')
    expect(jaipurCardHindi).toContain('+91 8450000845')

    const delhiCardEng = formatClinicCard('Delhi', true)
    expect(delhiCardEng).toContain('Delhi Clinic')
    expect(delhiCardEng).toContain('https://maps.google.com/?q=Gynocci+Rajouri+Garden+New+Delhi')
  })

  it('formats no-clinic message for non-clinic cities correctly', () => {
    const suratMsg = formatNoClinicCityMessage('Surat', false)
    expect(suratMsg).toContain('Surat')
    expect(suratMsg).toContain('45 मिनट का विस्तृत')
    expect(suratMsg).toContain('ऑनलाइन वीडियो कंसल्टेशन')
  })

  it('correctly detects nearby clinics for surrounding cities', () => {
    const noidaMatch = findNearbyClinic('Noida')
    expect(noidaMatch?.clinic.city).toBe('Delhi')
    expect(noidaMatch?.isExactCity).toBe(false)

    const ajmerMatch = findNearbyClinic('Ajmer')
    expect(ajmerMatch?.clinic.city).toBe('Jaipur')

    const kanpurMatch = findNearbyClinic('Kanpur')
    expect(kanpurMatch?.clinic.city).toBe('Lucknow')

    const jalandharMatch = findNearbyClinic('Jalandhar')
    expect(jalandharMatch?.clinic.city).toBe('Ludhiana')
  })

  it('formats all-clinics list with 9 cities', () => {
    const allList = formatAllClinicsList(false)
    expect(allList).toContain('जयपुर (Jaipur)')
    expect(allList).toContain('नई दिल्ली (New Delhi')
    expect(allList).toContain('लखनऊ (Lucknow')
    expect(allList).toContain('रेवाड़ी (Rewari')
  })
})
