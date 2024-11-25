// ログイン処理とリダイレクト
console.log("ログイン.js読み込まれた"); // login.jsが読み込まれたか確認

// フォームの要素が正しく取得できているか確認
const loginForm = document.getElementById("login-form");

if (loginForm) {
    console.log("フォームが見つかりました");
} else {
    console.log("フォームが見つかりません。IDが正しいか確認してください");
}

document.addEventListener("DOMContentLoaded", () => {
    console.log("DOMContentLoaded イベントが発火しました");

    const loginForm = document.getElementById("login-form");

    if (loginForm) {
        console.log("フォームが見つかりました");
    } else {
        console.log("フォームが見つかりません。IDが正しいか確認してください");
    }

    loginForm.addEventListener("submit", function(event) {
        event.preventDefault();
        console.log("ログインボタンが押され、submit イベントが発火しました");

        const username = document.getElementById("username").value;
        const password = document.getElementById("password").value;

        fetch("/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
            credentials: "include"
        })
        .then(response => response.json())
        .then(data => {
            console.log("サーバからのレスポンス:", data);
            if (data.success) {
                window.location.href ='/main';
            } else {
                alert(data.message || 'ログインに失敗しました');
            }
        })
        .catch(error => {
            console.error("通信エラー:", error);
            alert('サーバーとの通信エラーが発生しました');
        });
    });
});


