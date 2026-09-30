import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Vector3 } from 'three';
import { openModel } from './glb';

// Each person-<name>.glb (exported by blender/scripts/build_people.py) against what world/homies.ts counts
// on: the Mixamo bones it poses them by, the materials it finds by name, and a grown-up standing on the
// floor facing forward.

const PEOPLE = ['blond', 'bob', 'afro', 'tee', 'pony', 'buzz'];
const BONES = ['Hips', 'Spine1', 'Spine2', 'Neck', 'Head', ...['Arm', 'ForeArm', 'Hand', 'UpLeg', 'Leg', 'Foot'].flatMap((b) => [`Left${b}`, `Right${b}`])];
const MATERIALS = ['Skin', 'Top', 'Bottom', 'Shoes', 'Hair', 'Eyes', 'Brows'];

for (const name of PEOPLE) {
  const person = openModel(`person-${name}`);
  const { gltf, nodes } = person;

  test(`${name}: one skeleton with the Mixamo bones the office poses`, () => {
    assert.equal(gltf.skins?.length, 1, 'one armature');
    const joints = (gltf.skins?.[0]?.joints ?? []).map((j) => nodes[j].name);
    for (const b of BONES) assert.ok(joints.includes(`mixamorig:${b}`), `a bone called mixamorig:${b}`);
    assert.deepEqual(person.clips(), [], 'no clips: the office moves the bones itself');
  });

  test(`${name}: a material for each part, by name`, () => {
    assert.deepEqual([...person.materials()].sort(), [...MATERIALS].sort());
  });

  test(`${name}: grown-up sized, on the floor, facing forward`, () => {
    // Skinned, so its vertices are where the skeleton binds them, whatever the nodes above say (glTF's rule).
    const box = new Box3();
    for (const n of nodes) {
      if (n.mesh === undefined) continue;
      for (const p of gltf.meshes[n.mesh].primitives) {
        const a = gltf.accessors[p.attributes.POSITION];
        box.union(new Box3(new Vector3().fromArray(a.min!), new Vector3().fromArray(a.max!)));
      }
    }
    const height = box.max.y - box.min.y;
    assert.ok(height > 1.55 && height < 2.0, `about a person's height (${height.toFixed(2)} m)`);
    assert.ok(Math.abs(box.min.y) < 0.05, `feet on the floor (${box.min.y.toFixed(3)})`);
    assert.ok(Math.abs(box.max.x + box.min.x) < 0.1, 'standing in the middle');
    // The toes are in front of the heels: forward is +z.
    const toe = person.placed(person.byName('mixamorig:LeftToeBase')).at;
    const foot = person.placed(person.byName('mixamorig:LeftFoot')).at;
    assert.ok(toe.z > foot.z, 'facing +z');
  });
}
