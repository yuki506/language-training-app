document.addEventListener("DOMContentLoaded", () => {
    console.log("DOMContentLoaded イベントが発火しました - main.js の読み込み開始");

    fetch('/api/check-auth')
        .then(response => {
            console.log("fetch('/api/check-auth')のレスポンスを受け取りました:", response);
            return response.json();
        })
        .then(data => {
            console.log("認証データ:", data);

            if (!data.authenticated) {
                console.log("認証されていません - ログインページへリダイレクトします");
                window.location.href = '/login';
            } else {
                console.log("認証されています - メインページを表示します");
            }
        })
        .catch(error => {
            console.error("セッションチェックでエラーが発生しました:", error);
            window.location.href = '/login';
        });
});