import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

const resources = {
  en: {
    translation: {
      'nav.campaigns': 'Campaigns',
      'nav.news': 'News',
      'nav.login': 'Login',
      'nav.logout': 'Logout',
      'nav.dashboard': 'Dashboard',
      'nav.moderation': 'Moderation',
      'nav.admin': 'Administration',
      'home.hero.title': 'Lend a Hand',
      'home.hero.subtitle': 'Making a difference, one donation at a time',
      'home.hero.cta': 'Donate Now',
      'campaigns.title': 'Campaigns',
      'campaign.donate': 'Donate',
      'campaign.progress': 'Progress',
      'campaign.raised': 'Raised',
      'campaign.target': 'Target',
      'campaign.donations': 'Donations',
      'campaign.donation.amount': 'Amount',
      'campaign.donation.date': 'Date',
      'campaign.donation.anonymous': 'Anonymous',
      'news.title': 'News',
      'login.title': 'Login',
      'login.email': 'Email',
      'login.password': 'Password',
      'login.submit': 'Sign In',
      'register.title': 'Register',
      'register.email': 'Email',
      'register.username': 'Username',
      'register.password': 'Password',
      'register.password2': 'Confirm Password',
      'register.phone': 'Phone',
      'register.address': 'Address',
      'register.submit': 'Sign Up',
    },
  },
  ru: {
    translation: {
      'nav.campaigns': 'Кампании',
      'nav.news': 'Новости',
      'nav.login': 'Войти',
      'nav.logout': 'Выйти',
      'nav.dashboard': 'Панель управления',
      'nav.moderation': 'Модерация',
      'nav.admin': 'Администрация',
      'home.hero.title': 'Помощь',
      'home.hero.subtitle': 'Делаем мир лучше, одно пожертвование за раз',
      'home.hero.cta': 'Пожертвовать',
      'campaigns.title': 'Кампании',
      'campaign.donate': 'Пожертвовать',
      'campaign.progress': 'Прогресс',
      'campaign.raised': 'Собрано',
      'campaign.target': 'Цель',
      'campaign.donations': 'Пожертвования',
      'campaign.donation.amount': 'Сумма',
      'campaign.donation.date': 'Дата',
      'campaign.donation.anonymous': 'Анонимно',
      'news.title': 'Новости',
      'login.title': 'Вход',
      'login.email': 'Email',
      'login.password': 'Пароль',
      'login.submit': 'Войти',
      'register.title': 'Регистрация',
      'register.email': 'Email',
      'register.username': 'Имя пользователя',
      'register.password': 'Пароль',
      'register.password2': 'Подтвердите пароль',
      'register.phone': 'Телефон',
      'register.address': 'Адрес',
      'register.submit': 'Зарегистрироваться',
    },
  },
  be: {
    translation: {
      'nav.campaigns': 'Кампаніі',
      'nav.news': 'Навіны',
      'nav.login': 'Увайсці',
      'nav.logout': 'Выйсці',
      'nav.dashboard': 'Панэль кіравання',
      'nav.moderation': 'Мадэрацыя',
      'nav.admin': 'Адміністрацыя',
    },
  },
  lt: {
    translation: {
      'nav.campaigns': 'Kampanijos',
      'nav.news': 'Naujienos',
      'nav.login': 'Prisijungti',
      'nav.logout': 'Atsijungti',
      'nav.dashboard': 'Valdymo skydelis',
      'nav.moderation': 'Moderavimas',
      'nav.admin': 'Administracija',
    },
  },
  uk: {
    translation: {
      'nav.campaigns': 'Кампанії',
      'nav.news': 'Новини',
      'nav.login': 'Увійти',
      'nav.logout': 'Вийти',
      'nav.dashboard': 'Панель керування',
      'nav.moderation': 'Модерування',
      'nav.admin': 'Адміністрація',
    },
  },
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  })

export default i18n

