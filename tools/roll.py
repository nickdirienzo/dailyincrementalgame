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

# The arc is what the progression is about. It's composed from small independent parts rather than
# picked from one list of premises: an LLM asked for "a story" falls into the same few (every game
# ending up about loneliness), but drive x obstacle x turn x initial gives thousands of combinations
# and the pitch has to invent a story that fits all of them.
DRIVES = [
    "money", "escape", "fame", "revenge", "curiosity", "duty", "comfort", "mischief",
    "rivalry", "a deadline", "a promise", "a dare", "hunger", "pride", "a bet", "legacy",
]

OBSTACLES = [
    "a rival", "a strict rule", "the weather", "paperwork", "physics", "a landlord",
    "their own clumsiness", "a ticking clock", "an inspector", "a critic", "gravity", "a bad map",
    "the neighbors", "a broken machine", "a tiny budget", "a misunderstanding",
]

TURNS = [
    "it works far too well", "it was the wrong goal all along", "they win and leave town",
    "everyone else joins in", "it all collapses beautifully", "a quiet, smaller win",
    "the obstacle switches sides", "a huge pointless spectacle",
]

INITIALS = "ABCDEFGHIJKLMNOPRSTVW"

# How the game is built and how long it runs. Without these every game came out the same shape:
# one currency, a straight line of upgrades, helpers at minute 2, done at minute 10.
LENGTHS = ["short (5–8 min)", "standard (10–15 min)", "long (20–30 min)", "extended (45–60 min)"]
# How many structures each length combines; longer games have room to layer or chain several.
STRUCTURE_COUNTS = {"short": (1, 1), "standard": (1, 2), "long": (2, 3), "extended": (2, 4)}

STRUCTURES = [
    "straight line of upgrades", "reset loop (prestige for a permanent bonus)",
    "stacked currencies (A makes B, B makes C)", "tech tree with exclusive choices",
    "limited space to arrange (a grid, shelf or map)", "the core action goes obsolete; you manage automation",
    "a mid-game rule change that reshapes everything", "distinct phases, each its own small economy",
]

TWISTS = [
    "decay: things break or spoil", "random events", "gambling or loot drops", "combos and streaks",
    "hard tradeoffs", "timed rushes", "a helper with opinions", "a day/night or weather cycle",
    "nothing extra, keep it pure",
]

ENDINGS = [
    "hit a target", "build one final thing", "choose between two endings", "a story reveal",
    "an ending you have to be talked out of", "the game ends itself", "a final showdown",
    "a send-off parade",
]

LOOKS = [
    "pixel art", "paper cutout", "blueprint", "watercolor", "terminal / ASCII", "risograph print",
    "felt and yarn", "soft clay", "stained glass", "1-bit classic Mac", "chalkboard", "vaporwave",
    "woodcut", "neon signs",
]

MUSIC_STYLES = [
    "lo-fi hip hop", "8-bit chiptune", "ambient pads", "music box lullaby", "bossa nova", "synthwave",
    "jazzy walking bass", "marimba minimalism", "sea shanty", "baroque harpsichord", "dub", "kalimba folk",
]

MUSIC_SCALES = [
    "major pentatonic", "minor pentatonic", "dorian", "lydian", "mixolydian", "blues", "in-sen",
    "harmonic minor",
]

TONES = [
    "cozy", "deadpan bureaucratic", "nature documentary", "sports commentary", "noir", "mild horror",
    "epic fantasy", "corporate memo", "breathless gossip", "self-help guru", "mission control",
    "cooking show",
]

# An optional nod to the release date. Mostly "none": a month of Halloween games would be a lot.
CONTEXTS = ["none", "none", "calendar"]

# What kind of date to nod to, so it isn't always the biggest holiday in sight.
CALENDAR_KINDS = [
    "a holiday or festival near the release date", "the season and its weather",
    "an obscure observance day on the release date", "the night sky (moon phase, meteor shower, solstice)",
    "a harmless historical anniversary on the release date", "a household ritual of that time of year",
]


def roll(seed):
    rng = random.Random(seed)
    r = {
        "seed": seed,
        "subject": rng.choice(SUBJECTS),
        "verb": rng.choice(VERBS),
        "object": rng.choice(OBJECTS),
        "interaction": rng.choice(INTERACTIONS),
        "scale": rng.choice(SCALES),
        # Drawn last so seeds rolled before arcs existed keep their other fields.
        "arc": {
            "drive": rng.choice(DRIVES),
            "obstacle": rng.choice(OBSTACLES),
            "turn": rng.choice(TURNS),
            "initial": rng.choice(INITIALS),
        },
        # Also drawn after everything older, for the same reason.
        "length": rng.choice(LENGTHS),
    }
    lo, hi = STRUCTURE_COUNTS[r["length"].split()[0]]
    r.update({
        "structure": rng.sample(STRUCTURES, rng.randint(lo, hi)),
        "twist": rng.choice(TWISTS),
        "ending": rng.choice(ENDINGS),
        "look": rng.choice(LOOKS),
        "music": {"style": rng.choice(MUSIC_STYLES), "scale": rng.choice(MUSIC_SCALES)},
        "tone": rng.choice(TONES),
    })
    r["context"] = rng.choice(CONTEXTS)
    if r["context"] == "calendar":
        r["context"] = {"kind": "calendar", "nod": rng.choice(CALENDAR_KINDS)}
    return r


def main():
    seed = int(sys.argv[1]) if len(sys.argv) > 1 else secrets.randbits(32)
    r = roll(seed)
    print(json.dumps(r, ensure_ascii=False, indent=2))
    # Flag repeats of recent games so the pitch can lean away from them. The roll itself never changes.
    games = json.loads((Path(__file__).resolve().parent.parent / "public" / "games.json").read_text())
    recent = games[-3:]
    for key, value in r.items():
        if key in ("seed", "subject", "verb", "object") or value == "none":
            continue
        parts = value.items() if isinstance(value, dict) else [(None, value)]
        for part, v in parts:
            if key == "arc" and part == "initial":
                continue
            def same(g):
                old = g.get(key, {}).get(part) if part else g.get(key)
                if isinstance(v, list):
                    return bool(set(v) & set(old if isinstance(old, list) else [old]))
                return old == v
            clash = [g["n"] for g in recent if same(g)]
            if clash:
                name = f"{key} {part}" if part else key
                print(f"note: {name} '{v}' was also used by game(s) {clash}", file=sys.stderr)

if __name__ == "__main__":
    main()
