import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'

export const BADGE_MILESTONES = [
  { count: 1, id: 'first_responder', icon: '🌱', name: 'First Responder' },
  { count: 5, id: 'mapper', icon: '🗺️', name: 'Mapper' },
  { count: 10, id: 'field_scout', icon: '🔍', name: 'Field Scout' },
  { count: 25, id: 'correspondent', icon: '🏅', name: 'Crisis Correspondent' },
  { count: 50, id: 'guardian', icon: '🌍', name: 'Community Guardian' }
]

export const useStore = create(
  persist(
    (set, get) => ({
      sessionId: uuidv4(),
      offlineCount: 0,
      language: 'en',
      badges: [],
      submissionCount: 0,
      submittedReportIds: [],

      setLanguage: (lang) => set({ language: lang }),

      setOfflineCount: (count) => set({ offlineCount: count }),

      recordSubmission: (reportId) => {
        const { submittedReportIds, submissionCount, badges } = get()
        if (submittedReportIds.includes(reportId)) return null
        const newCount = submissionCount + 1
        const newIds = [...submittedReportIds, reportId]
        const newBadge = BADGE_MILESTONES.find(
          (b) => b.count === newCount && !badges.find((ex) => ex.id === b.id)
        )
        const newBadges = newBadge ? [...badges, newBadge] : badges
        set({ submissionCount: newCount, submittedReportIds: newIds, badges: newBadges })
        return newBadge || null
      },

      awardBadge: (badge) => {
        const { badges } = get()
        if (badges.find((b) => b.id === badge.id)) return
        set({ badges: [...badges, badge] })
      }
    }),
    {
      name: 'rapida-store',
      partialize: (s) => ({
        sessionId: s.sessionId,
        badges: s.badges,
        submissionCount: s.submissionCount,
        submittedReportIds: s.submittedReportIds,
        language: s.language
      })
    }
  )
)
