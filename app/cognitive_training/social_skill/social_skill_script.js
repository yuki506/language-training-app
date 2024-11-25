//- **役割**: フロントエンド側のロジックを管理し、フォームからのデータ送信やサーバーとの通信を処理します。
//- **機能**:
//  - ストーリー追加機能
//  - ファイルアップロード機能
//  - ストーリー表示機能
// ストーリー追加用のフォーム処理
document.getElementById('story-form').addEventListener('submit', function (event) {
    event.preventDefault();

    const title = document.getElementById('story-title').value;
    const content = document.getElementById('story-content').value;

    fetch('/api/add-story', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title: title, content: content })
    })
    .then(response => response.json())
    .then(data => {
        alert('ストーリーが追加されました');
        // 追加したストーリーのみを表示
        const storyElement = document.createElement('div');
        storyElement.innerHTML = `<h3>${data.title}</h3><p>${data.content}</p>`;
        document.getElementById('stories').appendChild(storyElement);
    })
    .catch(error => console.error('Error:', error));
});

// アップロード用のフォーム処理
document.getElementById('upload-form').addEventListener('submit', async function(event) {
    event.preventDefault();

    const fileInput = document.getElementById('file-upload');
    const formData = new FormData();
    const files = fileInput.files;

    if (files.length === 0) {
        alert('ファイルが選択されていません');
        return;
    }

    //リストをクリア
    const uploadedFilesList = document.getElementById('uploaded-files-list');
    uploadedFilesList.innerHTML = ''; //アップロード前にクリア

    formData.append('file', fileInput.files[0]);

    const maxFileSize = 2 * 1024 * 1024; // 2MB
    const allowedTypes = ['image/jpeg', 'image/png', 'video/mp4']; // 許可されるファイルタイプ

    // ファイルのバリデーション
    if (files[0].size > maxFileSize) {
        alert(`ファイルサイズが大きすぎます: ${files[0].name}`);
        return;
    }
    if (!allowedTypes.includes(files[0].type)) {
        alert(`サポートされていないファイルタイプです: ${files[0].name}`);
        return;
    }

    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const result = await response.json();
            alert(result.message);
            displayUploadedFiles(); // アップロード後にファイルリストを表示
            // 画像を表示するための img タグを作成
            const uploadedFilesList = document.getElementById('uploaded-files-list');
            const imgElement = document.createElement('img');
            imgElement.src = result.filePath;  // サーバーから返ってきたファイルパスを img の src に設定
            imgElement.alt = 'Uploaded Image';
            imgElement.width = 200;  // サイズ調整（任意）
           
            const listItem = document.createElement('li');
            listItem.appendChild(imgElement);
            uploadedFilesList.appendChild(listItem);
        } else {
            const errorResult = await response.json();
            alert('アップロードに失敗しました');
        }
    } catch (error) {
        console.error('アップロードエラー:', error);
    }
});

// ユーザープロフィールを取得する関数
document.getElementById('get-profile-btn').addEventListener('click', function() {
    const userId = '1'; // 必要に応じて設定
    fetch(`/api/profile/${userId}`)
        .then(response => response.json())
        .then(profileData => {
            console.log('ユーザープロフィール:', profileData);
            // プロフィールデータを表示または処理
            document.getElementById('username-display').innerText = profileData.name;
            document.getElementById('level-display').innerText = profileData.age;
        })
        .catch(error => console.error('プロフィールの取得エラー:', error));
});

// ユーザーの進捗を取得する関数
document.getElementById('get-progress-btn').addEventListener('click', function() {
    const userId = '指定されたユーザーID'; // 必要に応じて設定
    fetch(`/api/progress/${userId}`)
        .then(response => response.json())
        .then(progressData => {
            document.getElementById('progress-display').innerText = `進捗レベル: ${progressData.level}`;
        })
        .catch(error => console.error('進捗の取得エラー:', error));
});

// ユーザーの進捗を更新する関数
document.getElementById('update-progress-btn').addEventListener('click', function() {
    const userId = 1; // 必要に応じて設定
    const newProgress = { level: 2 }; // 仮の進捗データ

    fetch(`/api/progress/${userId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(newProgress)
    })
    .then(response => response.json())
    .then(updatedProgress => {
        document.getElementById('progress-display').innerText = `更新された進捗レベル: ${updatedProgress.level}`;
    })
    .catch(error => console.error('進捗更新エラー:', error));
});

// OpenAIを使ってストーリーを生成する関数
document.getElementById('generate-story-btn').addEventListener('click', function() {
    const title = document.getElementById('story-title').value;
    const content = document.getElementById('story-content').value;

    // ファイルの情報を取得
    const fileInput = document.getElementById('file-upload');
    const fileName = fileInput.files[0]?.name || 'No File';
    const fileType = fileInput.files[0]?.type || 'Unknown Type';

    fetch('/api/generate-story', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title: title, content: content, fileName: fileName, fileType: fileType })
    })
    .then(response => response.json())
    .then(data => {
        console.log('Received data:', data);
        document.getElementById('generated-story-title').innerText = data.title || 'No Title';
        document.getElementById('generated-story-content').innerText = data.content || 'No Content';
    })
    .catch(error => console.error('ストーリー生成エラー:', error));
});

// ストーリーを表示する関数
function displayStories() {
    fetch('/api/stories')
        .then(response => response.json())
        .then(data => {
            const storiesDiv = document.getElementById('stories');
            storiesDiv.innerHTML = '';  // 前回の内容をクリア

            data.forEach(story => {
                const storyElement = document.createElement('div');
                storyElement.innerHTML = `<h3>${story.title}</h3><p>${story.content}</p>`;
                storiesDiv.appendChild(storyElement);
            });
        })
        .catch(error => console.error('Error:', error));
}

// ファイルアップロード関数
function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file); // ファイルを追加

    fetch('/api/upload', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        console.log(result); //サーバーからのレスポンスを確認
        if (!response.ok) {
            return response.json().then(error => {
                throw new Error(error.message);
            });
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            alert(data.message); // アップロード成功メッセージを表示
            displayUploadedFiles(); // アップロード後にファイルリストを再表示
        } else {
            alert(`アップロードに失敗しました: ${data.message}`); // エラーメッセージを表示
        }
    })
    .catch(error => {
        alert(`アップロードエラー: ${error.message}`); // ネットワークエラーの場合のメッセージを表示
    });
}

// ファイル選択のイベントリスナーを追加
document.getElementById('file-upload').addEventListener('change', (event) => {
    const file = event.target.files[0]; // 最初のファイルを取得
    if (file) {
        uploadFile(file); // ファイルアップロード関数を呼び出し
    }
});

// ファイルリストを動的に表示する関数
function displayUploadedFiles() {
    fetch('/api/media-files')
        .then(response => response.json())
        .then(files => {
            const fileList = document.getElementById('uploaded-files-list');
            fileList.innerHTML = ''; // 以前のリストをクリア

            files.forEach(file => {
                console.log(file); //デバッグ用
                const listItem = document.createElement('li');
                if (file.file_type.startsWith('image/')) {
                    //ファイルパスをブラウザがアクセスできる形に変換
                    const filePath = `/social-uploads/${file.file_name}`;
                    console.log('Filename:', file.file_name); //確認用
                    console.log('Filepath:', filePath); //確認用
                    console.log('Image path:', file.file_path); //確認用
                    // 画像ファイルの場合は img タグを使用して表示
                    listItem.innerHTML = `<img src="${filePath}" alt="${file.file_name}" width="600">`;
                } else if (file.file_type.startsWith('video/')) {
                    // 動画ファイルの場合、video タグで表示
                    listItem.innerHTML = `
                        <video width="320" height="240" controls>
                            <source src="${filePath}" type="${file.file_type}">
                            Your browser does not support the video tag.
                        </video>`;
                } else {
                    listItem.textContent = file.file_name;
                }
                fileList.appendChild(listItem);
            });
        })
        .catch(error => console.error('Error fetching files:', error));
}

// ページロード時にストーリーを表示
window.onload = displayStories;
// ページロード時にファイルを表示
window.onload = displayUploadedFiles;