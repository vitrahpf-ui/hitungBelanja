# HitungBelanja.id 🛒
> **Aplikasi Kalkulator & Perencana Belanja Harian (Mobile-First + Riwayat & Google Sheets Sync)**

Aplikasi kalkulator dan perencana belanja harian yang sangat praktis, ringan, dan dirancang khusus untuk kenyamanan penggunaan di smartphone (HP). Membantu ibu rumah tangga dan warga mengontrol pengeluaran belanja, menghitung subtotal & total otomatis secara real-time, menyimpan riwayat belanja untuk dipakai kembali (*re-use session*), mendeteksi status anggaran (*Aman vs Over Budget*), serta menyinkronkan data ke **Google Sheets** pribadi Anda.

---

## ✨ Fitur Utama

1. **Mobile-First & Responsif Penuh:**
   - Desain tata letak kartu kompak yang nyaman digulir di layar HP.
   - Tombol-tombol touch-friendly dengan stepper kuantitas (`-` / `+`) yang mudah diakses dengan jempol.
   - *Sticky Bottom Summary Bar*: Ringkasan Total Belanja, tombol Riwayat, dan tombol Simpan tetap terlihat melayang di bagian bawah layar saat berbelanja.

2. **Fitur Riwayat Belanja (Shopping History):**
   - **Pencatatan Otomatis:** Setiap kali menekan *"Simpan ke Google Sheets"* atau *"Simpan ke Riwayat"*, sesi belanja otomatis tersimpan di peramban.
   - **Pratinjau di Layar Utama:** Menampilkan kartu ringkasan 3 sesi belanja terakhir.
   - **Modal Riwayat Lengkap:** Melihat daftar semua riwayat belanja masa lalu lengkap dengan tanggal, total pengeluaran, status anggaran, dan rincian item.
   - **Pakai Lagi (Restore Session):** Dengan 1-klik (`🔄 Pakai Lagi`), muat kembali daftar barang dan budget dari riwayat masa lalu ke dalam kalkulator aktif!
   - **Manajemen Riwayat:** Hapus riwayat tertentu atau bersihkan seluruh riwayat dengan konfirmasi aman.

3. **Integrasi Google Sheets API (Serverless):**
   - Modal khusus *"Pengaturan Sheets"* di navbar untuk menempelkan URL Web App Google Apps Script (`/exec`).
   - Tersimpan aman di `localStorage` dengan key `SHEETS_API_URL`.
   - Dilengkapi tombol *"Uji Koneksi"* dan indikator status dot (*Berhasil Terhubung* vs *Belum Disetel*).

4. **Kontrol Anggaran (Target Budget):**
   - Input plafon anggaran belanja dengan pemformatan Rupiah otomatis.
   - Pilihan cepat (*quick chips*): Rp 50rb, Rp 100rb, Rp 150rb, Rp 200rb, Rp 500rb.

5. **Daftar Belanja Dinamis:**
   - Input nama barang dengan *autocomplete suggestions* sembako & kebutuhan dapur populer.
   - Input harga satuan dan kuantitas barang dengan subtotal per baris yang terkalkulasi otomatis.
   - Template cepat: 1-klik untuk memuat *Paket Sembako* atau *Paket Dapur*.

6. **Live Summary & Status Anggaran:**
   - Total Belanja terhitung secara instan.
   - Status visual:
     - **Aman & Hemat (Hijau)** saat masih dalam batas anggaran.
     - **Over Budget / Defisit (Merah Berkedip)** disertai banner peringatan otomatis saat melebihi anggaran.
   - Bar persentase pemakaian budget.

7. **Logika Saran Penghematan AI:**
   - Menganalisis barang belanjaan dengan porsi biaya terbesar (*Pareto 80/20*).
   - Memberikan rekomendasi konkret untuk memangkas atau mengganti bahan baku lauk hemat (telur, tempe, tahu) dan menunda barang sekunder jika terjadi defisit anggaran.

8. **Fitur Ekspor Praktis:**
   - **Kirim ke WhatsApp:** Pesan catatan belanja terformat rapi dengan rincian harga dan emoji.
   - **Cetak Catatan:** Tata letak cetak dokumen struk belanja yang rapi.

---

## 🚀 Cara Menjalankan

Aplikasi ini 100% statis murni:
- Cukup buka file `index.html` langsung di browser, atau
- Jalankan server lokal:
  ```bash
  npx serve .
  ```
- Deploy ke **Vercel** hanya butuh 1-klik dengan menghubungkan repositori GitHub Anda.
