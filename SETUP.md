# SETUP — Professional Edition

## A. Spreadsheet
Buat Spreadsheet dan sheet berikut.

### Users
Header:
`id | nama | jabatan | email | pin | aktif | role`

Contoh:
`G001 | Budi | Guru Kelas | guru@sekolah.sch.id | 1234 | TRUE | GURU`

Untuk keamanan yang lebih baik, PIN jangan disimpan plaintext pada deployment nyata; gunakan hash + salt.

### Attendance
Header:
`timestamp | tanggal | jam | userId | nama | tipe | latitude | longitude | accuracy | distanceMeter | photoUrl | device`

### Settings
Header:
`schoolName | latitude | longitude | radiusMeter | checkInStart | checkInEnd | checkOutStart | checkOutEnd`

Contoh:
`SD Contoh | -6.123 | 110.123 | 100 | 05:30 | 08:00 | 14:00 | 17:00`

### AuditLog
Header:
`timestamp | actorId | actorName | action | target | detail`

## B. Google Drive
Buat satu folder khusus foto absensi, salin Folder ID ke `Code.gs`.

## C. Google Maps
Aktifkan Maps JavaScript API dan isi `YOUR_GOOGLE_MAPS_API_KEY` pada `User.html`.
Gunakan API key yang dibatasi sesuai kebutuhan deployment.

## D. Apps Script
1. Extensions → Apps Script dari Spreadsheet.
2. Masukkan `Code.gs`, `User.html`, `Admin.html`, `appsscript.json`.
3. Isi Spreadsheet ID dan Drive Folder ID.
4. Deploy → New deployment → Web app.
5. Jalankan `initializeSheets()` satu kali jika ingin membuat header otomatis.

URL:
- Guru: `/exec?page=user`
- Admin: `/exec?page=admin`

## E. Login
Halaman login memakai ID + PIN dari sheet Users. Setelah login, role menentukan dashboard.
Admin harus menggunakan akun role ADMIN.

## F. Rekomendasi produksi
- Aktifkan Google Workspace dan pembatasan domain jika sekolah memilikinya.
- Gunakan HTTPS Apps Script Web App.
- Batasi akses Spreadsheet dan Drive hanya admin.
- Ganti PIN awal setiap guru.
- Backup Spreadsheet.
- Atur radius sekolah sesuai akurasi GPS lingkungan sekolah.
