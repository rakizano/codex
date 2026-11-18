#!/usr/bin/env python3
"""MUSIC HUNTER — version gratuite (aucune API payante).

Les données entrent par des relevés CSV (remplis par le skill `music-hunter` via
WebSearch/WebFetch de pages publiques, ou à la main depuis l'appli TikTok).
Le script ne fabrique AUCUNE donnée : il calcule croissance et score à partir des relevés.

Commandes :
  hunter.py ingest <releve.csv>          ajoute un relevé à data/snapshots.csv (dédupliqué)
  hunter.py report [--date AAAA-MM-JJ]   écrit reports/hunter-<date>.md
  hunter.py usage <usage.csv>            résume un échantillon de vidéos (relevé manuel)

Format relevé (colonnes) :
  date,market,source,source_url,title,artist,variant,sound_id,rank,videos_count
  market = FR|US|GB ; variant = original|sped up|slowed|remix|extrait|reupload ; vides autorisés.
"""
import argparse, csv, datetime as dt, json, os, re, sys, unicodedata
from collections import defaultdict

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(ROOT, "data"); SNAP = os.path.join(DATA, "snapshots.csv")
REPORTS = os.path.join(ROOT, "..", "reports")
STORIES = os.path.join(ROOT, "..", "config", "stories.json")
FIELDS = ["date", "market", "source", "source_url", "title", "artist", "variant", "sound_id", "rank", "videos_count"]


def norm(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    s = re.sub(r"\(.*?(sped|slowed|remix|version|feat|ft\.).*?\)", "", s)
    s = re.sub(r"\b(feat|ft)\.?\s.*$", "", s)
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def song_key(r):
    """Regroupe les variantes d'un même morceau (titre+artiste principal normalisés)."""
    artist = norm(re.split(r",|&| x |;", r.get("artist") or "")[0])
    return f"{norm(r['title'])}|{artist}"


def num(x):
    try: return float(str(x).replace(" ", "").replace(",", "")) if str(x).strip() else None
    except ValueError: return None


def load(path):
    if not os.path.exists(path): return []
    with open(path, newline="", encoding="utf-8") as f: return list(csv.DictReader(f))


def cmd_ingest(a):
    rows = load(SNAP); seen = {(r["date"], r["market"], r["source"], r["title"], r["variant"], r["sound_id"]) for r in rows}
    new = 0
    for r in load(a.file):
        r = {k: (r.get(k) or "").strip() for k in FIELDS}
        if not (r["date"] and r["market"] and r["title"]): continue
        k = (r["date"], r["market"], r["source"], r["title"], r["variant"], r["sound_id"])
        if k in seen: continue
        rows.append(r); seen.add(k); new += 1
    os.makedirs(DATA, exist_ok=True)
    with open(SNAP, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, FIELDS); w.writeheader(); w.writerows(rows)
    print(f"[hunter] +{new} lignes ({len(rows)} au total)")


def growth(series, day, window):
    """Croissance relative du nombre de vidéos entre day-window et day (même son, même marché)."""
    now = [v for d, v in series if d == day]
    past = [v for d, v in series if (day - d).days >= window]
    if not now or not past: return None
    p = past[-1]  # relevé le plus récent datant d au moins `window` jours
    return (now[-1] - p) / p if p else None


def score(c, stories):
    """Score /100 explicable. Chaque composante renvoie (points, explication)."""
    parts = {}
    g7 = c["growth"].get(("FR", 7)) or c["growth"].get(("US", 7))
    parts["acceleration"] = (min(25, max(0, (g7 or 0) * 50)), f"croissance 7 j = {g7:.0%}" if g7 is not None else "pas d'historique 7 j")
    fr_rank = c["best_rank"].get("FR")
    parts["france"] = (20 if fr_rank and fr_rank <= 10 else 12 if fr_rank and fr_rank <= 50 else 5 if "FR" in c["markets"] else 0,
                       f"meilleur rang FR = {fr_rank}" if fr_rank else "absent des relevés FR")
    xo = "FR" in c["markets"] and ("US" in c["markets"] or "GB" in c["markets"])
    parts["crossover"] = (10 if xo and (c["first_seen"].get("US", dt.date.max) < c["first_seen"].get("FR", dt.date.max)) else 5 if xo else 0,
                          "vu US/GB avant FR" if xo else "pas de crossover observé")
    eng = c.get("engagement")
    parts["engagement"] = (eng[0], eng[1]) if eng else (0, "aucun échantillon de vidéos")
    st = stories.get(c["key"], {})
    parts["narratif"] = (st.get("narrative", 0), st.get("angle", "potentiel narratif non évalué"))
    parts["sources"] = (st.get("sources", 0), f"{st.get('n_sources', 0)} source(s) indépendante(s) identifiée(s)")
    total = sum(v[0] for v in parts.values())
    pen = []
    if c["n_obs"] < 2: total -= 10; pen.append("données trop faibles (-10)")
    if (c["growth"].get(("FR", 7)) or 0) < 0 and fr_rank and fr_rank <= 10: total -= 10; pen.append("saturé, n'accélère plus (-10)")
    if norm(c["title"]).startswith("original sound") or norm(c["title"]).startswith("son original"): total -= 15; pen.append("son original non identifié (-15)")
    return max(0, round(total)), parts, pen


def cmd_report(a):
    rows = load(SNAP)
    if not rows: sys.exit("[hunter] aucun relevé : lance d'abord `ingest`")
    day = dt.date.fromisoformat(a.date) if a.date else max(dt.date.fromisoformat(r["date"]) for r in rows)
    stories = json.load(open(STORIES)) if os.path.exists(STORIES) else {}
    cands = {}
    for r in rows:
        d = dt.date.fromisoformat(r["date"])
        if d > day: continue
        k = song_key(r)
        c = cands.setdefault(k, {"key": k, "title": r["title"], "artist": r["artist"], "markets": set(), "variants": defaultdict(set),
                                 "series": defaultdict(list), "best_rank": {}, "first_seen": {}, "sources": set(), "n_obs": 0})
        m = r["market"].upper().replace("UK", "GB"); c["markets"].add(m); c["n_obs"] += 1
        c["variants"][r["variant"] or "?"].add(r["sound_id"] or "—")
        c["sources"].add(f"{r['source']} ({r['date']})")
        c["first_seen"][m] = min(c["first_seen"].get(m, d), d)
        rk = num(r["rank"])
        if rk and d == day: c["best_rank"][m] = int(min(rk, c["best_rank"].get(m, 1e9)))
        vc = num(r["videos_count"])
        if vc is not None: c["series"][(m, r["sound_id"] or r["variant"])].append((d, vc))
    for c in cands.values():
        c["growth"] = {}
        for (m, _sid), s in c["series"].items():
            s.sort()
            for w in (1, 7, 30):
                g = growth(s, day, w)
                if g is not None: c["growth"][(m, w)] = max(g, c["growth"].get((m, w), -1e9))
        c["score"], c["parts"], c["pen"] = score(c, stories)

    def top(m):
        xs = [c for c in cands.values() if m in c["markets"]]
        return sorted(xs, key=lambda c: (-(c["growth"].get((m, 7)) or -1), c["best_rank"].get(m, 999)))[:10]

    L = [f"# Music Hunter — {day.isoformat()}", "",
         f"Relevés utilisés : {len(rows)} lignes, {len(cands)} morceaux. Sources : uniquement pages publiques / relevés manuels (voir colonne source).",
         "**Le score n'est pas une prédiction de vues.** Croissance = calculée sur nos propres relevés (nombre de vidéos affiché par TikTok ou rang de classement).", ""]
    for m, label in (("FR", "France"), ("US", "États-Unis")):
        L += [f"## Top {label}", "", "| # | Morceau | Rang | Vidéos (dernier relevé) | Croiss. 1 j | 7 j | 30 j | Score |", "|---|---|---|---|---|---|---|---|"]
        for i, c in enumerate(top(m), 1):
            last = max((s[-1][1] for (mm, _), s in c["series"].items() if mm == m and s), default=None)
            f = lambda w: f"{c['growth'][(m, w)]:+.0%}" if (m, w) in c["growth"] else "—"
            L.append(f"| {i} | {c['title']} — {c['artist']} | {c['best_rank'].get(m, '—')} | {int(last) if last else '—'} | {f(1)} | {f(7)} | {f(30)} | {c['score']} |")
        L.append("")
    xo = [c for c in cands.values() if "FR" in c["markets"] and ({"US", "GB"} & c["markets"])]
    L += ["## Crossovers US/GB → FR observés", ""] + ([f"- {c['title']} — {c['artist']} : vu US/GB le {min(c['first_seen'].get('US', day), c['first_seen'].get('GB', day))}, FR le {c['first_seen']['FR']}" for c in xo] or ["- aucun dans les relevés"]) + [""]
    ranked = sorted(cands.values(), key=lambda c: -c["score"])
    L += ["## Recommandations (3 max)", ""]
    for c in [c for c in ranked if c["score"] >= 40][:3]:
        kind = "tendance émergente" if (c["growth"].get(("FR", 7)) or 0) > 0.1 else "histoire evergreen / décalage d'interprétation"
        L += [f"### {c['title']} — {c['artist']}  ·  {c['score']}/100  ·  *{kind}*", ""]
        L += [f"- {k} : {v[0]:.0f} pts — {v[1]}" for k, v in c["parts"].items()]
        L += [f"- pénalité : {p}" for p in c["pen"]]
        L += [f"- variantes : " + "; ".join(f"{v} ({', '.join(sorted(ids))})" for v, ids in c["variants"].items()), f"- sources : {', '.join(sorted(c['sources']))}", ""]
    L += ["## À surveiller (données ou histoire insuffisantes)", ""] + [f"- {c['title']} — {c['artist']} ({c['score']}/100 ; {', '.join(c['pen']) or 'angle non documenté'})" for c in ranked if c["score"] < 40][:15]
    L += ["", "## Limites", "- Pas d'accès API TikTok : les nombres de vidéos sont ceux affichés publiquement au moment du relevé.",
          "- Usages (fête, nostalgie…) : seulement via `hunter.py usage` sur un échantillon déclaré ; jamais déduits.", ""]
    os.makedirs(REPORTS, exist_ok=True)
    out = os.path.join(REPORTS, f"hunter-{day.isoformat()}.md"); open(out, "w").write("\n".join(L)); print(out)


def cmd_usage(a):
    rows = load(a.file)
    if not rows: sys.exit("[hunter] échantillon vide")
    tags = defaultdict(int); tot = defaultdict(float)
    for r in rows:
        for t in re.split(r"[;/,]", r.get("usage", "")):
            if t.strip(): tags[t.strip().lower()] += 1
        for k in ("vues", "likes", "comm", "partages"):
            v = num(r.get(k)); tot[k] += v or 0
    n = len(rows); dates = sorted(r.get("date_releve", "") for r in rows)
    print(f"Échantillon : {n} vidéos vues manuellement ({dates[0]} → {dates[-1]})")
    for t, k in sorted(tags.items(), key=lambda x: -x[1]): print(f"  {t:<15} {k}/{n} ({k / n:.0%})")
    if tot["vues"]: print(f"  taux d'engagement moyen (likes+comm+partages)/vues = {(tot['likes'] + tot['comm'] + tot['partages']) / tot['vues']:.1%}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); sp = ap.add_subparsers(dest="cmd", required=True)
    p = sp.add_parser("ingest"); p.add_argument("file"); p.set_defaults(fn=cmd_ingest)
    p = sp.add_parser("report"); p.add_argument("--date"); p.set_defaults(fn=cmd_report)
    p = sp.add_parser("usage"); p.add_argument("file"); p.set_defaults(fn=cmd_usage)
    a = ap.parse_args(); a.fn(a)
