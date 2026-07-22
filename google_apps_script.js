/**
 * Google Apps Script Code for Google Sheets Integration (삭제 자동 연동 완결판)
 * Copy and paste this code into [Extensions] > [Apps Script] in Google Sheets!
 */

const GOOGLE_APPS_SCRIPT_CODE = `
/**
 * 위탁진료비 수납 및 환자계좌 관리 Google Apps Script
 * - 웹사이트에서 🗑️ 삭제 클릭 시 구글시트 행 실시간 자동 삭제 지원
 * - 25~26년 시트 B~H열 기입 시 I열부터 마스터 시트 자동 채움
 */

// 1. 메뉴 생성 (상단 툴바 메뉴)
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('🏥 위탁수납 관리')
    .addItem('⚡ 계좌정보 일괄 자동 채우기 (25~26년)', 'fillAllAccounts')
    .addItem('🔍 동명이인 (A/B) 검사하기', 'highlightDuplicates')
    .addToUi();
}

// 2. 셀 수정 자동 감지 (Simple Trigger: onEdit)
function onEdit(e) {
  if (!e) return;
  try {
    var range = e.range;
    var sheet = range.getSheet();
    var sheetName = sheet.getName().trim();
    
    if ((sheetName.indexOf('25~26') !== -1 || sheetName.indexOf('25-26') !== -1) && range.getColumn() === 2 && range.getRow() >= 4) {
      var patientName = range.getValue();
      if (!patientName) return;
      
      autoFillAccountForSingleRow(sheet, range.getRow(), String(patientName).trim());
    }
  } catch (err) {
    Logger.log('onEdit Error: ' + err.toString());
  }
}

// 3. 단일 행 I열부터(주민번호, 보험유형, 은행명, 계좌번호, 입금자명, 연락처) 자동 채우기
function autoFillAccountForSingleRow(targetSheet, rowNum, patientName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  var masterSheet = ss.getSheetByName('추가(A,B찾기)');
  if (!masterSheet) {
    var sheets = ss.getSheets();
    for (var i = 0; i < sheets.length; i++) {
      if (sheets[i].getName().indexOf('추가') !== -1) {
        masterSheet = sheets[i];
        break;
      }
    }
  }
  if (!masterSheet) return;
  
  var masterData = masterSheet.getDataRange().getValues();
  var cleanName = String(patientName).trim();
  if (!cleanName) return;
  
  var matchedRows = [];
  for (var i = 2; i < masterData.length; i++) {
    var masterName = String(masterData[i][1]).trim();
    if (masterName === cleanName || masterName.indexOf(cleanName + '(') === 0) {
      matchedRows.push(masterData[i]);
    }
  }
  
  if (matchedRows.length === 1) {
    var p = matchedRows[0];
    targetSheet.getRange(rowNum, 9).setValue(p[2]);  // I: 주민번호
    targetSheet.getRange(rowNum, 10).setValue(p[5]); // J: 보험유형
    targetSheet.getRange(rowNum, 11).setValue(p[7]); // K: 은행명
    targetSheet.getRange(rowNum, 12).setValue(p[8]); // L: 계좌번호
    targetSheet.getRange(rowNum, 13).setValue(p[9]); // M: 입금자명
    targetSheet.getRange(rowNum, 14).setValue(p[10]);// N: 연락처
    
    ss.toast('[' + cleanName + '] 님의 주민번호/계좌 정보(I~N열)가 마스터에서 자동 채워졌습니다.', 'I열 자동입력 완료', 3);
  } else if (matchedRows.length > 1) {
    var namesList = matchedRows.map(function(r) { return r[1] + '(' + (r[13] || '병동미지정') + ')'; }).join(', ');
    ss.toast('⚠️ 동명이인 ' + matchedRows.length + '명 발견 (' + namesList + '). 이름 뒤에 (A), (B)를 적어주세요.', '동명이인 알림', 6);
  }
}

// 4. 전체 수납 내역 일괄 계좌 자동 채우기
function fillAllAccounts() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var targetSheet = ss.getSheetByName('25~26년');
  if (!targetSheet) {
    SpreadsheetApp.getUi().alert('25~26년 시트를 찾을 수 없습니다.');
    return;
  }
  
  var lastRow = targetSheet.getLastRow();
  if (lastRow < 4) return;
  
  var names = targetSheet.getRange(4, 2, lastRow - 3, 1).getValues();
  var filledCount = 0;
  
  for (var i = 0; i < names.length; i++) {
    var name = String(names[i][0]).trim();
    if (name) {
      autoFillAccountForSingleRow(targetSheet, i + 4, name);
      filledCount++;
    }
  }
  SpreadsheetApp.getUi().alert('총 ' + filledCount + '건의 수납 데이터 I~N열 조회가 완료되었습니다.');
}

// 5. 동명이인 검사
function highlightDuplicates() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var masterSheet = ss.getSheetByName('추가(A,B찾기)');
  if (!masterSheet) return;
  
  var masterData = masterSheet.getDataRange().getValues();
  var nameCounts = {};
  
  for (var i = 2; i < masterData.length; i++) {
    var name = String(masterData[i][1]).trim();
    var baseName = name.replace(/\\\\([A-Z]\\\\)/, '').trim();
    if (baseName) {
      nameCounts[baseName] = (nameCounts[baseName] || 0) + 1;
    }
  }
  
  var duplicates = [];
  for (var k in nameCounts) {
    if (nameCounts[k] > 1) duplicates.push(k);
  }
  
  SpreadsheetApp.getUi().alert('🔍 동명이인 검사 결과:\\\\n총 ' + duplicates.length + '개의 성명에서 동명이인(A, B 등)이 존재합니다.\\\\n목록: ' + duplicates.join(', '));
}

// 6. 웹 앱 실시간 전체 데이터 수신 API (doGet)
function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // 마스터 환자 읽기 (추가(A,B찾기))
    var masterSheet = ss.getSheetByName('추가(A,B찾기)');
    var masterPatients = [];
    if (masterSheet) {
      var data = masterSheet.getDataRange().getValues();
      for (var i = 2; i < data.length; i++) {
        if (data[i][1] && String(data[i][1]).trim() !== '') {
          masterPatients.push({
            id: 'P_' + (i + 1),
            seq: data[i][0],
            name: String(data[i][1]).trim(),
            residentNo: String(data[i][2]),
            gender: String(data[i][3]),
            age: data[i][4],
            insuranceType: String(data[i][5]),
            dept: String(data[i][6]),
            bank: (data[i][7] == '0' || data[i][7] == 0) ? '' : String(data[i][7]),
            account: (data[i][8] == '0' || data[i][8] == 0) ? '' : String(data[i][8]),
            depositor: (data[i][9] == '0' || data[i][9] == 0) ? '' : String(data[i][9]),
            contact: (data[i][10] == '0' || data[i][10] == 0) ? '' : String(data[i][10]),
            memo: String(data[i][11]),
            idPrefix: String(data[i][12]),
            ward: String(data[i][13])
          });
        }
      }
    }

    // 수납 장부 읽기 (25~26년)
    var txSheet = ss.getSheetByName('25~26년');
    var transactions = [];
    if (txSheet) {
      var txData = txSheet.getDataRange().getValues();
      for (var j = 4; j < txData.length; j++) {
        if (txData[j][1] && String(txData[j][1]).trim() !== '') {
          transactions.push({
            id: 'T_' + (j + 1),
            patientName: String(txData[j][1]).trim(),
            treatmentDate: formatDate(txData[j][2]),
            submitDate: formatDate(txData[j][3]),
            amount: parseFloat(txData[j][4]) || 0,
            inCharge: String(txData[j][5]),
            hospital: String(txData[j][6]),
            submitter: String(txData[j][7]),
            residentNo: String(txData[j][8]),
            insuranceType: String(txData[j][9]),
            bank: String(txData[j][10]),
            account: String(txData[j][11]),
            depositor: String(txData[j][12]),
            contact: String(txData[j][13]),
            receiptCount: String(txData[j][14]),
            remarks: String(txData[j][15]),
            adminChecked: txData[j][20] == 1 || txData[j][20] == 'O',
            auditChecked: txData[j][22] == 1 || txData[j][22] == 'O',
            isError: txData[j][23] && txData[j][23] != '0'
          });
        }
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      masterPatients: masterPatients,
      transactions: transactions
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function formatDate(val) {
  if (!val) return '';
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(val);
}

// 7. 웹 앱 실시간 백업 및 삭제 API (doPost)
function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var data = JSON.parse(e.postData.contents);
    
    // 7-1. 수납 건 추가
    if (data.action === 'addTransaction') {
      var sheet = ss.getSheetByName('25~26년');
      if (!sheet) sheet = ss.insertSheet('25~26년');
      
      var t = data.transaction;
      var lastRow = sheet.getLastRow();
      var targetRow = 5359;
      
      var bValues = sheet.getRange(1, 2, Math.max(lastRow + 20, 5450), 1).getValues();
      for (var r = 3; r < bValues.length; r++) {
        if (!bValues[r][0] || String(bValues[r][0]).trim() === '') {
          targetRow = Math.max(r + 1, 5359);
          break;
        }
      }
      
      var newRow = [
        '', t.patientName, t.treatmentDate, t.submitDate, t.amount, t.inCharge, t.hospital, t.submitter
      ];
      
      sheet.getRange(targetRow, 1, 1, newRow.length).setValues([newRow]);
      autoFillAccountForSingleRow(sheet, targetRow, t.patientName);
      
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        message: '구글시트 25~26년 시트 ' + targetRow + '행에 저장되었습니다.'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 7-2. 수납 건 실시간 삭제 (웹사이트 🗑️ 삭제 버튼 클릭 시 구글시트 행 삭제)
    if (data.action === 'deleteTransaction') {
      var sheet = ss.getSheetByName('25~26년');
      if (!sheet) return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Sheet not found' })).setMimeType(ContentService.MimeType.JSON);
      
      var t = data.transaction;
      var lastRow = sheet.getLastRow();
      if (lastRow < 4) return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'No rows' })).setMimeType(ContentService.MimeType.JSON);
      
      var dataRange = sheet.getRange(4, 1, lastRow - 3, 6).getValues();
      var deletedRowIndex = -1;
      
      for (var k = dataRange.length - 1; k >= 0; k--) {
        var rName = String(dataRange[k][1]).trim();
        var rTreatDate = formatDate(dataRange[k][2]);
        var rSubmitDate = formatDate(dataRange[k][3]);
        var rAmount = parseFloat(dataRange[k][4]) || 0;
        
        if (rName === String(t.patientName).trim() &&
            (rSubmitDate === String(t.submitDate) || rTreatDate === String(t.treatmentDate)) &&
            Math.abs(rAmount - (parseFloat(t.amount) || 0)) < 1) {
          
          sheet.deleteRow(k + 4);
          deletedRowIndex = k + 4;
          break;
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        message: deletedRowIndex > 0 ? '구글시트 ' + deletedRowIndex + '행이 실시간 삭제되었습니다.' : '일치 행 없음'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // 7-3. 마스터 환자 신규 추가
    if (data.action === 'addMasterPatient') {
      var sheet = ss.getSheetByName('추가(A,B찾기)');
      if (!sheet) sheet = ss.insertSheet('추가(A,B찾기)');
      
      var p = data.patient;
      var lastRow = sheet.getLastRow();
      var targetRow = 575;
      
      var bValues = sheet.getRange(1, 2, Math.max(lastRow + 20, 600), 1).getValues();
      for (var r = 2; r < bValues.length; r++) {
        if (!bValues[r][0] || String(bValues[r][0]).trim() === '') {
          targetRow = r + 1;
          break;
        }
      }
      
      var newMasterRow = [
        p.seq, p.name, p.residentNo, p.gender, p.age, p.insuranceType, p.dept, p.bank, p.account, p.depositor, p.contact, p.memo, p.idPrefix, p.ward
      ];
      sheet.getRange(targetRow, 1, 1, newMasterRow.length).setValues([newMasterRow]);
      
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        message: '구글시트 추가(A,B찾기) 시트 ' + targetRow + '행에 저장되었습니다.'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 7-4. 마스터 환자 삭제
    if (data.action === 'deleteMasterPatient') {
      var sheet = ss.getSheetByName('추가(A,B찾기)');
      if (!sheet) return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Sheet not found' })).setMimeType(ContentService.MimeType.JSON);
      
      var pName = String(data.name).trim();
      var lastRow = sheet.getLastRow();
      if (lastRow < 3) return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'No rows' })).setMimeType(ContentService.MimeType.JSON);
      
      var masterValues = sheet.getRange(3, 2, lastRow - 2, 1).getValues();
      for (var m = masterValues.length - 1; m >= 0; m--) {
        if (String(masterValues[m][0]).trim() === pName) {
          sheet.deleteRow(m + 3);
          break;
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: '마스터 환자 삭제 완료' })).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Unknown action' })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}
`;

document.addEventListener('DOMContentLoaded', () => {
    const codeArea = document.getElementById('apps-script-code-text');
    if (codeArea) {
        codeArea.value = GOOGLE_APPS_SCRIPT_CODE.trim();
    }
    
    const copyBtn = document.getElementById('copy-script-btn');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE.trim()).then(() => {
                alert('삭제 자동 연동 기능이 탑재된 최신 매크로 코드가 클립보드에 복사되었습니다!\n\n구글 시트의 [확장 프로그램] > [Apps Script]에 붙여넣고 저장해 주세요.');
            });
        });
    }
});
