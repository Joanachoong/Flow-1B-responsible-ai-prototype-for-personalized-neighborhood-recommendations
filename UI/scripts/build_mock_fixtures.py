"""Regenerates UI/public/mock/*.json (sample data for NEXT_PUBLIC_USE_MOCK=true).

FIXTURES ONLY. The ranking below is a crude stand-in so the UI has realistic shapes and real
Miami values before the MCP server exists. It is NOT the scoring engine and must not be used as one;
once score_zips works, replace these files with saved live responses (PRD B7).

    python UI/scripts/build_mock_fixtures.py .   # run from the repo root
"""
import csv, json, sys
from pathlib import Path

repo = Path(sys.argv[1]); out = repo / "UI/public/mock"; (out / "presets").mkdir(parents=True, exist_ok=True)
def rows(p, key):
    with open(repo / p, encoding="utf-8-sig", newline="") as f:
        return {r[key].zfill(5): r for r in csv.DictReader(f)}
feat = rows("data/cleaned/area_features_cleaned.csv", "zip")
rent = rows("data/cleaned/new/Miami-rents-cleaned.csv", "zip_code")
transit = rows("data/cleaned/new/miami-transit-cleaned.csv", "zip_code")
geo = {f["properties"]["zip"]: f["properties"] for f in json.load(open(repo / "UI/public/geo/miami-zctas.geojson"))["features"]}
def num(v):
    try: return float(v)
    except (TypeError, ValueError): return None
BR_COL = {0: "hud_efficiency", 1: "hud_1_bedroom", 2: "hud_2_bedroom", 3: "hud_3_bedroom"}
BR_LABEL = {0: "studio", 1: "1BR", 2: "2BR", 3: "3BR"}
max_stops = max(num(t["transit_stop_count"]) or 0 for t in transit.values())

def zip_result(z, p):
    f, r, t = feat.get(z), rent.get(z), transit.get(z, {})
    if not f or not r or z not in geo: return None
    rent_v = num(r[BR_COL[p["bedrooms"]]])
    quiet, social, pet, walk = (num(f[k]) for k in ("quiet", "social", "pet_friendly", "walkable"))
    stops = num(t.get("transit_stop_count")) or 0
    if None in (rent_v, quiet, social, pet, walk): return None
    target = (p["vibe"] - 1) / 4; lively = (social + (1 - quiet)) / 2
    parts = {
        "median_rent": (max(0.0, 1 - abs(p["budgetMax"] - rent_v) / p["budgetMax"]) if rent_v <= p["budgetMax"] else 0.0, 3),
        "vibe": (1 - abs(target - lively), 3),
        "pet_friendly": (pet, 2 if p["petFriendly"] else 0.5),
        "transit": (stops / max_stops, p["weights"]["transit"]),
        "walkable": (walk, p["weights"]["amenities"]),
    }
    total_w = sum(w for _, w in parts.values())
    contrib = {k: s * w / total_w * 100 for k, (s, w) in parts.items()}
    def m(s): return "yes" if s >= 0.66 else "partial" if s >= 0.33 else "no"
    noise = "Low" if quiet >= 0.66 else "Medium" if quiet >= 0.33 else "High"
    features = [
        {"key": "median_rent", "label": f"Median rent ({BR_LABEL[p['bedrooms']]})", "value": round(rent_v), "unit": "$/mo", "match": "yes" if rent_v <= p["budgetMax"] else "no", "contribution": round(contrib["median_rent"], 1)},
        {"key": "noise_level", "label": "Noise level", "value": noise, "match": m(parts["vibe"][0]), "contribution": round(contrib["vibe"], 1)},
        {"key": "pet_friendly", "label": "Pet-friendly score", "value": round(pet * 100), "unit": "%", "match": m(pet) if p["petFriendly"] else "partial", "contribution": round(contrib["pet_friendly"], 1)},
        {"key": "transit_stops", "label": "Transit stops", "value": int(stops), "unit": "stops", "match": m(parts["transit"][0]), "contribution": round(contrib["transit"], 1)},
        {"key": "walkable", "label": "Walkability", "value": round(walk * 100), "unit": "%", "match": m(walk), "contribution": round(contrib["walkable"], 1)},
    ]
    return {"zip": z, "neighborhood": geo[z]["name"], "rank": 0, "score": round(sum(contrib.values()), 1),
            "centroid": geo[z]["centroid"], "features": features, "reason": "", "_rent": rent_v}

def reason(res, p):
    under = p["budgetMax"] - res["_rent"]
    vibe = {1: "very quiet", 2: "quiet", 3: "balanced", 4: "lively", 5: "very lively"}[p["vibe"]]
    good = [f["label"].lower() for f in res["features"][1:] if f["match"] == "yes"]
    s = f"{res['neighborhood']} keeps you about ${under:,.0f} under your ${p['budgetMax']:,.0f} budget"
    s += (" and scores well on " + " and ".join(good[:2]) + "." if good else ".")
    s += f" It is a reasonable fit for the {vibe} vibe you asked for. (Mock data — not from the live engine.)"
    return s

def rank(p, n, budget_filter=True):
    res = [r for z in sorted(feat) if (r := zip_result(z, p))]
    total = len(res)
    if budget_filter: res = [r for r in res if r["_rent"] <= p["budgetMax"] and (not p["petFriendly"] or r["features"][2]["value"] >= 30)]
    res.sort(key=lambda r: (-r["score"], r["zip"])); matched = len(res); res = res[:n]
    for i, r in enumerate(res, 1): r["rank"] = i; r["reason"] = reason(r, p)
    for r in res: r.pop("_rent")
    return {"results": res, "appliedFilters": p, "meta": {"zipsScored": total, "matched": matched}}

base = {"budgetMax": 2500, "housingType": "any", "bedrooms": 1, "petFriendly": False, "vibe": 3, "weights": {"safety": 3, "transit": 3, "schools": 1, "amenities": 3}, "topN": 5}
presets = {
    "budget-dog": {**base, "budgetMax": 2000, "petFriendly": True, "vibe": 2, "housingType": "apartment"},
    "young-family": {**base, "budgetMax": 3500, "bedrooms": 3, "housingType": "house", "vibe": 2, "weights": {"safety": 5, "transit": 2, "schools": 5, "amenities": 3}},
    "lively-single": {**base, "budgetMax": 2800, "bedrooms": 0, "housingType": "apartment", "vibe": 5, "weights": {"safety": 2, "transit": 5, "schools": 0, "amenities": 5}},
}
for name, p in presets.items():
    (out / "presets" / f"{name}.json").write_text(json.dumps(rank(p, 5), indent=1))
pool_p = {**base, "budgetMax": 6000}
pool = rank(pool_p, 30)
for r in pool["results"]:
    rent_f = r["features"][0]["value"]; good = [f["label"].lower() for f in r["features"][1:] if f["match"] == "yes"]
    r["reason"] = (f"{r['neighborhood']} has a median rent of ${rent_f:,} and " + ("scores well on " + " and ".join(good[:2]) if good else "a mixed profile on your other preferences") + ". (Mock data — not from the live engine.)")
(out / "recommend.json").write_text(json.dumps(pool, indent=1))
chat = rank(presets["budget-dog"], 5)
(out / "chat.json").write_text(json.dumps({"reply": "Here are 5 quiet, pet-friendly zips under $2,000.", "understoodFilters": presets["budget-dog"], "results": chat["results"], "meta": chat["meta"]}, indent=1))
details = {}
for z in sorted(feat):
    r = zip_result(z, base)
    if r: r.pop("_rent"); r["reason"] = f"{r['neighborhood']} is not in your current top 5. (Mock data — not from the live engine.)"; details[z] = r
(out / "zips.json").write_text(json.dumps(details, separators=(",", ":")))
for name in presets: print(name, [(r["zip"], r["neighborhood"], r["score"]) for r in json.load(open(out / "presets" / f"{name}.json"))["results"]])
print("pool", len(pool["results"]), "details", len(details))
