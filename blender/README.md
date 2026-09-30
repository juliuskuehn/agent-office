# Models made in Blender

Most of the office is built in code from boxes and spheres (`src/client/world/`). The things that are
modelled in Blender instead are each made by a Python script in `blender/scripts/`, never by hand: the
script is the source, and the `.glb` it writes to `src/client/models/` is its output. Change a model by
changing its script and running it again.

| File | What it is |
| --- | --- |
| `scripts/aokit.py` | The kit every script uses: shapes, one smooth skin, painted patches, rigs and clips, export, review renders |
| `scripts/build_<name>.py` | One model (or a small set), exported as `src/client/models/<name>.glb` |
| `scripts/build_dog.py`, `scripts/dog_breeds.py` | The office dog in every breed (the presets are in `dog_breeds.py`), each exported as `src/client/models/dog-<breed>.glb` with the same bones, sockets, materials and clips |

| `scripts/build_people.py` | The San Andreas look's people (realistic, made with MPFB), each exported as `src/client/models/person-<name>.glb` with the same Mixamo bones and part materials |

A helper only one model needs lives in that model's script. One that several need can join the kit, as a new
function: the kit's existing functions are what every script already counts on, so change them only with
every script rebuilt and checked.

## Running a script

Headless, from the repo root (Blender 5.2, `--factory-startup` so local settings don't matter):

```bash
blender --background --factory-startup --python blender/scripts/build_dog.py -- --shots
```

`-- --shots` also writes review renders (Workbench, outlined) to your temp folder's `ao-shots/` and prints
where. Several scripts can run headless at once; each is its own Blender.

Through the Blender MCP bridge instead, a script can be run and looked at live in the open Blender. There is
one Blender and one scene, and every build script clears it first, so only one session at a time should
drive it.

## What every model keeps to

These are what the office's code counts on. A model that breaks one looks wrong or doesn't show.

1. **Space.** Metres. Blender is Z up; the model faces **-Y**, which the exporter turns into **+Z**, the
   office's forward; its left is +X. Replacing something the office already builds in code, keep that
   builder's origin and footprint, so the code that places it, and its collider and interactable, stay
   as they are.
2. **Materials are names.** The office paints every material with its own toon material by the name it
   has in the `.glb` (`paintModel()` and `palette()` in `world/models.ts`), so the colours in a script are
   only for review renders. Use the colours the code already uses for that part, and give each colour its
   own name (`Body`, `Trim`, `Chrome`, ...). A name the code has no colour for comes out magenta.
3. **Moving parts are their own objects,** named in `snake_case`, with their origin at the pivot the code
   turns them about (`aokit.set_origin`). Everything that doesn't move joins into one object, so a prop is
   a draw call per material, not per part.
4. **Something that glows or changes colour** (a lamp, an LED strip, a display) gets a material name of
   its own, so the code can give just that part a material it animates.
5. **A surface the code paints a canvas on** (a screen, a sign) is its own object, UV mapped 0 to 1 across
   it, and the model is exported with `uvs=True`.
6. **Rigged and animated** models (the dog) use `aokit.armature`, bones named with underscores (three
   drops dots from names), clips from `aokit.key_clips`, and empties from `aokit.socket` where the code
   hangs things on them. Bones the code moves itself are left at rest in every clip.
7. **Budget.** A prop is a few thousand triangles at most, a creature about 12 thousand; keep materials
   to what the prop needs (each is a draw call).
8. **Smooth, not faceted.** Shapes that should read as one soft form melt together with `aokit.fuse`
   (a voxel remesh, smoothing, then even quads), and coloured patches on them are cut in with
   `aokit.paint` along smooth edges. Hard-edged things (cabinets, counters, cars' panels) stay as
   bevelled boxes and outlines, shaded flat or smooth as suits them.

## Checking it

- **Review renders** from the script (`-- --shots`), for shape and proportion.
- **The lab pages**, which draw a model with the office's own code, lights and outline:
  `src/client/lab/props.html?show=<name>` for props (add yours to `SHOW` in `props.ts`) and
  `src/client/lab/dog.html` for the dogs. A model the world is built with (read with `model(name)`) is marked
  `preload` in `world/models.ts`; one only some pages need loads with `loadModel(name)` instead. They run on the Vite dev server (`npx vite`), and
  `node src/client/lab/shot.mjs <url> <out.png>` screenshots one headless and prints what the page found.
- **A test** per model, `tests/<name>-model.test.ts`, reads the `.glb` with `tests/glb.ts` and checks what
  the code counts on: the node and material names it looks for, and its size and facing.

## Git

Commit the script and the `.glb` together. Two runs of a script make the same model but not the same
bytes (the exporter's triangle order varies), so commit a `.glb` only when the model changed.

## The people (MPFB)

`build_people.py` makes its people with [MPFB](https://extensions.blender.org/add-ons/mpfb/), MakeHuman for
Blender, which needs installing once, with the asset packs the people are dressed from (from
[makehumancommunity.org](https://static.makehumancommunity.org/assets/assetpacks.html); the `files.` mirror is
the quick one):

```bash
blender --factory-startup -b --command extension install-file -r user_default --enable add-on-mpfb-v2.0.17.zip
```

Then unzip `makehuman_system_assets_cc0.zip`, `shirts01_cc0.zip`, `pants02_ccby.zip` and `shoes01_cc0.zip` into
MPFB's data folder (`~/Library/Application Support/Blender/5.2/extensions/.user/user_default/mpfb/data` on a
Mac), or load each with MPFB's *Load pack from zip file*.

The people's bodies, skins, hair, tops and boots are CC0. Their jeans are CC-BY, from the pants02 pack:
`elvs_jeans_straight_leg` and `elvs_jeans_bootcut` by Elvaerwyn, and `punkduck_female_tight_jeans` and
`punkduck_male_classic_jeans` by punkduck.
