# Reference video analysis

Source: `referances/Screen Recording 2026-11-05 173257.mp4` (7:46, 1918x984, 30 fps), a Roblox-style "Steal an Egg" session with a white roadster.
Method: contact sheets every 10 s (46 frames viewed), 3 full-resolution frames, and dominant-colour clustering on 9 frames (values below are measured, not guessed).

## 1. Look and feel

Chunky "Lego plate" voxel look. Every surface (grass, dirt, road, walls) carries a **stud / brick pattern** (small rounded rectangles in a slightly lighter and darker shade of the base colour). Pets, eggs and trees are built from visible cubes. Lighting is bright with a soft bloom, so sunlit grass reads even more saturated.

## 2. Measured colour palette

| Object | Colour (measured) | Notes |
| --- | --- | --- |
| Grass (main) | `#6dc611` (also `#6fc72d`) | very saturated lime, bloom pushes it to `#90f60e` |
| Grass terrace strip on cliffs | `#6fc72d` | thin ledges on top of each dirt step |
| Dirt cliff wall | `#955739` | darker bands `#77360c`, lighter `#a65829`, stud lines `#833c0b` |
| Fence wood | `#725231` | posts darker, rails lighter, 3 rails + square posts |
| Rival plot fence | light blue `#82aab6` | other players' plots use blue fences |
| Sky top | `#13edfa` (up to `#13fffb`) | strong cyan |
| Sky horizon | `#90d4f0` / `#72d8f4` | pale cyan |
| Clouds | `#ecfbf8` / `#b0cbec` | soft white-blue puffs |
| Night sky | `#070f13` / `#062324` | night ground tint `#2f0b03` (dark red-brown cliffs) |
| Road surface | `#b0d3e4` (`#a6cadb`, `#9cc4d6`) | pale blue-grey with studs |
| Road lines / dashes | `#f0f9f9` | white dashes and white edge lines |
| Town stone walls | `#909478` / `#8e9785` / `#b1cbab` | grey-green brick, mossy green patches |
| Mountains (backdrop) | `#526c73` | blue-teal rock with white snow caps `#b0cbec` |
| Barn | red `#c8202a`, white X doors, blue roof `#2f5fa8` | |
| Roadster (player car) | white `#f0f9f9`, navy windows `#1f2f4a`, red tail strip | Lamborghini-style wedge, big rear wing |
| Egg (chicken) | white + red/pink `#e0707e` band at the bottom and a red tuft | voxel |
| Money HUD | bills icon, green `#289a02` square "+" button | |
| Leaderboard frames | cyan `#19d3ff` frame on navy panel, header colours green / red / purple / yellow | |
| Reward chest | yellow `#e6ef1c` with red `#c0202a` bands, yellow ring on the ground | |

## 3. World layout (what is where)

- The playable area is a huge **pit**: flat lime field enclosed by **terraced dirt cliffs** (3 steps, grass on top of each step). Snowy mountains, clouds and a blue sky sit behind the rim.
- **Hub / town** in the middle: grey stone brick buildings, lamp posts (dark post, lantern), a red barn, a long paved **road** (studded pale blue) with white dashes and edge lines, a blue billboard gate.
- Hub stations (each has a floating label): **Roadster Shop** (yellow/white striped awning), **Sell Shop** (red/white awning), **Fuse Machine** (blue machine), a **Mecha Shadow Dragon** display on a purple disc, a **Spooky Egg** limited display, **Free Reward** chest with yellow ring, **Invite Friend** sign (up to +25% boost), **4 leaderboards** (Most Money/s, Most Speed, Most Robux Spent, Most Eggs Stolen).
- **Player plots**: each player has a fenced farm (brown fence; blue for others) with an avatar head billboard "Your farm" and `$/s`. Pets roam inside, showing `name / rarity / $x/s`. An **Upgrade Plot** sign (slots, Gym) and a purple drone sit at the edge.
- A **white chevron trail** on the ground shows the way to the current objective.

## 4. HUD

- Top-left: Roblox/Bloxity controls (left alone). Top-centre: the title **"Steal an Egg!"** (italic heavy font, `Steal` blue, `an` white, `Egg!` yellow, dark outline). It is replaced by the current objective:
  `Place your Egg on your plot!` / `Run back to your base!` / `Open your Egg!` / `Upgrade your Plot to unlock your Gym!` / `Night time! Wait for day... 3s` / `UNLOCK ALL PETS FOR LIMITED CAR 0/7 PETS`.
- Left stack: **cash** (`$50` with green bills icon and green `+`), **gems** (blue crystal, `0`, `+`), **second currency** (red car icon, `0`, `+`), **friend boost** (people icon, `+0%`, `+`).
- Left buttons (after the first plot): **Shop**, **Index** (red `!` badge), **Rebirth**. Right buttons: **Animals**, **Eggs**.
- Top-right: gift, chest, star, settings icons; limited-offer tile (Hacker Roadster ONLY 399 gems / VIP ONLY 299) with red-pink gradient.
- Bottom-centre **hotbar**: slot 1 **Bat**, slot 2 **Bear Trap x3**, a red backpack toggle; slot 3 shows the **carried egg** (e.g. "Chicken Egg") while stealing.
- Bottom-right: weather timer (**STORM 4:23**, cloud-lightning icon) and a round **egg/event timer** (`4m 22s`). At night: `EGGS GROW x10`.
- World-space labels: bold white text with black outline, small rarity line, `$/s` in green.
- Interact prompt: dark rounded box with an `E` key badge: `Ready! / Open`.

## 5. Gameplay loop observed

1. Start on your plot, follow the chevrons.
2. Drive the roadster (third person, chase camera, speed lines and dust) along the road.
3. Steal an egg (hotbar shows the egg), banner changes to **Run back to your base!**, guards/players can hit you (bat), traps can be placed.
4. **Place your Egg on your plot** (egg pod), it grows (timer), then the prompt **Ready! Open [E]** and the banner **Open your Egg! ... Silver Common OPEN NOW!**.
5. A pet hatches (Chicken, Silver, Common, `$5/s`), roams, earns cash (`+$5` floaters). Cash buys plot upgrades, Roadsters, rebirth.
6. Weather (thunderstorm) and day/night cycles run on a server timer. **Night = stealing paused.**

## 6. How this maps onto our game

Our build keeps the user's own description (ramp jump, robot guard, 10 biomes, 80 animals, 12 cars, events, mutations) and adopts the reference's **look, HUD, hub, plot, hotbar, objectives, chevron trail, night cycle and prompts**. See `README.md`.

## 7. Size analysis (second pass, both videos, ~25 full-res frames)

Ruler: the Roblox avatar (5 studs tall). Our avatar is 3.5 units, so 1 stud ~ 0.7 unit.

| Thing | Reference (studs, from avatar ruler) | Ours (units) |
| --- | --- | --- |
| Avatar | 5 tall, ~2.5 wide with arms | 3.5 tall |
| Toy roadster that follows you in the lobby (frames a200, b47, b60) | ~2.5 long (about half the avatar's height) | scale 0.24 of the full car (~1.8 long) |
| Full roadster on the track (frame a260) | ~11 long, ~4.5 wide | ~7.4 long, 2.3 wide |
| Avatar : car length | 1 : 2.2 | 1 : 2.1 |
| Road | ~20 wide, dashed centre line, solid edge lines | 18 wide |

Behaviour seen in the frames: the avatar walks in the lobby with the toy roadster trotting behind-right; at the track the roadster is full size with the avatar in the seat. Chevrons lead from the avatar to the objective.
Less precise (perspective, no object next to the avatar): leaderboards and chest are several avatar-heights tall, the pit walls are three 20-30 stud steps, pens are roughly 40-55 studs across.

## 8. Lobby layout (third pass, ~40 full-res frames from both videos)

- **Shape:** a rectangular lime field (small ~1-unit studs), not a circle.
- **Walls (3 sides):** stepped brown dirt *blocks*, each a separate box of a different height, with a bright green slab on top; 2-3 rows that step back and up. Big subtle brick checker on the dirt.
- **Pens:** 4 fenced plots in a 2x2 grid (brown wooden fence, 3 rails; one blue). Your pen has the "Your farm" billboard: `$x/s`, the title, and your round avatar picture.
- **Track:** ONE paved road that leaves the **middle of the lobby's front edge and runs straight ahead** (pale blue studs, white edge lines, dashed centre line, black lamp posts with lanterns on both sides). A blue "xx Recommended" billboard spans it before each egg zone.
- **Town along the track:** no houses - **grey stone blocks** (stepped, tall pillars, green moss slabs on top) line both sides; the red barn (white X doors, blue roof, silo) stands left of the road, a stone tower with a wooden hut on the right; brighter green grass between.
- **Hub row (along the lobby front edge, facing the pens):** left of the track: Fuse Machine (blue), Sell Shop (red/white awning), Mecha Shadow Dragon (purple disc), Invite Friend (yellow pad); right of it: Spooky Egg (purple disc), Roadster Shop (yellow/white awning), Hacker Roadster (green glow pad), Free Reward chest (yellow + red). The **4 leaderboards** (cyan frames) stand along the right-hand cliff near the front.
- **Next to your pen:** navy "Upgrade Plot" sign and a purple drone with yellow rotor rings.
- **Character:** the Bloxity/Roblox base character: white skin, smiley face, big brown hair, black open jacket over a blue shirt, dark trousers, white shoes. A toy-sized roadster follows behind; on the track it becomes the full car.
