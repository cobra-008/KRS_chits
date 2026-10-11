import { createContext, useContext, useState, useEffect } from 'react'
import { getTranslation } from '../lib/translations'

const LanguageContext = createContext({
  language: 'en',
  setLanguage: () => {},
  t: (key, fallback) => fallback || key,
  isTamil: false,
})

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    try {
      return localStorage.getItem('krs_lang') || 'en'
    } catch {
      return 'en'
    }
  })

  const setLanguage = (lang) => {
    setLanguageState(lang)
    try {
      localStorage.setItem('krs_lang', lang)
    } catch {}
  }

  const t = (key, fallback) => {
    return getTranslation(language, key, fallback)
  }

  return (
    <LanguageContext.Provider value={{
      language,
      setLanguage,
      t,
      isTamil: language === 'ta',
    }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
