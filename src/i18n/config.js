import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import esTranslations from './locales/es.json';
import enTranslations from './locales/en.json';
import frTranslations from './locales/fr.json';
import deTranslations from './locales/de.json';

// Detectar idioma del navegador o usar español por defecto
const getInitialLanguage = () => {
  const savedLanguage = localStorage.getItem('ondeon-language');
  if (savedLanguage) return savedLanguage;
  
  const browserLang = navigator.language || navigator.userLanguage;
  const langCode = browserLang.split('-')[0];
  
  // Mapear códigos de idioma a nuestros idiomas soportados
  const supportedLanguages = ['es', 'en', 'fr', 'de'];
  if (supportedLanguages.includes(langCode)) {
    return langCode;
  }
  
  return 'es'; // Español por defecto
};

i18n
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: esTranslations },
      en: { translation: enTranslations },
      fr: { translation: frTranslations },
      de: { translation: deTranslations },
    },
    lng: getInitialLanguage(),
    fallbackLng: 'es',
    interpolation: {
      escapeValue: false, // React ya escapa los valores
    },
  });

export default i18n;








