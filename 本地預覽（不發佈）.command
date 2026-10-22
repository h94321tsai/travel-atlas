#!/bin/bash
# 雙擊我：在這台電腦開一個「本地預覽」網站，改完存檔→瀏覽器重整就看到，不用發佈。
# 關掉這個視窗（或按 Ctrl+C）就會停止預覽。
VAULT="$HOME/Documents/Obsidian Vault"
PORT=8765
cd "$VAULT"

echo "① 重新產生資料（讀 Trips 筆記 / 回顧照片）…"
uv run --quiet --with pillow --with piexif python3 "$VAULT/assets/build_recap.py" >/dev/null 2>&1 || echo "  （回顧照片略過）"
python3 "$VAULT/assets/build_trips.py" >/dev/null

# 若 8765 已被占用，先關掉舊的
PIDS=$(lsof -ti tcp:$PORT 2>/dev/null)
[ -n "$PIDS" ] && kill $PIDS 2>/dev/null

URL="http://localhost:$PORT/Travel%20Atlas.html"
echo ""
echo "✅ 本地預覽已啟動："
echo "   $URL"
echo ""
echo "改了網頁樣式/功能 → 瀏覽器按 ⌘R 重整就看到。"
echo "改了旅程筆記(Trips/*.md) → 重新雙擊本檔，資料才會更新。"
echo ""
echo "(關掉這個視窗就停止預覽)"
open "$URL"
python3 -m http.server $PORT
