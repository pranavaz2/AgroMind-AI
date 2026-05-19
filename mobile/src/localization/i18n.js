import { I18n } from 'i18n-js';
import { getLocales } from 'expo-localization';
import { translations, SUPPORTED_LANGUAGES } from './translations';

export const DEFAULT_LANGUAGE = 'en';

const supportedCodes = SUPPORTED_LANGUAGES.map((language) => language.code);

function getDeviceLanguage() {
  const deviceCode = getLocales()?.[0]?.languageCode;
  return supportedCodes.includes(deviceCode) ? deviceCode : DEFAULT_LANGUAGE;
}

export const i18n = new I18n(translations);
i18n.defaultLocale = DEFAULT_LANGUAGE;
i18n.enableFallback = true;
i18n.locale = getDeviceLanguage();

export function normalizeLanguage(languageCode) {
  return supportedCodes.includes(languageCode) ? languageCode : DEFAULT_LANGUAGE;
}

export function setI18nLanguage(languageCode) {
  const nextLanguage = normalizeLanguage(languageCode);
  i18n.locale = nextLanguage;
  return nextLanguage;
}

export function getInitialLanguage() {
  return normalizeLanguage(i18n.locale);
}

export function getLanguageMeta(languageCode) {
  return SUPPORTED_LANGUAGES.find((language) => language.code === languageCode)
    || SUPPORTED_LANGUAGES[0];
}
