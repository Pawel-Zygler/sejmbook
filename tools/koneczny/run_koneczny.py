#!/usr/bin/env python3
"""Masowa analiza ustaw algorytmem Konecznego (tryb Mantis) przez lokalny backend.

Wymaga uruchomionego backendu algorytm_konecznego (make start -> http://127.0.0.1:8005)
z kluczem GEMINI_API_KEY w backend/.env albo w zmiennej srodowiskowej.

Uzycie:
  python3 run_koneczny.py ustawy.json wyniki/ [--workers 10] [--limit N] [--url http://127.0.0.1:8005]

- Kazda ustawa -> wyniki/<proces>.json (gotowe sa pomijane, wiec skrypt mozna wznawiac).
- Werdykt: primary_civilization == "Łacińska" -> zgodna, inna cywilizacja -> niezgodna,
  "Nieokreślona (Brak danych)" -> nierozstrzygnieta.
- Po 429 (limit) czeka i probuje ponownie; po --max-429 kolejnych 429 konczy prace,
  zapisujac to, co zdazyl (limit dzienny darmowego tieru).
"""
import argparse, json, os, sys, time, threading
import concurrent.futures as cf
import urllib.request, urllib.error

stop = threading.Event()
lock = threading.Lock()
consecutive_429 = 0


def verdict(civ):
    if not civ:
        return "brak"
    if civ.strip().lower().startswith("łacińska"):
        return "zgodna"
    if civ.lower().startswith("nieokreślona"):
        return "nierozstrzygnieta"
    return "niezgodna"


def call(url, law, timeout):
    body = json.dumps({"text": law["text"], "title": "ustawa " + law["title"], "mode": "jmantis"}).encode()
    req = urllib.request.Request(url + "/api/analyze", data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)


def work(law, args):
    global consecutive_429
    path = os.path.join(args.out, f"{law['process']}.json")
    if os.path.exists(path):
        return "skip"
    delay = int(os.environ.get("K_DELAY","30"))
    for attempt in range(args.retries):
        if stop.is_set():
            return "stopped"
        t0 = time.time()
        try:
            res = call(args.url, law, args.timeout)
        except urllib.error.HTTPError as e:
            detail = e.read().decode(errors="replace")[:300]
            if e.code == 429:
                with lock:
                    consecutive_429 += 1
                    n = consecutive_429
                print(f"[429] {law['process']} (seria {n}) -> czekam {delay}s", flush=True)
                if n >= args.max_429:
                    print("!!! Limit klucza wyczerpany (seria 429). Zatrzymuje. Wznow pozniej tym samym poleceniem.", flush=True)
                    stop.set()
                    return "quota"
                time.sleep(delay); delay = min(delay * 2, 300)
                continue
            print(f"[HTTP {e.code}] {law['process']}: {detail}", flush=True)
            time.sleep(10)
            continue
        except Exception as e:
            print(f"[blad] {law['process']}: {e}", flush=True)
            time.sleep(10)
            continue
        with lock:
            consecutive_429 = 0
        civ = res.get("primary_civilization")
        rec = {
            "process": law["process"], "title": law["title"], "proposed": law["proposed"], "pillar": law["pillar"],
            "verdict": verdict(civ), "primary_civilization": civ,
            "legal_dualism_score": res.get("legal_dualism_score"), "sacrality_score": res.get("sacrality_score"),
            "personalism_score": res.get("personalism_score"), "church_independence_score": res.get("church_independence_score"),
            "civilization_diagnosis": res.get("civilization_diagnosis"), "mantis_gates": res.get("mantis_gates"),
            "seconds": round(time.time() - t0, 1), "at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        }
        tmp = path + ".tmp"
        json.dump(rec, open(tmp, "w"), ensure_ascii=False, indent=1)
        os.replace(tmp, path)
        print(f"[ok] {law['process']}: {rec['verdict']} ({civ}, dualizm {rec['legal_dualism_score']}) {rec['seconds']}s", flush=True)
        return "ok"
    return "failed"


def main():
    p = argparse.ArgumentParser()
    p.add_argument("laws"); p.add_argument("out")
    p.add_argument("--url", default="http://127.0.0.1:8005")
    p.add_argument("--workers", type=int, default=10)
    p.add_argument("--limit", type=int, default=0)
    p.add_argument("--retries", type=int, default=6)
    p.add_argument("--max-429", type=int, default=12)
    p.add_argument("--timeout", type=int, default=600)
    args = p.parse_args()
    os.makedirs(args.out, exist_ok=True)
    laws = json.load(open(args.laws))
    if args.limit:
        laws = laws[: args.limit]
    stats = {}
    with cf.ThreadPoolExecutor(max_workers=args.workers) as ex:
        for s in ex.map(lambda l: work(l, args), laws):
            stats[s] = stats.get(s, 0) + 1
    done = len([f for f in os.listdir(args.out) if f.endswith(".json")])
    print(f"\nPodsumowanie: {stats}; gotowych plikow: {done}/{len(json.load(open(args.laws)))}", flush=True)
    sys.exit(2 if stop.is_set() else 0)


if __name__ == "__main__":
    main()
