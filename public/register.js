document.getElementById('register-form').addEventListener('submit', function(event) {
    event.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const gender = document.getElementById('gender').value;
    const age = document.getElementById('age').value;
    const email = document.getElementById('email').value;
    
    fetch('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, gender, age, email })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('ユーザー登録が成功しました！');
            window.location.href = '/index.html'; // ログイン画面へリダイレクト
        } else {
            alert('ユーザー登録に失敗しました: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
});