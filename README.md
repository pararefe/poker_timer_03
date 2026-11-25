# Poker Tournament Timer

ブラウザだけで動くポーカートーナメント用タイマーです。サーバー不要（静的ファイルのみ）。

## 特長
- ブラインド/アンティ/休憩の管理、プリセット保存、Excel(.xlsx)入出力、JSONバックアップ
- 残り人数・エントリー数・アベレージスタックの自動計算
- 終了時刻ベースのタイマー（タブが裏に回っても、一時停止しても、ずれません）
- 設定・進行状況はブラウザに自動保存（リロードしても復帰）
- **SHARE URL**：QRコードをスマホで読み取ると、本体と同期する**閲覧専用**タイマー（タイマー・アベレージ等のみ。設定・操作は不可）を表示
- 20色のテーマカラー、30種類のフォント、ネオン発光調整
- PWA対応、画面スリープ防止、キーボード操作（`Space` 開始/停止、`←` `→` レベル移動）

## ファイル構成
```
index.html      画面
css/style.css   スタイル
js/app.js       ロジック
sw.js           Service Worker（オフライン対応）
manifest.json   PWA設定
icon.svg        アイコン
```
効果音 `1min.mp3`（残り1分）、`count.mp3`（ラスト3秒）、`LevelUP.mp3`（レベル終了）をルートに置くと鳴ります（リポジトリには含まれていません。無くても動作します）。

## 使い方
### GitHub Pages で公開（推奨）
1. このリポジトリを GitHub に push
2. **Settings → Pages → Branch: `main` / `(root)`** を選んで保存
3. 発行された `https://<user>.github.io/<repo>/` を開く
4. SHARE URL → QRコードをスマホで読み取り

### ローカルで動かす
```bash
python3 -m http.server 8000
# → http://localhost:8000/ （スマホと共有する場合は http://<PCのIP>:8000/ で開く）
```
`file://` で直接開くと共有機能・PWAは使えません。

## 共有機能の仕組みと注意
- [PeerJS](https://peerjs.com/)（WebRTC）で本体→子機へ状態を送信します。シグナリングには PeerJS 公開サーバーを利用します。
- 別ネットワーク間の接続用に公開TURNサーバー（Open Relay）を指定しています。無料の公開枠のため不安定な場合があります。本格運用では自前のTURN/PeerServer の利用を推奨します（`js/app.js` の `PEER_OPTS`）。
- 本体のタブを閉じる/スリープさせると子機も止まります。

## 使用ライブラリ（CDN）
PeerJS / SheetJS (xlsx) / qrcodejs / Google Fonts

## ライセンス
MIT
