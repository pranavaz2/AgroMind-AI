import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { i18n, getInitialLanguage, getLanguageMeta, setI18nLanguage } from '../localization/i18n';
import { SUPPORTED_LANGUAGES } from '../localization/translations';

const LANGUAGE_KEY = 'agromind_language';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(getInitialLanguage());
  const [isLanguageLoading, setIsLanguageLoading] = useState(true);

  useEffect(() => {
    async function loadSavedLanguage() {
      try {
        const savedLanguage = await SecureStore.getItemAsync(LANGUAGE_KEY);
        if (savedLanguage) {
          const nextLanguage = setI18nLanguage(savedLanguage);
          setLanguageState(nextLanguage);
        }
      } finally {
        setIsLanguageLoading(false);
      }
    }

    loadSavedLanguage();
  }, []);

  async function setLanguage(languageCode) {
    const nextLanguage = setI18nLanguage(languageCode);
    await SecureStore.setItemAsync(LANGUAGE_KEY, nextLanguage);
    setLanguageState(nextLanguage);
    return nextLanguage;
  }

  const value = useMemo(() => ({
    currentLanguage: language,
    currentLanguageMeta: getLanguageMeta(language),
    isLanguageLoading,
    languages: SUPPORTED_LANGUAGES,
    setLanguage,
    t: (key, options) => i18n.t(key, options),
  }), [isLanguageLoading, language]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error('useLanguage must be used inside LanguageProvider.');
  }

  return context;
}
