const SPREADSHEET_ID = 'GANTI_DENGAN_ID_SPREADSHEET';
const DRIVE_FOLDER_ID = 'GANTI_DENGAN_ID_FOLDER_DRIVE';
const SESSION_TTL = 21600; // 6 jam

function doGet(e) {
  const page = e?.parameter?.page === 'admin' ? 'Admin' : 'User';
  return HtmlService.createTemplateFromFile(page).evaluate()
    .setTitle(page === 'admin' ? 'Admin • Absensi Guru' : 'Absensi Guru')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function db_(){ return SpreadsheetApp.openById(SPREADSHEET_ID); }
function sh_(name){ const s=db_().getSheetByName(name); if(!s) throw new Error('Sheet '+name+' belum ada. Jalankan initializeSheets().'); return s; }

function initializeSheets(){
  const ss=db_();
  const defs={
    Users:['id','nama','jabatan','email','pin','aktif','role'],
    Attendance:['timestamp','tanggal','jam','userId','nama','tipe','latitude','longitude','accuracy','distanceMeter','photoUrl','device'],
    Settings:['schoolName','latitude','longitude','radiusMeter','checkInStart','checkInEnd','checkOutStart','checkOutEnd'],
    AuditLog:['timestamp','actorId','actorName','action','target','detail']
  };
  Object.keys(defs).forEach(n=>{
    let s=ss.getSheetByName(n)||ss.insertSheet(n);
    if(s.getLastRow()===0) s.appendRow(defs[n]);
  });
  if(sh_('Settings').getLastRow()<2) sh_('Settings').appendRow(['SD Contoh',-6.123,110.123,100,'05:30','08:00','14:00','17:00']);
  return 'OK';
}

function settings_(){
  const r=sh_('Settings').getRange(2,1,1,8).getValues()[0];
  return {schoolName:String(r[0]||''),latitude:Number(r[1]),longitude:Number(r[2]),radiusMeter:Number(r[3]||100),
    checkInStart:String(r[4]||'05:30'),checkInEnd:String(r[5]||'08:00'),checkOutStart:String(r[6]||'14:00'),checkOutEnd:String(r[7]||'17:00')};
}
function getPublicSettings(){ return settings_(); }

function users_(){
  const v=sh_('Users').getDataRange().getValues();
  return v.length<2?[]:v.slice(1).filter(r=>r[0]).map(r=>({id:String(r[0]),nama:String(r[1]||''),jabatan:String(r[2]||''),email:String(r[3]||''),pin:String(r[4]||''),aktif:String(r[5]).toLowerCase()!=='false',role:String(r[6]||'GURU').toUpperCase()}));
}

function login(id,pin){
  const u=users_().find(x=>x.id===String(id).trim() && x.pin===String(pin).trim() && x.aktif);
  if(!u) throw new Error('ID atau PIN salah, atau akun tidak aktif.');
  const token=Utilities.getUuid();
  CacheService.getScriptCache().put('session_'+token, JSON.stringify({id:u.id,nama:u.nama,role:u.role}), SESSION_TTL);
  audit_(u,'LOGIN',u.id,'Login berhasil');
  return {token,user:{id:u.id,nama:u.nama,jabatan:u.jabatan,role:u.role},settings:settings_()};
}
function session_(token){
  if(!token) throw new Error('Sesi tidak ditemukan.');
  const raw=CacheService.getScriptCache().get('session_'+token);
  if(!raw) throw new Error('Sesi kedaluwarsa. Silakan login lagi.');
  return JSON.parse(raw);
}
function logout(token){ if(token) CacheService.getScriptCache().remove('session_'+token); return true; }

function today_(){
  return Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy-MM-dd');
}
function attendance_(){
  const v=sh_('Attendance').getDataRange().getValues();
  return v.length<2?[]:v.slice(1).filter(r=>r[0]).map(r=>({
    timestamp:r[0],tanggal:r[1] instanceof Date?Utilities.formatDate(r[1],Session.getScriptTimeZone(),'yyyy-MM-dd'):String(r[1]),
    jam:String(r[2]),userId:String(r[3]),nama:String(r[4]),tipe:String(r[5]),
    latitude:Number(r[6]),longitude:Number(r[7]),accuracy:Number(r[8]),distanceMeter:Number(r[9]),photoUrl:String(r[10]||''),device:String(r[11]||'')
  }));
}
function getToday(token){
  const s=session_(token), all=attendance_(), t=today_();
  const mine=all.filter(a=>a.tanggal===t && a.userId===s.id);
  const people=all.filter(a=>a.tanggal===t && a.tipe==='MASUK');
  return {date:t,mine,people,settings:settings_()};
}
function inWindow_(type,hhmm){
  const s=settings_();
  const toMin=x=>{const p=x.split(':');return Number(p[0])*60+Number(p[1]);};
  const now=toMin(hhmm);
  return type==='MASUK' ? now>=toMin(s.checkInStart)&&now<=toMin(s.checkInEnd)
                         : now>=toMin(s.checkOutStart)&&now<=toMin(s.checkOutEnd);
}
function submitAttendance(token,p){
  const u=session_(token);
  if(u.role!=='GURU' && u.role!=='ADMIN') throw new Error('Role tidak valid.');
  if(!p || !p.tipe || !p.photoData || p.latitude==null || p.longitude==null) throw new Error('Foto dan lokasi wajib diambil.');
  if(!['MASUK','PULANG'].includes(p.tipe)) throw new Error('Tipe absensi tidak valid.');
  const now=new Date(), tz=Session.getScriptTimeZone(), date=Utilities.formatDate(now,tz,'yyyy-MM-dd'), jam=Utilities.formatDate(now,tz,'HH:mm:ss');
  if(!inWindow_(p.tipe,jam)) throw new Error('Absensi '+p.tipe+' di luar jam yang diizinkan.');
  const mine=attendance_().filter(a=>a.tanggal===date&&a.userId===u.id&&a.tipe===p.tipe);
  if(mine.length) throw new Error('Anda sudah absen '+p.tipe.toLowerCase()+' hari ini.');
  const s=settings_();
  const distance=haversine_(Number(p.latitude),Number(p.longitude),s.latitude,s.longitude);
  if(distance>s.radiusMeter) throw new Error('Anda berada di luar radius sekolah ('+Math.round(distance)+' m).');
  const parts=String(p.photoData).split(','), mime=(parts[0].match(/data:(.*?);base64/)||[])[1]||'image/jpeg';
  const blob=Utilities.newBlob(Utilities.base64Decode(parts[1]||''),mime,`${date}_${u.id}_${p.tipe}.jpg`);
  const file=DriveApp.getFolderById(DRIVE_FOLDER_ID).createFile(blob);
  file.setName(`${date}_${u.id}_${p.tipe}.jpg`);
  sh_('Attendance').appendRow([now,date,jam,u.id,u.nama,p.tipe,Number(p.latitude),Number(p.longitude),Number(p.accuracy||0),Math.round(distance),file.getUrl(),String(p.device||'')]);
  audit_(u,'ABSEN',u.id,p.tipe+' berhasil, jarak '+Math.round(distance)+' m');
  return {ok:true,jam,tipe:p.tipe,distance:Math.round(distance),photoUrl:file.getUrl()};
}

function adminGuard_(token){ const s=session_(token); if(s.role!=='ADMIN') throw new Error('Akses admin ditolak.'); return s; }
function getUsersAdmin(token){ adminGuard_(token); return users_().map(u=>({id:u.id,nama:u.nama,jabatan:u.jabatan,email:u.email,aktif:u.aktif,role:u.role})); }
function saveUser(token,u){
  const actor=adminGuard_(token);
  if(!u?.nama) throw new Error('Nama wajib diisi.');
  const s=sh_('Users'), v=s.getDataRange().getValues(), id=String(u.id||Utilities.getUuid()).trim();
  const row=v.findIndex((r,i)=>i>0&&String(r[0])===id);
  const data=[id,String(u.nama).trim(),String(u.jabatan||'Guru'),String(u.email||''),String(u.pin||'1234'),u.aktif!==false,String(u.role||'GURU').toUpperCase()];
  if(row>=1) s.getRange(row+1,1,1,7).setValues([data]); else s.appendRow(data);
  audit_(actor,'USER_SAVE',id,'Data user disimpan');
  return {ok:true,id};
}
function setUserActive(token,id,active){ const a=adminGuard_(token),s=sh_('Users'),v=s.getDataRange().getValues(); for(let i=1;i<v.length;i++)if(String(v[i][0])===String(id)){s.getRange(i+1,6).setValue(Boolean(active));audit_(a,'USER_STATUS',id,active?'Aktif':'Nonaktif');return true;}throw new Error('User tidak ditemukan.');}
function saveSettings(token,x){ const a=adminGuard_(token),s=sh_('Settings');s.getRange(2,1,1,8).setValues([[x.schoolName,Number(x.latitude),Number(x.longitude),Number(x.radiusMeter),x.checkInStart,x.checkInEnd,x.checkOutStart,x.checkOutEnd]]);audit_(a,'SETTINGS','school','Pengaturan diperbarui');return settings_(); }

function report(token,start,end){
  adminGuard_(token);
  return attendance_().filter(a=>a.tanggal>=start&&a.tanggal<=end);
}
function summary(token,start,end){
  adminGuard_(token);
  const rows=report(token,start,end), active=users_().filter(u=>u.aktif).length;
  const days=[...new Set(rows.map(r=>r.tanggal))];
  return {activeUsers:active,total:rows.length,days:days.length,avg:days.length?Math.round(rows.length/days.length*10)/10};
}
function audit_(actor,action,target,detail){ try{sh_('AuditLog').appendRow([new Date(),actor.id,actor.nama,action,target,detail]);}catch(e){} }
function exportCsv(token,start,end){
  adminGuard_(token); const rows=report(token,start,end);
  const head=['Tanggal','Jam','User ID','Nama','Tipe','Latitude','Longitude','Akurasi','Jarak Meter','Foto'];
  const lines=[head,...rows.map(r=>[r.tanggal,r.jam,r.userId,r.nama,r.tipe,r.latitude,r.longitude,r.accuracy,r.distanceMeter,r.photoUrl])]
    .map(r=>r.map(x=>`"${String(x??'').replace(/"/g,'""')}"`).join(',')).join('\n');
  return Utilities.base64Encode(Utilities.newBlob(lines,'text/csv','rekap.csv').getBytes());
}
function haversine_(a,b,c,d){const R=6371000,p1=a*Math.PI/180,p2=c*Math.PI/180,dp=(c-a)*Math.PI/180,dl=(d-b)*Math.PI/180,A=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;return 2*R*Math.atan2(Math.sqrt(A),Math.sqrt(1-A));}
