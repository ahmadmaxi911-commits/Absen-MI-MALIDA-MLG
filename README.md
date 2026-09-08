# Absensi Guru SD — Professional Edition

Arsitektur:
- Google Apps Script sebagai backend/API.
- Google Sheets sebagai database/rekap.
- Google Drive sebagai penyimpanan foto.
- Google Maps sebagai visualisasi lokasi.
- Login berbasis token sesi dengan role ADMIN/GURU.
- Validasi radius dilakukan di server.

Fitur utama:
1. Login guru/admin.
2. Guru memilih akun sendiri dari sesi, tanpa mengetik ID saat absensi.
3. Absensi masuk dan pulang.
4. Foto kamera smartphone.
5. GPS live location + validasi radius.
6. Status absensi hari ini.
7. Riwayat pribadi.
8. Dashboard admin.
9. Rekap mingguan/bulanan.
10. Kelola guru.
11. Pengaturan sekolah, koordinat, radius, jam masuk/pulang.
12. Audit log.
13. Ekspor CSV dari dashboard.

Catatan:
- Untuk deployment produksi, gunakan akun Google Workspace sekolah bila tersedia.
- Jangan membagikan URL admin.
- Apps Script session token pada rancangan ini disimpan di CacheService; untuk skala besar/produksi tinggi dapat dipindahkan ke datastore yang lebih kuat.
- Foto absensi disimpan ke folder Drive yang ditentukan.
