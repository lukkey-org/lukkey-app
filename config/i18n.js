/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";
import { en } from "./translations/en";
import { zh } from "./translations/zh";
import { zhTW } from "./translations/zh-TW";
import { fr } from "./translations/fr";
import { es } from "./translations/es";
import { ar } from "./translations/ar";
import { ja } from "./translations/ja";
import { ru } from "./translations/ru";
import { ko } from "./translations/ko";
import { pt } from "./translations/pt";
import { ptBR } from "./translations/pt-BR";
import { it } from "./translations/it";
import { de } from "./translations/de";
import { hi } from "./translations/hi";
import { mn } from "./translations/mn";
import { th } from "./translations/th";
import { uk } from "./translations/uk";
import { vi } from "./translations/vi";
import { id } from "./translations/id";
import { tl } from "./translations/tl";
import { bn } from "./translations/bn";

const LanguageDetector = {
  type: "languageDetector",
  async: true,
  detect: (callback) => {
    callback(Localization.locale.split("-")[0]);
  },
  init: () => {},
  cacheUserLanguage: () => {},
};
//en zh zh-TW fr es ar ja ru ko pt pt-BR it de hi mn th uk vi id tl bn
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    lng: "en",
    fallbackLng: "en",
    resources: {
      en,
      zh,
      "zh-TW": zhTW,
      fr,
      es,
      ar,
      ja,
      ru,
      ko,
      pt,
      "pt-BR": ptBR,
      it,
      de,
      hi,
      mn,
      th,
      uk,
      vi,
      id,
      tl,
      bn,
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
