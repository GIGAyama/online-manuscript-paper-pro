/**
 * オンライン原稿用紙 Pro - サーバーサイドロジック (Code.gs)
 * 機能:
 * - データベース(スプレッドシート)との連携
 * - 自動セットアップ & 自己修復機能
 * - ステータス管理 & 添削データの保存
 * - 【改善】一覧取得時に全データを返却して高速化
 */

const SHEET_NAME = '作文データ';
const TEACHER_PASSWORD = 'admin'; 

const COLUMNS = {
  ID: 1, TITLE: 2, CLASS: 3, NAME: 4, CONTENT: 5,
  CREATED_AT: 6, UPDATED_AT: 7, DELETED_AT: 8,
  STATUS: 9, CORRECTION: 10, TEACHER_CMT: 11
};

function doGet() {
  return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('オンライン原稿用紙 Pro')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
      .setFaviconUrl('https://drive.google.com/uc?id=1EsaLbGPFc9WixYhJ5sPynTIBZpxzSsfK&.png');
}

function saveOrSubmitDraft(draftData, isSubmit = false) {
  const lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (e) { return { status: 'error', message: '混み合っています。' }; }

  try {
    const sheet = getSheet_();
    const now = new Date();
    let status = 'draft';
    if (draftData.status) status = draftData.status;
    else if (isSubmit) status = 'submitted';

    if (draftData.id) {
      const foundRow = findRowById_(sheet, draftData.id);
      if (foundRow > 0) {
        // 更新
        sheet.getRange(foundRow, COLUMNS.TITLE).setValue(draftData.title);
        sheet.getRange(foundRow, COLUMNS.CLASS).setValue(draftData.class);
        sheet.getRange(foundRow, COLUMNS.NAME).setValue(draftData.name);
        sheet.getRange(foundRow, COLUMNS.CONTENT).setValue(draftData.content);
        sheet.getRange(foundRow, COLUMNS.UPDATED_AT).setValue(now);
        sheet.getRange(foundRow, COLUMNS.DELETED_AT).setValue(''); 
        sheet.getRange(foundRow, COLUMNS.STATUS).setValue(status);

        if (draftData.correction !== undefined) sheet.getRange(foundRow, COLUMNS.CORRECTION).setValue(draftData.correction);
        if (draftData.teacherCmt !== undefined) sheet.getRange(foundRow, COLUMNS.TEACHER_CMT).setValue(draftData.teacherCmt);

        let msg = '保存しました。';
        if (status === 'submitted') msg = '提出しました！';
        return { status: 'success', message: msg, id: draftData.id, docStatus: status };
      }
    }
    
    // 新規
    const newId = Utilities.getUuid();
    sheet.appendRow([
      newId, draftData.title, draftData.class, draftData.name, draftData.content,
      now, now, '', status, '', ''
    ]);
    return { status: 'success', message: status === 'submitted' ? '提出しました！' : '保存しました。', id: newId, docStatus: status };

  } catch (e) {
    return { status: 'error', message: 'エラー: ' + e.message };
  } finally {
    lock.releaseLock(); 
  }
}

function getDraftList(mode = 'student', password = '') {
  try {
    if (mode === 'teacher' && password !== TEACHER_PASSWORD) return { status: 'error', message: 'パスワードが違います。' };

    const sheet = getSheet_();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { status: 'success', data: [] };

    const values = sheet.getRange(2, 1, lastRow - 1, 11).getValues();

    const drafts = values
      .filter(row => row[COLUMNS.DELETED_AT - 1] === '') 
      .filter(row => {
        if (mode === 'student') return true;
        const st = row[COLUMNS.STATUS - 1];
        // 先生用: 提出済み、再提出、完了、返却済みを表示
        return st === 'submitted' || st === 'rework' || st === 'completed' || st === 'returned';
      })
      .map(row => ({
        id: row[COLUMNS.ID - 1],
        title: row[COLUMNS.TITLE - 1],
        class: row[COLUMNS.CLASS - 1],
        name: row[COLUMNS.NAME - 1],
        // 【改善】先生モードの場合は詳細データも一度に送る（リストクリック時のロード時間短縮）
        content: mode === 'teacher' ? row[COLUMNS.CONTENT - 1] : undefined,
        correction: mode === 'teacher' ? row[COLUMNS.CORRECTION - 1] : undefined,
        teacherCmt: mode === 'teacher' ? row[COLUMNS.TEACHER_CMT - 1] : undefined,
        
        updatedAtRaw: new Date(row[COLUMNS.UPDATED_AT - 1]),
        status: row[COLUMNS.STATUS - 1] || 'draft'
      }));

    drafts.sort((a, b) => b.updatedAtRaw - a.updatedAtRaw);

    const formatted = drafts.slice(0, 100).map(d => ({
      ...d,
      updatedAt: Utilities.formatDate(d.updatedAtRaw, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm'),
      updatedAtRaw: undefined // 通信エラー防止のためDateオブジェクト削除
    }));

    return { status: 'success', data: formatted };

  } catch (e) {
    return { status: 'error', message: 'リスト取得失敗: ' + e.message };
  }
}

function loadDraft(id) {
  try {
    const sheet = getSheet_();
    const rowIndex = findRowById_(sheet, id);
    if (rowIndex > 0) {
      const rowData = sheet.getRange(rowIndex, 1, 1, 11).getValues()[0];
      if (rowData[COLUMNS.DELETED_AT - 1] !== '') return { status: 'error', message: '削除されています。' };

      return {
        status: 'success',
        data: {
          id: rowData[COLUMNS.ID - 1],
          title: rowData[COLUMNS.TITLE - 1],
          class: rowData[COLUMNS.CLASS - 1],
          name: rowData[COLUMNS.NAME - 1],
          content: rowData[COLUMNS.CONTENT - 1],
          status: rowData[COLUMNS.STATUS - 1] || 'draft',
          correction: rowData[COLUMNS.CORRECTION - 1],
          teacherCmt: rowData[COLUMNS.TEACHER_CMT - 1]
        }
      };
    }
    return { status: 'error', message: '見つかりませんでした。' };
  } catch (e) { return { status: 'error', message: e.message }; }
}

function deleteDraft(id) {
  const lock = LockService.getScriptLock();
  try { lock.waitLock(5000); } catch (e) { return { status: 'error', message: '混み合っています。' }; }
  try {
    const sheet = getSheet_();
    const rowIndex = findRowById_(sheet, id);
    if (rowIndex > 0) {
      sheet.getRange(rowIndex, COLUMNS.DELETED_AT).setValue(new Date());
      return { status: 'success', message: '削除しました。' };
    }
    return { status: 'error', message: '見つかりませんでした。' };
  } finally { lock.releaseLock(); }
}

function getSheet_() {
  let ss = null;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) {}
  if (!ss) {
    const props = PropertiesService.getScriptProperties();
    const savedId = props.getProperty('SPREADSHEET_ID');
    if (savedId) { try { ss = SpreadsheetApp.openById(savedId); } catch (e) { ss = null; } }
    if (!ss) {
      ss = SpreadsheetApp.create('オンライン原稿用紙Pro_データ');
      props.setProperty('SPREADSHEET_ID', ss.getId());
    }
  }
  if (!ss) throw new Error('DBエラー');

  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    const headers = ['ID', '題名', '学年・クラス', '氏名', '本文', '作成日時', '更新日時', '削除日時', 'ステータス', '添削データ', '先生コメント'];
    const range = sheet.getRange(1, 1, 1, headers.length);
    range.setValues([headers]);
    range.setFontWeight('bold').setBackground('#f3f3f3');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(COLUMNS.ID, 50);
    sheet.setColumnWidth(COLUMNS.TITLE, 150);
    sheet.setColumnWidth(COLUMNS.CONTENT, 300);
  }
  return sheet;
}

function findRowById_(sheet, id) {
  const textFinder = sheet.getRange("A:A").createTextFinder(id);
  const match = textFinder.matchEntireCell(true).findNext();
  return match ? match.getRow() : -1;
}

function initDatabase() {
  try {
    const sheet = getSheet_();
    console.log('DB OK: ' + sheet.getParent().getUrl());
    return '成功';
  } catch (e) { console.error(e); return '失敗'; }
}
