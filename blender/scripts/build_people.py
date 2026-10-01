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

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import aokit  # noqa: E402
import outfits  # noqa: E402

# name: body (MPFB's macros, 0..1), skin, hair (and its color, or None for its own), eyebrows, clothes as
# (asset, role, color or None to keep its texture's), and the outfit (outfits.py) made from them, if any.
PEOPLE = {
    "hoodie": dict(
        macros=dict(gender=1.0, age=0.36, muscle=0.5, weight=0.38, height=0.72, proportions=0.75, race=dict(caucasian=1.0, african=0.0, asian=0.0)),
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


def build(svc, name, spec):
    aokit.clear()
    HS = svc.HumanService
    info = HS._create_default_human_info_dict()
    info["phenotype"].update({k: v for k, v in spec["macros"].items() if k != "race"})
    info["phenotype"]["race"].update(spec["macros"]["race"])
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
    roles = {c[0]: (c[1], c[2]) for c in spec["clothes"]}
    if spec.get("outfit"):
        meshes = [ob for ob in bpy.data.objects if ob.type == 'MESH']
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
