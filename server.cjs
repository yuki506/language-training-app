// **役割**: メインのサーバーサイドロジックを管理します。ストーリーとファイルのAPIエンドポイントを設定し、データベースに接続して操作を行います。
// **機能**:
// APIエンドポイント
// ファイルアップロード
// データベース処理
//const dotenv = require('dotenv');
//dotenv.config();  // dotenvを読み込む
const OpenAI = require('openai');
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const natural = require('natural'); //類似性
const plainPassword = "req.body.password";  // ハッシュ化したいパスワード
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const helmet = require('helmet');
const fs = require('fs');
const { fileURLToPath } = require('url');
const bodyParser = require('body-parser');
const cors = require('cors');
const ensureAuthenticated = require('./app/SessionMiddleware.cjs');

//openAiの設定
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
const app = express();

// EJSをテンプレートエンジンとして設定
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));  // viewsフォルダを指定

// 他の認証が必要なルートも同様に適用できます
app.get('/protected-route', ensureAuthenticated, (req, res) => {
    res.json({ message: '認証されました！' });
});

// nonceを生成してテンプレートに渡すミドルウェア
app.use((req, res, next) => {
    res.locals.nonce = crypto.randomBytes(16).toString('base64');
    next();
});

//httpsの強制
if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
      // HTTPの場合はHTTPSにリダイレクト
      if (req.protocol === 'http') {
        return res.redirect(301, `https://${req.headers.host}${req.url}`);
      }
      next();
    });
  }
  
// HelmetでCSPを設定
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'", "https://language-training-app.herokuapp.com"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", "data:", "https://language-training-app.herokuapp.com"],
                connectSrc: ["'self'", "https://language-training-app.herokuapp.com"],
                fontSrc: ["'self'", "https://fonts.gstatic.com"],
                objectSrc: ["'none'"],
                upgradeInsecureRequests: [],
            },
        },
        frameguard: true,
        hidePoweredBy: true,
        hsts: true,
        ieNoOpen: true,
        noSniff: true,
        xssFilter: true,
    })
);

// favicon.icoのリクエストを無視する設定
app.get('/favicon.ico', (req, res) => res.status(204));

// 本番環境でPostgreSQL、ローカル環境でSQLiteを使用
let db;
if (process.env.DATABASE_URL) {
  // 本番環境（Herokuなど）ではPostgreSQLを使用
  const { Pool } = require('pg');
  const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
  });
  db = pool;
} else {
  // ローカル開発環境ではSQLiteを使用
  const sqlite3 = require('sqlite3').verbose();
  db = new sqlite3.Database('./database.sqlite');  // SQLite接続
}

// ポート番号の設定
const port = process.env.PORT || 3000;

// ランダムな秘密キーを生成
const secretKey = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
console.log(secretKey); // コンソールに生成されたキーが表示される
// 不正な文字（スラッシュや特殊文字）を除去する関数

function sanitizeKey(key) {
    return key.replace(/[^A-Za-z0-9_]/g, ''); // アルファベット、数字、アンダースコア以外を削除
  }
  const sanitizedSecretKey = sanitizeKey(secretKey);
//セッション管理  
  app.use(session({
    store: new SQLiteStore({ db: 'sessions.sqlite', dir: './sessions' }),
    secret: sanitizedSecretKey, // 修正されたシークレットキーを使用
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 20 * 60 * 1000 },
  }));

//ログインしているか確認するAPI
// API認証チェック
app.get('/api/check-auth', (req, res) => {
    console.log("セッション確認 - ユーザーID:", req.session.userId); // デバッグ用にセッション情報を出力
    if (req.session && req.session.userId) {
        res.json({ authenticated: true, userId: req.session.userId });
    } else {
        res.json({ authenticated: false });
    }
});

//ミドルウェア
app.use(cors({
    origin: 'https://language-training-app.herokuapp.com',  // 本番環境のURLを指定
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  }));
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));  // URLエンコードされたデータを解析

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
// レベルを計算する関数をここに追加
function calculateLevel(currentPoints) {
    if (currentPoints >= 200) {
        return "上級";
    } else if (currentPoints >= 100) {
        return "中級";
    } else {
        return "初級";
    }
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
// ファイルディレクトリの設定
const uploadsDir1 = path.join(__dirname, 'app', 'cognitive_training', 'social_skill', 'social-uploads');
//app.use(express.static(path.join(__dirname, 'app', 'cognitive_training')));
const uploadsDir2 = path.join(__dirname, 'app', 'language_training', 'language-uploads');

//静的ファイルの提供設定
app.use('/social-uploads', express.static(uploadsDir1)); //ソーシャルスキルのアップロードディレクトリ
app.use('/language-uploads', express.static(uploadsDir2)); //言語訓練のアップロードディレクトリ

app.use('/public', express.static(path.join(__dirname, 'public'))); // 公共のCSSやJSファイルを提供
app.use('/images', express.static(path.join(__dirname, 'app', 'images'))); // 画像フォルダを提供
app.use(express.static(path.join(__dirname, 'public')));

// JavaScriptとCSSファイルのContent-Typeを設定
app.use('/app', express.static(path.join(__dirname, 'app'), {
    setHeaders: function (res, filePath) {
        if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        } else if (filePath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        }
    }
}));
// JavaScriptとCSSファイルのContent-Typeを設定
app.use('/public', express.static(path.join(__dirname, 'public'), {
    setHeaders: function (res, filePath) {
        if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        } else if (filePath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        }
    }
}));

// データベース初期化（SQLiteの書き換え）
async function initializeDatabase() {
    if (db instanceof sqlite3.Database) {
        console.log("SQLiteデータベースの初期化を開始します...");
        // SQLite用のテーブル作成処理
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS users (
                user_id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                gender TEXT,
                age INTEGER,
                email TEXT UNIQUE NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
            db.run(`CREATE TABLE IF NOT EXISTS social_stories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                content TEXT NOT NULL
            )`);
            db.run(`CREATE TABLE IF NOT EXISTS media_files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_name TEXT NOT NULL,
                file_type TEXT NOT NULL,
                file_path TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // カテゴリーテーブル
            db.run(`
                CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL
                )
            `);

            // サブカテゴリーテーブル
            db.run(`
                CREATE TABLE IF NOT EXISTS subcategories (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                parent_id INTEGER NOT NULL,
                FOREIGN KEY (parent_id) REFERENCES categories (id)
                )
            `);

            // フラッシュカードテーブル（カラム追加対応済み）
            db.run(`
                CREATE TABLE IF NOT EXISTS flashcards (
                id INTEGER PRIMARY KEY,
                text TEXT NOT NULL,
                image TEXT NOT NULL,
                category TEXT NOT NULL,
                subcategory_id INTEGER,
                level TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (subcategory_id) REFERENCES subcategories (id)
                )
            `);
            
            // 進捗管理テーブル
            db.run(`CREATE TABLE IF NOT EXISTS progress (
                user_id INTEGER,
                story_id INTEGER PRIMARY KEY AUTOINCREMENT,
                level TEXT DEFAULT '初級',
                points INTEGER DEFAULT 0,
                badges TEXT,
                medals INTEGER,
                completed_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
            
            // クイズ質問テーブル
            db.run(`CREATE TABLE IF NOT EXISTS quiz_questions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                question_id INTEGER,
                question_text TEXT NOT NULL,
                category TEXT,
                difficulty_level TEXT,
                correct_answer TEXT NOT NULL
            )`);
            
            // ユーザーのクイズ回答履歴
            db.run(`CREATE TABLE IF NOT EXISTS quiz_answers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                question_id INTEGER,
                user_answer TEXT NOT NULL,
                is_correct BOOLEAN,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            //進捗レポート
            db.run(`CREATE TABLE IF NOT EXISTS progress_reports (
                report_id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                report_date DATETIME,
                strengths TEXT,
                weaknesses TEXT,
                suggestions TEXT,
                progress_percentage INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
        });
        console.log("SQLiteデータベースの初期化が完了しました。");
    } else if (db instanceof Pool) {
        // PostgreSQL用のテーブル作成処理
        console.log("PostgreSQLデータベースの初期化を開始します...");
        // PostgreSQL用のテーブル作成処理
        const client = await db.connect();
        try {
            await client.query(`
                CREATE TABLE IF NOT EXISTS users (
                    user_id SERIAL PRIMARY KEY,
                    username TEXT UNIQUE NOT NULL,
                    password TEXT NOT NULL,
                    gender TEXT,
                    age INTEGER,
                    email TEXT UNIQUE NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            await client.query(`
                CREATE TABLE IF NOT EXISTS social_stories (
                    id SERIAL PRIMARY KEY,
                    title TEXT NOT NULL,
                    content TEXT NOT NULL
                )
            `);

            await client.query(`
                CREATE TABLE IF NOT EXISTS media_files (
                    id SERIAL PRIMARY KEY,
                    file_name TEXT NOT NULL,
                    file_type TEXT NOT NULL,
                    file_path TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            // カテゴリーテーブル
            await client.query(`
                CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL
                )
            `);
            // サブカテゴリーテーブル
            await client.query(`
                CREATE TABLE IF NOT EXISTS subcategories (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                parent_id INTEGER NOT NULL,
                FOREIGN KEY (parent_id) REFERENCES categories (id)
                )
            `);
            // フラッシュカードテーブル（カラム追加対応済み）
            await client.query(`
                CREATE TABLE IF NOT EXISTS flashcards (
                id INTEGER PRIMARY KEY,
                text TEXT NOT NULL,
                image TEXT NOT NULL,
                category TEXT NOT NULL,
                subcategory_id INTEGER,
                level TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (subcategory_id) REFERENCES subcategories (id)
                )
            `);
            // 進捗管理テーブル
            await client.query(`
                CREATE TABLE IF NOT EXISTS progress (
                user_id INTEGER,
                story_id INTEGER PRIMARY KEY AUTOINCREMENT,
                level TEXT DEFAULT '初級',
                points INTEGER DEFAULT 0,
                badges TEXT,
                medals INTEGER,
                completed_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            // クイズ質問テーブル
            await client.query(`
                CREATE TABLE IF NOT EXISTS quiz_questions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                question_id INTEGER,
                question_text TEXT NOT NULL,
                category TEXT,
                difficulty_level TEXT,
                correct_answer TEXT NOT NULL
                )
            `);
            // ユーザーのクイズ回答履歴
            await client.query(`
                CREATE TABLE IF NOT EXISTS quiz_answers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                question_id INTEGER,
                user_answer TEXT NOT NULL,
                is_correct BOOLEAN,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            //進捗レポート
            await client.query(`
                CREATE TABLE IF NOT EXISTS progress_reports (
                report_id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                report_date DATETIME,
                strengths TEXT,
                weaknesses TEXT,
                suggestions TEXT,
                progress_percentage INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            console.log("PostgreSQLデータベースの初期化が完了しました。");

        } catch (err) {
            console.error('PostgreSQLテーブル作成エラー:', err);
        } finally {
            client.release();
        }
    }
}

// データベースの初期化呼び出す
initializeDatabase()
    .then(() => {
        console.log("データベース初期化完了");
    })
    .catch((err) => {
        console.error("データベース初期化エラー:", err);
    });
////////////////////////////////////////////////////////////////////////////////////////////////////////////
// ユーザー登録エンドポイント
app.post('/register', (req, res) => {
    const { username, password, gender, age, email } = req.body;
    // パスワードをハッシュ化
    bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) {
            console.error('ハッシュ化エラー:', err);
            return res.status(500).json({ success: false, message: 'サーバーエラーが発生しました。' });
        }

        // ユーザー情報をデータベースに挿入
        db.run("INSERT INTO users (username, password, gender, age, email, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
            [username, hashedPassword, gender, age, email], 
            function(err) {
                if (err) {
                    console.error('ユーザー登録エラー:', err);
                    return res.status(500).json({ success: false, message: 'ユーザー登録に失敗しました。' });
                }
                res.json({ success: true });
            });
    });
});
//////////////////////////////////////////////////////////////////////////////////////////////////////////
// メインページのルーティング（EJSレンダリングに変更）
app.get('/main', ensureAuthenticated, (req, res) => {
    res.render('main');
});
//////////////////////////////////////////////////////////////////////////////////////////////////////////
// ログイン処理
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
        if (err) {
            console.error("データベースエラー:", err);
            return res.status(500).json({ success: false, message: 'サーバーエラー' });
        }

        if (!user) {
            console.log("ユーザーが見つかりません:", username);
            return res.json({ success: false, message: 'ユーザー名かパスワードが間違っています' });
        }
        console.log("取得したユーザー情報:", user);

        if (!bcrypt.compareSync(password, user.password)) {
            console.log("パスワードが一致しません:", password);
            return res.json({ success: false, message: 'ユーザー名かパスワードが間違っています' });
        }

        // ユーザーIDをセッションに保存
        req.session.userId = user.user_id;
        console.log("デバッグ - 保存するユーザーID:", user.user_id);  // 追加のデバッグ
        console.log("セッションに保存されたユーザーID:", req.session.userId);

        db.get("SELECT points, medals FROM progress WHERE user_id = ?", [user.user_id], (err, progress) => {
            if (err) {
                console.error("進捗データの取得エラー:", err);
                return res.status(500).json({ success: false, message: 'サーバーエラー' });
            }
            
            console.log("ログイン時の取得ポイント:", progress ? progress.points : 0); // ログ追加
            //req.session.sessionPoints = progress ? progress.points : 0; // セッションに初期値保存
            console.log("ログイン後のセッションポイント:", req.session.sessionPoints); // 確認用ログ

            req.session.sessionPoints = progress ? progress.points : 0;
            req.session.sessionMedals = progress ? progress.medals : 0;

            // セッション保存のデバッグ
            req.session.save((err) => {
                if (err) {
                    console.log("セッション保存エラー:", err);
                    return res.status(500).json({ success: false, message: 'セッション保存エラー' });
                }

                console.log("セッション保存完了:", req.session);
                res.json({ success: true, redirectUrl: '/main', message: '/ログイン成功' });
            });
        });
    });
});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//ログアウト処理
app.post('/api/logout', (req, res) => {
    console.log("API '/api/logout' が呼び出されました"); // デバッグログを追加

    req.session.destroy((err) => {
        if (err) {
            console.error('セッション破棄エラー:', err);
            return res.status(500).json({ success: false, message: 'ログアウトに失敗しました' });
        }

        res.clearCookie('sessionId'); // セッションIDを削除
        console.log("ログアウト成功: セッションが破棄されました"); // デバッグログを追加
        res.status(200).json({ success: true, message: 'ログアウトに成功しました' });
    });
});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// 例: `login.html`を提供するルート
app.get('/index', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 認証が必要なメインページの提供
app.get('main', (req, res) => {
    if (!req.session.userId) {
        // 認証されていなければログインページにリダイレクト
        return res.redirect('/index');
    }
    res.sendFile(path.join(__dirname, 'app', 'main'));
});


// ストーリーをデータベースに追加するAPI
app.post('/api/add-story', (req, res) => {
    const { title, content } = req.body;
    // データベースに挿入し、挿入されたストーリーのIDを取得
    db.run("INSERT INTO social_stories (title, content) VALUES (?, ?)", [title, content], function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        // 挿入されたIDを基にストーリーを取得
        const insertedId = this.lastID;
        db.get("SELECT * FROM social_stories WHERE id = ?", [insertedId], (err, row) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            // 追加されたストーリーを返す
            res.json(row);
        });
    });
});
/////////////////////GET////////////////////////////////////////////////////////////////////////////////
// ユーザーの進捗状況を取得するAPI
app.get('/api/get-progress/:userId', (req, res) => {
    const userId = req.params.userId;

    db.get("SELECT * FROM progress WHERE user_id = ?", [userId], (err, row) => {
        if (err) {
            console.error("データベースエラー:", err);
            return res.status(500).json({ success: false, message: 'データベースエラー' });
        }

        if (row) {
            req.session.sessionPoints = row.points || 0;
            req.session.sessionMedals = row.medals || 0;
            req.session.difficultyLevel = row.level || "初級";

            // 必ずセッションを保存
            req.session.save((saveErr) => {
                if (saveErr) {
                    console.error("セッション保存エラー:", saveErr);
                    return res.status(500).json({ success: false, message: 'セッション保存に失敗しました' });
                }
                // 統合したレスポンスを返す
                res.json({
                    success: true,
                    profile: userId,
                    //progress: userProgress || { level: "初級" }, // デフォルトレベルを "初級" に設定
                    difficultyLevel: req.session.difficultyLevel || "初級",
                });
            });
        } else {
            res.status(404).json({ success: false, message: '進捗データが見つかりません' });
        }
    });
});
//////////////////PUT///////////////////////////////////////////////////////////////////////////////////////////
// ユーザーの進捗を更新するAPI
app.put('/api/progress/:userId', (req, res) => {
    const userId = req.params.userId;
    const newProgress = req.body.level || 1; // フロントエンドから送られた進捗データ、初期値は１
    // まず、ユーザーの進捗がデータベースに存在するか確認
    db.get("SELECT * FROM progress WHERE user_id = ?", [userId], (err, row) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'データベースエラー' });
        }

        if (row) {
            // 既存の進捗がある場合、進捗を更新
            db.run("UPDATE progress SET progress_level = ? WHERE user_id = ?", [newProgress, userId], function(err) {
                if (err) {
                    return res.status(500).json({ success: false, message: 'データベースエラー' });
                }
                res.json({ success: true, message: '進捗が更新されました', level: newProgress });
            });
        } else {
            // 進捗が存在しない場合、新しい進捗レコードを作成
            db.run("INSERT INTO progress (user_id, progress_level) VALUES (?, ?)", [userId, newProgress], function(err) {
                if (err) {
                    return res.status(500).json({ success: false, message: 'データベースエラー' });
                }
                res.json({ success: true, message: '新しい進捗が追加されました', level: newProgress });
            });
        }
    });
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// ファイルアップロード用の設定
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir1);
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage: storage });

// ファイルをアップロードするAPI
app.post('/api/upload', upload.single('file'), (req, res) => {
    const file = req.file;
    if (!file) {
        return res.status(400).json({ success: false, message: 'ファイルがアップロードされていません' });
    }
    const relativePath = `/social-uploads/${file.filename}`;
    db.run("INSERT INTO media_files (file_name, file_type, file_path) VALUES (?, ?, ?)",
        [file.originalname, file.mimetype, file.path], function (err) {
        if (err) {
            return res.status(500).json({ success: false, message: 'データベースエラー' });
        }
        res.json({ success: true, message: 'ファイルがアップロードされました', filePath: relativePath });
    });
});

// アップロードされたファイルを取得するAPI
app.get('/api/media-files', (req, res) => {
    db.all("SELECT * FROM media_files ORDER BY created_at DESC LIMIT 1", [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// OpenAIを使ってストーリーを生成するAPI
app.post('/api/generate-story', async (req, res) => {
    const { title, content, fileName, fileType } = req.body;  // ファイル情報を追加
    try {
        console.log('API呼び出し開始');

// OpenAI APIリクエストにファイルの情報を含める
        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                { role: 'system', content: 'あなたはストーリー生成のAIアシスタントです。以下のストーリーのタイトル、内容、及びファイル情報に基づいて、ユーザーに質問を生成してください。' },
                { role: 'user', content: `タイトル: ${title}、内容: ${content}、ファイル名: ${fileName}、ファイルタイプ: ${fileType}` }
            ],
            max_tokens: 200,
        });

// API呼び出し成功時のレスポンス全体を確認
    console.log("Response Data: ", response);
    console.log("Response Data: ", JSON.stringify(response, null, 2));

// レスポンスとchoicesが存在するか確認
    if (response && response.choices && response.choices.length > 0) {
        console.log("Choices exist: ", response.choices);
        const generatedStory = response.choices[0].message.content.trim();
        res.json({ title: title, content: generatedStory });
    } else {
        console.error("Response or choices are undefined or empty");
    }
    } catch (error) {
        if (error.response) {
            console.error('API呼び出しエラーレスポンス:', error.response.status, error.response.data);
        } else {
            console.error('API呼び出し中にエラーが発生:', error.message);
        }
        res.status(500).json({ error: 'ストーリー生成エラー', details: error.message });
    }

});
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
// 言語訓練機能
// ファイル名をUTF-8にエンコードして保存する設定（memoryStorageを使用）
const storageLanguageTraining =  multer.memoryStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir2);  // ソーシャルスキルと形式を合わせアップロード先ディレクトリ
    },
    filename: function (req, file, cb) {
        // ファイル名をUTF-8に変換する
        const utf8FileName = Buffer.from(file.originalname, 'binary').toString('utf8');
        cb(null, utf8FileName);  // UTF-8エンコードされたファイル名で保存
    }
});

const uploadLanguageTraining = multer({ storage: storageLanguageTraining });
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
// サブカテゴリー取得用のAPI
app.get('/api/get-subcategories', (req, res) => {
    const categoryName = req.query.category;

    if (!categoryName) {
        return res.status(400).json({ success: false, message: 'カテゴリー名が指定されていません' });
    }

    db.all(
        `SELECT id, name FROM subcategories WHERE parent_id = (SELECT id FROM categories WHERE name = ?)`,
        [categoryName],
        (err, rows) => {
            if (err) {
                console.error('サブカテゴリー取得エラー:', err);
                return res.status(500).json({ success: false, message: 'サブカテゴリーの取得に失敗しました' });
            }
            res.json({ success: true, subcategories: rows });
        }
    );
});
//////////////////////////////////////////////////////////////////////////////////////////////////////////
// 複数ファイルをアップロードするAPI
app.post('/api/upload-language-training-images', uploadLanguageTraining.array('files'), async (req, res) => {
    const uploadedFiles = req.files;
    const category = req.body.category;  // カテゴリを取得
    const subcategory = req.body.subcategory; // サブカテゴリを取得
    const level = req.body.level;  // レベルを取得
    if (!uploadedFiles || uploadedFiles.length === 0) {
        return res.status(400).json({ success: false, message: 'ファイルがアップロードされていません' });
    }

    const currentTime = new Date().toISOString();
    const existingFiles = [];
    const duplicateFiles = [];
    const filesToUpload = [];

    try {
        // ディレクトリが空かどうかを確認
        const isDirEmpty = fs.readdirSync(uploadsDir2).length === 0;

        await Promise.all(uploadedFiles.map(async (file) => {
            const utf8FileName = Buffer.from(file.originalname, 'binary').toString('utf8');
            const fileNameWithoutExt = path.parse(utf8FileName).name;
            const filePath = path.join(uploadsDir2, utf8FileName);
            console.log("アップロードされたファイル名:", fileNameWithoutExt);

            // 1. ディレクトリが空かどうか確認して処理
            if (!isDirEmpty && fs.existsSync(filePath)) {
                existingFiles.push(utf8FileName);
            } else {
                filesToUpload.push(file);
                const filePath = path.join(uploadsDir2, utf8FileName);
                fs.writeFileSync(filePath, file.buffer);
            }

            // 2. データベースの重複チェック
            const row = await new Promise((resolve, reject) => {
                db.get("SELECT * FROM flashcards WHERE image = ?", [utf8FileName], (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                });
            });

            if (row) {
                duplicateFiles.push(utf8FileName);
            } else if (!row) {
                await new Promise((resolve, reject) => {
                    db.run("INSERT INTO flashcards (text, image, category, subcategory_id, level, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                        [fileNameWithoutExt, utf8FileName, category, subcategory || null, level, currentTime], (err) => {
                            if (err) reject(err);
                            resolve();
                        });
                });
            }
        }));

        // ポップアップメッセージを適切に表示
        if (existingFiles.length > 0 && filesToUpload.length === 0) {
            // 全て既存ファイルの場合
            return res.status(400).json({
                success: false,
                message: `全てのファイルが既に存在しています: ${existingFiles.join(', ')}`
            });
        } else if (existingFiles.length > 0 && filesToUpload.length > 0) {
            // 一部既存、一部新規ファイルの場合
            return res.status(200).json({
                success: true,
                message: `一部のファイルが既に存在します: ${existingFiles.join(', ')}。残りの ${filesToUpload.length} 枚のファイルが正常にアップロードされました。`
            });
        } else {
            // 全て新規ファイルの場合
            return res.json({
                success: true,
                message: `${filesToUpload.length} 枚のファイルが正常にアップロードされました。`
            });
        }

    } catch (error) {
        console.error("エラーが発生しました:", error);
        res.status(500).json({ success: false, message: '内部サーバーエラーが発生しました' });
    }
});


// フラッシュ用画面用のアップロードされたファイルを取得するAPI
// フラッシュカードをユーザーのレベルに合わせて取得するAPI
app.get('/api/language-training/flashcards', (req, res) => {
    const userId = req.query.userId; // クエリパラメータからユーザーIDを取得
    console.log("リクエスト受信 - ユーザーID:", userId); // デバッグ用

    // userIdが存在しない場合、エラーレスポンスを返す
    if (!userId) {
        console.error("ユーザーIDが指定されていません");
        return res.status(400).json({ success: false, message: 'ユーザーIDが指定されていません' });
    }

    // progressテーブルからユーザーのレベルを取得
    db.get("SELECT level FROM progress WHERE user_id = ?", [userId], (err, row) => {
        if (err) {
            console.error("progressテーブルからレベル取得エラー:", err);
            return res.status(500).json({ success: false, message: 'レベル取得エラー' });
        }

        if (row) {
            const userLevel = row.level;
            console.log("ユーザープログレスレベル:", userLevel); // 取得したユーザーレベルをログ出力

            // 取得したユーザーレベルに基づいてフラッシュカードを取得
            const sql = `
                SELECT * 
                FROM flashcards 
                WHERE level = ? 
                AND text IS NOT NULL 
                AND image IS NOT NULL 
                AND category IS NOT NULL
                AND (subcategory_id = ? OR ? IS NULL)
                ORDER BY created_at DESC 
                LIMIT 10
            `;

            db.all(sql, [userLevel], (err, rows) => {
                if (err) {
                    console.error("フラッシュカード取得エラー:", err);
                    return res.status(500).json({ success: false, message: 'フラッシュカードの取得に失敗しました。' });
                }
                console.log("データ取得結果:", rows); // データベースから取得したデータをログに出力
                res.json({ success: true, flashcards: rows });
            });
        } else {
            // 進捗レベルが存在しない場合、初級レベルを設定する
            const insertSql = 'INSERT INTO progress (user_id, level) VALUES (?, "初級")';
            db.run(insertSql, [userId], (insertErr) => {
                if (insertErr) {
                    console.error("初期レベル設定エラー:", insertErr);
                    return res.status(500).json({ success: false, message: '初期レベル設定に失敗しました' });
                }

                // 初級レベルでフラッシュカードを取得
                const initialLevel = "初級";
                const sql = `
                    SELECT *
                    FROM flashcards
                    WHERE level = ?
                    AND text IS NOT NULL
                    AND image IS NOT NULL
                    AND category IS NOT NULL
                    AND (subcategory_id = ? OR ? IS NULL)
                    ORDER BY created_at DESC
                    LIMIT 10
                `;

                db.all(sql, [initialLevel], (err, rows) => {
                    if (err) {
                        console.error("フラッシュカード取得エラー:", err);
                        return res.status(500).json({ success: false, message: 'フラッシュカード取得に失敗しました' });
                    }
                
                    console.log("初級レベルでのデータ取得結果:", rows);
                    res.json({ success: true, flashcards: rows });
                });
            });
        }
    });
});
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// クイズの結果に基づいてポイントを更新するAPI
app.post('/api/update-points', (req, res) => {

    const { userId, points_earned } = req.body;

    db.run("UPDATE progress SET points = points + ? WHERE user_id = ?", [points_earned, user_id], function(err) {
        if (err) {
            return res.status(500).json({ success: false, message: 'データベースエラー' });
        }
        res.json({ success: true, message: 'ポイントが更新されました' });
    });
});

// 一定のポイントに達したら報酬を付与するAPI
app.post('/api/update-reward', (req, res) => {
    const { user_id, reward } = req.body;
    db.run("UPDATE progress SET rewards = ? WHERE user_id = ?", [reward, user_id], function(err) {
        if (err) {
            return res.status(500).json({ success: false, message: 'データベースエラー' });
        }
        res.json({ success: true, message: 'リワードが追加されました' });
    });
});

// ユーザーの進捗やポイントを取得するAPI
app.get('/api/get-progress/:user_id', (req, res) => {

    const userId = req.params.user_id;

    db.get("SELECT * FROM progress WHERE user_id = ?", [userId], (err, row) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'データベースエラー' });
        }
        if (row) {
            res.json({ success: true, progress: row });
        } else {
            res.status(404).json({ success: false, message: '進捗データが見つかりません' });
        }
    });
});

// ユーザーの進捗に基づいてセッションをカスタマイズするAPI
app.get('/api/customize-session/:user_id', (req, res) => {

    const userId = req.params.user_id;

    db.get("SELECT * FROM progress WHERE user_id = ?", [userId], (err, row) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'データベースエラー' });
        }
        if (row) {
            let sessionContent;

            if (row.progress_level < 5) {
                sessionContent = "簡単なフラッシュカード";
            } else if (row.progress_level < 10) {
                sessionContent = "中級のクイズ";
            } else {
                sessionContent = "上級のタスク";
            }
            res.json({ success: true, session: sessionContent });
        } else {
            res.status(404).json({ success: false, message: '進捗データが見つかりません' });
        }
    });
});
// クイズセクション//////////////////////////////////////////////////////////////////////////////////////////////////////
//プロンプト関数
function generatePrompt(category, subcategory, fileName) {
    let prompt = "";
    // カテゴリとサブカテゴリに応じたプロンプト生成
    switch (category) {
        case "感情": // Emotions
            if (subcategory === "ポジティブ") {
                prompt = `この人の気持ちはどんな感じかな？「${fileName}」に関連する嬉しい気持ちだよ！`;
            } else if (subcategory === "ネガティブ") {
                prompt = `この子、ちょっと元気がなさそう。何を感じていると思う？「${fileName}」が答えだよ！`;
            } else {
                prompt = `この顔、どんな気持ちかわかる？「${fileName}」が答えだよ！`;
            }
            break;

        case "動詞": // Actions/Verbs
            if (subcategory === "基本動作") {
                prompt = `この人、今何をしているかな？「${fileName}」が答えだよ！`;
            } else if (subcategory === "移動") {
                prompt = `どこかに行こうとしているね。何をしているか当ててみて！「${fileName}」が答えだよ！`;
            } else {
                prompt = `この動き、なんていうか知ってる？「${fileName}」が答えだよ！`;
            }
            break;

        case "名詞": // Nouns
            if (subcategory === "食べ物") {
                prompt = `これは何かな？「${fileName}」に関連する食べ物だよ！`;
            } else if (subcategory === "動物") {
                prompt = `この動物、なんて名前か知ってる？「${fileName}」が答えだよ！`;
            } else {
                prompt = `これは何というものか知ってる？「${fileName}」が答えだよ！`;
            }
            break;

        case "形容詞": // Adjectives
            if (subcategory === "状態") {
                prompt = `この物、どんな状態かな？「${fileName}」が答えだよ！`;
            } else if (subcategory === "特徴") {
                prompt = `この特徴、なんて言うかわかる？「${fileName}」が答えだよ！`;
            } else {
                prompt = `この様子、どう表現する？「${fileName}」が答えだよ！`;
            }
            break;

        case "形": // Shapes
            if (subcategory === "基本形状") {
                prompt = `この形、なんて言うかわかる？「${fileName}」が答えだよ！`;
            } else if (subcategory === "複雑な形状") {
                prompt = `ちょっと難しい形だね。なんて名前かな？「${fileName}」が答えだよ！`;
            } else {
                prompt = `この形、知ってる？「${fileName}」が答えだよ！`;
            }
            break;

        default:
            prompt = `この内容に関連するものを答えてね。「${fileName}」が答えだよ！`;
            break;
    }
    console.log("Generated Prompt:", prompt);
    return prompt;
}

// クイズ出題時にクエッションIDを生成
app.post('/api/generate-quiz-question', async (req, res) => {
    // ヘッダにUTF-8を設定
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    console.log("リクエストを受け取りました:", req.body); // ここで `req.body` の内容を確認
    const userId = parseInt(req.body.user_id, 10);  // クエリからではなくボディから取得
    console.log("せっっしおんのれべる", req.session.difficultyLevel);
    const difficultyLevel = req.session.difficultyLevel;


    // 完全なデータがあるフラッシュカードを取得するクエリ
    const sql = `
        SELECT * 
        FROM flashcards 
        WHERE level = ? 
        AND text IS NOT NULL 
        AND image IS NOT NULL 
        AND category IS NOT NULL
        AND (subcategory_id = ? OR ? IS NULL)
        AND created_at NOT NULL 
        ORDER BY RANDOM() 
        LIMIT 1
    `;

    // フラッシュカードデータを取得して質問生成
    db.get("SELECT * FROM flashcards WHERE level = ? ORDER BY RANDOM() LIMIT 1", [difficultyLevel], async (err, row) => {
        if (err) {
            console.error("フラッシュカードの取得中にエラーが発生しました:", err);
            return res.status(500).json({ error: 'データベースエラー' });
        }
        if (row) {
            console.log("取得したフラッシュカードデータ:", row);

            try {
                // プロンプト生成関数を呼ぶ
                const prompt = generatePrompt(row.category, row.subcategory, row.text);
                console.log("Generated Prompt in API:", prompt);

                const aiResponse = await openai.chat.completions.create({
                    model: 'gpt-3.5-turbo',
                    messages: [
                        {
                            role: "system",
                            content: "あなたは子供の日本語習得のために簡単な質問を生成するアシスタントです。以下の情報に基づいて、子供向けの口調で短い質問を生成してください。",
                        },
                        {
                            role: "user",
                            content: `画像カテゴリ: ${row.category}\n画像サブカテゴリ: ${row.subcategory}\n画像の内容: ${row.text}\nこの画像内容が答えになるよう質問を作成してください。`,
                        },
                    ],                      
                    max_tokens: 50,
                });

                const question = aiResponse.choices[0].message.content.trim();
                const generated_question_id = row.question_id || Math.floor(Math.random() * 10000);
                console.log("AI Response:", aiResponse);
                console.log("Generated question:", question);
                console.log("row.textの中身:", row.text);
                console.log("Difficulty Level:", difficultyLevel);

                // データベースに生成された質問を保存する処理
                db.run("INSERT INTO quiz_questions (question_id, question, category, difficulty_level, correct_answer) VALUES (?, ?, ?, ?, ?)",
                    [generated_question_id, question, row.category, difficultyLevel, row.text], (err) => {
                        if (err) {
                            console.error("質問データをデータベースに保存できませんでした:", err);
                            return res.status(500).json({ error: '質問データをデータベースに保存できませんでした。' });
                        }
                        // クライアントに question_id を送る
                        res.json({
                            success: true,
                            question: question,
                            image: row.image,
                            question_id: generated_question_id
                        });
                    });
            } catch (apiError) {
                console.error("OpenAI APIエラー:", apiError);
                return res.status(500).json({ error: '質問生成中にエラーが発生しました。' });
            }
        } else {
            console.log("該当するフラッシュカードデータが見つかりませんでした");
            res.status(404).json({ error: "データが見つかりません" });
        }
    });
});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
app.use((req, res, next) => {
    console.log(`Received ${req.method} request for ${req.url}`);
    next();
});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const threshold = 0.7;  // 類似度の閾値
// クイズ回答送信API
app.post('/api/submit-quiz-answer', (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    console.log('受信したリクエストデータ:', req.body);
    // 正解・不正解の判断処理...
    const { user_id, question_id, answer: userAnswer } = req.body;

    if (!user_id || !question_id || !userAnswer) {
        return res.status(400).json({ error: '不正なデータです。' });
    }

    // クイズの回答状況を確認
    db.get("SELECT is_correct FROM quiz_answers WHERE user_id = ? AND question_id = ?", [user_id, question_id], (err, row) => {
        if (err) {
            console.error("データベースエラー:", err);
            return res.status(500).json({ error: 'データベースエラー' });
        }
        //debag
        if (row) {
            console.log("取得したデータ:", row); // row 全体を確認
            console.log("取得した is_correct の値:", row.is_correct); // is_correct の値を個別に出力
        } else {
                console.log("指定された user_id と question_id に該当するデータが存在しません。");

        }
        console.log("正解済みの確認結果:", row);
        // すでに正解済みの場合、回答を受け付けない
        if (row && row.is_correct === 1) {
            //alert(data.message);
            console.log("この問題は既に正解済みです");
            return res.json({ success: false, message: 'この問題はすでに正解済みです。' });
        }
        // クイズの正解を取得し、ユーザーの回答と照合
        db.get("SELECT correct_answer FROM quiz_questions WHERE question_id = ?", [question_id], (err, row) => {
            if (err || !row) {
                return res.status(500).json({ error: '正解データの取得に失敗しました。' });
            }
            
            console.log("取得した正解データ:", row.correct_answer);
            console.log("ユーザーの回答:", userAnswer);
            const similarity = natural.JaroWinklerDistance(userAnswer, row.correct_answer);
            console.log("類似度判定:", similarity);

            let isCorrect = 0;
            let pointsEarned = 0;

            if (similarity >= threshold) {
                isCorrect = 1;
                pointsEarned = 10;
                console.log("コレクト「:", isCorrect);
            }
            console.log("判定結果:", isCorrect);

            // クイズ回答を保存
            db.run(
                "INSERT INTO quiz_answers (user_id, question_id, user_answer, is_correct, created_at) VALUES (?, ?, ?, ?, datetime('now'))",
                [user_id, question_id, userAnswer, isCorrect ? 1 : 0],
                (err) => {
                    if (err) {
                        return res.status(500).json({ error: '回答データの保存に失敗しました。' });
                    }

                    console.log("クイズ回答前のセッションポイント:", req.session.sessionPoints); // ログ追加
                    // セッションでポイントとメダルを管理
                    if (isCorrect) {
                        req.session.sessionPoints = (req.session.sessionPoints || 0) + 10;
                        req.session.sessionMedals = (req.session.sessionMedals || 0) + 1;

                        console.log("クイズ正解後のセッションポイント:", req.session.sessionPoints); // 確認用ログ

                        // メダルが10個に達したらリセット
                        if (req.session.sessionMedals >= 10) {
                            //req.session.sessionPoints = 0;
                            req.session.sessionMedals = 0;
                            res.json({
                                success: true,
                                feedback: 'よく頑張りました!メダル10個獲得です!',
                                points: req.session.sessionPoints,
                                medals: req.session.sessionMedals,
                                isCorrect: true
                            });
                        } else {
                            res.json({
                                success: true,
                                feedback: '正解です！',
                                points: req.session.sessionPoints,
                                medals: req.session.sessionMedals,
                                isCorrect: true
                            });
                        }
                    } else {
                        res.json({
                            success: true,
                            feedback: '不正解です。もう一度試してみてください。',
                            points: req.session.sessionPoints,
                            medals: req.session.sessionMedals,
                            isCorrect: false
                        });
                    }
            });
                
        });    
    });
})
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//サーバー側でセッションデータを返すAPI
app.get('/api/get-session-data', (req, res) => {
    if (req.session) {
        // セッションポイントとレベルを返す
        res.json({
            success: true,
            sessionPoints: req.session.sessionPoints || 0,
            sessionMedals: req.session.sessionMedals || 0,
            currentLevel: req.session.difficultyLevel || "初級"
        });
    } else {
        res.json({ success: false, message: "セッションデータがありません" });
    }
});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//1週間、1ヶ月、または1年の範囲で回答データを取得し、その後プログレステーブルにデータをインサート
app.post('/api/progress-report', (req, res) => {
    const { user_id, period } = req.body;

    if (!user_id || !period) {
        return res.status(400).json({ success: false, message: 'ユーザーIDまたは期間が提供されていません' });
    }
    //console.log('リクエストデータ:', req.body);
    console.log('実行されるクエリ:', `
        SELECT qa.question_id, qa.user_answer, qq.difficulty_level, qa.is_correct
        FROM quiz_answers qa
        JOIN quiz_questions qq ON qa.question_id = qq.id
        WHERE qa.user_id = ${user_id}

        AND qa.created_at >= DATETIME('now', '${period}')
    `);
    // クエリでデータを取得する部分
    db.all(`
        SELECT qa.question_id, qa.user_answer, qq.difficulty_level, qa.is_correct
        FROM quiz_answers qa
        JOIN quiz_questions qq ON qa.question_id = qq.id
        WHERE qa.user_id = ?
        AND qa.created_at >= DATETIME('now', ?)
    `, [user_id, period], (err, rows) => {
        if (err) {
            console.error('データベースエラー:', err);
            return res.status(500).json({ success: false, message: 'データベースエラー' });
        }

        console.log('クエリ結果:', rows);

        // データがない場合の処理: 空のレポートを生成する
        if (!rows || rows.length === 0) {
            console.log('データが見つかりません');
            
            // 空のレポートを生成して progress_reports に挿入する
            db.run(`
                INSERT INTO progress_reports (user_id, report_date, strengths, weaknesses, suggestions, progress_percentage, created_at)
                VALUES (?, datetime('now'), ?, ?, ?, ?, datetime('now'))
            `, [user_id, 'なし', 'なし', 'データがありません', 0], function(err) {
                if (err) {
                    console.error('進捗レポートの保存エラー:', err);
                    return res.status(500).json({ success: false, message: '進捗レポートの保存に失敗しました' });
                }

                res.json({ success: true, message: '進捗レポートが保存されました', report_id: this.lastID });
            });
            return;
        }

        // データが存在する場合の処理
        let strengths = [];
        let weaknesses = [];

        rows.forEach((row) => {
            if (row.is_correct) {
                strengths.push(`問題ID ${row.question_id} (${row.difficulty_level}) に正解`);
            } else {
                weaknesses.push(`問題ID ${row.question_id} (${row.difficulty_level}) で不正解`);
            }
        });

        // 進捗率を計算する（例: 正答率）
        const correctCount = rows.filter(row => row.is_correct).length;
        const progressPercentage = Math.floor((correctCount / rows.length) * 100);

        // 提案生成
        let suggestions = [];
        if (strengths.length > weaknesses.length) {
            suggestions.push("現在の強みを活かしてより高度な問題に挑戦してください。");
        } else {
            suggestions.push("弱点となっている分野にフォーカスし、反復練習を行いましょう。");
        }

        // レポートをデータベースに保存
        db.run(`
            INSERT INTO progress_reports (user_id, report_date, strengths, weaknesses, suggestions, progress_percentage, created_at)
            VALUES (?, datetime('now'), ?, ?, ?, ?, datetime('now'))
        `, [user_id, strengths.join(', '), weaknesses.join(', '), suggestions.join(', '), progressPercentage], function(err) {
            if (err) {
                console.error('進捗レポートの保存エラー:', err);
                return res.status(500).json({ success: false, message: '進捗レポートの保存に失敗しました' });
            }

            // レポートが正常に保存された場合、クライアントにレスポンスを返す
            res.json({ success: true, message: '進捗レポートが保存されました', report_id: this.lastID });
        });
    });
});

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//サーバー側の削除処理
app.post('/delete-old-reports', (req, res) => {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - 3); // 3か月前の日付を計算

    db.run(
        'DELETE FROM progress_reports WHERE report_date < ?',
        [cutoffDate.toISOString()],
        function (err) {
            if (err) {
                console.error('古いレポートの削除中にエラーが発生しました:', err);
                res.status(500).send('レポート削除に失敗しました');
            } else {
                console.log('古いレポートが削除されました');
                res.redirect('/'); // 成功したらトップページにリダイレクト
            }
        }
    );
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// レベル更新エンドポイント
app.post('/api/update-progress-level', (req, res) => {
    const { user_id, newLevel, points } = req.body;

    // セッションからポイントとメダルを取得
    const sessionPoints = req.session.sessionPoints || 0; // セッションのポイント
    const sessionMedals = req.session.sessionMedals || 0; // セッションのメダル

    console.log("req.body 全体:", JSON.stringify(req.body, null, 2));
    console.log("レベルとポイント:", { newLevel, points });

    // リクエストのバリデーション
    if (!user_id || !newLevel) {
        console.log("バリデーション失敗: user_id または level が不足しています");
        return res.status(400).json({
            success: false,
            message: 'ユーザーIDまたはレベルが不足しています。',
        });
    }

    // 累積ポイントを計算
    const updatedPoints = points; // 累積ポイント
    console.log("累積ポイント計算後の値:", updatedPoints);

    const currentSessionPoints = req.session.sessionPoints || 0;

    // プログレステーブルのレベルとポイントを更新するSQLクエリ
    const sql = `
        UPDATE progress
        SET level = ?,
            points = ?,

            medals = ?
        WHERE user_id = ?
    `;

    console.log("実行するSQLクエリ:", sql, "値:", [newLevel, updatedPoints, sessionMedals, user_id]);

    db.run(sql, [newLevel, updatedPoints, sessionMedals, user_id], (err) => {
        if (err) {
            console.error("レベル更新エラー:", err);
            return res.status(500).json({
                success: false,
                message: 'レベルとポイントの更新に失敗しました。',
            });
        }

        // セッションのポイントとメダルをリセット
        //req.session.sessionPoints = 0;  //はレベルアップダウンのためリセットしない
        req.session.sessionMedals = 0;

        console.log("リセット後のセッションポイント:", req.session.sessionPoints); // 確認用ログ
        console.log("リセット後のセッシンメダル:", req.session.sessionMedals); // 確認用ログ

        res.json({
            success: true,
            message: 'レベルとポイントが正常に更新されました。',
            updatedPoints: updatedPoints,
        });
    });
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
// フラッシュカードの選出
app.get('/api/get-flashcards', (req, res) => {
    const level = req.query.level;

    db.all(`SELECT * FROM flashcards WHERE level = ? ORDER BY RANDOM() LIMIT 10`, [level], (err, rows) => {
        if (err) {
            console.error("フラッシュカード取得エラー:", err);
            return res.status(500).json({ success: false, message: 'フラッシュカードの取得に失敗しました。' });
        }
        res.json({ success: true, flashcards: rows });
    });
});


// 認証チェック付きでポイント更新
//app.put('/api/update-points/:user_id', authenticateToken, (req, res) => {
//    const userId = req.params.user_id;

//    const newPoints = req.body.points;
//    const newReward = req.body.reward || '';

//    db.run("UPDATE progress SET points = ?, reward = ? WHERE user_id = ?", [newPoints, newReward, userId], function(err) {
//       if (err) {
//            return res.status(500).json({ success: false, message: 'データベースエラー' });
//        }
//        res.json({ success: true, message: 'ポイントとリワードが更新されました' });
//    });
//});




// サーバーの起動
app.listen(port, () => {
  console.log(`Server is running on https://localhost:${port}`);
});