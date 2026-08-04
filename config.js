/* Общие настройки YOULAB. Ключи Supabase вставляются после создания проекта
   (см. ../supabase/README-setup.md). Пока они пустые — сайт работает без кабинета. */

const SUPABASE_URL = "https://rsojelwlcsoeefbyugym.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MKGopQpLNRK-SkbdbJx-Fg_6hphN5hd";

window.sb = (SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
