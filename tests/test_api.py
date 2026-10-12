"""Automated checks for the SenSen API, run against your real pipeline output.

They test rules that must always hold (sorting, error codes, no BAYAM for
"ayam"), not exact prices, so they keep passing after each monthly refresh.

Run from the repo root (after pipeline/run.py):
    python -m pytest
"""

import pytest
from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


@pytest.fixture(scope="module")
def district():
    """The district with the most shops: the best-covered place to test."""
    areas = client.get("/areas").json()
    assert areas, "no districts at all: did pipeline/run.py run?"
    return max(areas, key=lambda a: a["shops"])["district"]


# ---------- basics ----------

def test_health():
    assert client.get("/health").json() == {"status": "ok"}


def test_meta_has_both_regions():
    meta = client.get("/meta").json()
    assert meta["regions"] == ["Kuala Lumpur", "Selangor"]
    assert meta["weeks"] >= 8


def test_unknown_district_is_404():
    r = client.get("/items/search", params={"q": "ayam", "district": "Mars"})
    assert r.status_code == 404


# ---------- search ----------

def test_search_ayam_finds_chicken_first_and_no_bayam(district):
    results = client.get("/items/search", params={"q": "ayam", "district": district}).json()
    assert results, "ayam should match something"
    assert results[0]["name"].startswith("AYAM")
    assert not any(r["name"].startswith("BAYAM") for r in results)


def test_search_english_word_matches_malay_name(district):
    results = client.get("/items/search", params={"q": "chicken", "district": district}).json()
    assert any("AYAM" in r["name"] for r in results)


def test_search_too_short_is_422(district):
    r = client.get("/items/search", params={"q": "a", "district": district})
    assert r.status_code == 422


# ---------- item detail ----------

def test_item_detail_shops_sorted_cheapest_first(district):
    d = client.get("/items/1", params={"district": district}).json()
    prices = [s["price"] for s in d["cheapest_shops"]]
    assert len(prices) <= 5
    assert prices == sorted(prices)
    if prices:
        assert d["cheapest_shops"][0]["more_than_cheapest"] == 0


def test_item_detail_label_range_is_ordered(district):
    label = client.get("/items/1", params={"district": district}).json()["label"]
    if label:
        assert label["usual_low"] <= label["usual_high"]


def test_unknown_item_is_404(district):
    assert client.get("/items/999999", params={"district": district}).status_code == 404


# ---------- stores ----------

def test_stores_sorted_and_have_enough_items(district):
    rows = client.get("/stores", params={"district": district}).json()
    pcts = [r["vs_district_pct"] for r in rows]
    assert pcts == sorted(pcts)
    assert all(r["items_compared"] >= 10 for r in rows)


# ---------- basket ----------

def test_basket_complete_shops_first_then_cheapest(district):
    r = client.post("/basket", json={"district": district, "item_codes": [1, 1, 2]}).json()
    assert r["items_requested"] == 2  # duplicate 1 removed
    shops = r["shops"]
    missing_counts = [len(s["missing"]) for s in shops]
    assert missing_counts == sorted(missing_counts)
    complete_totals = [s["total"] for s in shops if s["complete"]]
    assert complete_totals == sorted(complete_totals)
    # Buying each item at its cheapest can never cost more than any complete shop.
    if complete_totals:
        assert r["cheapest_mix_total"] <= complete_totals[0]


def test_basket_rejects_bad_input(district):
    assert client.post("/basket", json={"district": district, "item_codes": []}).status_code == 422
    assert client.post("/basket", json={"district": district,
                                        "item_codes": list(range(1, 32))}).status_code == 422
    assert client.post("/basket", json={"district": district,
                                        "item_codes": [999999]}).status_code == 404


# ---------- areas ----------

def test_areas_have_town_hints():
    areas = client.get("/areas").json()
    assert all(isinstance(a["towns"], list) for a in areas)
    # A district never lists itself as its own town hint.
    assert all(a["district"].lower() not in [t.lower() for t in a["towns"]] for a in areas)


# ---------- movers and deals ----------

def test_movers_split_into_rises_and_falls(district):
    m = client.get("/movers", params={"district": district}).json()
    assert all(x["change_pct"] > 0 for x in m["risers"])
    assert all(x["change_pct"] < 0 for x in m["fallers"])
    rises = [x["change_pct"] for x in m["risers"]]
    assert rises == sorted(rises, reverse=True)


def test_deals_are_below_usual_and_best_first(district):
    rows = client.get("/deals", params={"district": district}).json()
    pcts = [d["below_usual_pct"] for d in rows]
    assert pcts == sorted(pcts, reverse=True)
    assert all(d["usual_low"] <= d["usual_high"] for d in rows)