/* Общие настройки YOULAB. Ключи Supabase вставляются после создания проекта
   (см. ../supabase/README-setup.md). Пока они пустые — сайт работает без кабинета. */

const SUPABASE_URL = "https://jxgnurfzaeeitgpwqsjw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_5Wv9JYkcQl1mIomjMazh3Q_nE0bhAZB";

window.sb = (SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
