import React from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from '../components/LanguageSwitcher'

function Section({ title, children }) {
  return (
    <section className="mb-8">
      <h2 className="text-xl font-bold text-undp-blue mb-3">{title}</h2>
      <div className="text-gray-700 leading-relaxed space-y-3">{children}</div>
    </section>
  )
}

export default function Privacy() {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-undp-blue text-white shadow-md flex-shrink-0">
        <div className="flex items-center gap-3 px-4 py-3 max-w-2xl mx-auto w-full">
          <Link
            to="/submit"
            className="flex items-center gap-1 text-white/90 hover:text-white font-semibold text-sm"
            aria-label={t('back')}
          >
            <svg className="w-5 h-5 rtl-flip" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
            <span>{t('back')}</span>
          </Link>
          <h1 className="flex-1 font-bold text-base">{t('privacy_title')}</h1>
          <LanguageSwitcher />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm p-6 md:p-8">
          <div className="flex items-start gap-4 mb-8 pb-6 border-b border-gray-100">
            <div className="w-12 h-12 bg-undp-blue rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-white text-2xl">🔒</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{t('privacy_title')}</h1>
              <p className="text-sm text-gray-500 mt-1">{t('privacy_last_updated')}</p>
              <p className="text-sm text-gray-600 mt-2">{t('privacy_intro')}</p>
            </div>
          </div>

          <Section title="What Data We Collect">
            <p>
              RAPIDA collects the minimum data necessary to map crisis damage effectively. We collect:
            </p>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li>
                <strong>Location data</strong> — GPS coordinates or manually entered location descriptions, collected only when you submit a report. Location data is permanently associated with your report to enable geographic analysis.
              </li>
              <li>
                <strong>Photographs</strong> — Photos you take or upload. Before storage, we automatically strip all EXIF metadata (including GPS tags embedded in photos, camera model, timestamps) to prevent unintended disclosure.
              </li>
              <li>
                <strong>Damage assessment data</strong> — The damage level, infrastructure type, crisis type, and any additional details you voluntarily provide.
              </li>
              <li>
                <strong>Anonymous session ID</strong> — A randomly generated identifier (UUID) stored locally on your device. This is used to prevent duplicate submissions and enable gamification features. It contains no personal information and cannot identify you.
              </li>
            </ul>
          </Section>

          <Section title="What We Do NOT Collect">
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li>No names, email addresses, or phone numbers</li>
              <li>No device identifiers or IP addresses stored with reports</li>
              <li>No account registration required</li>
              <li>No tracking across sessions or devices</li>
              <li>No advertising data or third-party analytics</li>
              <li>No photo EXIF metadata (stripped automatically)</li>
            </ul>
          </Section>

          <Section title="How We Use Your Data">
            <p>
              All data collected is used exclusively for humanitarian crisis response coordination by UNDP and partner organizations. Specifically:
            </p>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li>
                <strong>Crisis response mapping</strong> — Reports are aggregated to create damage maps that guide emergency responders, UNDP field teams, and government authorities to areas of greatest need.
              </li>
              <li>
                <strong>Resource allocation</strong> — Anonymized aggregate data informs decisions about where to deploy humanitarian resources, including food, shelter, medical supplies, and personnel.
              </li>
              <li>
                <strong>Recovery planning</strong> — Post-crisis, aggregated building damage data is used to plan infrastructure recovery and reconstruction efforts.
              </li>
              <li>
                <strong>Research and analysis</strong> — Anonymized, aggregated data may be used for academic research on crisis patterns and humanitarian response effectiveness.
              </li>
            </ul>
          </Section>

          <Section title="Data Sharing">
            <p>
              Aggregated, anonymized crisis data may be shared with:
            </p>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li>United Nations agencies involved in crisis response (OCHA, UNICEF, WFP, etc.)</li>
              <li>National and local government emergency management agencies</li>
              <li>Verified humanitarian organizations (NGOs, Red Cross/Red Crescent)</li>
              <li>Academic researchers under data sharing agreements</li>
            </ul>
            <p>
              Raw individual reports are accessible only to credentialed UNDP personnel and verified partner organizations through API key authentication.
            </p>
          </Section>

          <Section title="Data Retention">
            <p>
              Crisis reports are retained for a minimum of 5 years to support long-term recovery analysis and future preparedness. You may request deletion of reports attributed to your session ID by contacting us below.
            </p>
          </Section>

          <Section title="Your Rights">
            <p>Depending on your jurisdiction, you may have rights to:</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li>Access the reports submitted by your session ID</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your session's reports</li>
              <li>Object to processing for research purposes</li>
            </ul>
          </Section>

          <Section title="Offline Data Storage">
            <p>
              When you submit a report while offline, the report data is temporarily stored in your browser's IndexedDB. This data remains on your device only until it is successfully synced to our servers, after which it is removed from local storage.
            </p>
          </Section>

          <Section title="Security">
            <p>
              All data transmission uses TLS encryption. Our servers are hosted within UNDP's secure infrastructure. Access to raw reports is restricted to authenticated personnel. We conduct regular security reviews.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              For privacy inquiries, data access requests, or to report a privacy concern, please contact:
            </p>
            <div className="bg-gray-50 rounded-xl p-4 font-mono text-sm">
              <p>UNDP Digital Office</p>
              <p>privacy@undp.org</p>
              <p>United Nations Development Programme</p>
              <p>One United Nations Plaza</p>
              <p>New York, NY 10017, USA</p>
            </div>
          </Section>

          <div className="pt-6 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400 mb-4">
              This privacy policy was last updated on {t('privacy_last_updated').replace('Last updated: ', '')}.
              It may be updated periodically. Continued use of RAPIDA after changes constitutes acceptance of the updated policy.
            </p>
            <Link to="/submit" className="btn-primary inline-flex items-center gap-2">
              <span aria-hidden="true">←</span> {t('submit_report')}
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
