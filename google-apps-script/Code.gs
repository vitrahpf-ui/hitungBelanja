/**
 * ============================================================================
 * HitungBelanja.id - Google Apps Script Backend (Web App)
 * ============================================================================
 * Skrip ini bertindak sebagai API endpoint untuk menerima data kalkulasi
 * belanja dari website HitungBelanja.id dan menyimpannya secara otomatis
 * ke Google Sheets pemilik aplikasi.
 *
 * Panduan Setup:
 * 1. Buka Google Sheets baru di https://sheets.new
 * 2. Beri nama spreadsheet, contoh: "Data Belanja - HitungBelanja.id"
 * 3. Klik menu: Extensions > Apps Script
 * 4. Hapus semua kode default, lalu tempelkan (paste) seluruh kode di file ini
 * 5. Klik tombol "Save" (ikon disket)
 * 6. Klik tombol "Deploy" di kanan atas > "New deployment"
 * 7. Pilih type: "Web app" (ikon roda gigi)
 * 8. Konfigurasi Deployment:
 *    - Description: "HitungBelanja API v1"
 *    - Execute as: "Me (email Anda)"
 *    - Who has access: "Anyone" (PENTING! Agar frontend bisa mengirim data tanpa login Google)
 * 9. Klik "Deploy", izinkan hak akses (Authorize access)
 * 10. Salin "Web app URL" (berakhiran /exec) dan tempelkan ke form pengaturan di website!
 * ============================================================================
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  // Kunci eksekusi selama maksimal 30 detik untuk menghindari konflik data bersamaan
  lock.tryLock(30000);

  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Periksa apakah sheet masih kosong, jika ya buat header kolom otomatis
    if (sheet.getLastRow() === 0) {
      setupHeaders(sheet);
    }

    // Parsing payload data JSON yang dikirimkan frontend
    var payload;
    if (e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (err) {
        // Fallback jika dikirim via URL-encoded form
        payload = e.parameter;
      }
    } else {
      payload = e.parameter || {};
    }

    // Format waktu penyimpanan (Zona Waktu lokal WIB/Asia/Jakarta)
    var timestamp = Utilities.formatDate(new Date(), "Asia/Jakarta", "dd/MM/yyyy HH:mm:ss");

    var targetAnggaran = payload.targetAnggaran || 0;
    var totalBelanja = payload.totalBelanja || 0;
    var statusAnggaran = payload.status || "Tidak Diketahui";
    var detailBarang = payload.detailBarang || "-";
    var saranAI = payload.saranAI || "-";
    var sisaAnggaran = payload.sisaAnggaran || 0;

    // Tambahkan baris baru ke Google Sheet
    sheet.appendRow([
      timestamp,
      targetAnggaran,
      totalBelanja,
      sisaAnggaran,
      statusAnggaran,
      detailBarang,
      saranAI
    ]);

    // Format sel baris terakhir agar rapi (format mata uang Rupiah)
    var lastRow = sheet.getLastRow();
    sheet.getRange(lastRow, 2).setNumberFormat('"Rp"#,##0'); // Target Anggaran
    sheet.getRange(lastRow, 3).setNumberFormat('"Rp"#,##0'); // Total Belanja
    sheet.getRange(lastRow, 4).setNumberFormat('"Rp"#,##0'); // Sisa / Defisit

    // Beri warna status (Hijau jika hemat/aman, Merah jika defisit)
    var statusCell = sheet.getRange(lastRow, 5);
    if (statusAnggaran.toLowerCase().indexOf("aman") !== -1 || statusAnggaran.toLowerCase().indexOf("hemat") !== -1) {
      statusCell.setBackground("#dcfce7").setFontColor("#15803d").setFontWeight("bold");
    } else if (statusAnggaran.toLowerCase().indexOf("defisit") !== -1 || statusAnggaran.toLowerCase().indexOf("lebih") !== -1) {
      statusCell.setBackground("#fee2e2").setFontColor("#b91c1c").setFontWeight("bold");
    }

    // Auto-wrap teks untuk kolom Detail Barang dan Saran AI
    sheet.getRange(lastRow, 6, 1, 2).setWrap(true);

    // Respon sukses JSON
    return ContentService
      .createTextOutput(JSON.stringify({
        status: "success",
        message: "Data belanja berhasil disimpan ke Google Sheets!",
        row: lastRow,
        timestamp: timestamp
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    // Tangani error
    return ContentService
      .createTextOutput(JSON.stringify({
        status: "error",
        message: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } finally {
    // Lepaskan lock
    lock.releaseLock();
  }
}

/**
 * Handle HTTP GET (Berguna untuk menguji apakah Web App sudah aktif)
 */
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      status: "online",
      message: "HitungBelanja.id Google Apps Script API siap menerima POST request."
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Fungsi pembantu untuk membuat header tabel secara otomatis dengan styling premium
 */
function setupHeaders(sheet) {
  var headers = [
    "Timestamp",
    "Target Anggaran (Rp)",
    "Total Belanja (Rp)",
    "Sisa / Defisit (Rp)",
    "Status Anggaran",
    "Detail Barang & Item",
    "Saran Rekomendasi AI"
  ];

  sheet.appendRow(headers);

  // Styling header row
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground("#059669"); // Emerald 600
  headerRange.setFontColor("#ffffff");
  headerRange.setFontWeight("bold");
  headerRange.setHorizontalAlignment("center");
  headerRange.setVerticalAlignment("middle");

  sheet.setRowHeight(1, 35);
  sheet.setColumnWidth(1, 160); // Timestamp
  sheet.setColumnWidth(2, 160); // Target Anggaran
  sheet.setColumnWidth(3, 160); // Total Belanja
  sheet.setColumnWidth(4, 160); // Sisa / Defisit
  sheet.setColumnWidth(5, 150); // Status
  sheet.setColumnWidth(6, 320); // Detail Barang
  sheet.setColumnWidth(7, 360); // Saran AI

  // Freeze baris header
  sheet.setFrozenRows(1);
}
