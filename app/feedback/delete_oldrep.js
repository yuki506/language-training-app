// delete_oldrep.js
document.addEventListener('DOMContentLoaded', () => {
    // ボタンのクリックイベントを設定
    const deleteButton = document.getElementById('delete-button');

    // ボタンが見つかった場合のみ、イベントリスナーを設定
    if (deleteButton) {
        deleteButton.addEventListener('click', function () {
            fetch('/delete-old-reports', {
                method: 'POST',
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('レポートの削除に失敗しました');
                }
                return response.text();
            })
            .then(data => {
                console.log('削除成功:', data);
                window.location.href = '/progress'; // 成功後に進捗ページへリダイレクト
            })
            .catch(error => {
                console.error('削除エラー:', error);
                alert('レポートの削除に失敗しました');
            });
        });
    } else {
        console.error('削除ボタンが見つかりません');
    }
});
