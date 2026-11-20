-- =====================================================================
-- Học tiếng Anh qua video YouTube — Giai đoạn 1
-- Toàn bộ bảng, Row Level Security (RLS) và policy.
--
-- Cách chạy: Supabase > SQL Editor > New query > dán toàn bộ file này > Run.
-- File có thể chạy lại nhiều lần mà không lỗi (dùng "if not exists"
-- và xóa policy cũ trước khi tạo lại).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. BẢNG
-- ---------------------------------------------------------------------

create table if not exists videos (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  youtube_id text not null,
  title text not null,
  created_at timestamptz not null default now()
);

create table if not exists segments (
  id bigint generated always as identity primary key,
  video_id bigint not null references videos(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  position int not null default 0,
  start_sec numeric not null,
  end_sec numeric not null,
  en text not null,
  vi text,
  ipa text,
  pattern text,
  note text
);

create table if not exists progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  segment_id bigint not null references segments(id) on delete cascade,
  box int not null default 1,            -- hộp Leitner: 1 đến 4, vượt 4 (= 5) là đã thuộc
  next_review_at timestamptz not null default now(),
  primary key (user_id, segment_id)
);

create table if not exists my_examples (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  segment_id bigint not null references segments(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists shares (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  owner_email text not null,
  viewer_email text not null,
  created_at timestamptz not null default now(),
  unique (owner_id, viewer_email)
);

-- Nhật ký học (bổ sung): mỗi lần luyện / ôn một dòng, dùng để tính
-- chuỗi ngày học (streak), điểm XP và mục tiêu mỗi ngày.
create table if not exists study_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,                    -- listen, dictation, backtranslate, cloze, pattern, speak, review
  segment_id bigint references segments(id) on delete set null,
  xp int not null default 0,
  created_at timestamptz not null default now()
);

-- Chỉ mục giúp truy vấn theo chủ sở hữu / video nhanh hơn
create index if not exists videos_owner_idx      on videos (owner_id);
create index if not exists segments_video_idx    on segments (video_id, start_sec);
create index if not exists segments_owner_idx    on segments (owner_id);
create index if not exists progress_due_idx      on progress (user_id, next_review_at);
create index if not exists my_examples_seg_idx   on my_examples (segment_id);
create index if not exists shares_viewer_idx     on shares (viewer_email);
create index if not exists study_log_user_idx    on study_log (user_id, created_at);


-- ---------------------------------------------------------------------
-- 2. HÀM HỖ TRỢ
-- ---------------------------------------------------------------------

-- Email của người đang đăng nhập, viết thường (lấy từ JWT của Supabase).
create or replace function current_email()
returns text
language sql stable
set search_path = public
as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;

-- Kiểm tra: chủ sở hữu "owner" có chia sẻ với người đang đăng nhập không?
-- Truy vấn bảng shares vẫn chịu RLS, nên người xem chỉ thấy dòng của mình.
create or replace function is_shared_with_me(p_owner uuid)
returns boolean
language sql stable
set search_path = public
as $$
  select exists (
    select 1 from shares s
    where s.owner_id = p_owner
      and lower(s.viewer_email) = current_email()
  )
$$;


-- ---------------------------------------------------------------------
-- 3. TỰ ĐỘNG THÊM CÂU MỚI VÀO LỊCH ÔN
-- Mỗi khi thêm một câu (segment), tạo dòng progress hộp 1, đến hạn ngay.
-- ---------------------------------------------------------------------

create or replace function add_progress_for_new_segment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  insert into progress (user_id, segment_id, box, next_review_at)
  values (new.owner_id, new.id, 1, now())
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists segments_add_progress on segments;
create trigger segments_add_progress
  after insert on segments
  for each row execute function add_progress_for_new_segment();


-- ---------------------------------------------------------------------
-- 3b. CẤP QUYỀN API
-- Dự án Supabase mới có thể KHÔNG tự cấp quyền cho bảng mới (ô "Tự động cấp
-- quyền truy cập API cho các bảng mới"). Cấp rõ ràng cho người đã đăng nhập;
-- RLS bên dưới vẫn giới hạn mỗi người chỉ thấy dữ liệu được phép.
-- Không cấp cho "anon" (người chưa đăng nhập).
-- ---------------------------------------------------------------------

grant usage on schema public to authenticated;
grant select, insert, update, delete
  on videos, segments, progress, my_examples, shares, study_log
  to authenticated;
grant execute on function current_email(), is_shared_with_me(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- 4. BẬT ROW LEVEL SECURITY
-- Khi RLS bật, mặc định KHÔNG ai đọc/ghi được; chỉ những gì policy cho phép.
-- ---------------------------------------------------------------------

alter table videos      enable row level security;
alter table segments    enable row level security;
alter table progress    enable row level security;
alter table my_examples enable row level security;
alter table shares      enable row level security;
alter table study_log   enable row level security;


-- ---------------------------------------------------------------------
-- 5. POLICY
-- ---------------------------------------------------------------------

-- ===== videos =====
drop policy if exists "videos: chủ sở hữu toàn quyền" on videos;
create policy "videos: chủ sở hữu toàn quyền" on videos
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "videos: người được chia sẻ chỉ đọc" on videos;
create policy "videos: người được chia sẻ chỉ đọc" on videos
  for select to authenticated
  using (is_shared_with_me(owner_id));

-- ===== segments =====
-- Khi thêm/sửa, ngoài owner_id còn phải đúng là video của chính mình.
drop policy if exists "segments: chủ sở hữu toàn quyền" on segments;
create policy "segments: chủ sở hữu toàn quyền" on segments
  for all to authenticated
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and exists (select 1 from videos v where v.id = video_id and v.owner_id = auth.uid())
  );

drop policy if exists "segments: người được chia sẻ chỉ đọc" on segments;
create policy "segments: người được chia sẻ chỉ đọc" on segments
  for select to authenticated
  using (is_shared_with_me(owner_id));

-- ===== progress =====
-- Chỉ được tạo tiến độ cho câu của chính mình.
drop policy if exists "progress: chủ sở hữu toàn quyền" on progress;
create policy "progress: chủ sở hữu toàn quyền" on progress
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from segments s where s.id = segment_id and s.owner_id = auth.uid())
  );

drop policy if exists "progress: người được chia sẻ chỉ đọc" on progress;
create policy "progress: người được chia sẻ chỉ đọc" on progress
  for select to authenticated
  using (is_shared_with_me(user_id));

-- ===== my_examples ===== (riêng tư, không chia sẻ)
drop policy if exists "my_examples: chủ sở hữu toàn quyền" on my_examples;
create policy "my_examples: chủ sở hữu toàn quyền" on my_examples
  for all to authenticated
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and exists (select 1 from segments s where s.id = segment_id and s.owner_id = auth.uid())
  );

-- ===== shares =====
-- owner_email phải đúng email của chính mình (tránh mạo danh người khác).
drop policy if exists "shares: chủ sở hữu toàn quyền" on shares;
create policy "shares: chủ sở hữu toàn quyền" on shares
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and lower(owner_email) = current_email());

drop policy if exists "shares: người được chia sẻ xem dòng của mình" on shares;
create policy "shares: người được chia sẻ xem dòng của mình" on shares
  for select to authenticated
  using (lower(viewer_email) = current_email());

-- ===== study_log ===== (riêng tư)
drop policy if exists "study_log: chủ sở hữu toàn quyền" on study_log;
create policy "study_log: chủ sở hữu toàn quyền" on study_log
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
