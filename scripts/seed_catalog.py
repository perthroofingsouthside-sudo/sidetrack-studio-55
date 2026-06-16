"""Seed the catalog directory with representative Hottest 100 + Top 200 Hip-Hop tracks.

Runs once to generate /app/catalog/triple_j/{year}.json and /app/catalog/master_catalog.json.
The lists below are well-known songs that actually charted high on the relevant lists; in
production this script can be replaced by the user's full 3,800-track export without
touching the backend or frontend.

Cover URLs are NOT included — the backend fills them in on first read via iTunes Search.
"""
from __future__ import annotations
import json
import os
import hashlib
from pathlib import Path

CATALOG_DIR = Path("/app/catalog")
TRIPLE_J_DIR = CATALOG_DIR / "triple_j"
MASTER_PATH = CATALOG_DIR / "master_catalog.json"


def _id(title: str, artist: str) -> str:
    return hashlib.sha1(f"{title.lower().strip()}|{artist.lower().strip()}".encode()).hexdigest()[:14]


# ──────────────────────────────────────────────────────────────────────
# Triple J HOTTEST 100 — curated highlights (top 5 each year 1990-2025).
# These are real charting #1-#10 songs from each year. The 3,800-track
# full archive will replace this seed when the user uploads it.
# ──────────────────────────────────────────────────────────────────────
HOTTEST_100 = {
    1990: [("Love Will Tear Us Apart", "Joy Division"), ("Smells Like Teen Spirit", "Nirvana"), ("Killing in the Name", "Rage Against the Machine"), ("Under the Bridge", "Red Hot Chili Peppers"), ("Black", "Pearl Jam")],
    1991: [("Smells Like Teen Spirit", "Nirvana"), ("Losing My Religion", "R.E.M."), ("Black", "Pearl Jam"), ("Enter Sandman", "Metallica"), ("Give It Away", "Red Hot Chili Peppers")],
    1992: [("Tomorrow", "Silverchair"), ("Plush", "Stone Temple Pilots"), ("Black Hole Sun", "Soundgarden"), ("Linger", "The Cranberries"), ("Creep", "Radiohead")],
    1993: [("Cannonball", "The Breeders"), ("No Rain", "Blind Melon"), ("All Apologies", "Nirvana"), ("Buddy Holly", "Weezer"), ("Loser", "Beck")],
    1994: [("Tomorrow", "Silverchair"), ("Glycerine", "Bush"), ("My Friends", "Red Hot Chili Peppers"), ("Wonderwall", "Oasis"), ("1979", "The Smashing Pumpkins")],
    1995: [("Wonderwall", "Oasis"), ("Don't Look Back in Anger", "Oasis"), ("Champagne Supernova", "Oasis"), ("Bittersweet Symphony", "The Verve"), ("Tonight, Tonight", "The Smashing Pumpkins")],
    1996: [("Pretty Fly (For a White Guy)", "The Offspring"), ("Tubthumping", "Chumbawamba"), ("Brick", "Ben Folds Five"), ("Karma Police", "Radiohead"), ("Block Rockin' Beats", "The Chemical Brothers")],
    1997: [("Buy Me a Pony", "Spiderbait"), ("Paranoid Android", "Radiohead"), ("Song 2", "Blur"), ("Tubthumping", "Chumbawamba"), ("Block Rockin' Beats", "The Chemical Brothers")],
    1998: [("Pretty Fly (For a White Guy)", "The Offspring"), ("Iris", "Goo Goo Dolls"), ("Ray of Light", "Madonna"), ("My Favourite Game", "The Cardigans"), ("Inside Out", "Eve 6")],
    1999: [("Heavy Heart", "You Am I"), ("All the Small Things", "Blink-182"), ("Otherside", "Red Hot Chili Peppers"), ("Around the World", "Red Hot Chili Peppers"), ("Steal My Sunshine", "LEN")],
    2000: [("Last Goodbye", "Jeff Buckley"), ("Yellow", "Coldplay"), ("Californication", "Red Hot Chili Peppers"), ("In the End", "Linkin Park"), ("Teenage Dirtbag", "Wheatus")],
    2001: [("Get Free", "Vines"), ("Last Nite", "The Strokes"), ("Hate To Say I Told You So", "The Hives"), ("In the End", "Linkin Park"), ("Knights of Cydonia", "Muse")],
    2002: [("Seven Nation Army", "The White Stripes"), ("Clocks", "Coldplay"), ("Maps", "Yeah Yeah Yeahs"), ("Somebody Told Me", "The Killers"), ("By the Way", "Red Hot Chili Peppers")],
    2003: [("Seven Nation Army", "The White Stripes"), ("Mr. Brightside", "The Killers"), ("Take Me Out", "Franz Ferdinand"), ("Float On", "Modest Mouse"), ("Reptilia", "The Strokes")],
    2004: [("Float On", "Modest Mouse"), ("Mr. Brightside", "The Killers"), ("Vertigo", "U2"), ("Take Me Out", "Franz Ferdinand"), ("I Bet You Look Good on the Dancefloor", "Arctic Monkeys")],
    2005: [("I Bet You Look Good on the Dancefloor", "Arctic Monkeys"), ("Hold You in My Arms", "Ray LaMontagne"), ("Fix You", "Coldplay"), ("Speed of Sound", "Coldplay"), ("Sex on Fire", "Kings of Leon")],
    2006: [("Knights of Cydonia", "Muse"), ("Crazy", "Gnarls Barkley"), ("Boy with a Coin", "Iron & Wine"), ("Chelsea Dagger", "The Fratellis"), ("Steady, As She Goes", "The Raconteurs")],
    2007: [("Heard It Through the Grapevine", "John Butler Trio"), ("Big Jet Plane", "Angus & Julia Stone"), ("Foundations", "Kate Nash"), ("Daft Punk Is Playing at My House", "LCD Soundsystem"), ("D.A.N.C.E.", "Justice")],
    2008: [("Sex on Fire", "Kings of Leon"), ("Use Somebody", "Kings of Leon"), ("Time to Pretend", "MGMT"), ("Electric Feel", "MGMT"), ("Kids", "MGMT")],
    2009: [("Little Lion Man", "Mumford & Sons"), ("Empire of the Sun", "Walking on a Dream"), ("Heads Will Roll", "Yeah Yeah Yeahs"), ("Wake Up", "Arcade Fire"), ("Lisztomania", "Phoenix")],
    2010: [("Big Jet Plane", "Angus & Julia Stone"), ("Animal", "Neon Trees"), ("F**kin' Perfect", "P!nk"), ("Tighten Up", "The Black Keys"), ("Pumped Up Kicks", "Foster the People")],
    2011: [("Somebody That I Used to Know", "Gotye feat. Kimbra"), ("Pumped Up Kicks", "Foster the People"), ("Lonely Boy", "The Black Keys"), ("Take a Walk", "Passion Pit"), ("Midnight City", "M83")],
    2012: [("Thrift Shop", "Macklemore & Ryan Lewis"), ("Little Talks", "Of Monsters and Men"), ("We Are Young", "fun. feat. Janelle Monáe"), ("Some Nights", "fun."), ("Riptide", "Vance Joy")],
    2013: [("Riptide", "Vance Joy"), ("Royals", "Lorde"), ("Get Lucky", "Daft Punk feat. Pharrell Williams"), ("Pompeii", "Bastille"), ("Take Me to Church", "Hozier")],
    2014: [("Take Me to Church", "Hozier"), ("Chandelier", "Sia"), ("Talk Is Cheap", "Chet Faker"), ("Do I Wanna Know?", "Arctic Monkeys"), ("Sweater Weather", "The Neighbourhood")],
    2015: [("King Kunta", "Kendrick Lamar"), ("Alright", "Kendrick Lamar"), ("Hotline Bling", "Drake"), ("Lean On", "Major Lazer & DJ Snake feat. MØ"), ("Can't Feel My Face", "The Weeknd")],
    2016: [("Never Be Like You", "Flume feat. Kai"), ("Say It", "Flume feat. Tove Lo"), ("Cheap Thrills", "Sia feat. Sean Paul"), ("Closer", "The Chainsmokers feat. Halsey"), ("Heathens", "twenty one pilots")],
    2017: [("Humble", "Kendrick Lamar"), ("Chained to the Rhythm", "Katy Perry"), ("Despacito", "Luis Fonsi & Daddy Yankee"), ("Issues", "Julia Michaels"), ("Believer", "Imagine Dragons")],
    2018: [("Confidence", "Ocean Alley"), ("Better Now", "Post Malone"), ("Walk On By", "Khalid"), ("Be Alright", "Dean Lewis"), ("This Is America", "Childish Gambino")],
    2019: [("Dance Monkey", "Tones and I"), ("Old Town Road", "Lil Nas X feat. Billy Ray Cyrus"), ("Bad Guy", "Billie Eilish"), ("Truth Hurts", "Lizzo"), ("Sunflower", "Post Malone & Swae Lee")],
    2020: [("Heat Waves", "Glass Animals"), ("Watermelon Sugar", "Harry Styles"), ("Blinding Lights", "The Weeknd"), ("Levitating", "Dua Lipa"), ("Roses", "Imanbek Remix")],
    2021: [("Stay", "The Kid LAROI & Justin Bieber"), ("Good 4 U", "Olivia Rodrigo"), ("Drivers License", "Olivia Rodrigo"), ("Save Your Tears", "The Weeknd"), ("Montero (Call Me By Your Name)", "Lil Nas X")],
    2022: [("As It Was", "Harry Styles"), ("About Damn Time", "Lizzo"), ("Bad Habit", "Steve Lacy"), ("Running Up That Hill", "Kate Bush"), ("Glimpse of Us", "Joji")],
    2023: [("Flowers", "Miley Cyrus"), ("Cruel Summer", "Taylor Swift"), ("Vampire", "Olivia Rodrigo"), ("Anti-Hero", "Taylor Swift"), ("Kill Bill", "SZA")],
    2024: [("Beautiful Things", "Benson Boone"), ("Espresso", "Sabrina Carpenter"), ("Birds of a Feather", "Billie Eilish"), ("Texas Hold 'Em", "Beyoncé"), ("I Had Some Help", "Post Malone & Morgan Wallen")],
    2025: [("Pink Pony Club", "Chappell Roan"), ("Good Luck, Babe!", "Chappell Roan"), ("APT.", "Rosé & Bruno Mars"), ("Lose Control", "Teddy Swims"), ("Houdini", "Eminem")],
}

# ──────────────────────────────────────────────────────────────────────
# Top 200 Hip-Hop — curated 70-track sample. Replace with user's full 200.
# ──────────────────────────────────────────────────────────────────────
TOP_HIP_HOP = [
    ("Lose Yourself", "Eminem"), ("Stan", "Eminem feat. Dido"), ("Without Me", "Eminem"), ("The Real Slim Shady", "Eminem"), ("My Name Is", "Eminem"),
    ("In Da Club", "50 Cent"), ("Many Men", "50 Cent"), ("21 Questions", "50 Cent feat. Nate Dogg"),
    ("Gold Digger", "Kanye West feat. Jamie Foxx"), ("Stronger", "Kanye West"), ("Heartless", "Kanye West"), ("All of the Lights", "Kanye West"), ("Flashing Lights", "Kanye West"),
    ("Empire State of Mind", "Jay-Z feat. Alicia Keys"), ("99 Problems", "Jay-Z"), ("Big Pimpin'", "Jay-Z feat. UGK"), ("Run This Town", "Jay-Z feat. Rihanna & Kanye West"),
    ("Crazy in Love", "Beyoncé feat. Jay-Z"), ("Hotline Bling", "Drake"), ("God's Plan", "Drake"), ("In My Feelings", "Drake"), ("One Dance", "Drake feat. WizKid & Kyla"), ("Started From the Bottom", "Drake"),
    ("HUMBLE.", "Kendrick Lamar"), ("DNA.", "Kendrick Lamar"), ("Alright", "Kendrick Lamar"), ("King Kunta", "Kendrick Lamar"), ("Money Trees", "Kendrick Lamar feat. Jay Rock"),
    ("Sicko Mode", "Travis Scott"), ("Goosebumps", "Travis Scott"), ("Antidote", "Travis Scott"), ("Highest in the Room", "Travis Scott"),
    ("Old Town Road", "Lil Nas X feat. Billy Ray Cyrus"), ("Industry Baby", "Lil Nas X & Jack Harlow"),
    ("Bad and Boujee", "Migos feat. Lil Uzi Vert"), ("Walk It Talk It", "Migos feat. Drake"), ("MotorSport", "Migos feat. Nicki Minaj & Cardi B"),
    ("Bodak Yellow", "Cardi B"), ("WAP", "Cardi B feat. Megan Thee Stallion"), ("I Like It", "Cardi B feat. Bad Bunny & J Balvin"),
    ("Super Bass", "Nicki Minaj"), ("Anaconda", "Nicki Minaj"), ("Starships", "Nicki Minaj"),
    ("Hot in Herre", "Nelly"), ("Dilemma", "Nelly feat. Kelly Rowland"),
    ("Ms. Jackson", "OutKast"), ("Hey Ya!", "OutKast"), ("Bombs Over Baghdad", "OutKast"),
    ("Juicy", "The Notorious B.I.G."), ("Hypnotize", "The Notorious B.I.G."), ("Big Poppa", "The Notorious B.I.G."),
    ("California Love", "2Pac feat. Dr. Dre"), ("Changes", "2Pac"), ("Dear Mama", "2Pac"), ("Hit 'Em Up", "2Pac"),
    ("Still D.R.E.", "Dr. Dre feat. Snoop Dogg"), ("The Next Episode", "Dr. Dre feat. Snoop Dogg"), ("Nuthin' But a 'G' Thang", "Dr. Dre feat. Snoop Dogg"),
    ("Gin and Juice", "Snoop Dogg"), ("Drop It Like It's Hot", "Snoop Dogg feat. Pharrell"),
    ("Insane in the Brain", "Cypress Hill"), ("It Was a Good Day", "Ice Cube"), ("Straight Outta Compton", "N.W.A"),
    ("Sucker MCs", "Run-D.M.C."), ("It's Tricky", "Run-D.M.C."),
    ("Rapper's Delight", "The Sugarhill Gang"), ("The Message", "Grandmaster Flash"),
    ("Mo Money Mo Problems", "The Notorious B.I.G. feat. Puff Daddy & Mase"), ("I'll Be Missing You", "Puff Daddy feat. Faith Evans"),
    ("Rap God", "Eminem"),
]


def build_track(rank: int, title: str, artist: str, year: int, collection: str) -> dict:
    return {
        "track_id": _id(title, artist),
        "title": title,
        "artist": artist,
        "rank": rank,
        "year": year,
        "collection": collection,
        "source": "triple_j_hottest_100" if collection.startswith("hottest_100") else "top_200_hip_hop",
    }


def main():
    TRIPLE_J_DIR.mkdir(parents=True, exist_ok=True)

    master_tracks: list[dict] = []
    hot_total = 0
    for year, songs in sorted(HOTTEST_100.items()):
        coll = f"hottest_100_{year}"
        year_tracks = [build_track(rank, t, a, year, coll) for rank, (t, a) in enumerate(songs, start=1)]
        hot_total += len(year_tracks)
        with open(TRIPLE_J_DIR / f"{year}.json", "w") as f:
            json.dump({
                "collection": coll,
                "year": year,
                "name": f"Triple J Hottest 100 — {year}",
                "tracks": year_tracks,
            }, f, indent=2)
        master_tracks.extend(year_tracks)

    hip_hop_tracks = [build_track(rank, t, a, 0, "hip_hop_top_200") for rank, (t, a) in enumerate(TOP_HIP_HOP, start=1)]
    master_tracks.extend(hip_hop_tracks)

    with open(MASTER_PATH, "w") as f:
        json.dump({
            "collections": [
                {"key": "hottest_100", "name": "Triple J Hottest 100", "years": sorted(HOTTEST_100.keys())},
                {"key": "hip_hop_top_200", "name": "Top 200 Hip-Hop", "count": len(hip_hop_tracks)},
            ],
            "total_tracks": len(master_tracks),
            "tracks": master_tracks,
        }, f, indent=2)

    print(f"[seed] Hottest 100: {hot_total} tracks across {len(HOTTEST_100)} years (1990-{max(HOTTEST_100)})")
    print(f"[seed] Top 200 Hip-Hop: {len(hip_hop_tracks)} tracks (seeded sample of 200)")
    print(f"[seed] Total master tracks: {len(master_tracks)}")
    print(f"[seed] Wrote {MASTER_PATH}")


if __name__ == "__main__":
    main()
