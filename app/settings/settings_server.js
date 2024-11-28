const express = require('express');

const sqlite3 = require('sqlite3').verbose();

const bodyParser = require('body-parser');

const cors = require('cors');

const app = express();

const PORT = 3000;

//CORSを有効化
app.use(cors());



// ボディパーサーを設定

app.use(bodyParser.json());

app.use(bodyParser.urlencoded({ extended: true }));



// SQLite3 データベースを作成または接続

const db = new sqlite3.Database('./user_profiles.db', (err) => {

  if (err) {

    console.error('データベースの接続中にエラーが発生しました:', err.message);

  } else {

    console.log('SQLiteデータベースに接続しました。');

  }

});



// プロフィール用のテーブルを作成

db.run(`

  CREATE TABLE IF NOT EXISTS profiles (

    id SERIAL PRIMARY KEY,

    name TEXT NOT NULL,

    gender TEXT,

    age INTEGER

  )

`);



// ユーザープロフィールを取得するエンドポイント

app.get('/profiles', (req, res) => {

  db.all('SELECT * FROM profiles', [], (err, rows) => {

    if (err) {

      res.status(500).json({ error: err.message });

      return;

    }

    res.json({

      message: 'success',

      data: rows

    });

  });

});



// ユーザープロフィールを追加するエンドポイント

app.post('/profiles', (req, res) => {

  const { name, gender, age } = req.body;

  const query = 'INSERT INTO profiles (name, gender, age) VALUES (?, ?, ?)';



  db.run(query, [name, gender, age], function(err) {

    if (err) {

      res.status(500).json({ error: err.message });

      return;

    }

    res.json({

      message: '新しいプロフィールが追加されました！',

      data: { id: this.lastID, name, gender, age }

    });

  });

});



// サーバーを開始

app.listen(PORT, () => {

  console.log(`サーバーはhttp://localhost:${PORT}で実行されています。`);

});