//- **役割**: バックエンドのサーバー処理を担当し、フロントエンドからのリクエストに対してデータベース処理やファイルアップロード機能を提供します。
//- **機能**:
//  - ストーリーの保存と取得
//  - ファイルのアップロード
//  - アップロードされたファイル情報の保存
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const multer = require('multer');  // ファイルアップロード用
const path = require('path');  // ファイルパスの処理用
const cors = require('cors');
const ensureAuthenticated = require('../SessionMiddleware'); // セッションミドルウェアをインポート
const uploadsDir1 = path.join(__dirname, 'social-uploads');
const app = express();
const OpenAI = require('openai-api');

//OPENAIの取得
const openai = new OpenAI(process.env.OPENAI_API_KEY); // OpenAIのAPIキーを環境変数から取得
//データベース接続
const db = new sqlite3.Database('./database.sqlite');

// socialSkillTraining.js
const router = express.Router();
router.get('/social-skill-training', ensureAuthenticated, (req, res) => {
    // ソーシャルスキルトレーニングのメイン処理
    res.render('social-skill-training');
});
module.exports = router;


// ファイルアップロード用の設定
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir1);
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 最大ファイルサイズ2MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'video/mp4'];
        if (!allowedTypes.includes(file.mimetype)) {
            return cb(new Error('サポートされていないファイルタイプです'), false);
        }
        cb(null, true);
    }
});

// 動的ファイルの提供
app.use(bodyParser.json());
app.use(cors());
app.use(express.static('public'));
app.use('/social-uploads', express.static(uploadsDir1)); // ソーシャルスキル用
// データベースの初期化いる
db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS social_stories (id SERIAL PRIMAY KEY, title TEXT, content TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS media_files (id SERIAL PRIMAY KEY, file_name TEXT, file_type TEXT, file_path TEXT, created_at D DEFAULT CURRENT_TIMESTAMP)");
});



// ストーリーを追加するAPI
app.post('/api/add-story', (req, res) => {
    const { title, content } = req.body;
    db.run("INSERT INTO social_stories (title, content) VALUES (?, ?)", [title, content], function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ id: this.lastID });
    });
});

// ストーリーを取得するAPI
app.get('/api/stories', (req, res) => {
    db.all("SELECT * FROM social_stories", [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});


// ファイルをアップロードするAPI
app.post('/api/upload', upload.array('file', 10), (req, res) => {  // 複数ファイル対応
    const files = req.files;

    // アップロードされたファイルがない場合のエラーチェック
    if (!files || files.length === 0) {
        return res.status(400).json({ success: false, message: 'ファイルがアップロードされていません' });
    }

    const uploadedFiles = [];
    const fileNames = files.map(file => file.originalname); // アップロードされたファイル名の配列
    const placeholders = fileNames.map(() => '?').join(',');

    // 既存のファイル名をデータベースから取得
    db.all(`SELECT file_name FROM media_files WHERE file_name IN (${placeholders})`, fileNames, (err, existingFiles) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'データベースエラー' });
        }
        console.log('Existing files:', existingFiles); //既存のファイル名
        console.log('Existing files from DB:', existingFiles); //既存のファイルログを出力

        const existingFileNames = existingFiles.map(file => file.file_name); // 既存ファイル名の配列

        // 新しいファイルだけをフィルタ
        const newFiles = files.filter(file => !existingFileNames.includes(file.originalname));

        console.log('New files:', newFiles); //新しいのファイル名

        // 同じ名前のファイルがすでに存在する場合のエラーチェック
        if (newFiles.length === 0) {
            return res.status(400).json({ success: false, message: '同じ名前のファイルがすでに存在します。' });
        }

        // 新しいファイルをデータベースに挿入
        newFiles.forEach(file => {
            db.run("INSERT INTO media_files (file_name, file_type, file_path) VALUES (?, ?, ?)",
                [file.originalname, file.mimetype, file.path], function (err) {
                    if (err) {
                        return res.status(500).json({ success: false, message: 'データベースエラー' });
                    }
                }
            );

            uploadedFiles.push({ name: file.originalname, path: `/social-uploads/${file.originalname}` });
        });

        // アップロードされたファイル情報をレスポンスとして返す
        res.json({
            success: true,
            message: '新しいファイルがアップロードされました。',
            uploadedFiles // アップロードされたファイル情報
        });
    });
});

// アップロードされたファイルを取得するAPI
app.get('/api/media-files', (req, res) => {
    db.all("SELECT * FROM media_files", [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// プロフィールを取得するエンドポイント
app.get('/api/api/profile/:userId', (req, res) => {
    const userId = req.params.userId;
    // プロフィールデータを取得（仮実装）
    const profileData = {
        userId: userId,
        username: 'ユーザー名',
        level: 3
    };
    res.json(profileData);
});

// ユーザーの進捗を取得するエンドポイント
app.get('/api/api/progress/:userId', (req, res) => {
    const userId = req.params.userId;
    // 進捗データを取得（仮実装）
    const progressData = {
        userId: userId,
        level: 2
    };
    res.json(progressData);
});

// ユーザーの進捗を更新するエンドポイント
app.put('/api/api/progress/:userId', (req, res) => {
    const userId = req.params.userId;
    const newProgress = req.body; // 送信された進捗データ
    // 進捗データを更新（仮実装）
    const updatedProgress = {
        userId: userId,
        level: newProgress.level
    };
    res.json(updatedProgress);
});

// OpenAIを使ってストーリーを生成するエンドポイント
app.post('/api/api/generate-story', async (req, res) => {
    const { title, content } = req.body;
   
    // OpenAI APIにリクエストを送信
    try {
        const gptResponse = await openai.complete({
            engine: 'davinci',
            prompt: `ストーリーのタイトル: ${title}\n\nストーリーの内容: ${content}`,
            maxTokens: 150
        });
       
        const generatedStory = gptResponse.data.choices[0].text.trim();
        res.json({
            title: title,
            content: generatedStory
        });
    } catch (error) {
        res.status(500).json({ error: 'ストーリー生成エラー' });
    }
});

// サーバーの起動
const port = 3000;
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});