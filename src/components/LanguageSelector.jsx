import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Globe } from 'lucide-react';

const LanguageSelector = () => {
  const { t } = useTranslation();
  const { currentLanguage, changeLanguage, availableLanguages } = useLanguage();

  const currentLang = availableLanguages.find(lang => lang.code === currentLanguage) || availableLanguages[0];

  const handleLanguageChange = (langCode) => {
    changeLanguage(langCode);
  };

  return (
    <div className="flex items-center gap-2">
      <Globe size={18} className="text-foreground/60" />
      <Select value={currentLanguage} onValueChange={handleLanguageChange}>
        <SelectTrigger className="w-[140px] h-9 text-xs" title={t('language.selectLanguage')}>
          <SelectValue>
            <span className="flex items-center gap-2">
              <span>{getLanguageFlag(currentLanguage)}</span>
              <span>{currentLang.nativeName}</span>
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {availableLanguages.map((lang) => (
            <SelectItem key={lang.code} value={lang.code}>
              <span className="flex items-center gap-2">
                <span className="text-lg">{getLanguageFlag(lang.code)}</span>
                <span>{lang.nativeName}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

// Función auxiliar para obtener la bandera del idioma
const getLanguageFlag = (code) => {
  const flags = {
    es: '🇪🇸',
    en: '🇬🇧',
    fr: '🇫🇷',
    de: '🇩🇪',
  };
  return flags[code] || '🌐';
};

export default LanguageSelector;

