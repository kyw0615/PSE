#!/usr/bin/env python3
"""
PSE 단어장 - 빌드 스크립트
=========================
docs/data/ 안의 단어 JSON 파일들을 읽어서 사이트가 사용하는
  - docs/data/manifest.json  (구조 정보)
  - docs/data/bundle.js      (window.PSE_DATA = 전체 데이터)
를 생성합니다.

사용법:
    python build.py

새 날(day)을 추가하려면:
    1) docs/data/<월>/dayNN.json 파일을 만든다.  예) docs/data/AM1/day14.json
       형식:  { "label": "Day 14", "topic": null, "words": [ {"korean": "...", "english": "..."} ] }
    2) python build.py 를 실행한다.
    3) 커밋 & 푸시.

새 월을 추가하려면:
    1) docs/data/<월ID>/ 폴더를 만들고 day 파일을 넣는다.
    2) docs/data/config.json 의 "months" 목록에 { "id": "...", "name": "..." } 를 한 줄 추가한다.
    3) python build.py 실행 후 커밋 & 푸시.
"""
import os, re, json, sys

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "docs", "data")
CONFIG = os.path.join(DATA, "config.json")


def day_sort_key(deck_id):
    """dayNN -> NN 로 정렬. 숫자가 없으면(예: 'all') 맨 뒤로."""
    m = re.search(r'(\d+)', deck_id)
    return int(m.group(1)) if m else 10**9


def load_config():
    with open(CONFIG, "r", encoding="utf-8") as f:
        return json.load(f)


def discover_decks(month_id):
    folder = os.path.join(DATA, month_id)
    if not os.path.isdir(folder):
        print(f"  ! 경고: 폴더 없음 -> {folder}")
        return []
    decks = []
    for fn in os.listdir(folder):
        if not fn.endswith(".json"):
            continue
        deck_id = fn[:-5]
        path = os.path.join(folder, fn)
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except json.JSONDecodeError as e:
            raise SystemExit(
                f"오류: JSON 형식이 잘못되었습니다 -> {os.path.join(month_id, fn)}\n"
                f"       {e}\n"
                f"       (쉼표/따옴표를 확인하세요. 마지막 항목 뒤에는 쉼표가 없어야 합니다.)"
            )
        words = data.get("words", [])
        # 데이터 위생 검사
        clean = []
        for w in words:
            k = (w.get("korean") or "").strip()
            e = (w.get("english") or "").strip()
            if k and e:
                clean.append({"korean": k, "english": e})
        decks.append({
            "id": deck_id,
            "label": data.get("label") or deck_id,
            "topic": data.get("topic"),
            "count": len(clean),
            "words": clean,
        })
    decks.sort(key=lambda d: day_sort_key(d["id"]))
    return decks


def build():
    cfg = load_config()
    months_out = []
    for m in cfg["months"]:
        decks = discover_decks(m["id"])
        months_out.append({
            "id": m["id"],
            "name": m.get("name", m["id"]),
            "days": decks,
        })

    site = {
        "title": cfg.get("title", "PSE 단어장"),
        "subtitle": cfg.get("subtitle", ""),
        "months": months_out,
    }

    # manifest.json (단어 제외 - 구조/개수만)
    manifest = {
        "title": site["title"],
        "subtitle": site["subtitle"],
        "months": [
            {
                "id": m["id"],
                "name": m["name"],
                "days": [
                    {"id": d["id"], "label": d["label"], "topic": d["topic"], "count": d["count"]}
                    for d in m["days"]
                ],
            }
            for m in months_out
        ],
    }
    with open(os.path.join(DATA, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)

    # bundle.js (단어 포함 - 앱이 직접 로드. file:// 에서도 동작)
    bundle = "window.PSE_DATA = " + json.dumps(site, ensure_ascii=False, separators=(",", ":")) + ";\n"
    with open(os.path.join(DATA, "bundle.js"), "w", encoding="utf-8") as f:
        f.write(bundle)

    # 요약
    total_words = sum(d["count"] for m in months_out for d in m["days"])
    total_decks = sum(len(m["days"]) for m in months_out)
    print("빌드 완료 ✓")
    print(f"  월 {len(months_out)}개 · 덱 {total_decks}개 · 단어 {total_words}개")
    for m in months_out:
        wc = sum(d["count"] for d in m["days"])
        print(f"    {m['id']} ({m['name']}): 덱 {len(m['days'])}개 · 단어 {wc}개")
    print("  -> docs/data/manifest.json")
    print("  -> docs/data/bundle.js")
    return total_words


if __name__ == "__main__":
    # Windows 콘솔(cp949)에서도 한글/기호 출력이 깨지거나 죽지 않도록
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    try:
        build()
    except FileNotFoundError as e:
        print(f"오류: 파일을 찾을 수 없습니다 - {e}", file=sys.stderr)
        sys.exit(1)
