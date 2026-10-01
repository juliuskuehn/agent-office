"""People for the San Andreas look (src/client/world/homies.ts): realistic grown-ups made with MPFB
(MakeHuman for Blender), dressed for a techno club, each exported as src/client/models/person-<name>.glb.

Needs MPFB in Blender and these MakeHuman asset packs installed in it (see blender/README.md): the
system assets (CC0), shirts01 (CC0), pants02 (CC-BY) and shoes01 (CC0).

Every person has the same bones (MPFB's "mixamo" rig; three.js drops the colon, so the office finds
them as `mixamorigHips` and so on) and no clips: the office poses the bones itself. Their materials
are named for what they are, so the office can find them (`Skin`, `Top`, `Bottom`, `Shoes`, `Hair`,
`Eyes`, `Brows`), each with its texture, cut down to keep the files small.

    blender --background --factory-startup --python blender/scripts/build_people.py -- [--only name] [--shots]
"""
import bpy, bmesh, os, sys, importlib, addon_utils
import numpy as np
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import aokit  # noqa: E402
import outfits  # noqa: E402

# A slim, athletic build, not a wide one: narrower shoulders and back than MPFB's macros give on their own
# (MPFB's targets, each 0..1). With a grown man's macros (age 0.45, muscle 0.5, weight 0.4, height 0.59)
# that's 1.79 m, 45 cm across the shoulders, 30 at the chest, 28 at the waist and 35 at the hips.
SLIM = [
    {"target": "measure-shoulder-dist-decr", "value": 0.5},
    {"target": "torso-vshape-decr", "value": 0.3},
    {"target": "torso-muscle-dorsi-decr", "value": 0.3},
    {"target": "measure-neck-circ-incr", "value": 0.3},
    # A rounder deltoid, so the shoulder rounds into the arm.
    {"target": "l-upperarm-shoulder-muscle-incr", "value": 0.4},
    {"target": "r-upperarm-shoulder-muscle-incr", "value": 0.4},
]

# How much thinner arms are than MPFB makes them, as a share of their thickness.
ARMS = 0.18
# How much smaller hands are than MPFB's (toward the wrist): about 10.5% of their height long, not 11.
HANDS = 0.05
# How far each arm sits in toward the middle and down from where MPFB puts it (m), so shoulders slope off
# to the arm as real ones do instead of standing out square from the neck.
SHOULDERS = (0.012, 0.042)

# name: body (MPFB's macros, 0..1, and targets), skin, hair (and its color, or None for its own), eyebrows,
# clothes as (asset, role, color or None to keep its texture's), and the outfit (outfits.py) made from them, if any.
PEOPLE = {
    "hoodie": dict(
        macros=dict(gender=1.0, age=0.45, muscle=0.5, weight=0.4, height=0.59, proportions=0.75, race=dict(caucasian=1.0, african=0.0, asian=0.0)),
        targets=SLIM,
        skin="young_caucasian_male", hair=("short03", (0.2, 0.13, 0.09)), brows="eyebrow001",
        clothes=[("toigo_fisherman_sweater", "Top", None), ("elvs_gored_elephant_pants", "Bottom", None), ("shoes01", "Shoes", (0.6, 0.42, 0.36))],
        outfit=outfits.hoodie,
    ),
    "bob": dict(
        macros=dict(gender=0.0, age=0.4, muscle=0.5, weight=0.42, height=0.55, proportions=0.75, cupsize=0.55, race=dict(caucasian=0.8, african=0.0, asian=0.2)),
        skin="young_caucasian_female", hair=("bob02", (0.12, 0.08, 0.07)), brows="eyebrow010",
        clothes=[("skalldyrssuppe_tube_top_funky_colors", "Top", (0.32, 0.07, 0.12)), ("punkduck_female_tight_jeans", "Bottom", (0.3, 0.3, 0.34)), ("scailman_gogo_platform_boots", "Shoes", (0.06, 0.06, 0.06))],
    ),
    "afro": dict(
        macros=dict(gender=0.0, age=0.38, muscle=0.55, weight=0.45, height=0.6, proportions=0.75, cupsize=0.5, race=dict(caucasian=0.0, african=1.0, asian=0.0)),
        skin="young_african_female", hair=("afro01", (0.1, 0.07, 0.05)), brows="eyebrow011",
        clothes=[("toigo_camisole_top", "Top", (0.05, 0.05, 0.05)), ("elvs_jeans_bootcut", "Bottom", None), ("toigo_ankle_boots_female", "Shoes", (0.08, 0.08, 0.08))],
    ),
    "tee": dict(
        macros=dict(gender=1.0, age=0.45, muscle=0.62, weight=0.52, height=0.58, proportions=0.65, race=dict(caucasian=0.0, african=1.0, asian=0.0)),
        skin="young_african_male", hair=("short01", (0.05, 0.04, 0.04)), brows="eyebrow002",
        clothes=[("elvs_crude_t-shirt_male", "Top", (0.06, 0.06, 0.06)), ("punkduck_male_classic_jeans", "Bottom", None), ("toigo_ankle_boots_male", "Shoes", (0.1, 0.08, 0.06))],
    ),
    "pony": dict(
        macros=dict(gender=0.0, age=0.4, muscle=0.5, weight=0.4, height=0.5, proportions=0.75, cupsize=0.45, race=dict(caucasian=0.0, african=0.0, asian=1.0)),
        skin="young_asian_female", hair=("ponytail01", (0.06, 0.05, 0.05)), brows="eyebrow009",
        clothes=[("toigo_keyhole_tank_top", "Top", (0.05, 0.05, 0.055)), ("punkduck_female_tight_jeans", "Bottom", (0.18, 0.18, 0.2)), ("scailman_gogo_platform_boots", "Shoes", (0.05, 0.05, 0.05))],
    ),
    "buzz": dict(
        macros=dict(gender=1.0, age=0.48, muscle=0.6, weight=0.5, height=0.66, proportions=0.6, race=dict(caucasian=0.7, african=0.0, asian=0.3)),
        skin="young_caucasian_male2", hair=("short04", (0.14, 0.1, 0.07)), brows="eyebrow003",
        clothes=[("toigo_basic_tucked_t-shirt", "Top", (0.13, 0.13, 0.14)), ("elvs_jeans_bootcut", "Bottom", None), ("toigo_ankle_boots_male", "Shoes", (0.07, 0.07, 0.07))],
    ),
}

TEXTURE = 512
SKIN_TEXTURE = 1024


def mpfb():
    mod = next(m for m in addon_utils.modules() if m.__name__.endswith("mpfb"))
    addon_utils.enable(mod.__name__, default_set=True)
    return importlib.import_module(mod.__name__ + ".services")


def diffuse_image(mat):
    """The picture a MakeSkin material colors its surface with (not its normal or bump map)."""
    if not mat or not mat.use_nodes:
        return None
    named = mat.node_tree.nodes.get("diffuseTexture")
    if named is not None and named.type == 'TEX_IMAGE' and named.image:
        return named.image
    for node in mat.node_tree.nodes:
        if node.type == 'TEX_IMAGE' and node.image:
            n = node.image.name.lower()
            if not any(k in n for k in ("normal", "bump", "specular", "roughness", "_nm", "displace")):
                return node.image
    return None


def smaller(img, size, alpha):
    """A copy of `img` at most `size` across, packed into the file (JPEG, or PNG where it's cut out by alpha)."""
    copy = img.copy()
    w, h = copy.size
    if max(w, h) > size:
        k = size / max(w, h)
        copy.scale(max(1, int(w * k)), max(1, int(h * k)))
    copy.file_format = 'PNG' if alpha else 'JPEG'
    copy.pack()
    return copy


def dress(ob, role, color, alpha=False, size=TEXTURE):
    """Gives `ob` one plain material named `role`: its texture (tinted `color`, or replaced by it for a top in a solid color)."""
    img = diffuse_image(ob.active_material)
    mat = bpy.data.materials.new(role)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.8
    if img is not None and not (role == "Top" and color is not None):
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = smaller(img, size, alpha)
        if color is not None:
            mix = nt.nodes.new("ShaderNodeMix")
            mix.data_type = 'RGBA'
            mix.blend_type = 'MULTIPLY'
            mix.inputs["Factor"].default_value = 1.0
            nt.links.new(tex.outputs["Color"], mix.inputs["A"])
            mix.inputs["B"].default_value = (*color, 1.0)
            nt.links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])
        else:
            nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        if alpha:
            nt.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
            mat.blend_method = 'CLIP' if hasattr(mat, "blend_method") else None
    else:
        bsdf.inputs["Base Color"].default_value = (*(color or (0.5, 0.5, 0.5)), 1.0)
    ob.data.materials.clear()
    ob.data.materials.append(mat)


def no_cornea(ob):
    """Takes the clear shell off each eye. It's mapped to the see-through corner of the eye's texture
    (u > 0.85, v < 0.15), which the Eyes material doesn't keep, so it would hide the iris in white."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    uv = bm.loops.layers.uv.active
    shell = [f for f in bm.faces if all(l[uv].uv.x > 0.85 and l[uv].uv.y < 0.15 for l in f.loops)]
    bmesh.ops.delete(bm, geom=shell, context='FACES')
    bm.to_mesh(ob.data)
    bm.free()


def bone_weights(ob, rig):
    """Each vertex's weights by bone, as the rig deforms it: only the groups that are bones (MPFB adds
    others, like Right and body), scaled to add up to 1."""
    bones = set(rig.data.bones.keys())
    names = {g.index: g.name for g in ob.vertex_groups if g.name in bones}
    out = []
    for v in ob.data.vertices:
        ws = [(names[g.group], g.weight) for g in v.groups if g.group in names and g.weight > 0]
        total = sum(w for _, w in ws)
        out.append([(n, w / total) for n, w in ws] if total > 0 else [])
    return out


def bake_shapes(ob):
    """Bakes `ob`'s shape keys (MPFB's targets) into its mesh, so what's done to its vertices after shows."""
    if ob.data.shape_keys:
        with bpy.context.temp_override(object=ob, active_object=ob):
            bpy.ops.object.shape_key_remove(all=True, apply_mix=True)


def slimmer_arms(rig, obs, by):
    """Draws every vertex bound to an upper arm or forearm toward that bone, by `by` of its distance times
    its weight (a forearm by less, so the wrist still fits the hand, and an upper arm only from a little
    below the shoulder, so the shoulder stays round): arms and sleeves that much thinner, still on their
    bones. And the hands a touch smaller, toward the wrist."""
    segs = {}
    for side in ("Left", "Right"):
        for b, k, fade in (("Arm", 1.0, 0.35), ("ForeArm", 0.7, 0.0)):
            pb = rig.pose.bones[f"mixamorig:{side}{b}"]
            segs[pb.name] = (np.array(rig.matrix_world @ pb.head), np.array(rig.matrix_world @ pb.tail), k, fade)
    wrists = {}
    for side in ("Left", "Right"):
        hand = rig.data.bones[f"mixamorig:{side}Hand"]
        at = np.array(rig.matrix_world @ rig.pose.bones[hand.name].head)
        for b in [hand] + list(hand.children_recursive):
            wrists[b.name] = at
    for ob in obs:
        if not any(g.name in segs or g.name in wrists for g in ob.vertex_groups):
            continue
        M = np.array(ob.matrix_world)
        Mi = np.linalg.inv(M)
        for v, bw in zip(ob.data.vertices, bone_weights(ob, rig)):
            ws = [(n, w) for n, w in bw if n in segs or n in wrists]
            if not ws:
                continue
            p = M[:3, :3] @ np.array(v.co) + M[:3, 3]
            delta = np.zeros(3)
            for bone, weight in ws:
                if bone in wrists:
                    delta += (wrists[bone] - p) * HANDS * weight
                    continue
                a, b, k, fade = segs[bone]
                t = np.clip((p - a) @ (b - a) / ((b - a) @ (b - a)), 0, 1)
                # Eased in down from the shoulder joint, so the shoulder rounds into the arm without a step.
                if fade:
                    e = min(1.0, t / fade)
                    k *= e * e * (3 - 2 * e)
                delta += (a + t * (b - a) - p) * by * k * weight
            v.co = Mi[:3, :3] @ (p + delta) + Mi[:3, 3]
        ob.data.update()


def sloped_shoulders(rig, obs, inward, drop):
    """Moves each arm `inward` and `drop` down: its bones from the shoulder joint on, and every vertex bound
    to them (half as far for those bound to its collarbone)."""
    chain = {}
    for side, sgn in (("Left", 1), ("Right", -1)):
        arm = rig.data.bones[f"mixamorig:{side}Arm"]
        for b in [arm] + list(arm.children_recursive):
            chain[b.name] = (sgn, 1.0)
        chain[f"mixamorig:{side}Shoulder"] = (sgn, 0.5)
    bpy.ops.object.select_all(action='DESELECT')
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    into = rig.matrix_world.inverted().to_3x3()
    eb = rig.data.edit_bones
    # The arm's bones moved whole (their matrices, so each keeps its roll; setting a head and a tail can
    # turn a bone about itself), from the top down; the collarbone stays, the arm no longer joined to it.
    for side, sgn in (("Left", 1), ("Right", -1)):
        top = eb[f"mixamorig:{side}Arm"]
        top.use_connect = False
        move = Matrix.Translation(into @ Vector((-sgn * inward, 0, -drop)))
        for b in [top] + list(top.children_recursive):
            b.matrix = move @ b.matrix
    bpy.ops.object.mode_set(mode='OBJECT')
    for ob in obs:
        if not any(g.name in chain for g in ob.vertex_groups):
            continue
        back = np.linalg.inv(np.array(ob.matrix_world))[:3, :3]
        for v, bw in zip(ob.data.vertices, bone_weights(ob, rig)):
            d = np.zeros(3)
            for n, w in bw:
                if n in chain:
                    sgn, k = chain[n]
                    d += np.array((-sgn * inward, 0, -drop)) * k * w
            if d.any():
                v.co = np.array(v.co) + back @ d
        ob.data.update()


def build(svc, name, spec):
    aokit.clear()
    HS = svc.HumanService
    info = HS._create_default_human_info_dict()
    info["phenotype"].update({k: v for k, v in spec["macros"].items() if k != "race"})
    info["phenotype"]["race"].update(spec["macros"]["race"])
    info["targets"] = spec.get("targets", [])
    info["rig"] = "mixamo"
    info["eyes"] = "high-poly.mhclo"
    info["eyebrows"] = spec["brows"] + ".mhclo"
    info["hair"] = spec["hair"][0] + ".mhclo"
    info["clothes"] = [c[0] + ".mhclo" for c in spec["clothes"]]
    info["skin_mhmat"] = spec["skin"] + ".mhmat"
    info["skin_material_type"] = "MAKESKIN"
    info["name"] = name
    settings = HS.get_default_deserialization_settings()
    settings["subdiv_levels"] = 0
    body = HS.deserialize_from_dict(info, settings)

    rig = body.parent
    meshes = [ob for ob in bpy.data.objects if ob.type == 'MESH']
    for ob in meshes:
        bake_shapes(ob)
    slimmer_arms(rig, meshes, spec.get("arms", ARMS))
    sloped_shoulders(rig, meshes, *spec.get("shoulders", SHOULDERS))
    roles = {c[0]: (c[1], c[2]) for c in spec["clothes"]}
    if spec.get("outfit"):
        parts = {role: next(ob for ob in meshes if asset.lower() in ob.name.lower()) for asset, (role, _) in roles.items()}
        parts["Hair"] = next(ob for ob in meshes if spec["hair"][0] in ob.name.lower())
        parts["Body"] = body
        spec["outfit"](parts, rig)
    for ob in list(bpy.data.objects):
        if ob.type != 'MESH' or ob.get("dressed"):
            continue
        kind = svc.GeneralObjectProperties.get_value("object_type", entity_reference=ob) if hasattr(svc, "GeneralObjectProperties") else ""
        low = ob.name.lower()
        if ob is body:
            dress(ob, "Skin", None, size=SKIN_TEXTURE)
        elif "eyebrow" in low:
            dress(ob, "Brows", None, alpha=True)
        elif "high-poly" in low or "eye" in low:
            no_cornea(ob)
            dress(ob, "Eyes", None)
        elif spec["hair"][0] in low:
            dress(ob, "Hair", spec["hair"][1], alpha=True)
        else:
            match = next((a for a in roles if a.lower() in low or low.startswith(a.lower()[:12])), None)
            if match is None:
                print("DROP", ob.name, kind)
                bpy.data.objects.remove(ob, do_unlink=True)
                continue
            role, color = roles[match]
            dress(ob, role, color)
    # On their soles: platform boots reach below the feet the body stands on.
    bpy.context.view_layer.update()
    deps = bpy.context.evaluated_depsgraph_get()
    low = min((ob.matrix_world @ v.co).z for ob in bpy.data.objects if ob.type == 'MESH' for v in ob.evaluated_get(deps).to_mesh().vertices)
    rig.location.z -= low
    bpy.context.view_layer.update()
    for ob in bpy.data.objects:
        print("OBJ", ob.name, ob.type, len(ob.data.polygons) if ob.type == 'MESH' else "", [m.name for m in getattr(ob.data, "materials", [])] if ob.type == 'MESH' else "")
    return rig


def export(name):
    path = os.path.join(aokit.MODELS, f"person-{name}.glb")
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        export_yup=True,
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_cameras=False,
        export_lights=False,
        export_animations=False,
        export_skins=True,
        export_def_bones=True,
        export_image_format='WEBP',
        export_image_quality=80,
    )
    print("WROTE", path, os.path.getsize(path))


def main():
    a = aokit.args()
    only = a[a.index("--only") + 1] if "--only" in a else None
    svc = mpfb()
    for name, spec in PEOPLE.items():
        if only and name != only:
            continue
        build(svc, name, spec)
        export(name)
        if "--shots" in a:
            for view in ("front", "back", "tq"):
                print("SHOT", aokit.shoot(f"person-{name}-{view}", view, target=(0, 0, 0.95), dist=3.2))


main()
