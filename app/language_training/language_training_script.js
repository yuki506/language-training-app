document.addEventListener('DOMContentLoaded', () => {
    // グローバル変数
    let authData = null; // 認証データを保存
    let currentLevel = null; // currentLevelを初期化
    let currentUserId = null; // currentUserIdも初期化
    let totalsessionPoints = 0; // 累計ポイントを初期化
    let totalPoints = 0; // データベースの累計ポイントを初期化

    // 認証状態を確認する関数
    async function checkAuthentication() {
        try {
            const response = await fetch('/api/check-auth');
            const data = await response.json();
            console.log("認証データ:", data);

            if (!data.authenticated) {
                // 認証されていない場合はログインページにリダイレクト
                window.location.href = '/index';
                return;
            }
            // 認証データをグローバル変数に保存
            authData = data;
            console.log("settionのID:", data.userId);
            currentUserId = data.userId; // セッションから取得したユーザーIDを保存
            console.log("セッションから取得したユーザーID:", currentUserId);
        } catch (error) {
            console.error("認証チェックエラー:", error);
        }
    }

    // 初期化部分
    const startButton = document.getElementById('start-button');
    const flashcardContainer = document.getElementById('flashcard-container');
    const startContainer = document.getElementById('start-container');
    const quizSection = document.getElementById('quiz-section');
    const quizQuestionElement = document.getElementById('quiz-question');
    const quizAnswerInput = document.getElementById('quiz-answer');
    const submitAnswerButton = document.getElementById('submit-answer');
    const nextQuestionButton = document.getElementById('next-question-btn');
    const resultContainer = document.getElementById('quiz-result-container');
    const resultText = document.getElementById('result');
    const progressContainer = document.getElementById('progress-container');
    const medalContainer = document.getElementById('medal-container');
    let currentQuestionId = null;
    let medalCount = 0;
    let correctAnswers = 0;
    const totalQuestions = 10;

    // ユーザープロフィールと進捗レベルの取得
//    async function fetchUserProfile() {
//        try {
//            if (!authData || !currentUserId) {
//                console.warn("ユーザーIDが取得できません。認証チェックを確認してください。");
//                return; // ユーザーIDがなければ処理を終了
//            }
//
//           // プロフィールデータを取得
//            const response = await fetch(`/api/profile/${currentUserId}`);
 //           const data = await response.json();
  //          console.log("取得したデータ:", data); // データの内容を確認
//
 //           if (data.success && data.profile) {
 //               console.log("プロフィールデータが見つかりました。");
  //              const userProgressLevel = data.progress.level; // 'data.progress' からユーザーレベルを取得
  //              console.log("ユーザープログレスレベル:", userProgressLevel);
//
 //               // currentLevel を更新
 //               currentLevel = userProgressLevel;
 //               console.log("更新された currentLevel:", currentLevel);
//
//                totalPoints = data.progress.points || 0; // 累計ポイントを取得
//                console.log("累計ポイント:", totalPoints);
 //           } else {
 //               console.warn("プロフィールデータが見つかりませんでした。");
 //           }
  //      } catch (error) {
 //           console.error("エラー:", error);
 //       }
  //  }

    // ページ読み込み時に認証チェックを実行
    checkAuthentication();

    // スタートボタンを押したときにのみフラッシュカードを取得
    startButton.addEventListener('click', async () => {
        try {
            console.log("スタートボタンがクリックされました。フラッシュカードを表示します。");
            startContainer.style.display = 'none';
            document.getElementById('file-upload-section').style.display = 'none';
            document.getElementById('training-title').style.display = 'none';
    
            // 認証データまたはユーザーIDが無い場合のエラー処理
            if (!authData || !currentUserId) {
                console.error("認証データまたはユーザーIDが見つかりません。処理を終了します。");
                return;
            }    

            // ユーザープロファイルと進捗データを取得
            const progressResponse = await fetch(`/api/get-progress/${currentUserId}`);
            const progressData = await progressResponse.json();
    
            if (progressData.success) {
                console.log("進捗データ取得成功:", progressData)    

                // セッションデータの取得
                const sessionData = await getSessionData();
    
                // セッションデータの取得確認
                if (sessionData) {
                    console.log("セッションデータ取得:", sessionData);
    
                    // セッションデータから現在のレベル、ポイント、メダルを設定
                    currentLevel = sessionData.currentLevel;
                    const sessionPoints = sessionData.sessionPoints;
                    const sessionMedals = sessionData.sessionMedals;
    
                    console.log("取得した現在のレベル:", currentLevel);
                    console.log("取得したセッションポイント:", sessionPoints);
                    console.log("取得したセッションメダル:", sessionMedals);
    
    
                    // 遅延処理を追加して、データが確実に取得されるまで待つ
                    setTimeout(() => {
                        console.log("クイズ開始準備中のデータ:");
                        console.log("レベル:", currentLevel, "ポイント:", sessionPoints, "メダル:", sessionMedals);
                        displayFlashcardsForLevel(currentLevel); // フラッシュカードを表示
                    }, 1000); // 1秒の遅延
                } else {
                    console.error("セッションデータが取得できませんでした。処理を終了します。");
                }
            } else {
                console.error("進捗データの取得に失敗しました:", progressData.message);
            }
        } catch (error) {
            console.error("エラーが発生しました:", error);
        }
    });
    
    // レベルに応じたフラッシュカードを取得して表示する関数
    function displayFlashcardsForLevel(level) {
        console.error("現在のレベル:", currentLevel);
        fetch(`/api/language-training/flashcards?level=${currentLevel}&userId=${currentUserId}`)
            .then(response => response.json())
            .then(data => {
                // フラッシュカードデータの取得確認
                console.log("取得したフラッシュカードデータ:", data);
                
                if (data.success && data.flashcards.length > 0) {
                    console.log("フラッシュカードが見つかりました。表示を開始します。");
                    displayFlashcards(data.flashcards); // 取得したフラッシュカードを表示
                } else {
                    console.error("指定されたレベルにフラッシュカードがありません");
                }
            })
            .catch(error => console.error("Error fetching flashcards:", error));
    }

    // フラッシュカードを順に表示する関数
    function displayFlashcards(flashcards, index = 0) {
        console.log("displayFlashcards 関数が呼び出されました"); // ログを追加
        console.log("現在のフラッシュカードインデックス:", index); // インデックス確認用ログ
        console.log("表示するフラッシュカードデータ:", flashcards); // データ確認用ログ
        

        document.getElementById('training-title').style.display = 'none';
        const flashcardContainer = document.getElementById('flashcard-container');    
        flashcardContainer.style.display = 'block';  // フラッシュカードコンテナを表示

        // 取得したフラッシュカードをログに出力
        console.log("現在表示中のフラッシュカード:", flashcards[index]);

        if (index < flashcards.length) {
            const flashcard = flashcards[index];
            flashcardContainer.innerHTML = '';  // 画面をクリア
    
            const cardElement = document.createElement('div');
            const imageElement = document.createElement('img');
            const textElement = document.createElement('p');
    
            imageElement.src = `/language-uploads/${flashcard.image}`;
            imageElement.alt = 'Flashcard Image';    
            textElement.textContent = flashcard.text;
    
            cardElement.appendChild(imageElement);
            cardElement.appendChild(textElement);
            flashcardContainer.appendChild(cardElement);

            // フラッシュカード音声読み上げ
            speakText(flashcard.text);
        
            // 次のフラッシュカードに移動する
            setTimeout(() => displayFlashcards(flashcards, index + 1), 3000);
        } else {
            flashcardContainer.style.display = 'none';
            startQuiz(); // 全てのフラッシュカード表示後にクイズを開始
        }
    }

    // 音声読み上げを行う関数
    function speakText(text) {
        if ('speechSynthesis' in window) {
            // 既存の発話をキャンセルしてから新しい発話を作成
            window.speechSynthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'ja-JP'; // 日本語で読み上げ
            window.speechSynthesis.speak(utterance);
        }
    }

    // クイズの開始
    function startQuiz() {
        console.log("現在のユーザーレベル:", currentLevel); // デバッグ用出力
        hideAllOtherElements();
        fetchQuizQuestion();
    }

    // クイズの質問と画像を取得
    function fetchQuizQuestion() {
        console.log("現在のユーザレベル:", currentLevel); // デバッグ用
        fetch('/api/generate-quiz-question', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: currentUserId, level: currentLevel })
        })
        .then(response => response.json())
        .then(data => {
            console.log("取得したクイズデータ:", data); // デバッグ用
            if (data.success && data.question && data.image) {
                displayQuizQuestion(data); // クイズの質問を表示
            } else {
                console.error("クイズデータが存在しません。");
            }
        })
        .catch(error => console.error("Error fetching quiz question:", error));
    }

    // クイズの質問を表示
    function displayQuizQuestion(data) {
        quizQuestionElement.textContent = data.question;
        currentQuestionId = data.question_id;
        const quizImageContainer = document.getElementById('quiz-image-container');
        quizImageContainer.innerHTML = '';
        const quizImage = document.createElement('img');
        quizImage.src = `/language-uploads/${data.image}`;
        quizImage.alt = 'クイズ関連画像';
        quizImageContainer.appendChild(quizImage);
        quizSection.style.display = 'block';

        // 音声読み上げ（日本語対応）
        if ('speechSynthesis' in window) {
            // キューに残っている発話をキャンセル
            window.speechSynthesis.cancel();

            const synth = window.speechSynthesis;
            const utterance = new SpeechSynthesisUtterance(data.question);
            utterance.lang = 'ja-JP';

            // 発話をキューに追加
            synth.speak(utterance);
        }
    }

    // 回答を送信
    submitAnswerButton.addEventListener('click', () => {
        const userAnswer = quizAnswerInput.value;
        fetch('/api/submit-quiz-answer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUserId,
                question_id: currentQuestionId,
                answer: userAnswer
            })
        })
        .then(response => response.json())
        .then(data => handleQuizAnswerResponse(data))
        .catch(error => console.error('Error submitting quiz answer:', error));
    });

    // クイズの回答結果を処理
    function handleQuizAnswerResponse(data) {
        console.log("回答結果のポイントとメダル:", data); // デバッグ用
        if (data.isCorrect) {
            correctAnswers++;

            // ポイントとメダルを更新(メダルは関数の中で表示)
            progressContainer.style.display = 'block'; //表示
            document.getElementById('progress-points').textContent = `${data.points} ポイント`;

            // 正解のフィードバックを表示
            resultText.textContent = data.feedback;
            resultContainer.style.display = 'block';
            submitAnswerButton.disabled = true;
    
            alert("正解しました！次の質問に進んでください。");
    
            updateMedals(); // メダルを更新

        } else {
            alert("不正解です。もう一度試してください。");
        }
    
        // 回答フィールドをクリア
        quizAnswerInput.value = '';
    }

    // メダルの更新と表示
    function updateMedals() {
        medalCount++;
        const medalImg = document.createElement('img');
        medalImg.src = '/images/gold_medal.png';
        medalImg.style.width = '50px';
        medalImg.style.height = '50px';
        document.getElementById('medals').appendChild(medalImg);
        medalContainer.style.display = 'block';

        if (medalCount >= 10) {
            const congratulationMessage = document.createElement('p');
            congratulationMessage.textContent = 'よく頑張りました！';
            medalContainer.appendChild(congratulationMessage);
            setTimeout(() => {
                medalContainer.innerHTML = '';
                medalCount = 0;
            }, 5000);
        }
        nextQuestionButton.style.display = 'block';
    }

    // 次の質問ボタンの処理
    nextQuestionButton.addEventListener('click', () => {
        resultContainer.style.display = 'none';
        quizAnswerInput.value = '';
        nextQuestionButton.style.display = 'none';
        submitAnswerButton.disabled = false;

        hideAllOtherElements();  // 次の質問準備中に一旦非表示
        fetchQuizQuestion();
    });

    // 他の要素を非表示にする関数
    function hideAllOtherElements() {
        startContainer.style.display = 'none';
        flashcardContainer.style.display = 'none';
        quizSection.style.display = 'none';
        resultContainer.style.display = 'none';
        progressContainer.style.display = 'none';
        document.getElementById('training-title').style.display = 'none';
        medalContainer.style.display = 'none';
    }

    // セッションデータを取得する関数
    function getSessionData() {
        return fetch('/api/get-session-data')
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    console.log("取得したセッションデータ:", data);
                    return data; // セッションデータを返す
                } else {
                    console.error("セッションデータ取得エラー:", data.message);
                    return null;
                }
            })
            .catch(error => {

                console.error("APIエラー:", error);
                return null;
            });
    }

    // 「終了」ボタンを押したときにレベル更新の処理
    const endQuizButton = document.getElementById('end-quiz-button'); // HTMLにこのボタンを追加

    endQuizButton.addEventListener('click', async () => { // async を追加
        // 確認ダイアログを表示
        const confirmEnd = confirm("クイズを終了してもいいですか？");
    
        if (confirmEnd) {
            const accuracyRate = correctAnswers / totalQuestions;
            let newLevel = currentLevel;
    
            if (accuracyRate >= 0.8) {
                if (currentLevel === "初級") newLevel = "中級";
                else if (currentLevel === "中級") newLevel = "上級";
            } else if (accuracyRate < 0.5) {
                if (currentLevel === "上級") newLevel = "中級";
                else if (currentLevel === "中級") newLevel = "初級";
            }

            try {
                const sessionData = await getSessionData(); // セッションデータを取得
    
                if (sessionData) {
                    updateProgressData(sessionData.currentLevel, sessionData.sessionPoints, true);
                    alert("クイズの進捗を保存しました！");
                }
            } catch (error) {
                console.error("セッションデータの取得中にエラーが発生しました:", error);
            }
    
            // フィードバックメッセージを表示
            displayFeedbackMessage();
        }
    });

    /**
    * 進捗データを更新する関数
    * @param {string} newLevel - 新しいレベル（オプション、nullの場合はレベルを更新しない）
    * @param {number} pointsEarned - 追加するポイント数
    * @param {boolean} resetSession - セッションのポイントとメダルをリセットするかどうか
    */
    function updateProgressData(newLevel = null, pointsEarned = 0, resetSession = false) {
        fetch('/api/update-progress-level', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUserId,
                newLevel: newLevel || currentLevel, // レベルが指定されていない場合、現在のレベルを使用
                points: pointsEarned, // 追加するポイント
            }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log('進捗データが更新されました:', data);

                // 必要に応じてセッションデータをリセット
                if (resetSession) {
                    //totalPoints = 0;
                    medalCount = 0;
                    console.log('セッションメダルをリセットしました');
                }
            } else {
                console.error('進捗データの更新に失敗しました:', data.message);
            }
        })
        .catch(error => console.error('進捗更新APIエラー:', error));
    }
   
    // フィードバックメッセージの表示関数
    function displayFeedbackMessage() {
        // フィードバックメッセージの要素を作成
        const feedbackMessage = document.createElement('div');
        feedbackMessage.innerText = "よくがんばったね！〇あそんでいいよ！！";
        feedbackMessage.style.position = 'fixed';
        feedbackMessage.style.top = '50%';
        feedbackMessage.style.left = '50%';
        feedbackMessage.style.transform = 'translate(-50%, -50%)';
        feedbackMessage.style.backgroundColor = '#333';
        feedbackMessage.style.color = '#fff';
        feedbackMessage.style.padding = '20px';
        feedbackMessage.style.borderRadius = '8px';
        feedbackMessage.style.textAlign = 'center';
        feedbackMessage.style.zIndex = '1000';
        document.body.appendChild(feedbackMessage);

        // メイン画面に戻るために数秒後にリダイレクト
        setTimeout(() => {
            feedbackMessage.remove(); // フィードバックメッセージを削除
            window.location.href = '/main'; // メイン画面のURLにリダイレクト
        }, 3000); // 3秒後に実行
    }

    // イメージ画像を送信してデータベースに保存 アップロードボタン
    document.getElementById('upload-btn').addEventListener('click', function() {
        const fileInput = document.getElementById('file-upload'); // ファイル入力
        const categorySelect = document.getElementById('category-select'); // 大カテゴリー選択
        const subcategorySelect = document.getElementById('subcategory-select'); // サブカテゴリー選択
        const levelSelect = document.getElementById('level-select'); // レベル選択
        const formData = new FormData();

        // ファイルを追加
        Array.from(fileInput.files).forEach(file => {
            formData.append('files', file);
        });
        // 大カテゴリーを追加
        formData.append('category', categorySelect.value);
        // サブカテゴリーを追加 
        formData.append('subcategory', subcategorySelect.value || ''); // サブカテゴリーが選択されていない場合は空にする
        // レベルを追加
        formData.append('level', levelSelect.value);

        fetch('/api/upload-language-training-images', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            console.log('Uploaded:', data);
            if (data.success) {
                alert(`${data.message}`);  // アップロード枚数をポップアップで表示
                fileInput.value = ''; //ファイル選択の表示をリセット
            } else {
                alert(data.message || 'エラーが発生しました');
            }
        })
        .catch(error => console.error('アップロードエラー:', error));
    });
    
    document.getElementById('category-select').addEventListener('change', async (event) => {
        const selectedCategory = event.target.value; // 選択されたカテゴリー
        const subcategorySelect = document.getElementById('subcategory-select'); // サブカテゴリーのプルダウン
    
        try {
            // サブカテゴリー取得APIを呼び出し
            const response = await fetch(`/api/get-subcategories?category=${selectedCategory}`);
            const data = await response.json();
    
            if (data.success) {
                // サブカテゴリーリストをリセット
                subcategorySelect.innerHTML = '<option value="">サブカテゴリーを選択</option>';
    
                // サブカテゴリーをプルダウンに追加
                data.subcategories.forEach((subcat) => {
                    const option = document.createElement('option');
                    option.value = subcat.id; // サブカテゴリーのID
                    option.textContent = subcat.name; // サブカテゴリー名
                    subcategorySelect.appendChild(option);
                });
            } else {
                console.error('サブカテゴリー取得失敗:', data.message);
            }
        } catch (error) {
            console.error('サブカテゴリー取得エラー:', error);
        }
    });
});
