-- =====================================================================
-- ForeCash — data demo (sama dengan php-version/database/demo_data.sql)
--
-- SEBELUM menjalankan file ini, buat akun di Supabase:
--   Authentication → Users → Add user → Create new user
--     1) demo@forecash.id  / demo12345   (centang "Auto Confirm User")
--     2) ortu@forecash.id  / demo12345   (opsional, akun orang tua)
--     3) teman@forecash.id / demo12345   (opsional, teman ForeCash untuk demo split bill)
-- Lalu jalankan file ini di SQL Editor.
--
-- Aman dijalankan ulang: data lama akun demo dihapus dulu, lalu diisi lagi.
-- Tanggal transaksi dihitung mundur dari hari ini, jadi demo selalu terlihat baru.
-- =====================================================================

do $$
declare
  mhs   uuid := (select id from auth.users where email = 'demo@forecash.id');
  ortu  uuid := (select id from auth.users where email = 'ortu@forecash.id');
  tmn   uuid := (select id from auth.users where email = 'teman@forecash.id');
  t_laptop bigint; t_konser bigint; id_tagih bigint;
  hari  date := public.hari_ini_wib();
  w_utama bigint; w_bca bigint; w_gopay bigint;
  k_makan bigint; k_transport bigint; k_kos bigint; k_kuliah bigint; k_hiburan bigint; k_saku bigint;
begin
  if mhs is null then
    raise exception 'Akun demo@forecash.id belum ada. Buat dulu di Authentication → Users → Add user.';
  end if;

  -- ---------- profil mahasiswa
  update public.profiles
     set nama = 'Momo Mahasiswa', role = 'mahasiswa', kode_hubung = 'DEMO2026', kode_teman = 'MOMO26',
         batas_harian = 45000, avatar = 'a2'
   where id = mhs;

  -- bersihkan data lama akun demo (wallet ikut menghapus transaksinya)
  delete from public.wallets          where user_id = mhs;
  delete from public.income_schedules where user_id = mhs;
  delete from public.debts            where user_id = mhs;
  delete from public.user_pets        where user_id = mhs;
  delete from public.anggaran         where user_id = mhs;
  delete from public.target_tabungan  where user_id = mhs;
  delete from public.rencana_pengeluaran where user_id = mhs;
  delete from public.teman            where user_id = mhs or teman_id = mhs;
  delete from public.debts            where teman_id = mhs;

  -- ---------- wallet
  insert into public.wallets (user_id, nama, tipe, saldo_awal) values (mhs, 'Utama', 'tunai', 250000) returning id into w_utama;
  insert into public.wallets (user_id, nama, tipe, saldo_awal) values (mhs, 'BCA', 'bank', 0)          returning id into w_bca;
  insert into public.wallets (user_id, nama, tipe, saldo_awal) values (mhs, 'GoPay', 'ewallet', 0)    returning id into w_gopay;

  -- ---------- kategori bawaan
  select id into k_makan     from public.categories where user_id is null and nama = 'Makan & Minum';
  select id into k_transport from public.categories where user_id is null and nama = 'Transportasi';
  select id into k_kos       from public.categories where user_id is null and nama = 'Kos / Sewa';
  select id into k_kuliah    from public.categories where user_id is null and nama = 'Kebutuhan Kuliah';
  select id into k_hiburan   from public.categories where user_id is null and nama = 'Hiburan';
  select id into k_saku      from public.categories where user_id is null and nama = 'Uang Saku';

  -- ---------- transaksi
  insert into public.transactions (user_id, wallet_id, wallet_tujuan_id, category_id, jenis, nominal, keterangan, tanggal) values
    (mhs, w_bca,   null,    k_saku,      'pemasukan',   1000000, 'Uang saku bulanan',   hari - 13),
    (mhs, w_bca,   w_gopay, null,        'transfer',     300000, 'Isi GoPay',           hari - 12),
    (mhs, w_gopay, null,    k_makan,     'pengeluaran',   85000, 'Makan bareng teman',  hari - 12),
    (mhs, w_bca,   null,    k_kos,       'pengeluaran',  250000, 'Bayar kos (cicilan)', hari - 13),
    (mhs, w_gopay, null,    k_transport, 'pengeluaran',   40000, 'Ojek online',         hari - 9),
    (mhs, w_utama, null,    k_makan,     'pengeluaran',   60000, 'Makan kantin',        hari - 8),
    (mhs, w_gopay, null,    k_hiburan,   'pengeluaran',   75000, 'Nonton bioskop',      hari - 6),
    (mhs, w_utama, null,    k_kuliah,    'pengeluaran',   35000, 'Print tugas',         hari - 5),
    (mhs, w_gopay, null,    k_makan,     'pengeluaran',   55000, 'Kopi & camilan',      hari - 3),
    (mhs, w_utama, null,    k_transport, 'pengeluaran',   30000, 'Bensin',              hari - 2),
    (mhs, w_utama, null,    k_makan,     'pengeluaran',   45000, 'Makan siang',         hari - 1);

  -- ---------- jadwal pemasukan, utang, teman hemat
  insert into public.income_schedules (user_id, sumber, nominal, tanggal_perkiraan) values
    (mhs, 'Uang saku dari orang tua', 1000000, hari + 13);

  insert into public.debts (user_id, nama_teman, keterangan, nominal, arah, jatuh_tempo) values
    (mhs, 'Andi', 'Patungan makan', 28000, 'piutang', hari + 3),
    (mhs, 'Sasa', 'Pinjam ongkos',  20000, 'utang',   null);

  -- ---------- rencana: anggaran, target tabungan, rencana pengeluaran
  insert into public.anggaran (user_id, category_id, batas) values
    (mhs, k_makan, 600000), (mhs, k_transport, 200000), (mhs, k_hiburan, 100000), (mhs, k_kuliah, 150000);

  insert into public.target_tabungan (user_id, nama, target, terkumpul, tenggat) values
    (mhs, 'Laptop baru', 8000000, 1500000, hari + 200) returning id into t_laptop;
  insert into public.target_tabungan (user_id, nama, target, terkumpul, tenggat) values
    (mhs, 'Tiket konser', 750000, 450000, hari + 45) returning id into t_konser;
  insert into public.setoran_tabungan (user_id, target_id, nominal, tanggal) values
    (mhs, t_laptop, 1000000, hari - 20), (mhs, t_laptop, 500000, hari - 6),
    (mhs, t_konser, 300000, hari - 13), (mhs, t_konser, 150000, hari - 2);

  insert into public.rencana_pengeluaran (user_id, nama, nominal, tanggal, category_id, berulang) values
    (mhs, 'Patungan kado ultah Sasa', 50000,  hari + 5,  null,     false),
    (mhs, 'Bayar kos',                1200000, hari + 17, k_kos,    true),
    (mhs, 'Cicilan UKT',              500000,  hari + 25, k_kuliah, false);

  insert into public.user_pets (user_id, pet_id, menetas_pada, dipakai) values
    (mhs, 'celeng', hari - 10, true),
    (mhs, 'mochi',  hari - 5,  false);

  -- ---------- akun teman (opsional): berteman dengan Momo + satu tagihan split bill
  if tmn is not null then
    update public.profiles set nama = 'Andi Pratama', role = 'mahasiswa', kode_teman = 'ANDI26', avatar = 'a3' where id = tmn;
    insert into public.teman (user_id, teman_id) values (mhs, tmn), (tmn, mhs) on conflict do nothing;
    insert into public.debts (user_id, nama_teman, keterangan, nominal, arah, jatuh_tempo, teman_id)
      values (mhs, 'Andi Pratama', 'Split bill: pizza malam', 35000, 'piutang', hari + 4, tmn) returning id into id_tagih;
    insert into public.debts (user_id, nama_teman, keterangan, nominal, arah, jatuh_tempo, teman_id, pasangan_id)
      values (tmn, 'Momo Mahasiswa', 'Split bill: pizza malam', 35000, 'utang', hari + 4, mhs, id_tagih);
    update public.debts set pasangan_id = (select id from public.debts where pasangan_id = id_tagih) where id = id_tagih;
  end if;

  -- ---------- akun orang tua (opsional)
  if ortu is not null then
    update public.profiles set nama = 'Ibu Momo', role = 'orangtua', kode_hubung = null, kode_teman = null, avatar = 'a4' where id = ortu;
    delete from public.wallets where user_id = ortu;  -- orang tua tidak punya wallet
    insert into public.parent_links (parent_id, student_id) values (ortu, mhs) on conflict do nothing;
  end if;

  raise notice 'Data demo selesai diisi.';
end $$;
