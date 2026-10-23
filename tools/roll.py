#!/usr/bin/env python3
"""Roll the theme for the next game.

    python3 tools/roll.py            fresh random seed
    python3 tools/roll.py 12345      replay a seed

The lists are fixed so a seed always gives the same roll and the picking is actually random, not
whatever an LLM finds most natural. Edit the lists freely, but only append to them: inserting or
removing entries changes what older seeds roll.
"""
import json
import random
import secrets
import sys
from pathlib import Path

SUBJECTS = [
    "a haunted toaster", "a sleepy dragon", "a nervous lighthouse", "a retired pirate parrot",
    "a grumpy cactus", "a lonely moon", "a tiny wizard who is bad at magic", "a cat who runs a bakery",
    "an overworked snail courier", "a sentient teapot", "a shy volcano", "a robot learning to garden",
    "a ghost librarian", "a jellyfish with stage fright", "a forgetful octopus", "a bored lighthouse keeper",
    "a hermit crab real-estate agent", "a mole who wants to see the sun", "a cloud that can't rain",
    "a fox running a night market", "a snowman in July", "a beekeeping bear", "a cursed vending machine",
    "a pigeon with big dreams", "a dust bunny under the couch", "an anxious houseplant", "a deep-sea anglerfish",
    "a frog who collects buttons", "a lazy sun", "a moth obsessed with one lamp", "a goose with a grudge",
    "a mushroom wizard", "a raccoon with a business plan", "a sad radio tower", "a toy soldier on leave",
    "a sock that lost its pair", "an elderly tortoise mail carrier", "a lighthouse made of cheese",
    "a hedgehog chef", "a penguin in the desert", "a kite stuck in a tree", "a snail with a jetpack",
    "a ghost who's scared of people", "a dragon who hoards spoons", "a small storm cloud", "an owl night-shift nurse",
    "a crab DJ", "a garden gnome come to life", "an abandoned space probe", "a yeti who runs a ski lodge",
    "a bookworm (literally)", "a candle afraid of the dark", "a squid painter", "a golem made of laundry",
    "a slime who wants friends", "a weather vane that can't decide", "a beaver architect", "an ant union rep",
    "a vampire on a diet", "a koi pond spirit",
]

VERBS = [
    "hatching", "knitting", "polishing", "brewing", "baking", "growing", "stacking", "collecting",
    "launching", "sorting", "painting", "folding", "melting", "summoning", "trading", "taming",
    "planting", "juggling", "inflating", "weaving", "smelting", "recycling", "composting", "tuning",
    "herding", "distilling", "carving", "mining", "fishing for", "printing", "assembling", "decorating",
    "rescuing", "shrinking", "freezing", "charging", "mailing", "fermenting", "bottling", "pressing",
    "spinning", "sculpting", "untangling", "feeding", "dusting", "lighting", "filling", "repairing",
]

OBJECTS = [
    "teacups", "fireflies", "mushrooms", "pancakes", "stars", "pebbles", "socks", "bubbles",
    "lanterns", "snowflakes", "jellybeans", "paper cranes", "rubber ducks", "pickles", "acorns", "comets",
    "buttons", "marbles", "dumplings", "seashells", "kites", "pumpkins", "postcards", "crystals",
    "donuts", "feathers", "keys", "candles", "clouds", "soap", "noodles", "beetles",
    "spoons", "hats", "bells", "maps", "eggs", "lemons", "gears", "pearls",
    "jam jars", "origami frogs", "lightbulbs", "cheese wheels", "yarn balls", "honey pots", "rainbows", "teeth",
    "umbrellas", "cupcakes", "radishes", "coins", "dreams", "moons", "sprouts", "batteries",
]

INTERACTIONS = [
    "rub", "tap", "hold-to-charge", "drag-and-drop", "swipe/flick", "catch falling things",
    "aim and release", "draw a path", "rhythm taps",
]

SCALES = ["tens", "hundreds", "thousands", "millions", "billions", "absurd"]


def roll(seed):
    rng = random.Random(seed)
    return {
        "seed": seed,
        "subject": rng.choice(SUBJECTS),
        "verb": rng.choice(VERBS),
        "object": rng.choice(OBJECTS),
        "interaction": rng.choice(INTERACTIONS),
        "scale": rng.choice(SCALES),
    }


def main():
    seed = int(sys.argv[1]) if len(sys.argv) > 1 else secrets.randbits(32)
    r = roll(seed)
    print(json.dumps(r, ensure_ascii=False, indent=2))
    # Flag repeats of recent games so the pitch can lean away from them. The roll itself never changes.
    games = json.loads((Path(__file__).resolve().parent.parent / "public" / "games.json").read_text())
    recent = games[-3:]
    for key in ("interaction", "scale"):
        clash = [g["n"] for g in recent if g.get(key) == r[key]]
        if clash:
            print(f"note: {key} '{r[key]}' was also used by game(s) {clash}", file=sys.stderr)


if __name__ == "__main__":
    main()
