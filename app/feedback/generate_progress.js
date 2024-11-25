let progressPercentage = 0;
let tableBody = document.getElementById('progress-table-body');

// 強みと弱みを解析する関数（非同期処理なし）
function analyzeStrengthsAndWeaknesses(answers) {
    const strengths = [];
    const weaknesses = [];

    answers.forEach(answer => {
        if (answer.is_correct) {
            strengths.push(`問題ID ${answer.question_id}（${answer.difficulty_level}）に正解`);
        } else {
            weaknesses.push(`問題ID ${answer.question_id}（${answer.difficulty_level}）で不正解`);
        }
    });

    return { strengths, weaknesses };
}

// データに基づいて提案を生成する関数
function generateSuggestionsBasedOnData(strengths, weaknesses) {
    const suggestions = [];

    if (strengths.length > weaknesses.length) {
        suggestions.push("現在の強みを活かしてより高度な問題に挑戦してください。");
    } else {
        suggestions.push("弱点となっている分野にフォーカスし、反復練習を行いましょう。");
    }

    return suggestions;
}

// 進捗率を計算する関数
function calculateProgress(correctCount, totalCount) {
    if (totalCount === 0) {
        return 0; // データがない場合は0%
    }
    return Math.floor((correctCount / totalCount) * 100); // 正解率を進捗率として計算
}

// DOMの準備ができたら実行されるイベント
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('report-form').addEventListener('submit', (event) => {
        event.preventDefault();
        const period = document.getElementById('period').value;

        // 仮の回答データを設定
        const answers = [
            { question_id: 1, is_correct: true, difficulty_level: '初級' },
            { question_id: 2, is_correct: false, difficulty_level: '中級' },
            { question_id: 3, is_correct: true, difficulty_level: '上級' }
        ];

        // 強みと弱みを分析
        const { strengths, weaknesses } = analyzeStrengthsAndWeaknesses(answers);

        // 提案を生成
        const suggestions = generateSuggestionsBasedOnData(strengths, weaknesses);

        // 正解数と合計数を使って進捗を計算
        const correctCount = answers.filter(answer => answer.is_correct).length;
        const totalCount = answers.length;
        const progressPercentage = calculateProgress(correctCount, totalCount);

        // レポートをコンソールに出力
        console.log('強み:', strengths);
        console.log('弱み:', weaknesses);
        console.log('提案:', suggestions);
        console.log('進捗率:', progressPercentage, '%');

        // 進捗レポートをテーブルに追加する処理
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${new Date().toLocaleDateString()}</td>
            <td>${strengths.join(', ') || 'データなし'}</td>
            <td>${weaknesses.join(', ') || 'データなし'}</td>
            <td>${progressPercentage}%</td>
            <td>${suggestions.join(', ') || 'データなし'}</td>
        `;
        tableBody.appendChild(tr);
    
        // 進捗レポートをサーバーに送信
        fetch('/api/progress-report', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },

            body: JSON.stringify({
                user_id: 1,
                period: period,
                strengths: strengths,
                weaknesses: weaknesses,
                suggestions: suggestions,
                progress_percentage: progressPercentage
            })
        })

        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('進捗レポートが保存されました！');
            } else {
                alert('進捗レポートの生成に失敗しました。');
            }
        })
        .catch(error => {
            console.error('進捗レポート生成エラー:', error);
        });
    });
});