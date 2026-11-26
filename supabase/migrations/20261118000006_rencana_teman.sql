-- =====================================================================
-- ForeCash — fitur Rencana, Teman ForeCash, dan tagihan antar-akun
--
-- 1) Rencana: anggaran per kategori, target tabungan (+ setoran), rencana pengeluaran.
--    Rencana pengeluaran ikut dihitung di Prediksi (src/lib/forecast.ts).
-- 2) Teman: setiap mahasiswa punya kode teman. Dua akun yang berteman bisa saling
--    mengirim tagihan split bill: piutang di akun pengirim, utang di akun teman,
--    dan status lunasnya tersinkron.
--
-- Jalankan SEKALI di Supabase → SQL Editor (setelah migrasi 000001–000005).
-- =====================================================================

-- ---------- 1. RENCANA ------------------------------------------------

-- anggaran bulanan per kategori pengeluaran (berlaku tiap bulan sampai diubah)
create table public.anggaran (
  id           bigint generated always as identity primary key,
  user_id      uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  category_id  bigint not null references public.categories(id) on delete cascade,
  batas        numeric(12,2) not null check (batas > 0),
  created_at   timestamptz not null default now(),
  unique (user_id, category_id)
);

-- target tabungan (laptop, tiket konser, dana darurat, ...)
create table public.target_tabungan (
  id            bigint generated always as identity primary key,
  user_id       uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  nama          text not null check (char_length(nama) between 1 and 80),
  target        numeric(12,2) not null check (target > 0),
  terkumpul     numeric(12,2) not null default 0 check (terkumpul >= 0),
  tenggat       date,
  tercapai_pada date,
  created_at    timestamptz not null default now()
);
create index target_user_idx on public.target_tabungan(user_id);

-- riwayat setoran (dipakai untuk badge "Nabung Rutin")
create table public.setoran_tabungan (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  target_id  bigint not null references public.target_tabungan(id) on delete cascade,
  nominal    numeric(12,2) not null check (nominal > 0),
  tanggal    date not null default public.hari_ini_wib(),
  created_at timestamptz not null default now()
);
create index setoran_user_idx on public.setoran_tabungan(user_id, tanggal);

-- pengeluaran besar yang sudah direncanakan (bayar kos, UKT, kado, ...)
create table public.rencana_pengeluaran (
  id           bigint generated always as identity primary key,
  user_id      uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  nama         text not null check (char_length(nama) between 1 and 100),
  nominal      numeric(12,2) not null check (nominal > 0),
  tanggal      date not null,
  category_id  bigint references public.categories(id) on delete set null,
  berulang     boolean not null default false,   -- true = muncul lagi bulan depan setelah dibayar
  status       text not null default 'rencana' check (status in ('rencana', 'selesai')),
  created_at   timestamptz not null default now()
);
create index rencana_user_idx on public.rencana_pengeluaran(user_id, status, tanggal);

alter table public.anggaran            enable row level security;
alter table public.target_tabungan     enable row level security;
alter table public.setoran_tabungan    enable row level security;
alter table public.rencana_pengeluaran enable row level security;

-- pola sama dengan tabel lain: lihat = saya atau orang tua yang terhubung; ubah = hanya saya
create policy "anggaran: lihat" on public.anggaran for select to authenticated using (public.boleh_lihat(user_id));
create policy "anggaran: tambah" on public.anggaran for insert to authenticated
  with check (user_id = (select auth.uid()) and public.kategori_boleh_dipakai(category_id));
create policy "anggaran: ubah" on public.anggaran for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.kategori_boleh_dipakai(category_id));
create policy "anggaran: hapus" on public.anggaran for delete to authenticated using (user_id = (select auth.uid()));

create policy "target: lihat" on public.target_tabungan for select to authenticated using (public.boleh_lihat(user_id));
create policy "target: tambah" on public.target_tabungan for insert to authenticated with check (user_id = (select auth.uid()));
create policy "target: ubah" on public.target_tabungan for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "target: hapus" on public.target_tabungan for delete to authenticated using (user_id = (select auth.uid()));

create policy "setoran: lihat" on public.setoran_tabungan for select to authenticated using (public.boleh_lihat(user_id));
create policy "setoran: tambah" on public.setoran_tabungan for insert to authenticated
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.target_tabungan t where t.id = target_id and t.user_id = (select auth.uid())));
create policy "setoran: hapus" on public.setoran_tabungan for delete to authenticated using (user_id = (select auth.uid()));

create policy "rencana: lihat" on public.rencana_pengeluaran for select to authenticated using (public.boleh_lihat(user_id));
create policy "rencana: tambah" on public.rencana_pengeluaran for insert to authenticated
  with check (user_id = (select auth.uid()) and public.kategori_boleh_dipakai(category_id));
create policy "rencana: ubah" on public.rencana_pengeluaran for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.kategori_boleh_dipakai(category_id));
create policy "rencana: hapus" on public.rencana_pengeluaran for delete to authenticated using (user_id = (select auth.uid()));

-- ---------- 2. TEMAN FORECASH -------------------------------------------

-- kode teman 6 huruf (beda dengan kode hubung orang tua)
alter table public.profiles add column kode_teman text unique;

create or replace function public.buat_kode_teman()
returns text
language plpgsql
as $$
declare
  huruf constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  kode text;
begin
  loop
    kode := '';
    for i in 1..6 loop
      kode := kode || substr(huruf, 1 + floor(random() * length(huruf))::int, 1);
    end loop;
    exit when not exists (select 1 from public.profiles where kode_teman = kode);
  end loop;
  return kode;
end $$;

-- mahasiswa baru otomatis dapat kode teman
create or replace function public.isi_kode_teman()
returns trigger
language plpgsql
as $$
begin
  if new.role = 'mahasiswa' and new.kode_teman is null then
    new.kode_teman := public.buat_kode_teman();
  end if;
  return new;
end $$;

create trigger profiles_kode_teman
  before insert on public.profiles
  for each row execute function public.isi_kode_teman();

-- mahasiswa yang sudah ada
update public.profiles set kode_teman = public.buat_kode_teman() where role = 'mahasiswa' and kode_teman is null;

-- pertemanan disimpan dua arah (A→B dan B→A), dibuat/diputus lewat fungsi di bawah
create table public.teman (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  teman_id    uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (user_id, teman_id),
  check (user_id <> teman_id)
);
alter table public.teman enable row level security;
create policy "teman: lihat milik sendiri" on public.teman for select to authenticated using (user_id = (select auth.uid()));

-- tagihan antar-akun: debts tahu siapa temannya dan baris pasangannya di akun teman
alter table public.debts
  add column teman_id     uuid references public.profiles(id) on delete set null,
  add column pasangan_id  bigint references public.debts(id) on delete set null,
  add column perlu_dicatat boolean not null default false;  -- lunas ditandai teman, transaksinya belum dicatat
create index debts_pasangan_idx on public.debts(pasangan_id);

-- Tambah teman lewat kode. Mengembalikan id & nama teman.
create or replace function public.tambah_teman(kode text)
returns table (id uuid, nama text)
language plpgsql security definer set search_path = public
as $$
declare
  saya uuid := auth.uid();
  dia public.profiles%rowtype;
begin
  if (select p.role from public.profiles p where p.id = saya) is distinct from 'mahasiswa' then
    raise exception 'Hanya akun mahasiswa yang bisa menambah teman.';
  end if;
  select * into dia from public.profiles p
   where p.kode_teman = upper(replace(trim(kode), '-', '')) and p.role = 'mahasiswa';
  if not found then
    raise exception 'Kode teman tidak ditemukan.';
  end if;
  if dia.id = saya then
    raise exception 'Itu kode temanmu sendiri.';
  end if;
  insert into public.teman (user_id, teman_id) values (saya, dia.id), (dia.id, saya)
    on conflict (user_id, teman_id) do nothing;
  return query select dia.id, dia.nama;
end $$;

-- Putus pertemanan (dua arah). Catatan utang yang sudah ada tetap tersimpan.
create or replace function public.hapus_teman(p_teman uuid)
returns void
language sql security definer set search_path = public
as $$
  delete from public.teman
   where (user_id = auth.uid() and teman_id = p_teman)
      or (user_id = p_teman and teman_id = auth.uid())
$$;

-- Daftar teman saya (nama & avatar dibaca lewat fungsi karena RLS profil hanya untuk diri sendiri)
create or replace function public.daftar_teman()
returns table (id uuid, nama text, avatar text, sejak timestamptz)
language sql stable security definer set search_path = public
as $$
  select p.id, p.nama, p.avatar, t.created_at
    from public.teman t join public.profiles p on p.id = t.teman_id
   where t.user_id = auth.uid()
   order by p.nama
$$;

-- Kirim tagihan ke teman: piutang di akun saya + utang di akun teman, saling terhubung.
create or replace function public.kirim_tagihan(p_teman uuid, p_keterangan text, p_nominal numeric, p_jatuh_tempo date default null)
returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  saya uuid := auth.uid();
  nama_saya text;
  nama_dia text;
  id_saya bigint;
  id_dia bigint;
begin
  if not exists (select 1 from public.teman where user_id = saya and teman_id = p_teman) then
    raise exception 'Kalian belum berteman di ForeCash.';
  end if;
  if p_nominal is null or p_nominal <= 0 then
    raise exception 'Nominal tagihan harus lebih dari 0.';
  end if;
  select nama into nama_saya from public.profiles where id = saya;
  select nama into nama_dia  from public.profiles where id = p_teman;

  insert into public.debts (user_id, nama_teman, keterangan, nominal, arah, jatuh_tempo, teman_id)
  values (saya, nama_dia, left(p_keterangan, 150), p_nominal, 'piutang', p_jatuh_tempo, p_teman)
  returning id into id_saya;

  insert into public.debts (user_id, nama_teman, keterangan, nominal, arah, jatuh_tempo, teman_id, pasangan_id)
  values (p_teman, nama_saya, left(p_keterangan, 150), p_nominal, 'utang', p_jatuh_tempo, saya, id_saya)
  returning id into id_dia;

  update public.debts set pasangan_id = id_dia where id = id_saya;
  return id_saya;
end $$;

-- Setelah saya menandai lunas, baris pasangan di akun teman ikut lunas.
-- Teman lalu diminta mencatat transaksinya sendiri (perlu_dicatat = true).
create or replace function public.sinkron_lunas(p_id bigint)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  d public.debts%rowtype;
begin
  select * into d from public.debts where id = p_id and user_id = auth.uid() and status = 'lunas';
  if not found or d.pasangan_id is null then
    return;
  end if;
  -- hanya baris pasangan yang memang saling terhubung (dibuat oleh kirim_tagihan),
  -- supaya pasangan_id yang diubah sendiri tidak bisa dipakai menandai catatan orang lain
  update public.debts set status = 'lunas', perlu_dicatat = true
   where id = d.pasangan_id and pasangan_id = d.id and user_id = d.teman_id and status = 'belum';
end $$;

revoke execute on function public.tambah_teman(text), public.hapus_teman(uuid), public.daftar_teman(),
  public.kirim_tagihan(uuid, text, numeric, date), public.sinkron_lunas(bigint) from public, anon;
grant execute on function public.tambah_teman(text), public.hapus_teman(uuid), public.daftar_teman(),
  public.kirim_tagihan(uuid, text, numeric, date), public.sinkron_lunas(bigint) to authenticated;
