TANGO standalone version

学習データ保存:
- 端末内: Cookie（大きな状態は複数Cookieへ分割）
- 旧localStorageデータがある場合は初回起動時にCookieへ自動移行
- JSONバックアップの書き出し/復元も利用可能

アカウント同期とソーシャル機能:
- Email/Passwordログインで実ユーザーのみ利用可能
- leaderboard/{uid}: uid, displayName, xp, weeklyXP, streak, todayXP, groupIds, updatedAt
- TODAY / WEEKLY / STREAK のランキングに対応
- フレンド: users/{uid}/friends/{friendUid}
- グループ: groups/{groupId} に name, ownerUid, memberUids, createdAt
- フレンドランキングは自分と登録フレンド、グループランキングはgroupIdsで絞り込み
- 表示名を変更するとアカウント表示名とleaderboardにも反映

Firestore推奨ルール:
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} { allow read, write: if request.auth != null && request.auth.uid == userId; }
    match /users/{userId}/friends/{friendId} { allow read, write: if request.auth != null && request.auth.uid == userId; }
    match /leaderboard/{userId} {
      allow read: if request.auth != null;
      allow create, update: if request.auth != null && request.auth.uid == userId;
      allow delete: if false;
    }
    match /groups/{groupId} {
      allow read: if request.auth != null && request.auth.uid in resource.data.memberUids;
      allow create: if request.auth != null;
      allow update: if request.auth != null && request.auth.uid in resource.data.memberUids;
      allow delete: if request.auth != null && request.auth.uid == resource.data.ownerUid;
    }
  }
}

コレクション:
- テーマを8種類に拡張: MIDNIGHT, SAKURA GLASS, OCEAN GLASS, AURORA, EMBER, LAVENDER HAZE, FOREST, MONOCHROME
- テーマごとに背景グラデーション、光、アクセント色、カードの印象を変更
- バッジを12種類に拡張し、獲得数と装備状態を表示

未ログインでも学習機能と端末保存は動作します。ランキング、フレンド、グループはログイン後に利用できます。
公開時はHTTPSの静的ホスティングを推奨します。

今回の更新:
- フレンド一覧から相手プロフィールを閲覧
- フォロー / フォロー解除
- ハートのプレゼントと受け取り数
- 相手プロフィールからランキングバトルへ遷移
- テーマはコレクション画面のボタン群を廃止し、マイページ SETTINGS のプルダウンで変更
- ランキング行からも相手プロフィールを開ける
- ランキングの表示幅・長い表示名・STREAKタブの崩れを修正

追加データ構造:
- users/{uid}/following/{targetUid}
- users/{uid}/followers/{followerUid}
- users/{uid}/friends/{friendUid}
- users/{uid}/hearts/{senderUid}
- leaderboard/{uid}.heartsReceived

今回の本番モード更新:
- HP: レッスン中に「覚えてない」を選ぶと1減少。0になると新しいレッスンを開始できず、HPストックの回復またはコインガチャを案内。
- Streak: レッスン完了時に連続日数を更新し、学習日履歴を保存。完了直後に連続記録スタンプを表示。
- Coin: 正解でコインを獲得。100コインでコインガチャを引き、テーマ、バッジ、HP回復、Streak Keepなどを獲得。
- Home: HP / Streak / Coin、LV、Daily / Monthly達成率、レッスン開始、ガチャ、フレンドだけを表示。ミッション詳細は「詳細」から表示。
- 月間ミッション: 月20レッスンを目標に達成率を表示。

今回の詳細UI更新:
ミッション詳細では、Dailyの3項目を個別進捗・チェック状態・バーで表示し、Monthlyは20レッスンの達成率と5/10/20レッスンのマイルストーンを表示します。
コインガチャには景品一覧と排出確率を追加しました。100コインで1回抽選し、確率はテーマ25%・15%・12%、HP +1 15%、HP回復ストック12%、Streak Keep 8%、FOCUSバッジ8%、SAKURA STARバッジ5%です。
フレンド画面にはFriend Streakの詳細画面を追加し、自分の連続記録、今日達成したフレンド数、各フレンドの連続日数、今日の達成状態、週次スタンプを表示します。
ランキングは、ログイン案内、リーグヒーロー、全体/フレンド/グループ切替、今日/週間/連続の指標、本人順位、トップ3、全メンバー一覧を中心に再設計しました。

今回の学習機能再設計:
- 添付された vocab.js の大学入試最頻出英単語1,400語を学習データとして統合。
- 新規3語 + 復習対象最大2語の短時間セッションに変更。
- 復習対象は次回復習日時に到達した単語を優先。
- 正解時の復習間隔は 1日 → 3日 → 7日 → 14日 → 30日へ拡張。
- 不正解時は0.5日後に再出題し、間隔をリセット。
- まず意味を思い出してからタップして答えを見る「検索練習」型のUIに変更。
- 新規 / DUE（思い出す時間）/ REVIEW（再定着）をカード上部に表示。
- 認識だけでなく、後続の自由想起・英日／日英出題へ拡張できる語彙メタデータ構造を維持。

設計の根拠:
- 間隔を空けた検索練習は、同じセッションでの詰め込みより長期保持に向く。
- 即時テストと1週間・8週間後の保持は別物なので、短期正答率だけで習熟と判定しない。
- そのためTANGOでは、正答回数だけでなく次回復習日時、復習間隔、不正解回数、苦手フラグを保存する。

参照:
- https://theeducationhub.org.nz/spaced-practice-and-its-role-in-supporting-learning-and-retention/
- https://pdf.retrievalpractice.org/SpacingGuide.pdf
- https://www.sciencedirect.com/science/article/abs/pii/S0346251X23000714

今回のUI・学習フロー更新:
- S1/S2/S3表示を廃止し、大学入試頻出語を10問単位のUNIT表示へ変更。
- 学習カードをQUESTION 01 / 10形式に変更し、旧QUICK TEST表示と学習説明文を削除。
- ホームにログイン / ログアウト操作を常設。
- ホームのレベル表示を現在レベル、次レベルまでのXP、進捗率を中心としたカードへ再設計。
- ミッション詳細をDailyの達成率・報酬・リセット時刻、Monthlyの進捗とマイルストーンを含むモーダルへ再設計。
- コレクションをテーマ概要、所持数、バッジグリッド、最近の獲得履歴に再構成。
- マイページを円形プロフィール画像、レベルカード、統計、編集ショートカット中心に再設計。
- プロフィール画像は表示時に円形トリミング。
