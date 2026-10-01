"""Outfits for the people (build_people.py): what's done to MPFB's clothes so they look like a reference photo.

The photos are in blender/refs/ (look-<n>.*), kept out of git: they're someone else's pictures. Each look is a
function, named in a person's spec as `outfit`, that gets the person's parts by role (Top, Bottom, Shoes, Hair,
Body) and their rig, after MPFB has dressed them and before build_people.py names their materials. It reshapes
the clothes, paints their textures, and adds what MPFB hasn't got (a hood, a bag). Everything here is seeded,
so a rebuild paints the same.

Space as everywhere in the kit: metres, Z up, the person facing -Y, their right on -X.
"""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector, kdtree

TEXTURE = 1024


# ---- Helpers -------------------------------------------------------------------------------------

def world(ob):
    """`ob`'s vertices in world space, as an (n, 3) array."""
    M = np.array(ob.matrix_world)
    co = np.array([v.co[:] for v in ob.data.vertices])
    return co @ M[:3, :3].T + M[:3, 3]


def set_world(ob, w):
    """Moves `ob`'s vertices to `w`, given in world space."""
    Mi = np.linalg.inv(np.array(ob.matrix_world))
    for v, c in zip(ob.data.vertices, w @ Mi[:3, :3].T + Mi[:3, 3]):
        v.co = c
    ob.data.update()


def srgb(c):
    """A color picked off a photo (0..255, sRGB) as the linear color Blender's pixels hold."""
    c = np.asarray(c, float) / 255
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def _blur(a, r):
    for ax in (0, 1):
        a = sum(np.roll(a, s, axis=ax) for s in range(-r, r + 1)) / (2 * r + 1)
    return a


def _noise(rng, n, scale):
    """Soft blotches about `scale` pixels across, 0..1."""
    m = math.ceil(n / scale) + 1
    return _blur(np.kron(rng.random((m, m)), np.ones((scale, scale)))[:n, :n], max(1, scale // 2))


def _pixels(img):
    w, h = img.size
    return np.array(img.pixels[:], np.float32).reshape(h, w, 4)


def image(name, rgb):
    """A packed image of `rgb` (h, w, 3), linear."""
    h, w = rgb.shape[:2]
    img = bpy.data.images.new(name, w, h)
    px = np.ones((h, w, 4), np.float32)
    px[..., :3] = np.clip(rgb, 0, 1)
    img.pixels.foreach_set(px.ravel())
    img.pack()
    return img


def diffuse_node(ob):
    """The image node an MPFB material colors its surface with."""
    nodes = ob.active_material.node_tree.nodes
    return next(n for n in nodes if n.type == 'TEX_IMAGE' and n.name == 'diffuseTexture')


def smooth(ob, factor=0.6, repeat=6):
    """Irons out lumps (a smooth, before the rig's modifier, kept)."""
    m = ob.modifiers.new("smooth", 'SMOOTH')
    m.factor, m.iterations = factor, repeat
    with bpy.context.temp_override(object=ob):
        bpy.ops.object.modifier_move_to_index(modifier=m.name, index=0)
        bpy.ops.object.modifier_apply(modifier=m.name)


def lighter(ob, ratio):
    """Fewer triangles (a decimate, before the rig's modifier, kept)."""
    m = ob.modifiers.new("lighter", 'DECIMATE')
    m.ratio = ratio
    with bpy.context.temp_override(object=ob):
        bpy.ops.object.modifier_move_to_index(modifier=m.name, index=0)
        bpy.ops.object.modifier_apply(modifier=m.name)


def weights_from(ob, src):
    """Gives `ob` the bone weights of the nearest vertex of `src` (same world space)."""
    w = world(src)
    tree = kdtree.KDTree(len(w))
    for i, c in enumerate(w):
        tree.insert(c, i)
    tree.balance()
    groups = {g.index: g.name for g in src.vertex_groups}
    for name in groups.values():
        if name not in ob.vertex_groups:
            ob.vertex_groups.new(name=name)
    for v, c in zip(ob.data.vertices, world(ob)):
        _, i, _ = tree.find(c)
        for g in src.data.vertices[i].groups:
            ob.vertex_groups[groups[g.group]].add([v.index], g.weight, 'REPLACE')


# ---- Textures ------------------------------------------------------------------------------------

def knit(ob, name, color, contrast=0.5, seed=1):
    """A plain knit in `color`: the garment's own texture's light and shade (its ribs), recolored."""
    rng = np.random.default_rng(seed)
    src = diffuse_node(ob).image.copy()
    src.scale(TEXTURE, TEXTURE)
    lum = _pixels(src)[..., :3].mean(axis=2)
    bpy.data.images.remove(src)
    mask = lum > 0.02
    d = np.where(mask, lum / max(lum[mask].mean(), 1e-3), 1.0)
    shade = (1 + (d - 1) * contrast) * (0.95 + 0.1 * _noise(rng, TEXTURE, 64))
    diffuse_node(ob).image = image(name, srgb(color)[None, None] * shade[..., None])


def denim(ob, name, dark, light, flecks=0, seed=1):
    """Washed denim from `dark` to `light`: a fine twill, faded patches, streaks down the warp, and
    `flecks` spots of white paint."""
    rng = np.random.default_rng(seed)
    n = TEXTURE
    y, x = np.mgrid[0:n, 0:n]
    twill = 0.5 + 0.5 * np.sin((x + y) * 2 * np.pi / 3.0)
    streak = _blur(rng.random((1, n)).repeat(n, 0), 3)
    t = 0.55 * _noise(rng, n, 96) + 0.25 * streak + 0.2 * rng.random((n, n))
    t = (t - t.min()) / (np.percentile(t, 99) - t.min())
    lo, hi = srgb(dark), srgb(light)
    col = lo[None, None] + (hi - lo)[None, None] * np.clip(t, 0, 1)[..., None]
    col *= (0.93 + 0.07 * twill)[..., None]
    paint = np.zeros((n, n))
    yy, xx = np.ogrid[-6:7, -6:7]
    for _ in range(flecks):
        cx, cy = rng.integers(0, n, 2)
        r = rng.uniform(0.6, 3.2)
        blob = (xx ** 2 / (r * rng.uniform(0.5, 2.0)) ** 2 + yy ** 2 / r ** 2) < 1
        ys, xs = (cy + np.arange(-6, 7)) % n, (cx + np.arange(-6, 7)) % n
        paint[np.ix_(ys, xs)] = np.maximum(paint[np.ix_(ys, xs)], blob * rng.uniform(0.6, 1.0))
    col = col * (1 - paint[..., None]) + srgb((236, 236, 230))[None, None] * paint[..., None]
    diffuse_node(ob).image = image(name, col)


def checks(name, a, b, cols, rows, seed=1, n=512):
    """Leather in squares of `a` and `b`, each a little puffed, with dark seams between."""
    rng = np.random.default_rng(seed)
    y, x = np.mgrid[0:n, 0:n] / n
    cx, cy = np.floor(x * cols).astype(int), np.floor(y * rows).astype(int)
    col = np.where(((cx + cy) % 2)[..., None] == 1, srgb(b)[None, None], srgb(a)[None, None])
    var = rng.uniform(0.85, 1.12, (rows, cols))[cy, cx]
    fx, fy = (x * cols) % 1, (y * rows) % 1
    edge = np.minimum(np.minimum(fx, 1 - fx) * cols / rows, np.minimum(fy, 1 - fy))
    col = col * (var * (0.55 + 0.45 * np.clip(edge * 12, 0, 1) ** 0.5))[..., None]
    return image(name, col)


# ---- Shapes --------------------------------------------------------------------------------------

def straight_legs(ob, top=0.78, flare=0.06, part=0.05):
    """Trousers that hang straight and wide from the thigh down: below `top` each leg keeps the width
    and depth it has at `top`, growing by `flare` toward the hem (instead of the pattern's own bell),
    and the legs part by `part` at the hem, so they don't hang together like a skirt."""
    w = world(ob)
    out = w.copy()
    zs = np.arange(0.0, 1.0, 0.02)
    for sgn in (-1, 1):
        side = (w[:, 0] * sgn) > 0
        ext, at = [], []
        for z in zs:
            s = w[side & (abs(w[:, 2] - z) < 0.015)]
            if len(s) > 3:
                ext.append((s[:, 0].min(), s[:, 0].max(), s[:, 1].min(), s[:, 1].max()))
                at.append(z)
        E, Z = np.array(ext), np.array(at)
        x0, x1, y0, y1 = (np.interp(top, Z, E[:, k]) for k in range(4))
        for i in np.where(side & (w[:, 2] < top))[0]:
            z = w[i, 2]
            c0, c1, d0, d1 = (np.interp(z, Z, E[:, k]) for k in range(4))
            k = (top - z) / top
            grow = 1 + flare * k
            nx = (x0 + x1) / 2 + sgn * part * k + (w[i, 0] - (c0 + c1) / 2) * (x1 - x0) * grow / max(c1 - c0, 1e-4)
            depth = min(y1 - y0, (x1 - x0) * 1.15)   # round, not deeper than wide (a gore at the back bulges)
            ny = (y0 + y1) / 2 + (w[i, 1] - (d0 + d1) / 2) * depth * grow / max(d1 - d0, 1e-4)
            nx = sgn * max(sgn * nx, 0.006 + part * 0.6 * k)
            b = min(1.0, (top - z) / 0.08)   # eased in under `top`, so the thigh doesn't kink
            out[i, 0] += (nx - w[i, 0]) * b
            out[i, 1] += (ny - w[i, 1]) * b
    set_world(ob, out)


def tuck(ob, under, by=0.02):
    """Pulls `ob`'s top (a waistband) in toward the body by `by` where it's under `under` (a top's hem),
    so it doesn't poke through."""
    hem = world(under)[:, 2].min()
    w = world(ob)
    cy = np.median(w[w[:, 2] > hem - 0.01, 1])
    for p in w:
        if p[2] > hem - 0.04:
            r = math.hypot(p[0], p[1] - cy)
            if r > 1e-4:
                k = max(0.0, (r - by * min(1.0, (p[2] - (hem - 0.04)) / 0.03)) / r)
                p[0] *= k
                p[1] = cy + (p[1] - cy) * k
    set_world(ob, w)


def no_socks(ob):
    """Takes the socks out of MPFB's shoes: the faces whose texture is near white."""
    px = _pixels(diffuse_node(ob).image)
    h, w = px.shape[:2]
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    uv = bm.loops.layers.uv.active
    sock = []
    for f in bm.faces:
        u = sum(l[uv].uv.x for l in f.loops) / len(f.loops)
        v = sum(l[uv].uv.y for l in f.loops) / len(f.loops)
        if px[int(v * h) % h, int(u * w) % w, :3].min() > 0.45:
            sock.append(f)
    bmesh.ops.delete(bm, geom=sock, context='FACES')
    bm.to_mesh(ob.data)
    bm.free()


def swept_back(ob, lift=0.75, back=0.035):
    """Combs a fringe up and back off the eyes: the hair in front of the forehead and below the crown."""
    w = world(ob)
    f = np.clip((-0.07 - w[:, 1]) / 0.07, 0, 1) * np.clip((1.82 - w[:, 2]) / 0.1, 0, 1)
    w[:, 2] += (1.815 - w[:, 2]) * lift * f
    w[:, 1] += back * f
    set_world(ob, w)


def hood(top, neck=1.585):
    """A hoodie's hood, worn down: a collar round the neck, high at the back and meeting in a V at the
    front, and the hood folded on the upper back. Joined into `top` (its material, and the bone weights
    of the nearest of its vertices), its UVs on a plain patch of `top`'s front panel."""
    bm = bmesh.new()
    sph = bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=14, radius=1.0)
    for v in sph["verts"]:
        v.co = Vector((v.co.x * 0.125, v.co.y * 0.055 + 0.085, v.co.z * 0.10 + neck - 0.03))
    seg, rows = 40, 6
    grid = []
    for j in range(rows):
        t = j / (rows - 1)
        row = []
        for i in range(seg):
            a = 2 * math.pi * i / seg                                  # 0 at the front (-y)
            back = (1 - math.cos(a)) / 2
            r = (0.105 - 0.022 * t - 0.01 * back * t) * (1 + 0.06 * t * t)
            notch = math.exp(-(a if a < math.pi else a - 2 * math.pi) ** 2 / 0.12)
            zt = neck + 0.01 + 0.06 * back - 0.06 * notch
            z = neck - 0.06 + (zt - (neck - 0.06)) * t
            row.append(bm.verts.new((math.sin(a) * r, -math.cos(a) * r * 0.9 + 0.005, z)))
        grid.append(row)
    for j in range(rows - 1):
        for i in range(seg):
            bm.faces.new((grid[j][i], grid[j][(i + 1) % seg], grid[j + 1][(i + 1) % seg], grid[j + 1][i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    uv = bm.loops.layers.uv.new("UVMap")
    for f in bm.faces:
        f.smooth = True
        for l in f.loops:
            co = l.vert.co
            a = (math.atan2(co.x, co.y - 0.03) / math.pi + 1) / 2
            l[uv].uv = (0.12 + 0.26 * a, 0.12 + 0.30 * min(1, max(0, (co.z - 1.45) / 0.22)))
    me = bpy.data.meshes.new("hood")
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new("hood", me)
    bpy.context.scene.collection.objects.link(ob)
    me.materials.append(top.active_material)
    weights_from(ob, top)
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    top.select_set(True)
    bpy.context.view_layer.objects.active = top
    bpy.ops.object.join()


def bag(rig, name, img, size=(0.30, 0.21, 0.11)):
    """A bag hanging by its handle from the right hand, along the forearm (so it hangs straight when the
    arm does), bound to the hand bone. Its material is called Bag, colored by `img`."""
    W, H, D = size
    fa = rig.matrix_world @ rig.pose.bones["mixamorig:RightForeArm"].head
    hd = rig.matrix_world @ rig.pose.bones["mixamorig:RightHand"].head
    down = (hd - fa).normalized()
    lat = (Vector((1, 0, 0)) - down * down.x).normalized()
    fwd = down.cross(lat).normalized()
    bm = bmesh.new()
    cube = bmesh.ops.create_cube(bm, size=1.0)
    for v in cube["verts"]:
        v.co = Vector((v.co.x * W, v.co.y * D, v.co.z * H - H / 2))
    bmesh.ops.bevel(bm, geom=list(bm.edges), offset=0.03, segments=3, affect='EDGES', profile=0.6)
    n, m, r = 20, 6, 0.008
    rings = []
    for i in range(n + 1):
        t = math.pi * i / n
        c = Vector((math.cos(t) * 0.09, 0, math.sin(t) * 0.11 - 0.01))
        nrm = Vector((math.cos(t), 0, math.sin(t)))
        rings.append([bm.verts.new(c + (nrm * math.cos(2 * math.pi * k / m) + Vector((0, 1, 0)) * math.sin(2 * math.pi * k / m)) * r) for k in range(m)])
    for i in range(n):
        for k in range(m):
            bm.faces.new((rings[i][k], rings[i][(k + 1) % m], rings[i + 1][(k + 1) % m], rings[i + 1][k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    uv = bm.loops.layers.uv.new("UVMap")
    for f in bm.faces:
        f.smooth = True
        for l in f.loops:
            co = l.vert.co
            # The handle on a dark square; the body's front and back each half the picture across.
            l[uv].uv = (0.02, 0.02) if co.z > 0 else ((co.x / W + 0.5 + (0.5 if co.y > 0 else 0)) * 0.5, (co.z / H + 1) * 0.98 + 0.01)
    top = hd + down * 0.10
    basis = Matrix((fwd, lat, -down)).transposed()
    for v in bm.verts:
        v.co = top + basis @ (v.co - Vector((0, 0, 0.10)))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    mat = bpy.data.materials.new("Bag")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs["Roughness"].default_value = 0.4
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    ob.vertex_groups.new(name="mixamorig:RightHand").add(list(range(len(me.vertices))), 1.0, 'REPLACE')
    ob.parent = rig
    ob.matrix_parent_inverse = rig.matrix_world.inverted()
    ob.modifiers.new("Armature", 'ARMATURE').object = rig
    ob["dressed"] = True   # build_people.py leaves its material as it is
    return ob


# ---- The looks -----------------------------------------------------------------------------------

def hoodie(parts, rig):
    """look-1: a navy hoodie over light, wide jeans flecked with paint, brown loafers (the photo's bag in
    checks left out for now)."""
    top, bottom = parts["Top"], parts["Bottom"]
    knit(top, "hoodie_top", (38, 50, 88))
    hood(top, neck=(rig.matrix_world @ rig.pose.bones["mixamorig:Neck"].head).z - 0.003)
    smooth(bottom)
    straight_legs(bottom)
    tuck(bottom, top)
    lighter(bottom, 0.35)
    denim(bottom, "hoodie_bottom", (104, 134, 168), (172, 198, 222), flecks=140, seed=7)
    no_socks(parts["Shoes"])
    swept_back(parts["Hair"])
