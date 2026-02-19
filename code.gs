/**
 * オンライン原稿用紙 Pro - GIGA Edition
 * バージョン: 2.4.0
 */

const SHEET_NAME = '作文データ';
const TEACHER_PASSWORD = 'admin'; // 運用に合わせて変更してください

// カラム定義
const COLUMNS = {
  ID: 1, TITLE: 2, CLASS: 3, NAME: 4, CONTENT: 5,
  CREATED_AT: 6, UPDATED_AT: 7, DELETED_AT: 8,
  STATUS: 9, CORRECTION: 10, TEACHER_CMT: 11
};

/**
 * Webアプリのエントリーポイント
 */
function doGet() {
  initDatabase(); // DB初期化チェック
  
  return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('オンライン原稿用紙 Pro')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * HTML内で別ファイルを読み込むための関数
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * データベースの初期化・自己修復
 */
function initDatabase() {
  const props = PropertiesService.getScriptProperties();
  let ssId = props.getProperty('SPREADSHEET_ID');
  let ss;

  if (ssId) {
    try { ss = SpreadsheetApp.openById(ssId); } catch(e) { ssId = null; }
  }

  if (!ssId) {
    ss = SpreadsheetApp.create('オンライン原稿用紙Pro_データ');
    props.setProperty('SPREADSHEET_ID', ss.getId());
  }

  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    const headers = ['ID', '題名', '学年・クラス', '氏名', '本文', '作成日時', '更新日時', '削除日時', 'ステータス', '添削データ', '先生コメント'];
    
    const range = sheet.getRange(1, 1, 1, headers.length);
    range.setValues([headers]);
    
    range.setFontWeight('bold')
         .setBackground('#1a73e8')
         .setFontColor('#ffffff')
         .setHorizontalAlignment('center');
    
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(COLUMNS.ID, 50);
    sheet.setColumnWidth(COLUMNS.TITLE, 150);
    sheet.setColumnWidth(COLUMNS.CONTENT, 300);

    sheet.getRange(2, 1, 999, headers.length).applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY);

    const defaultSheet = ss.getSheetByName('シート1');
    if (defaultSheet) ss.deleteSheet(defaultSheet);
  }
  return ss.getId();
}

// --- 開発用ツール ---
function createDummyData() {
  const props = PropertiesService.getScriptProperties();
  const ssId = props.getProperty('SPREADSHEET_ID');
  if (!ssId) {
    initDatabase();
    return createDummyData();
  }
  
  const ss = SpreadsheetApp.openById(ssId);
  const sheet = ss.getSheetByName(SHEET_NAME);
  const now = new Date();
  
  const dummySamples = [
    {
      title: '運動会の思い出', class: '5年1組', name: '山田 太郎', status: 'submitted',
      content: '　五月晴れの空の下、小学校最後の運動会が行われました。\n　僕は、徒競走で一番になることを目標に、毎日練習を重ねてきました。スタートの合図とともに、地面を蹴って走り出しました。風を切る音が耳元で聞こえます。\n　ゴールテープを切った瞬間、歓声が湧き上がりました。一等賞です。練習の成果が出せて、本当に嬉しかったです。'
    },
    {
      title: '修学旅行', class: '6年2組', name: '佐藤 花子', status: 'rework',
      content: '　待ちに待った修学旅行の日がやってきました。行き先は日光です。\n　バスの中では、バスガイドさんが面白い話をしてくれました。東照宮の陽明門を見たときは、その豪華さに圧倒されました。\n　夜は、友達と遅くまでおしゃべりをして、先生に怒られてしまいましたが、それも良い思い出です。'
    },
    {
      title: '将来の夢', class: '6年1組', name: '鈴木 一郎', status: 'completed',
      content: '　僕の将来の夢は、プログラマーになることです。\n　パソコンを使って、世の中の役に立つアプリを作りたいと思っています。今はまだ難しいコードは書けませんが、少しずつ勉強しています。\n　いつか、世界中の人が使うようなすごいシステムを開発してみたいです。'
    },
    {
      title: '読書感想文「銀河鉄道の夜」', class: '5年3組', name: '田中 美咲', status: 'submitted',
      content: '　宮沢賢治の「銀河鉄道の夜」を読みました。\n　ジョバンニとカムパネルラが、銀河ステーションから不思議な列車に乗って旅をする物語です。「本当の幸い」とは何だろう、と考えさせられました。\n　サソリの火のエピソードが特に印象に残っています。'
    },
    {
      title: '夏休みの自由研究', class: '4年2組', name: '高橋 健太', status: 'draft',
      content: '　今年の夏休みは、カブトムシの観察をしました。\n　近所の森でカブトムシを捕まえて、家で飼うことにしました。エサのゼリーを食べる様子や、夜になると元気に動き回る様子を毎日ノートに記録しました。\n　オスとメスの違いや、足の形などもスケッチしました。'
    }
  ];

  const rows = dummySamples.map(d => [
    Utilities.getUuid(),
    d.title,
    d.class,
    d.name,
    d.content,
    now,
    now,
    '', 
    d.status,
    '', 
    '' 
  ]);

  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow + 1, 1, rows.length, rows[0].length).setValues(rows);
  console.log('ダミーデータを作成しました');
}

// --- API Methods ---

function saveOrSubmitDraft(draftData, isSubmit = false) {
  const lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (e) { return { status: 'error', message: 'サーバー混雑中' }; }

  try {
    const props = PropertiesService.getScriptProperties();
    const ss = SpreadsheetApp.openById(props.getProperty('SPREADSHEET_ID'));
    const sheet = ss.getSheetByName(SHEET_NAME);
    const now = new Date();
    
    let status = 'draft';
    if (draftData.status) status = draftData.status;
    else if (isSubmit) status = 'submitted';

    if (draftData.id) {
      const foundRow = findRowById_(sheet, draftData.id);
      if (foundRow > 0) {
        const rowData = sheet.getRange(foundRow, 1, 1, 11).getValues()[0];
        if (rowData[COLUMNS.DELETED_AT - 1]) return { status: 'error', message: '削除されています' };

        sheet.getRange(foundRow, COLUMNS.TITLE).setValue(draftData.title);
        sheet.getRange(foundRow, COLUMNS.CLASS).setValue(draftData.class);
        sheet.getRange(foundRow, COLUMNS.NAME).setValue(draftData.name);
        sheet.getRange(foundRow, COLUMNS.CONTENT).setValue(draftData.content);
        sheet.getRange(foundRow, COLUMNS.UPDATED_AT).setValue(now);
        sheet.getRange(foundRow, COLUMNS.STATUS).setValue(status);

        if (draftData.correction !== undefined) sheet.getRange(foundRow, COLUMNS.CORRECTION).setValue(draftData.correction);
        if (draftData.teacherCmt !== undefined) sheet.getRange(foundRow, COLUMNS.TEACHER_CMT).setValue(draftData.teacherCmt);

        return { status: 'success', message: status === 'submitted' ? '提出しました！' : '保存しました。', id: draftData.id, docStatus: status };
      }
    }
    
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

function getDraftList(mode = 'student', password = '', criteria = null) {
  try {
    if (mode === 'teacher' && password !== TEACHER_PASSWORD) return { status: 'error', message: 'パスワードが違います。' };

    const props = PropertiesService.getScriptProperties();
    const ss = SpreadsheetApp.openById(props.getProperty('SPREADSHEET_ID'));
    const sheet = ss.getSheetByName(SHEET_NAME);
    const lastRow = sheet.getLastRow();
    
    if (lastRow < 2) return { status: 'success', data: [] };

    const values = sheet.getRange(2, 1, lastRow - 1, 11).getValues();

    let drafts = values
      .filter(row => row[COLUMNS.DELETED_AT - 1] === '')
      .filter(row => {
        if (mode === 'student') return true;
        const st = row[COLUMNS.STATUS - 1];
        return st === 'submitted' || st === 'rework' || st === 'completed' || st === 'returned';
      })
      .map(row => ({
        id: row[COLUMNS.ID - 1],
        title: row[COLUMNS.TITLE - 1],
        class: row[COLUMNS.CLASS - 1],
        name: row[COLUMNS.NAME - 1],
        content: row[COLUMNS.CONTENT - 1],
        correction: mode === 'teacher' ? row[COLUMNS.CORRECTION - 1] : undefined,
        teacherCmt: mode === 'teacher' ? row[COLUMNS.TEACHER_CMT - 1] : undefined,
        updatedAtRaw: new Date(row[COLUMNS.UPDATED_AT - 1]),
        status: row[COLUMNS.STATUS - 1] || 'draft'
      }));

    if (criteria) {
      if (criteria.keyword) {
        const kw = criteria.keyword.toLowerCase();
        drafts = drafts.filter(d => {
          const text = ((d.title||'') + (d.name||'') + (d.content||'')).toLowerCase();
          return text.includes(kw);
        });
      }
      if (criteria.dateStart) {
        const start = new Date(criteria.dateStart);
        start.setHours(0, 0, 0, 0);
        drafts = drafts.filter(d => d.updatedAtRaw >= start);
      }
      if (criteria.dateEnd) {
        const end = new Date(criteria.dateEnd);
        end.setHours(23, 59, 59, 999);
        drafts = drafts.filter(d => d.updatedAtRaw <= end);
      }
      if (criteria.excludeCompleted && mode === 'teacher') {
        drafts = drafts.filter(d => d.status !== 'completed');
      }
    }

    drafts.sort((a, b) => b.updatedAtRaw - a.updatedAtRaw);

    const isFiltering = criteria && (criteria.keyword || criteria.dateStart || criteria.dateEnd || criteria.excludeCompleted);
    
    if (!isFiltering) {
      drafts = drafts.slice(0, 50);
    }

    const formatted = drafts.map(d => ({
      ...d,
      updatedAt: Utilities.formatDate(d.updatedAtRaw, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm'),
      updatedAtRaw: undefined
    }));

    return { status: 'success', data: formatted };

  } catch (e) {
    return { status: 'error', message: 'リスト取得失敗: ' + e.message };
  }
}

function loadDraft(id) {
  try {
    const props = PropertiesService.getScriptProperties();
    const ss = SpreadsheetApp.openById(props.getProperty('SPREADSHEET_ID'));
    const sheet = ss.getSheetByName(SHEET_NAME);
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

function findRowById_(sheet, id) {
  const textFinder = sheet.getRange("A:A").createTextFinder(id);
  const match = textFinder.matchEntireCell(true).findNext();
  return match ? match.getRow() : -1;
}

// --- Gemini API 連携 ---

function setGeminiApiKey(key) {
  PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', key);
  return '保存しました';
}

function hasGeminiKey() {
  return !!PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
}

/**
 * Gemini APIを使って作文を添削する
 */
function analyzeEssayWithGemini(title, grade, content) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) throw new Error('APIキーが設定されていません。設定画面からキーを保存してください。');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  
  const systemPrompt = `
あなたは日本の公立小学校のベテラン教師です。
学習指導要領の趣旨（主体的・対話的で深い学び）を踏まえ、児童の作文に対して教育的な添削を行ってください。
児童の意欲を削ぐような否定的な言葉は避け、気付きを促すような温かいコメントを心がけてください。

【タスク】
提供された「題名」「学年」「本文」を読み、修正すべき箇所やアドバイスが必要な箇所を特定してください。
誤字脱字、言葉の誤用、主語と述語のねじれ、段落の構成、表現の工夫などについて指摘してください。

【出力形式】
以下のJSON配列のみを出力してください。Markdownのコードブロック（\`\`\`json）は含めないでください。
[
  {
    "quote": "指摘対象の文字列（本文からそのまま抜き出す）",
    "comment": "先生からのコメント"
  }
]

※修正箇所がない場合は空の配列 [] を返してください。
※quoteは本文中に存在する文字列と完全に一致させてください。
  `;

  const userMessage = `
【学年】${grade}
【題名】${title}
【本文】
${content}
  `;

  const payload = {
    contents: [{ parts: [{ text: userMessage }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: { responseMimeType: "application/json" }
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const json = JSON.parse(response.getContentText());
    
    if (json.error) throw new Error(json.error.message);
    if (!json.candidates || json.candidates.length === 0) return [];

    const resultText = json.candidates[0].content.parts[0].text;
    return JSON.parse(resultText);
  } catch (e) {
    throw new Error('AI添削中にエラーが発生しました: ' + e.message);
  }
}

/**
 * 権限付与のためのダミー関数
 * これを実行することで、UrlFetchAppなどの権限承認画面が表示されます
 */
function requestExternalPermission() {
  // 実際にfetchを呼ばないと権限が要求されないため、Googleへダミーリクエストを行います
  console.log("権限確認用: UrlFetchApp.fetch を実行します");
  try {
    UrlFetchApp.fetch("https://www.google.com");
  } catch (e) {
    // 実行自体は成功しなくても、権限ポップアップが出ればOKです
    console.log("実行完了: " + e.message);
  }
}
