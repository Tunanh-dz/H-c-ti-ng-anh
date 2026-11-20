// Tạo một Supabase client duy nhất, các file khác import từ đây.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

// Bỏ khoảng trắng và đuôi thừa (ví dụ dán nhầm ".../rest/v1/") để còn dạng https://xxx.supabase.co
const url = SUPABASE_URL.trim().replace(/\/(rest|auth)\/v1\/?$/, '').replace(/\/+$/, '');
const key = SUPABASE_ANON_KEY.trim();

// config.js còn để giá trị mẫu thì coi như chưa cấu hình.
export const isConfigured = /^https:\/\/.+/.test(url) && !key.startsWith('DIEN_');

export const supabase = isConfigured
  ? createClient(url, key, {
      auth: {
        persistSession: true,      // giữ đăng nhập sau khi tải lại trang
        autoRefreshToken: true,
        detectSessionInUrl: true,  // đọc token từ magic link khi quay về trang
      },
    })
  : null;
