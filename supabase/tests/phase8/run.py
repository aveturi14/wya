"""Phase 8 checks: one file per item in docs/PHASE8.md.

    python3 -I supabase/tests/phase8/run.py              # everything
    python3 -I supabase/tests/phase8/run.py --only 8.3   # one item (repeatable)
    python3 -I supabase/tests/phase8/run.py --offline    # no network: built / pending / decisions only
    python3 -I supabase/tests/phase8/run.py --strict     # open decisions fail the run too

Items that aren't built yet report ⏸ PENDING; Edge Functions missing a secret
report 🔒 BLOCKED. Only ❌ fails the run (and ❓ with --strict). Run it on its
own, not alongside rls_check.py or stress_pledges.py: they share accounts.
"""

import argparse
import importlib.util
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent


def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def expected_files(item):
    files = []
    if item.MIGRATION:
        files.append(f"supabase/migrations/*_{item.MIGRATION}.sql")
    if item.FUNCTION:
        files.append(f"supabase/functions/{item.FUNCTION}/index.ts")
    return files


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--only", action="append", help="item id, e.g. 8.3 (repeatable)")
    parser.add_argument("--offline", action="store_true", help="don't contact wya-dev")
    parser.add_argument("--strict", action="store_true", help="open decisions fail the run")
    args = parser.parse_args()

    hz = load(HERE / "_harness.py", "phase8_harness")
    h = hz.Harness(offline=args.offline)
    decisions = hz.load_decisions()
    items = [load(path, path.stem) for path in sorted(HERE.glob("test_8_*.py"))]
    if args.only:
        items = [i for i in items if i.ID in args.only]
        if not items:
            sys.exit(f"No items match {args.only}")

    try:
        for item in items:
            h.feature = item.ID
            print(f"\n{item.ID}  {item.TITLE}")
            files = expected_files(item)
            missing = [f for f in files if not (
                (f.startswith("supabase/migrations") and h.migration_exists(item.MIGRATION))
                or (f.startswith("supabase/functions") and h.function_exists(item.FUNCTION)))]
            if not files:
                pass  # checked by hand only (see MANUAL)
            elif missing:
                h.record(hz.PENDING, "not built yet", "expects " + ", ".join(missing))
            elif not h.live:
                h.record(hz.SKIPPED, "live checks", h.live_reason)
            else:
                try:
                    item.run(h)
                except hz.Blocked as e:
                    h.record(hz.BLOCKED, "needs configuration", f"missing: {e} (docs/PHASE8.md §3)")
                except Exception as e:  # noqa: BLE001 — report and carry on with the next item
                    h.record(hz.FAIL, "check crashed", f"{type(e).__name__}: {e}")
                finally:
                    # Clean up per item, so one item's leftovers (e.g. an open pledge debt, which blocks
                    # RSVPs to that host) can't change the next item's results
                    h.cleanup()
            for code in item.DECISIONS:
                d = decisions.get(code)
                if d is None:
                    h.record(hz.FAIL, f"decision {code} is missing from docs/PHASE8.md §6")
                elif d["status"] == "open":
                    h.record(hz.CLARIFY, f"{code}: {d['question']}", f"default: {d['default']}")
            if item.MANUAL:
                print(f"  📝 by hand: {item.MANUAL}")
    finally:
        if h.live and (h.temp_events or h.cleanups or h._tokens):
            print("\nCleaning up")
            h.cleanup()

    counts = {s: sum(1 for r in h.results if r[1] == s) for s in hz.ICONS}
    print("\n" + "  ".join(f"{hz.ICONS[s].strip()} {s} {n}" for s, n in counts.items()))
    failed = counts[hz.FAIL] + (counts[hz.CLARIFY] if args.strict else 0)
    if failed:
        print("Failed:" if counts[hz.FAIL] else "Open decisions (--strict):")
        for feature, status, name, detail in h.results:
            if status == hz.FAIL or (args.strict and status == hz.CLARIFY):
                print(f"  {feature}  {name}" + (f"  →  {detail}" if detail else ""))
        sys.exit(1)


if __name__ == "__main__":
    main()
