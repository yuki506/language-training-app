function openProfileSettings() {

    document.getElementById("profile-settings").style.display = "block";

    document.getElementById("character-settings").style.display = "none";

}



function openCharacterSettings() {

    document.getElementById("profile-settings").style.display = "none";

    document.getElementById("character-settings").style.display = "block";

}



function saveProfile(event) {
    event.preventDefault(); // フォームの送信を防ぐ

    console.log("saveProfile function called!");    //デバッグ用

    const name = document.getElementById("name").value;
    const gender = document.getElementById("gender").value;
    const age = document.getElementById("age").value;

    const profileData = { name, gender, age };

    fetch('http://localhost:3000/profiles', { // 修正されたエンドポイント　ホストとポートを追加
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(profileData)
    })
    .then(response => response.json())
    .then(data => {
        alert('プロフィールが保存されました！');

        //入力フィールドをクリア
        document.getElementById("profileForm").reset();

        //プロフィール設定画面を閉じる
        document.getElementById("profile-settings").style.display = "none";
    })
    .catch((error) => {
        console.error('Error:', error);
        alert('エラーが発生しました：'+error.message);
    });
}