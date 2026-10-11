import { useLanguage } from '../context/LanguageContext'

export default function LanguageToggle() {
  const { language, setLanguage } = useLanguage()

  return (
    <div
      className="lang-capsule"
      role="group"
      aria-label="Language selection"
      title={language === 'en' ? 'Switch to தமிழ்' : 'Switch to English'}
    >
      <button
        type="button"
        id="btn-lang-en"
        className={`lang-capsule-btn ${language === 'en' ? 'active' : ''}`}
        onClick={() => setLanguage('en')}
        aria-pressed={language === 'en'}
        title="English"
      >
        En
      </button>
      <button
        type="button"
        id="btn-lang-ta"
        className={`lang-capsule-btn ${language === 'ta' ? 'active' : ''}`}
        onClick={() => setLanguage('ta')}
        aria-pressed={language === 'ta'}
        title="தமிழ்"
      >
        த
      </button>
    </div>
  )
}
