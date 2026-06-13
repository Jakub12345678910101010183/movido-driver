import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import en from '../locales/en.json';
import pl from '../locales/pl.json';
import ro from '../locales/ro.json';

const resources = {
  en: { translation: en },
  pl: { translation: pl },
  ro: { translation: ro },
};

const deviceLocale = Localization.getLocales()[0]?.languageCode ?? 'en';
const supportedLocale = ['en', 'pl', 'ro'].includes(deviceLocale) ? deviceLocale : 'en';

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: supportedLocale,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });

export default i18n;
export const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'pl', label: 'Polski', flag: '🇵🇱' },
  { code: 'ro', label: 'Română', flag: '🇷🇴' },
] as const;
