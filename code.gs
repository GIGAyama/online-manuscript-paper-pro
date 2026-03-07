/**
 * オンライン原稿用紙 Pro - GIGA Edition (React/Tailwind Version)
 * * 【特徴】
 * - Zero-Config DB構築 (初回起動時に自動でシート作成)
 * - 堅牢な排他制御 (LockServiceによる同時アクセス保護)
 * - セキュアなAPI管理 (PropertiesServiceの活用)
 */

const CONFIG = {
  SHEET_NAME: '作文データ',
  DEFAULT_PASSWORD: 'admin',
  LOCK_TIMEOUT: 10000,
  COLUMNS: {
    ID: 1, TITLE: 2, CLASS: 3, NAME: 4, CONTENT: 5,
    CREATED_AT: 6, UPDATED_AT: 7, DELETED_AT: 8,
    STATUS: 9, CORRECTION: 10, TEACHER_CMT: 11
  }
};

/**
 * Webアプリのエントリーポイント
 */
function doGet() {
  initDatabase(); // データベースの初期化・検証
  
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('オンライン原稿用紙 Pro')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .setFaviconUrl('https://drive.google.com/uc?id=1IDKbE31vFl1kbE9G1RHji3UIuAGW-G8y&.png');
}

/**
 * 教師用パスワードの取得・初期化
 */
function getTeacherPassword_() {
  const props = PropertiesService.getScriptProperties();
  let pw = props.getProperty('TEACHER_PASSWORD');
  if (!pw) {
    props.setProperty('TEACHER_PASSWORD', CONFIG.DEFAULT_PASSWORD);
    pw = CONFIG.DEFAULT_PASSWORD;
  }
  return pw;
}

/**
 * データベース（スプレッドシート）の初期化と自己修復
 */
function initDatabase() {
  const props = PropertiesService.getScriptProperties();
  let ssId = props.getProperty('SPREADSHEET_ID');
  let ss;

  if (ssId) {
    try { ss = SpreadsheetApp.openById(ssId); } catch (e) { ssId = null; }
  }

  if (!ssId) {
    ss = SpreadsheetApp.create('オンライン原稿用紙Pro_データ(React版)');
    props.setProperty('SPREADSHEET_ID', ss.getId());
  }

  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    const headers = ['ID', '題名', '学年・クラス', '氏名', '本文', '作成日時', '更新日時', '削除日時', 'ステータス', '添削データ', '先生コメント'];
    
    const range = sheet.getRange(1, 1, 1, headers.length);
    range.setValues([headers]);
    
    // ヘッダーのスタイリング
    range.setFontWeight('bold')
         .setBackground('#1e40af') // Tailwind blue-800
         .setFontColor('#ffffff')
         .setHorizontalAlignment('center');
    
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(CONFIG.COLUMNS.ID, 80);
    sheet.setColumnWidth(CONFIG.COLUMNS.TITLE, 200);
    sheet.setColumnWidth(CONFIG.COLUMNS.CONTENT, 400);

    sheet.getRange(2, 1, 999, headers.length).applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY);

    const defaultSheet = ss.getSheetByName('シート1');
    if (defaultSheet) ss.deleteSheet(defaultSheet);
  }
  return ss.getId();
}

/**
 * データの保存・提出（排他制御あり）
 */
function saveOrSubmitDraft(draftData, isSubmit = false) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(CONFIG.LOCK_TIMEOUT);
  } catch (e) {
    return { status: 'error', message: 'サーバーが混雑しています。少し待ってから再試行してください。' };
  }

  try {
    const props = PropertiesService.getScriptProperties();
    const ss = SpreadsheetApp.openById(props.getProperty('SPREADSHEET_ID'));
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    const now = new Date();
    
    // 送信されてきたステータスを優先し、児童の「提出」アクションの時のみ強制上書きする
    let status = draftData.status || 'draft';
    if (isSubmit) status = 'submitted';

    // 既存データの更新
    if (draftData.id) {
      const foundRow = findRowById_(sheet, draftData.id);
      if (foundRow > 0) {
        const isDeleted = sheet.getRange(foundRow, CONFIG.COLUMNS.DELETED_AT).getValue();
        if (isDeleted) return { status: 'error', message: 'このデータは削除されています。' };

        sheet.getRange(foundRow, CONFIG.COLUMNS.TITLE).setValue(draftData.title);
        sheet.getRange(foundRow, CONFIG.COLUMNS.CLASS).setValue(draftData.class);
        sheet.getRange(foundRow, CONFIG.COLUMNS.NAME).setValue(draftData.name);
        sheet.getRange(foundRow, CONFIG.COLUMNS.CONTENT).setValue(draftData.content);
        sheet.getRange(foundRow, CONFIG.COLUMNS.UPDATED_AT).setValue(now);
        sheet.getRange(foundRow, CONFIG.COLUMNS.STATUS).setValue(status);

        if (draftData.correction !== undefined) sheet.getRange(foundRow, CONFIG.COLUMNS.CORRECTION).setValue(draftData.correction);
        if (draftData.teacherCmt !== undefined) sheet.getRange(foundRow, CONFIG.COLUMNS.TEACHER_CMT).setValue(draftData.teacherCmt);

        return { status: 'success', message: status === 'submitted' ? '提出が完了しました。' : '保存しました。', id: draftData.id, docStatus: status };
      }
    }
    
    // 新規作成
    const newId = Utilities.getUuid();
    sheet.appendRow([
      newId, draftData.title, draftData.class, draftData.name, draftData.content,
      now, now, '', status, draftData.correction || '', ''
    ]);
    return { status: 'success', message: status === 'submitted' ? '提出が完了しました。' : '保存しました。', id: newId, docStatus: status };

  } catch (e) {
    return { status: 'error', message: 'サーバーエラー: ' + e.message };
  } finally {
    lock.releaseLock(); 
  }
}

/**
 * リストの取得
 */
function getDraftList(mode = 'student', password = '') {
  try {
    if (mode === 'teacher' && password !== getTeacherPassword_()) {
      return { status: 'error', message: 'パスワードが間違っています。' };
    }

    const props = PropertiesService.getScriptProperties();
    const ss = SpreadsheetApp.openById(props.getProperty('SPREADSHEET_ID'));
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    const lastRow = sheet.getLastRow();
    
    if (lastRow < 2) return { status: 'success', data: [] };

    const values = sheet.getRange(2, 1, lastRow - 1, 11).getValues();

    const drafts = values
      .filter(row => row[CONFIG.COLUMNS.DELETED_AT - 1] === '')
      .filter(row => {
        if (mode === 'student') return true;
        const st = row[CONFIG.COLUMNS.STATUS - 1];
        return ['submitted', 'rework', 'completed', 'returned'].includes(st);
      })
      .map(row => ({
        id: row[CONFIG.COLUMNS.ID - 1],
        title: row[CONFIG.COLUMNS.TITLE - 1],
        class: row[CONFIG.COLUMNS.CLASS - 1],
        name: row[CONFIG.COLUMNS.NAME - 1],
        content: row[CONFIG.COLUMNS.CONTENT - 1],
        correction: mode === 'teacher' ? row[CONFIG.COLUMNS.CORRECTION - 1] : undefined,
        teacherCmt: mode === 'teacher' ? row[CONFIG.COLUMNS.TEACHER_CMT - 1] : undefined,
        updatedAtRaw: new Date(row[CONFIG.COLUMNS.UPDATED_AT - 1]),
        status: row[CONFIG.COLUMNS.STATUS - 1] || 'draft'
      }))
      .sort((a, b) => b.updatedAtRaw - a.updatedAtRaw);

    const formatted = drafts.map(d => ({
      ...d,
      updatedAt: Utilities.formatDate(d.updatedAtRaw, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm'),
      updatedAtRaw: undefined
    }));

    return { status: 'success', data: formatted };

  } catch (e) {
    return { status: 'error', message: 'データ取得に失敗しました: ' + e.message };
  }
}

/**
 * 特定の作文データを取得
 */
function loadDraft(id) {
  try {
    const props = PropertiesService.getScriptProperties();
    const ss = SpreadsheetApp.openById(props.getProperty('SPREADSHEET_ID'));
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    const rowIndex = findRowById_(sheet, id);
    
    if (rowIndex > 0) {
      const rowData = sheet.getRange(rowIndex, 1, 1, 11).getValues()[0];
      if (rowData[CONFIG.COLUMNS.DELETED_AT - 1] !== '') return { status: 'error', message: '削除されたデータです。' };

      return {
        status: 'success',
        data: {
          id: rowData[CONFIG.COLUMNS.ID - 1],
          title: rowData[CONFIG.COLUMNS.TITLE - 1],
          class: rowData[CONFIG.COLUMNS.CLASS - 1],
          name: rowData[CONFIG.COLUMNS.NAME - 1],
          content: rowData[CONFIG.COLUMNS.CONTENT - 1],
          status: rowData[CONFIG.COLUMNS.STATUS - 1] || 'draft',
          correction: rowData[CONFIG.COLUMNS.CORRECTION - 1],
          teacherCmt: rowData[CONFIG.COLUMNS.TEACHER_CMT - 1]
        }
      };
    }
    return { status: 'error', message: 'データが見つかりませんでした。' };
  } catch (e) { return { status: 'error', message: e.message }; }
}

function findRowById_(sheet, id) {
  const textFinder = sheet.getRange("A:A").createTextFinder(id);
  const match = textFinder.matchEntireCell(true).findNext();
  return match ? match.getRow() : -1;
}

// --- 設定・API管理機能 ---

/**
 * 教師用パスワードの更新（フロントから呼ばれる）
 */
function updateTeacherPassword(newPassword) {
  PropertiesService.getScriptProperties().setProperty('TEACHER_PASSWORD', newPassword);
  return 'パスワードを更新しました';
}

function setGeminiApiKey(key) {
  PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', key);
  return 'APIキーを保存しました';
}

function hasGeminiKey() {
  return !!PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
}

/**
 * Gemini APIを用いたAI自動添削
 */
function analyzeEssayWithGemini(title, grade, content) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) throw new Error('APIキーが設定されていません。設定画面から登録してください。');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  
  const systemPrompt = `
あなたは日本の公立小学校のベテラン教師です。児童の作文に対して教育的な添削を行います。
誤字脱字、言葉の誤用、段落構成について指摘し、温かいコメントを心がけてください。
以下のJSON配列のみを出力してください。Markdownのコードブロックは含めないでください。
[
  {
    "quote": "指摘対象の文字列（本文からそのまま抜き出すこと）",
    "comment": "先生からのアドバイス"
  }
]
  `;

  const userMessage = `【学年】${grade}\n【題名】${title}\n【本文】\n${content}`;

  const payload = {
    contents: [{ parts: [{ text: userMessage }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: { responseMimeType: "application/json" }
  };

  try {
    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    
    const json = JSON.parse(response.getContentText());
    if (json.error) throw new Error(json.error.message);
    if (!json.candidates || json.candidates.length === 0) return [];

    return JSON.parse(json.candidates[0].content.parts[0].text);
  } catch (e) {
    throw new Error('AI添削中にエラーが発生しました: ' + e.message);
  }
}
