#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# 執行：uv run --with pillow --with piexif python3 assets/build_recap.py
"""
處理旅程「回顧」照片：
  1. 讀 EXIF 拍攝時間 → 依旅程當地日期分到 Day（沒時間 → 未分類 + 警告）
  2. 讀 EXIF GPS → 對當天 itinerary spots 找最近景點（<500m 命中），否則放當天「其他」
     （先完成比對，才去 EXIF）
  3. 輸出 thumb（短邊 400px）、full（長邊 1800px），移除所有 EXIF（含 GPS）
  4. 用 sha1 快取，只處理新增/改動過的照片
  5. 寫出 assets/data/<旅程>.recap.json（供 build_trips.py 併入 trips.js）
"""
import os, sys, re, json, glob, math, hashlib, datetime
from PIL import Image, ImageOps
import piexif

VAULT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA  = os.path.join(VAULT, "assets", "data")
IMG   = os.path.join(VAULT, "assets", "images")
TRIPS = os.path.join(VAULT, "Trips")

# 原圖來源：優先 Trips/<旅程>/recap/，否則用下表（原圖不必進 vault/git）
EXTERNAL_SRC = {
    "2025-11 泰國 曼谷 PATTAYA":
        "/Users/h94321tsai/Desktop/SUNMO/旅遊規劃_APP/trips/2025-11_曼谷PATTAYA/recap",
    "2026-10 日本 廣島倉敷高松":
        "/Users/h94321tsai/Desktop/SUNMO/旅遊規劃_APP/trips/2026-10_廣島倉敷高松/recap",
}
# 國家 → 當地時區（僅記錄用；分 Day 以 EXIF 當地日期為準）
TZ = {"日本": 9, "韓國": 9, "泰國": 7, "越南": 7, "台灣": 8}

THUMB_SHORT = 400     # 縮圖短邊
FULL_LONG   = 1800    # 大圖長邊
MATCH_M     = 500     # 景點命中距離（公尺）
THUMB_Q     = 72
FULL_Q      = 82


def parse_frontmatter(text):
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", text, re.S)
    if not m:
        return {}, text
    fm, body = {}, m.group(2)
    for line in m.group(1).splitlines():
        km = re.match(r"^(\w+):\s*(.*)$", line)
        if not km:
            continue
        fm[km.group(1)] = km.group(2).strip().strip('"\'')
    return fm, body


def extract_section(body, title):
    m = re.search(r"^##[^\n]*" + re.escape(title) + r"[^\n]*\n(.*?)(?=^##\s|\Z)", body, re.S | re.M)
    return m.group(1) if m else ""


def parse_recap_md(body):
    """## 回顧 區塊：Day N: 心得 ／ FILE.jpg: 說明 ★（★＝封面）"""
    notes, caps, cover = {}, {}, None
    sec = extract_section(body, "回顧")
    for line in sec.splitlines():
        m = re.match(r"^\s*-?\s*Day\s*(\d+)\s*[:：]\s*(.+)$", line, re.I)
        if m:
            notes[int(m.group(1))] = m.group(2).strip()
            continue
        m = re.match(r"^\s*-?\s*([\w.\-]+\.(?:jpg|jpeg|png))\s*[:：]\s*(.+)$", line, re.I)
        if m:
            fn, cap = m.group(1), m.group(2).strip()
            is_cover = "★" in cap
            cap = cap.replace("★", "").strip()
            caps[fn.lower()] = cap
            if is_cover:
                cover = fn.lower()
    return notes, caps, cover


def haversine(a, b, c, d):
    R = 6371000
    p1, p2 = math.radians(a), math.radians(c)
    dp = math.radians(c - a); dl = math.radians(d - b)
    x = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2 * R * math.asin(math.sqrt(x))


def exif_dt(exif):
    for ifd, tag in (("Exif", piexif.ExifIFD.DateTimeOriginal),
                     ("Exif", piexif.ExifIFD.DateTimeDigitized),
                     ("0th", piexif.ImageIFD.DateTime)):
        v = exif.get(ifd, {}).get(tag)
        if v:
            try:
                return datetime.datetime.strptime(v.decode().strip(), "%Y:%m:%d %H:%M:%S")
            except Exception:
                pass
    return None


def _rat(x):
    return x[0] / x[1] if x[1] else 0.0


def exif_gps(exif):
    g = exif.get("GPS") or {}
    lat = g.get(piexif.GPSIFD.GPSLatitude); latref = g.get(piexif.GPSIFD.GPSLatitudeRef)
    lng = g.get(piexif.GPSIFD.GPSLongitude); lngref = g.get(piexif.GPSIFD.GPSLongitudeRef)
    if not (lat and lng):
        return None
    def dms(v):
        return _rat(v[0]) + _rat(v[1])/60 + _rat(v[2])/3600
    la, lo = dms(lat), dms(lng)
    if latref in (b"S", "S"): la = -la
    if lngref in (b"W", "W"): lo = -lo
    return (la, lo)


def sha1(path):
    h = hashlib.sha1()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def save_variant(src, out, long_side=None, short_side=None, q=82):
    im = Image.open(src)
    im = ImageOps.exif_transpose(im)        # 先套方向校正
    if im.mode not in ("RGB", "L"):
        im = im.convert("RGB")
    w, h = im.size
    if long_side:
        r = min(1.0, long_side / max(w, h))
    else:
        r = short_side / min(w, h)           # 縮圖可放大以填滿短邊
    nw, nh = max(1, round(w * r)), max(1, round(h * r))
    if (nw, nh) != (w, h):
        im = im.resize((nw, nh), Image.LANCZOS)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    im.save(out, "JPEG", quality=q, optimize=True)   # 不帶 exif → 去除所有 EXIF/GPS


def process_trip(name, fm, body):
    src_dir = os.path.join(TRIPS, name, "recap")
    if not os.path.isdir(src_dir):
        src_dir = EXTERNAL_SRC.get(name)
    if not src_dir or not os.path.isdir(src_dir):
        return None
    files = sorted(f for ext in ("*.jpg", "*.JPG", "*.jpeg", "*.JPEG", "*.png", "*.PNG")
                   for f in glob.glob(os.path.join(src_dir, ext)))
    if not files:
        return None

    # 旅程每天日期
    start = None
    try:
        start = datetime.date.fromisoformat(str(fm.get("start")))
    except Exception:
        pass
    ipath = os.path.join(DATA, name + ".itinerary.json")
    itin = json.load(open(ipath, encoding="utf-8")) if os.path.exists(ipath) else {"days": []}
    idays = itin.get("days", [])
    date2day = {}   # date → (day_index0, label, spots[])
    for i, d in enumerate(idays):
        if start:
            date2day[start + datetime.timedelta(days=i)] = (i, d.get("date", f"Day {i+1}"),
                                                            d.get("spots", []))

    notes, caps, cover_file = parse_recap_md(body)

    # 輸出資料夾用「城市」資料夾（與購物/行程圖一致：廣島）
    city_dir = IMG_DIR_FOR.get(name) or name
    out_dir_abs = os.path.join(IMG, city_dir, "recap")
    out_rel = f"assets/images/{city_dir}/recap"

    cache_path = os.path.join(DATA, name + ".recap.cache.json")
    cache = json.load(open(cache_path, encoding="utf-8")) if os.path.exists(cache_path) else {}
    new_cache = {}

    days = {}   # day_index0 → {"d","date","note","spots":{name:[photos]},"others":[photos]}
    unclassified = []
    processed = skipped = 0

    for f in files:
        base = os.path.basename(f)
        stem = re.sub(r"[^\w.\-]", "_", os.path.splitext(base)[0])
        thumb_rel = f"{out_rel}/t_{stem}.jpg"
        full_rel  = f"{out_rel}/f_{stem}.jpg"
        thumb_abs = os.path.join(VAULT, thumb_rel)
        full_abs  = os.path.join(VAULT, full_rel)

        # 讀 EXIF（分 Day + GPS）— 先比對，後面再輸出（輸出時去 EXIF）
        try:
            ex = piexif.load(f)
        except Exception:
            ex = {"Exif": {}, "GPS": {}, "0th": {}}
        dt = exif_dt(ex)
        gps = exif_gps(ex)

        photo = {"thumb": thumb_rel, "full": full_rel, "src": base,
                 "time": dt.strftime("%H:%M") if dt else "",
                 "caption": caps.get(base.lower(), "")}

        # 分 Day
        day_key = None
        if dt and dt.date() in date2day:
            day_key = date2day[dt.date()][0]
        if day_key is None:
            unclassified.append(photo)
            print(f"   ⚠️  未分類（無有效拍攝日期或不在旅程期間）：{base}"
                  + (f"  [{dt}]" if dt else "  [無 EXIF 時間]"))
        else:
            idx, label, spots = date2day[dt.date()]
            dd = days.setdefault(idx, {"d": f"Day {idx+1}", "date": label,
                                       "note": notes.get(idx+1, ""), "spots": {}, "others": []})
            # GPS → 最近景點
            hit = None
            if gps:
                best = (MATCH_M + 1, None)
                for s in spots:
                    try:
                        la, lo = [float(x) for x in str(s.get("c", "")).split(",")]
                    except Exception:
                        continue
                    dist = haversine(gps[0], gps[1], la, lo)
                    if dist < best[0]:
                        best = (dist, s.get("n"))
                if best[1] and best[0] <= MATCH_M:
                    hit = best[1]
            if hit:
                dd["spots"].setdefault(hit, []).append(photo)
            else:
                dd["others"].append(photo)

        # 輸出圖（有快取且原圖未變 → 跳過重壓）
        h = sha1(f)
        new_cache[base] = {"sha1": h, "thumb": thumb_rel, "full": full_rel}
        if cache.get(base, {}).get("sha1") == h and os.path.exists(thumb_abs) and os.path.exists(full_abs):
            skipped += 1
            continue
        save_variant(f, thumb_abs, short_side=THUMB_SHORT, q=THUMB_Q)
        save_variant(f, full_abs, long_side=FULL_LONG, q=FULL_Q)
        processed += 1

    # 清掉來源已刪除的輸出
    valid = set()
    for b in new_cache.values():
        valid.add(os.path.join(VAULT, b["thumb"])); valid.add(os.path.join(VAULT, b["full"]))
    if os.path.isdir(out_dir_abs):
        for old in glob.glob(os.path.join(out_dir_abs, "*.jpg")):
            if old not in valid:
                os.remove(old)

    json.dump(new_cache, open(cache_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    # 組 days（只留有照片的天，依序；每組照片依時間排序）
    out_days = []
    for idx in sorted(days):
        dd = days[idx]
        spots = [{"n": n, "photos": sorted(ph, key=lambda p: p["time"])}
                 for n, ph in dd["spots"].items()]
        dd["others"].sort(key=lambda p: p["time"])
        out_days.append({"d": dd["d"], "date": dd["date"], "note": dd["note"],
                         "spots": spots, "others": dd["others"]})

    # 封面
    all_photos = [p for d in out_days for s in d["spots"] for p in s["photos"]] \
               + [p for d in out_days for p in d["others"]]
    cover = None
    if cover_file:
        for p in all_photos:
            if p["src"].lower() == cover_file:
                cover = p["full"]; break
    explicit_cover = fm.get("cover")
    if not cover and explicit_cover and explicit_cover.startswith("assets/") and os.path.isfile(os.path.join(VAULT, explicit_cover)):
        cover = explicit_cover
    if not cover and all_photos:
        cover = all_photos[0]["full"]

    print(f"   ✅ {name}：處理 {processed} 張、快取跳過 {skipped} 張、"
          f"分到 {len(out_days)} 天、未分類 {len(unclassified)} 張")

    recap = {"cover": cover, "count": len(all_photos),
             "days": out_days, "unclassified": unclassified}
    json.dump(recap, open(os.path.join(DATA, name + ".recap.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    return recap


# 旅程 → 圖片城市資料夾（與現有購物/行程圖一致）
IMG_DIR_FOR = {"2026-10 日本 廣島倉敷高松": "廣島"}


def main():
    os.makedirs(DATA, exist_ok=True)
    print("📸 處理回顧照片…")
    n = 0
    for path in sorted(glob.glob(os.path.join(TRIPS, "*.md"))):
        text = open(path, encoding="utf-8").read()
        fm, body = parse_frontmatter(text)
        if fm.get("type") != "trip":
            continue
        name = os.path.splitext(os.path.basename(path))[0]
        if process_trip(name, fm, body):
            n += 1
    print(f"完成（{n} 趟有回顧照片）。")


if __name__ == "__main__":
    main()
