import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// 导入语言资源
import zhCN from './locales/zh-CN';
import enUS from './locales/en-US';

i18n
  // 检测浏览器语言
  .use(LanguageDetector)
  // 传递 i18n 实例到 react-i18next
  .use(initReactI18next)
  // 初始化 i18next
  .init({
    // 语言资源
    resources: {
      'zh-CN': {
        translation: zhCN,
      },
      'en-US': {
        translation: enUS,
      },
    },
    // 默认语言
    fallbackLng: 'en-US',
    // 调试模式（开发环境）
    debug: false,
    // 插值配置
    interpolation: {
      escapeValue: false, // React 已经转义了
    },
    // 命名空间
    defaultNS: 'translation',
    // 语言检测配置
    detection: {
      // 检测顺序
      order: ['localStorage', 'navigator', 'htmlTag'],
      // 缓存用户选择的语言
      caches: ['localStorage'],
      // localStorage 键名
      lookupLocalStorage: 'i18nextLng',
    },
  });

export default i18n;

