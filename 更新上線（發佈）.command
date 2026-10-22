#!/bin/bash
# 雙擊我：把最新內容發佈到公開網站 https://h94321tsai.github.io/travel-atlas/
set -e
VAULT="$HOME/Documents/Obsidian Vault"
DEPLOY="$HOME/.travel-atlas-deploy"

echo "① 處理回顧照片（去 EXIF、產生縮圖）…"
uv run --quiet --with pillow --with piexif python3 "$VAULT/assets/build_recap.py" || echo "⚠️ 回顧照片處理略過（沿用上次結果；需要 uv + 原圖資料夾）"

echo "② 重新產生資料（讀 Trips 筆記）…"
python3 "$VAULT/assets/build_trips.py"

echo "② 複製最新檔案到發佈區…"
cp "$VAULT/index.html" "$VAULT/Travel Atlas.html" "$VAULT/travel-legacy.html" "$VAULT/robots.txt" "$DEPLOY/"
mkdir -p "$DEPLOY/assets/images" "$DEPLOY/assets/fonts" "$DEPLOY/assets/stickers"
cp "$VAULT/assets/globe.gl.min.js" "$VAULT/assets/countries.js" "$VAULT/assets/trips.js" "$DEPLOY/assets/"
cp "$VAULT/assets/proto-detail.css" "$VAULT/assets/proto-detail.js" "$VAULT/assets/proto-finance.css" "$VAULT/assets/proto-finance.js" "$VAULT/assets/paper-grain.svg" "$DEPLOY/assets/"
rsync -a "$VAULT/assets/fonts/" "$DEPLOY/assets/fonts/"
rsync -a --exclude=STYLE.md "$VAULT/assets/stickers/" "$DEPLOY/assets/stickers/"
rsync -a --delete "$VAULT/assets/images/" "$DEPLOY/assets/images/"

# 防快取：每次發佈給 trips.js 加新版本號，瀏覽器就會抓最新的
STAMP=$(date +%s)
sed -i '' "s#assets/trips\.js[^\"']*#assets/trips.js?v=$STAMP#g" "$DEPLOY/Travel Atlas.html"
sed -i '' "s#assets/trips\.js[^\"']*#assets/trips.js?v=$STAMP#g" "$DEPLOY/travel-legacy.html"

echo "③ 上傳到 GitHub…"
cd "$DEPLOY"
git add -A
if ! git diff --cached --quiet; then
  git commit -m "update $(date '+%Y-%m-%d %H:%M')"
fi
# 即使這次沒有新增變更，也重試推送先前尚未上傳的提交。
git push -q
echo ""
echo "✅ 已推送！約 1 分鐘後更新上線："
echo "   https://h94321tsai.github.io/travel-atlas/"
echo ""
echo "(按 Enter 關閉視窗)"; read _
