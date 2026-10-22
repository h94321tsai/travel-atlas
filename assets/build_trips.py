#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""掃描 Trips/*.md → 產出 assets/trips.js，供 Travel Atlas 網站讀取。"""
import glob, json, os, re, datetime

VAULT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TRIPS_DIR = os.path.join(VAULT, "Trips")
OUT = os.path.join(VAULT, "assets", "trips.js")

# 地點 → 經緯度（取 place 第一個城市）
COORDS = {
    "濟州": (33.4996,126.5312), "野澤溫泉": (36.9218,138.4443), "野澤": (36.9218,138.4443),
    "曼谷": (13.7563,100.5018), "芭達雅": (12.9236,100.8825), "釜山": (35.1796,129.0756),
    "首爾": (37.5665,126.9780), "越後湯澤": (36.9372,138.8082), "峴港": (16.0544,108.2022),
    "廣島": (34.3853,132.4553), "倉敷": (34.5850,133.7720), "高松": (34.3401,134.0434),
    "藏王": (38.1600,140.3900), "藏王溫泉": (38.1600,140.3900), "山形": (38.2554,140.3396),
    "東京": (35.6762,139.6503),
}
REGION = {"韓國":"韓國","日本":"日本","泰國":"泰國","越南":"越南"}

def parse_frontmatter(text):
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", text, re.S)
    if not m: return {}, text
    fm, body = {}, m.group(2)
    for line in m.group(1).splitlines():
        if not line.strip() or line.strip().startswith("#"): continue
        km = re.match(r"^(\w+):\s*(.*)$", line)
        if not km: continue
        k, v = km.group(1), km.group(2).strip()
        if v.startswith("[") and v.endswith("]"):
            inner = v[1:-1].strip()
            v = [x.strip().strip('"\'') for x in inner.split(",")] if inner else []
        elif v == "": v = None
        else: v = v.strip('"\'')
        fm[k] = v
    return fm, body

def first_city(place):
    if not place: return None
    token = re.split(r"[,、\s]+", str(place).strip())[0]
    return token

def days_between(s, e):
    try:
        d1 = datetime.date.fromisoformat(str(s)); d2 = datetime.date.fromisoformat(str(e))
        return (d2 - d1).days + 1
    except Exception:
        return None

def extract_section(body, title):
    """取 ## <title> 標題行到下一個 ## 之間的內容（標題只比對單行，避免誤觸內文關鍵字）。"""
    m = re.search(r"^##[^\n]*" + re.escape(title) + r"[^\n]*\n(.*?)(?=^##\s|\Z)", body, re.S | re.M)
    return m.group(1) if m else ""

def parse_shopping(body):
    sec = extract_section(body, "購物清單")
    if not sec: return []
    groups, cur = [], None
    for line in sec.splitlines():
        h = re.match(r"^###\s+(.*)$", line)
        if h:
            cur = {"group": h.group(1).strip(), "items": []}
            groups.append(cur); continue
        it = re.match(r"^\s*-\s*\[( |x|X)\]\s+(.*)$", line)
        if it and cur is not None:
            cur["items"].append({"text": it.group(2).strip(), "done": it.group(1).lower() == "x"})
    return [g for g in groups if g["items"]]

def parse_itinerary(body):
    sec = extract_section(body, "行程")
    rows = []
    for line in sec.splitlines():
        if not line.strip().startswith("|"): continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if not cells or set("".join(cells)) <= set("-: "): continue   # 分隔線
        if cells[0] in ("Day","day"): continue                        # 表頭
        rows.append(cells)
    return rows

trips = []
for path in sorted(glob.glob(os.path.join(TRIPS_DIR, "*.md"))):
    text = open(path, encoding="utf-8").read()
    fm, body = parse_frontmatter(text)
    if fm.get("type") != "trip": continue
    name = os.path.splitext(os.path.basename(path))[0]
    city = first_city(fm.get("place"))
    lat, lng = COORDS.get(city, (None, None))
    # 若有 rich 購物資料檔(assets/data/<name>.shopping.json)就優先用它
    jpath = os.path.join(VAULT, "assets", "data", name + ".shopping.json")
    if os.path.exists(jpath):
        jd = json.load(open(jpath, encoding="utf-8"))
        shopping = jd.get("shopping", [])
        image_base = jd.get("imageBase")
        buy_timing = jd.get("buyTiming")
    else:
        shopping = parse_shopping(body); image_base = None; buy_timing = None
    # rich 行程資料檔(assets/data/<name>.itinerary.json)
    ipath = os.path.join(VAULT, "assets", "data", name + ".itinerary.json")
    if os.path.exists(ipath):
        idata = json.load(open(ipath, encoding="utf-8"))
        itinerary_rich = idata.get("days"); trip_meta = idata.get("meta")
    else:
        itinerary_rich = None; trip_meta = None
    # 回顧照片資料檔(assets/data/<name>.recap.json,由 build_recap.py 產生)
    rpath = os.path.join(VAULT, "assets", "data", name + ".recap.json")
    recap = json.load(open(rpath, encoding="utf-8")) if os.path.exists(rpath) else None
    # 花費記帳:成員(只取名字,絕不含 email)+ 幣別
    raw_members = fm.get("members") or []
    if isinstance(raw_members, str):
        raw_members = [x.strip() for x in raw_members.split(",") if x.strip()]
    members = [re.sub(r"\s*<[^>]*>", "", str(x)).strip() for x in raw_members]
    members = [m for m in members if m]
    trips.append({
        "name": name,
        "country": fm.get("country"), "flag": fm.get("flag") or "",
        "place": fm.get("place"), "region": REGION.get(fm.get("country"), fm.get("country") or "其他"),
        "status": fm.get("status") or "規劃中",
        "start": str(fm.get("start")) if fm.get("start") else None,
        "end": str(fm.get("end")) if fm.get("end") else None,
        "year": (str(fm.get("start"))[:7].replace("-", ".") if fm.get("start") else
                 {"規劃中":"規劃中","許願池":"願望","行程回顧":""}.get(fm.get("status"), "")),
        "people": fm.get("people"),
        "days": days_between(fm.get("start"), fm.get("end")),
        "companions": fm.get("companions") or [],
        "tags": fm.get("tags") or [],
        "lat": lat, "lng": lng,
        "shopping": shopping, "imageBase": image_base, "buyTiming": buy_timing,
        "itinerary": parse_itinerary(body),
        "itineraryRich": itinerary_rich, "tripMeta": trip_meta,
        "recap": recap,
        "members": members, "currency": fm.get("currency"),
        "financeSource": json.load(open(os.path.join(VAULT, "assets", "data", name + ".finance.json"), encoding="utf-8")) if os.path.exists(os.path.join(VAULT, "assets", "data", name + ".finance.json")) else None,
    })

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as f:
    f.write("window.__TRIPS__ = " + json.dumps(trips, ensure_ascii=False, indent=1) + ";\n")
print(f"✅ 產生 {len(trips)} 趟 → {OUT}")
for t in trips:
    sc = sum(len(g["items"]) for g in t["shopping"])
    print(f"   · {t['name']}  [{t['status']}]  購物{sc}項  行程{len(t['itinerary'])}列  coord={t['lat']},{t['lng']}")
