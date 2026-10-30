#!/usr/bin/env python3
"""Roll the theme for the next game.

    python3 tools/roll.py                  fresh random seed
    python3 tools/roll.py 12345            replay a seed against every game so far
    python3 tools/roll.py 12345 --day 9    replay it as day 9 rolled it (only games before 9)

The lists are fixed so a seed always gives the same roll and the picking is actually random, not
whatever an LLM finds most natural. Each part avoids what the last two weeks of games in
public/games.json used (see fresh()), so a roll depends on its seed and on the games before it.
Edit the lists freely, but only append to them: inserting or removing entries changes what older
seeds roll. Days 1-8 were rolled before history mattered; their rolls are recorded in games.json.
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
    # Appended so a week of games doesn't share a core action.
    "scratch to reveal", "sort into bins", "trace a rune to cast it", "turn a crank or dial",
    "stack and balance", "pour and fill", "merge two alike into one", "steer something",
    "type words", "stop a moving marker at the right moment",
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
    # Appended.
    "the helper was the hero", "they lose and don't mind", "the small thing was the point",
    "it turns out someone asked for it", "it gets undone, and that's fine", "the roles reverse",
    "they give it all away",
]

INITIALS = "ABCDEFGHIJKLMNOPRSTVW"

# How the game is built and how long it runs. Without these every game came out the same shape:
# one currency, a straight line of upgrades, helpers at minute 2, done at minute 10.
# Modeled on real incrementals: jam-sized games, short complete ones (Spaceplan, Candy Box) and
# story-driven ones (A Dark Room, Universal Paperclips).
LENGTHS = ["mini (10–60 min)", "short (1–3 hours)", "story (3–10 hours, over several sittings)"]
# How many structures each length combines; longer games have room to layer or chain several.
STRUCTURE_COUNTS = {"mini": (1, 2), "short": (2, 3), "story": (2, 4)}

STRUCTURES = [
    "straight line of upgrades", "reset loop (prestige for a permanent bonus)",
    "stacked currencies (A makes B, B makes C)", "tech tree with exclusive choices",
    "limited space to arrange (a grid, shelf or map)", "the core action goes obsolete; you manage automation",
    "a mid-game rule change that reshapes everything", "distinct phases, each its own small economy",
    # Appended: more ways real incrementals are built, so a week of games doesn't share a skeleton.
    "a map you explore and reveal", "a recipe book: combine things to discover new ones",
    "orders with deadlines (fill contracts for rewards)", "workers you assign between jobs",
    "a market whose prices move", "craft: trade many of A for one B", "a collection to complete",
    "a production chain on a small belt grid you lay out",
    "a forced reset on a timer (a season, a lifespan); runs grow longer as you learn",
    "challenges: replay under a handicap for a reward", "a second, parallel game that opens midway",
    "sacrifice part of your progress to multiply the rest",
    "the number goes down: an incremental in reverse", "one long build that eats everything you make",
    "producers that make producers (tier 2 makes tier 1)",
    "automation you program (an action queue with priorities)", "auto-battle waves of enemies",
]

TWISTS = [
    "decay: things break or spoil", "random events", "gambling or loot drops", "combos and streaks",
    "hard tradeoffs", "timed rushes", "a helper with opinions", "a day/night or weather cycle",
    "nothing extra, keep it pure",
    # Appended.
    "upkeep that grows with size", "demand or a picky critic to please", "a rival who copies you",
    "a hidden mechanic to discover", "you pay with something you need (time, light, health)",
    "chain reactions", "a wandering visitor to catch", "a choice you can't take back changes the world",
    "slow things that ripen in real minutes", "the core action gets a new verb",
    "storage caps you must build past", "achievements that grant multipliers",
    "milestones: every 25 owned doubles it", "buildings boost each other (synergies)",
]

ENDINGS = [
    "hit a target", "build one final thing", "choose between two endings", "a story reveal",
    "an ending you have to be talked out of", "the game ends itself", "a final showdown",
    "a send-off parade",
    # Appended.
    "an ending reached by holding back", "hand it all over to someone else",
    "a secret ending behind the obvious one", "one last purchase that costs everything",
    "outpace a rival's ticking meter", "an epilogue that keeps playing itself as the credits roll",
    "the number hits its cap and the world crunches",
]

LOOKS = [
    "pixel art", "paper cutout", "blueprint", "watercolor", "terminal / ASCII", "risograph print",
    "felt and yarn", "soft clay", "stained glass", "1-bit classic Mac", "chalkboard", "vaporwave",
    "woodcut", "neon signs",
    # Appended.
    "embroidery", "comic book", "tarot cards", "isometric diorama", "ballpoint notebook doodle",
    "art deco poster",
]

MUSIC_STYLES = [
    "lo-fi hip hop", "8-bit chiptune", "ambient pads", "music box lullaby", "bossa nova", "synthwave",
    "jazzy walking bass", "marimba minimalism", "sea shanty", "baroque harpsichord", "dub", "kalimba folk",
    # Appended.
    "surf rock", "gamelan", "polka", "steel drum calypso",
]

MUSIC_SCALES = [
    "major pentatonic", "minor pentatonic", "dorian", "lydian", "mixolydian", "blues", "in-sen",
    "harmonic minor",
    # Appended; every name here must be in SCALES in public/shared/kit/audio.mjs.
    "major", "minor", "phrygian", "whole tone", "hirajoshi", "major blues",
]

TONES = [
    "cozy", "deadpan bureaucratic", "nature documentary", "sports commentary", "noir", "mild horror",
    "epic fantasy", "corporate memo", "breathless gossip", "self-help guru", "mission control",
    "cooking show",
    # Appended.
    "pirate radio", "museum audio guide", "fairy tale narrator", "late-night infomercial",
]

# An optional nod to the release date. Mostly "none": a month of Halloween games would be a lot.
CONTEXTS = ["none", "none", "calendar"]

# What kind of date to nod to, so it isn't always the biggest holiday in sight.
CALENDAR_KINDS = [
    "a holiday or festival near the release date", "the season and its weather",
    "an obscure observance day on the release date", "the night sky (moon phase, meteor shower, solstice)",
    "a harmless historical anniversary on the release date", "a household ritual of that time of year",
]


# Color palettes from Lospec, vendored by tools/palettes.mjs (append-only, like these lists).
PALETTES = [p["slug"] for p in json.loads(
    (Path(__file__).resolve().parent.parent / "public" / "shared" / "palettes.json").read_text())]


# How many past games each part tries not to repeat. Pools smaller than that keep the `SPARE`
# least recently used values in play on top of what's needed, so the pick is never forced.
WINDOW = 14
SPARE = 2


def used(game, key, part=None):
    """What a games.json entry used for one part of the roll, as a list."""
    v = game.get(key)
    if part:
        v = v.get(part) if isinstance(v, dict) else None
    if key == "scale" and isinstance(v, str):
        v = v.split()[0]  # entries may annotate the scale: "absurd (atoms of gold...)"
    if v is None:
        return []
    return v if isinstance(v, list) else [v]


def fresh(pool, history, key, part=None, need=1):
    """The pool minus anything the last WINDOW games used, topped back up with the least
    recently used values when that leaves fewer than need + SPARE. Keeps the pool's order so a
    seed picks the same way given the same history."""
    last = {}  # value -> games ago it was last used (1 = the previous game)
    for ago, game in enumerate(reversed(history[-WINDOW:]), 1):
        for v in used(game, key, part):
            last.setdefault(v, ago)
    keep = {v for v in pool if v not in last}
    for v in sorted((v for v in pool if v in last), key=lambda v: -last[v]):
        if len(keep) >= need + SPARE:
            break
        keep.add(v)
    return [v for v in pool if v in keep]


def roll(seed, history=()):
    history = list(history)
    rng = random.Random(seed)
    pick = lambda pool, key, part=None: rng.choice(fresh(pool, history, key, part))
    r = {
        "seed": seed,
        "subject": rng.choice(SUBJECTS),
        "verb": rng.choice(VERBS),
        "object": rng.choice(OBJECTS),
        "interaction": pick(INTERACTIONS, "interaction"),
        "scale": pick(SCALES, "scale"),
        "arc": {
            "drive": pick(DRIVES, "arc", "drive"),
            "obstacle": pick(OBSTACLES, "arc", "obstacle"),
            "turn": pick(TURNS, "arc", "turn"),
            "initial": pick(list(INITIALS), "arc", "initial"),
        },
        "length": pick(LENGTHS, "length"),
    }
    lo, hi = STRUCTURE_COUNTS[r["length"].split()[0]]
    n = rng.randint(lo, hi)
    r.update({
        "structure": rng.sample(fresh(STRUCTURES, history, "structure", need=n), n),
        "twist": pick(TWISTS, "twist"),
        "ending": pick(ENDINGS, "ending"),
        "look": pick(LOOKS, "look"),
        "music": {"style": pick(MUSIC_STYLES, "music", "style"),
                  "scale": pick(MUSIC_SCALES, "music", "scale")},
        "tone": pick(TONES, "tone"),
    })
    r["context"] = rng.choice(CONTEXTS)
    if r["context"] == "calendar":
        r["context"] = {"kind": "calendar", "nod": pick(CALENDAR_KINDS, "context", "nod")}
    # Colors in public/shared/palettes.json under this slug.
    r["palette"] = pick(PALETTES, "palette")
    return r


def main():
    args = sys.argv[1:]
    day = None
    if "--day" in args:
        i = args.index("--day")
        day = int(args[i + 1])
        del args[i:i + 2]
    seed = int(args[0]) if args else secrets.randbits(32)
    games = json.loads((Path(__file__).resolve().parent.parent / "public" / "games.json").read_text())
    if day is not None:
        games = [g for g in games if g["n"] < day]
    r = roll(seed, games)
    print(json.dumps(r, ensure_ascii=False, indent=2))
    # Flag what still repeats the last week (a pool too small to avoid it) so the pitch can lean
    # away from it. The roll itself never changes.
    recent = games[-7:]
    for key, value in r.items():
        if key in ("seed", "subject", "verb", "object", "length", "scale") or value == "none":
            continue
        parts = value.items() if isinstance(value, dict) else [(None, value)]
        for part, v in parts:
            if part in ("initial", "kind"):
                continue
            same = lambda g: bool(set(v if isinstance(v, list) else [v]) & set(used(g, key, part)))
            clash = [g["n"] for g in recent if same(g)]
            if clash:
                name = f"{key} {part}" if part else key
                print(f"note: {name} '{v}' was also used by game(s) {clash}", file=sys.stderr)

if __name__ == "__main__":
    main()
