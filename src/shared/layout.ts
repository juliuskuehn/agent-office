// Static office layout shared by the server (validation) and client (rendering).
// Units are meters; +y is up. The office floor spans FLOOR.minX..maxX / minZ..maxZ at y = 0,
// upstairs over a garage whose floor is level with the street (STREET_Y).

export const FLOOR = { minX: -18, maxX: 18, minZ: -13, maxZ: 13 } as const;
/** How high the ceiling is: a meter over the loft's roof (LOFT.y + LOFT.height), all the way across the room. */
export const WALL_HEIGHT = 6.8;

/**
 * The east wall's glass: all of it, in panes this wide (see WINDOWS). The boards and the TV hang in
 * front of it, each one pane wide, so the bay behind each is wholly covered and the rest stay clear.
 */
export const EAST_PANE = (FLOOR.maxZ - FLOOR.minZ) / Math.round((FLOOR.maxZ - FLOOR.minZ) / 3) /* GLASS_FRONT.bay */;
/** The middle of the east wall's `i`th pane, counting from the north. */
const eastBay = (i: number) => FLOOR.minZ + EAST_PANE * (i + 0.5);

export interface DeskDef {
  id: string;
  x: number;
  z: number;
  /** Rotation around Y. At 0 the worker sits on the desk's +z side, facing -z. */
  rotY: number;
  label: string;
  /** A bean bag on the floor instead of a desk; the worker sits on it at (x, z), facing -z at rotY 0. */
  beanbag?: boolean;
  /** A board agent's kiosk instead of a desk (see STATIONS): the worker stands behind it. */
  station?: StationKind;
  /** A chair at the meeting room's table (see MEETING_SEATS): only a meeting seats a worker here. */
  room?: boolean;
  /** A desk in the back office (see WING): there once the floor is built out this many rows. */
  wing?: number;
  /** A place at one of the round tables (see ROUND_TABLES): the table's middle. (x, z) is where its laptop sits. */
  table?: { x: number; z: number };
  /** A place on the lounge's Togo sofa (see LOUNGE), its laptop on the low table in front. */
  lounge?: boolean;
}

const DESK_WIDTH = 2.2;
const DESK_DEPTH = 1.1;
export const DESK_SIZE = { width: DESK_WIDTH, depth: DESK_DEPTH, height: 0.78 } as const;
/** The Togo armchair at each place at a round table (Ligne Roset's, like the lounge's sofa): how wide it is, how far back from the place its middle is, and the floor it takes, round. */
export const TOGO_CHAIR = { width: 0.87, at: 1.2, radius: 0.42 } as const;

/**
 * The big round table the office's desks are places at, eight round it: its middle, how big it is
 * (`radius`, and the same `height` as a desk), how many `places` it has and how far out from the
 * middle each place's display sits (`place`). The chair is out from the display the way a desk's is
 * (deskSeat), past the edge.
 */
export const ROUND_TABLE = { radius: 2.4, height: DESK_SIZE.height, places: 8, place: 1.75 } as const;

/**
 * The lounge, in from the east wall's glass: the middle of its rug. The couch is at its west side,
 * facing east over the coffee table in the middle; a pouf either side; and across from the couch, a
 * Togo sofa (LOUNGE_TOGO) with a low table in front of it, where two workers code at laptops
 * (LOUNGE_DESKS). The fire pole's railing is just west of the couch.
 */
export const LOUNGE = { x: 11.4, z: 0, rug: 7 } as const;
/** The Togo: its middle, how wide and deep it is, and how high its seat is, facing west (-x). */
export const LOUNGE_TOGO = { x: LOUNGE.x + 2.4, z: LOUNGE.z, width: 1.9, depth: 1.02, seat: 0.38 } as const;
/**
 * The places on the Togo: where their laptops sit on the low table in front of it (x), and how far
 * along it each is from its middle. The worker sits 0.85 m behind the laptop (deskSeat), on the Togo.
 */
export const LOUNGE_DESKS = { x: LOUNGE_TOGO.x - 0.85, places: [-0.45, 0.45], table: { width: 1.7, depth: 0.45, height: 0.42 } } as const;
export const ROUND_TABLES: readonly { x: number; z: number }[] = [{ x: -6, z: 0 }];

function buildDesks(): DeskDef[] {
  const desks: DeskDef[] = [];
  let n = 1;
  for (const table of ROUND_TABLES) {
    // Evenly round it, the first on the south side, facing north.
    for (let k = 0; k < ROUND_TABLE.places; k++) {
      const rotY = (k * Math.PI * 2) / ROUND_TABLE.places;
      const x = table.x + Math.sin(rotY) * ROUND_TABLE.place;
      const z = table.z + Math.cos(rotY) * ROUND_TABLE.place;
      desks.push({ id: `desk-${n}`, x, z, rotY, label: `Desk ${n}`, table });
      n++;
    }
  }
  // Then the Togo's two in the lounge, facing west across the low table.
  for (const dz of LOUNGE_DESKS.places) {
    desks.push({ id: `desk-${n}`, x: LOUNGE_DESKS.x, z: LOUNGE.z + dz, rotY: Math.PI / 2, label: `Desk ${n}`, lounge: true });
    n++;
  }
  return desks;
}

export const DESKS: DeskDef[] = buildDesks();

/**
 * The back office: a bay through the north wall between the elevator and the east wall, `row` meters
 * deep, where the board agents stand (see STATIONS). It's always open, on every floor, and has no
 * desks. It runs from `minX` to the east wall, and from the old north wall back to wingMinZ.
 */
export const WING = { minX: 13.4, maxX: FLOOR.maxX, row: 4.6, rows: 1 } as const;

/** How many rows a floor is built out: always all of them (a floor plan saved when it could be fewer says nothing now). */
export function wingLevel(_level?: unknown): number {
  return WING.rows;
}

/** How far north the back office's back wall is, built out `level` rows: the north wall with none. */
export function wingMinZ(level: number): number {
  return FLOOR.minZ - wingLevel(level) * WING.row;
}

/** Whether (x, z) is in the back office, built out `level` rows. */
export function inWing(x: number, z: number, level: number): boolean {
  return level > 0 && x > WING.minX && x < WING.maxX && z <= FLOOR.minZ && z > wingMinZ(level);
}

/** The middle of the back office's row `row` (1 is the first, through the old north wall). */
export function wingRowZ(row: number): number {
  return FLOOR.minZ - (row - 0.5) * WING.row;
}

/** The back office's desks: none, it's the board agents' room. */
export const WING_DESKS: DeskDef[] = [];

/** Whether `desk` is there on a floor built out `level` rows: every desk in the room is. */
export function deskBuilt(desk: DeskDef, level: number): boolean {
  return !desk.wing || desk.wing <= level;
}

/** Every desk on a floor built out `level` rows: the room's, then the back office's. */
export function builtDesks(level: number): DeskDef[] {
  return [...DESKS, ...WING_DESKS.filter((d) => deskBuilt(d, level))];
}

/**
 * Overflow seats: once every desk is taken, bean bags come out around the room, one at a time in
 * this order. Each faces a window or a wall, with open floor behind it to walk up to.
 */
export const BEANBAGS: DeskDef[] = (
  [
    // East of the elevator, clear of the board agents in front of the east wall, and west of it,
    // clear of its doors.
    [12.6, -8.8, -Math.PI / 2],
    [5.4, -9.8, 0],
    [-16.1, -9, Math.PI / 2],
    [-16.1, -3, Math.PI / 2],
    [-8.8, 10.2, Math.PI],
    [0.8, 10.2, Math.PI],
    [12.2, -5.6, -Math.PI / 2],
    [12.2, 5.6, -Math.PI / 2],
    // Out of the way of the donut bookshelf, down toward the south-west corner.
    [-16.1, 9.6, Math.PI / 2],
    // In the north-west corner, where the kitchen was.
    [-13.2, -9.8, 0],
    [-12.6, 9.2, Math.PI / 2],
    // East of the kitchen, clear of the floor in front of it.
    [0.6, -9.8, 0],
  ] as const
).map(([x, z, rotY], i) => ({ id: `beanbag-${i + 1}`, x, z, rotY, label: `Bean bag ${i + 1}`, beanbag: true }));

/** Everywhere a worker can sit: the desks, the back office's once it's built out (see deskBuilt), then the bean bags. */
export const SEATS: DeskDef[] = [...DESKS, ...WING_DESKS, ...BEANBAGS];

/** The boards with an agent standing by: the Issues board, the PR board and the task queue. */
export type StationKind = 'issues' | 'pulls' | 'queue';

/**
 * The board agents: a worker standing behind a little kiosk for each of those boards (see BOARDS),
 * round the back office (WING), there for anyone to prompt about it. (x, z) is the kiosk. They face
 * into the middle of it, so the worker stands on the wall's side of it. Nobody hires them from the desks or the queue.
 */
export const STATIONS: DeskDef[] = [
  // Round the back office, facing into the middle of it: the Issues agent by its west wall, the Queue
  // agent by the back wall, and the PR agent by the east wall.
  { id: 'station-issues', station: 'issues', x: WING.minX + 1.3, z: FLOOR.minZ - 1.3, rotY: -Math.PI / 2, label: 'Issues board' },
  { id: 'station-queue', station: 'queue', x: (WING.minX + WING.maxX) / 2, z: wingMinZ(WING.rows) + 1.3, rotY: Math.PI, label: 'Task queue' },
  { id: 'station-pulls', station: 'pulls', x: WING.maxX - 1.3, z: FLOOR.minZ - 1.3, rotY: Math.PI / 2, label: 'PR board' },
];
/** A board agent's kiosk: its top, and how far behind its middle (toward the wall) the agent stands. */
export const KIOSK = { width: 0.8, depth: 0.5, height: 0.55, stand: 0.55 } as const;
/** Each board agent's name and its color, the same whenever it's hired. */
export const STATION_AGENT: Record<StationKind, { name: string; color: string }> = {
  issues: { name: 'Issues agent', color: '#ef476f' },
  pulls: { name: 'PR agent', color: '#118ab2' },
  queue: { name: 'Queue agent', color: '#06d6a0' },
};

/** The upstairs office: a glass-walled loft on posts in the south-east corner, looking down on the desks. */
export const LOFT = { minX: 9, maxX: FLOOR.maxX, minZ: 8, maxZ: FLOOR.maxZ, y: 3, height: 2.8 } as const;
/** Its stairs climb east along the south wall and arrive at the loft's west door. */
export const STAIRS = { fromX: 3, toX: LOFT.minX, minZ: 11.2, maxZ: FLOOR.maxZ, steps: 15 } as const;

/**
 * The meeting room: glass walls round the space under the boss office, from the loft's posts to the
 * outside walls, with a long table in the middle. Workers called to a meeting sit round it (see
 * MEETING_SEATS and server/meetings.ts). The glass stops under the loft's floor; the door is in the
 * north wall, facing the lounge.
 */
export const MEETING_ROOM = { minX: LOFT.minX + 0.15, maxX: FLOOR.maxX, minZ: LOFT.minZ + 0.15, maxZ: FLOOR.maxZ, height: LOFT.y - 0.25, door: { x0: 10, x1: 11.4 } } as const;
export const MEETING_TABLE = { x: 13.7, z: 10.55, width: 3.6, depth: 1.2, height: 0.76 } as const;
/**
 * The chairs round the meeting table, in the order a meeting fills them: the head of the table at its
 * west end (whoever leads or writes the meeting up), then two down each side. (x, z) is where the
 * laptop sits on the table; the chair is out from it the way a desk's is (deskSeat).
 */
export const MEETING_SEATS: DeskDef[] = (
  [
    [MEETING_TABLE.x - MEETING_TABLE.width / 2 + 0.35, MEETING_TABLE.z, -Math.PI / 2],
    [MEETING_TABLE.x - 0.6, MEETING_TABLE.z - MEETING_TABLE.depth / 2 + 0.35, Math.PI],
    [MEETING_TABLE.x - 0.6, MEETING_TABLE.z + MEETING_TABLE.depth / 2 - 0.35, 0],
    [MEETING_TABLE.x + 1.1, MEETING_TABLE.z - MEETING_TABLE.depth / 2 + 0.35, Math.PI],
    [MEETING_TABLE.x + 1.1, MEETING_TABLE.z + MEETING_TABLE.depth / 2 - 0.35, 0],
  ] as const
).map(([x, z, rotY], i) => ({ id: `meeting-${i + 1}`, x, z, rotY, label: i === 0 ? 'Head of the table' : `Meeting chair ${i + 1}`, room: true }));
/** The board on the meeting room's back (south) wall that shows the meeting's output file as it's written. */
export const MEETING_BOARD = { x: MEETING_TABLE.x, y: 1.95, z: FLOOR.maxZ - 0.08, width: 3.6, height: 1.2 } as const;

/** Any place a worker can be by id: the seats (the back office's included), the board agents' kiosks and the meeting room's chairs. */
export const DESK_BY_ID = new Map([...SEATS, ...STATIONS, ...MEETING_SEATS].map((d) => [d.id, d]));

/**
 * The seat a new worker takes when nobody picks one: the first free desk (in the back office too, as
 * far as the floor is built out: `wing` rows), else the first free bean bag.
 */
export function nextFreeSeat(taken: (id: string) => boolean, wing = 0): DeskDef | undefined {
  return SEATS.find((d) => !taken(d.id) && deskBuilt(d, wing));
}

/**
 * The bean bags that are out: every one in use, and while every desk is taken (the back office's
 * too, built out `wing` rows), the next free one too, so there's always somewhere to hire the next worker.
 */
export function beanbagsOut(taken: (id: string) => boolean, wing = 0): Set<string> {
  const out = new Set(BEANBAGS.filter((b) => taken(b.id)).map((b) => b.id));
  if (builtDesks(wing).every((d) => taken(d.id))) {
    const spare = BEANBAGS.find((b) => !taken(b.id));
    if (spare) out.add(spare.id);
  }
  return out;
}

/**
 * The places nobody is at: every seat and board agent's kiosk with no worker there and nobody sent
 * home still packing up there (`packing`). Each shows that it's free, with a '+' over a seat and the
 * board agent waiting at a kiosk. It's worked out afresh from who's there rather than seat by seat as
 * workers come and go, so swapping one floor's workers for another's never leaves a place showing
 * free under someone (two floors can each have a Queue agent at the same kiosk).
 */
export function vacantSeats(workers: Iterable<{ deskId: string }>, packing: (id: string) => boolean = () => false): Set<string> {
  const taken = new Set<string>();
  for (const w of workers) taken.add(w.deskId);
  return new Set([...DESK_BY_ID.keys()].filter((id) => !taken.has(id) && !packing(id)));
}

/** Where the worker (and the interacting player) stands relative to the desk. */
export function deskSeat(desk: DeskDef, offset = 0.85): { x: number; z: number } {
  return {
    x: desk.x + Math.sin(desk.rotY) * offset,
    z: desk.z + Math.cos(desk.rotY) * offset,
  };
}

/** How big every wall board is (its thin frame a pane's width, 2:1 inside), and how high the middle of the row hangs. */
const BOARD_SIZE = { width: EAST_PANE - 0.2, height: (EAST_PANE - 0.2) / 2 } as const;
/** How far a board's frame, or the TV's bezel, stands out round its face. */
export const BOARD_FRAME = 0.04;
export const BOARD_ROW_Y = 2;
/** Wall boards. `rotY` is the way the board faces (0 = +z; the east wall's face -x, into the room). */
export const BOARDS = {
  // One row along the east wall, a pane each, from the north corner to the TV, the way work goes:
  // the issues, the task queue they go onto, the pull requests the workers make and the services
  // they run. The first three have an agent standing by in the back office (see STATIONS). All are
  // the same size (BOARD_SIZE), 2:1, which is what their faces are drawn for.
  issues: { x: FLOOR.maxX - 0.08, y: BOARD_ROW_Y, z: eastBay(0), rotY: -Math.PI / 2, ...BOARD_SIZE, label: 'Issues' },
  queue: { x: FLOOR.maxX - 0.08, y: BOARD_ROW_Y, z: eastBay(1), rotY: -Math.PI / 2, ...BOARD_SIZE, label: '📋 Task queue' },
  pulls: { x: FLOOR.maxX - 0.08, y: BOARD_ROW_Y, z: eastBay(2), rotY: -Math.PI / 2, ...BOARD_SIZE, label: 'Pull Requests' },
  services: { x: FLOOR.maxX - 0.08, y: BOARD_ROW_Y, z: eastBay(3), rotY: -Math.PI / 2, ...BOARD_SIZE, label: '🌐 Services' },
} as const;

/**
 * The big TV that shows whoever is screen sharing: on the east wall in the middle pane, at the end of
 * the boards' row and behind the Togo, facing the couch across the lounge. Its bezel is a board's size
 * (`width` × `height`); the 16:9 screen in it is `height` high, with black either side.
 */
export const TV = { x: FLOOR.maxX - 0.1, y: BOARD_ROW_Y, z: eastBay(4), ...BOARD_SIZE } as const;
/**
 * The monitor of how busy the office's machine is, and how many workers it runs of the most it takes:
 * on the east wall's glass in the pane south of the TV, at the end of the boards' row and as high as
 * they are, facing into the room. 23:13, what its screen is drawn for.
 */
export const MACHINE_MONITOR = { x: FLOOR.maxX, y: BOARD_ROW_Y, z: eastBay(5), width: (BOARD_SIZE.height * 23) / 13, height: BOARD_SIZE.height } as const;
/** The jukebox, a giant AirPod lying on the floor in the middle of the room, between the round table and the lounge, facing the table (-x). `width` runs along z; `y` is its speaker. */
export const JUKEBOX = { x: 3.4, y: 1, z: 0, width: 3.2, depth: 1.4, height: 1.4 } as const;
/** The arcade cabinet, against the east wall between the jukebox and the loft, facing into the room. `width` runs along the wall. */
export const CABINET = { x: FLOOR.maxX - 0.42, z: 7.05, width: 0.8, depth: 0.8, height: 1.9 } as const;

/**
 * The bookshelf of the project's docs (every Markdown file in it, see shared/docs.ts): a donut, a
 * low ring of shelf lying on the floor by the west wall's glass, north of the exit door (to its right,
 * seen from inside), clear of the ladder. You walk round it and pull the books out sideways. (x, z) is
 * its middle, `width` and `depth` across it (its diameter), `height` to its top; it faces the room (+x).
 */
export const BOOKSHELF = { x: FLOOR.minX + 1.65, z: 3.25, rotY: Math.PI / 2, width: 2.5, depth: 2.5, height: 0.8 } as const;
/** The floor it takes, back to the wall. */
export const BOOKSHELF_BOX = {
  minX: FLOOR.minX,
  maxX: BOOKSHELF.x + BOOKSHELF.depth / 2 + 0.03,
  minZ: BOOKSHELF.z - BOOKSHELF.width / 2 - 0.04,
  maxZ: BOOKSHELF.z + BOOKSHELF.width / 2 + 0.04,
} as const;

/**
 * The kitchen on the north wall, in the middle of its glass west of the elevator (from the west
 * corner to the elevator's shaft, 7.2 m from the middle), behind the round table, facing into the
 * room (world/kitchen.ts): one long run of chrome base units, handleless fronts flush with the
 * carcass, a sink, an E61 espresso machine and the bottles of a bar on the worktop. (x, z) is the
 * run's middle; `counter` is what it takes up, `sink` where the sink is along it, `machine` where the
 * machine stands (its sound comes from there), `bar` where the bottles stand, and `pour` where you
 * stand to get a coffee.
 */
const KITCHEN_X = (FLOOR.minX + 7.2) / 2;
export const KITCHEN = {
  x: KITCHEN_X,
  z: FLOOR.minZ + 0.675,
  rotY: 0,
  counter: { minX: KITCHEN_X - 3.85, maxX: KITCHEN_X + 3.85, minZ: FLOOR.minZ + 0.3, maxZ: FLOOR.minZ + 1.05, top: 0.92 },
  sink: { x: KITCHEN_X - 1.9 },
  machine: { x: KITCHEN_X + 1.6, z: FLOOR.minZ + 0.64 },
  bar: { x: KITCHEN_X + 3.05, z: FLOOR.minZ + 0.64 },
  pour: { x: KITCHEN_X + 1.6, z: FLOOR.minZ + 1.95 },
} as const;

export const SPAWN = { x: 8, z: 7 } as const;

/** The gong's size, and where the office's stood (it has none now: see world/gong.ts, which a map's gong is built by). */
export const GONG = { x: 11.8, z: FLOOR.minZ + 0.75, width: 1.9, height: 2.45 } as const;

/** Potted plants around the room: where each stands, and how big it is. None: add `[x, z, scale]` to put one back. */
export const PLANTS: readonly (readonly [x: number, z: number, scale: number])[] = [];

/** A plant by the north wall east of the gong, in the way into the back office: put away once it's built. */
export function plantByWing([x, z]: readonly [number, number, number]): boolean {
  return x > WING.minX && z < FLOOR.minZ + 1.5;
}

/** The plants standing on a floor built out `level` rows (see WING). */
export function plantsAt(level: number): readonly (readonly [x: number, z: number, scale: number])[] {
  return level > 0 ? PLANTS.filter((p) => !plantByWing(p)) : PLANTS;
}

/**
 * The whiteboard on wheels everyone draws on together, out on the open floor between the desks and
 * the lounge, facing into the room (+z), as world/whiteboard.ts builds it. The office has none out
 * now: the drawing's in the ☰ menu. `width` and `height` are its writing surface, whose bottom
 * edge is `bottom` above the floor.
 */
export const WHITEBOARD = { x: 5.4, z: -5.4, width: 4, height: 2.2, bottom: 0.5 } as const;

/**
 * The bottom floor of the building is its second storey: the street, and the open garage under the
 * office, are this far below its floor. Each floor stands one STOREY higher than the one below it,
 * so from floor `i` the street is `streetBelow(i)` down.
 */
export const STREET_Y = -3.6;
/** The street runs east–west in front of the building (south, +z), with a sidewalk along either side. */
export const ROAD = { minZ: 23, maxZ: 31 } as const;
/** The office's floor slab, which is the garage's ceiling: it runs from -SLAB up to 0. */
export const SLAB = 0.3;
/** From one floor of the building up to the next: the office's ceiling, and the slab over it. */
export const STOREY = WALL_HEIGHT + SLAB;
/** How thick the outside walls are. They stand just outside FLOOR. */
export const WALL_T = 0.3;

/** How far below floor `index` of the building (0 is the bottom one) the street is. */
export function streetBelow(index: number): number {
  return STREET_Y - Math.max(0, index) * STOREY;
}

export type Side = 'north' | 'south' | 'east' | 'west';

/**
 * A hole in an outside wall: `u` is its center along the wall (x on the north and south walls, z on
 * the east and west ones), `y0`..`y1` its sill and head above the office floor.
 */
export interface Opening {
  wall: Side;
  u: number;
  width: number;
  y0: number;
  y1: number;
  /** Where the wall's middle is (x for an east or west wall, z for a north or south one), when it isn't the building's own outside wall on that side: the back office's. */
  plane?: number;
}

/** Glass doors out to the balcony, on the south wall. They slide apart into the wall on either side. */
export const BALCONY_DOOR: Opening = { wall: 'south', u: -4, width: 3, y0: 0, y1: 2.5 };

/**
 * A wall's holes by the column of wall each is in, west to east (or north to south): `u0`..`u1`
 * along the wall, and the openings stacked in it bottom to top (a door with a pane over it, say).
 * Openings in one column span it exactly; the wall between them is solid.
 */
export function wallColumns(holes: readonly Opening[]): { u0: number; u1: number; stack: Opening[] }[] {
  const cols: { u0: number; u1: number; stack: Opening[] }[] = [];
  for (const o of [...holes].sort((a, b) => a.u - b.u || a.y0 - b.y0)) {
    const u0 = o.u - o.width / 2;
    const u1 = o.u + o.width / 2;
    const last = cols[cols.length - 1];
    if (last && Math.abs(last.u0 - u0) < 1e-6 && Math.abs(last.u1 - u1) < 1e-6) last.stack.push(o);
    else cols.push({ u0, u1, stack: [o] });
  }
  return cols;
}

/**
 * The way out of the bottom floor: a door in the west wall onto a landing, with stairs down to the
 * street. The floors above have no door there; workers leave them off the balcony (see PARACHUTE).
 */
export const EXIT_DOOR: Opening = { wall: 'west', u: 6.5, width: 1.4, y0: 0, y1: 2.4 };
export const EXIT_STAIRS = {
  maxX: FLOOR.minX - WALL_T,
  minX: FLOOR.minX - WALL_T - 1.6,
  /** The landing outside the door, level with the office floor. */
  landingZ0: 5.6,
  landingZ1: 7.5,
  /** The steps run south from the landing down to the street. */
  steps: 15,
  run: 0.34,
} as const;

/** The smoking balcony, hanging over the garage entrance. */
export const BALCONY = { minX: -10.5, maxX: 2.5, minZ: FLOOR.maxZ + WALL_T, maxZ: FLOOR.maxZ + WALL_T + 3.4 } as const;
/** The ashtray on the balcony, where a smoke break starts. */
export const ASHTRAY = { x: -8.2, z: BALCONY.maxZ - 0.55 } as const;
/**
 * The golf tee on the balcony, between the ashtray and the doors: a square of turf `size` across,
 * with the ball teed up at `ball`, hit out over the railing at the hole across the street
 * (GOLF_HOLE). The golf bag leans on the wall behind it at `bag`, just short of the doors.
 */
export const GOLF_TEE = { x: -6.75, z: 14.75, size: 1.5, ball: { x: -6.95, z: 14.75 }, bag: { x: -5.8, z: BALCONY.minZ + 0.28 } } as const;
/**
 * The hole across the street, out past the far sidewalk where the neighbours leave a gap: its pin,
 * the green round it (`green` its radius) and the fairway leading up to it (x `fairway` wide, from
 * the sidewalk to the green). Down on the street, so it's further down the higher your floor is.
 */
export const GOLF_HOLE = { x: -5, z: 58, green: 5.5, fairway: [-11, 0] } as const;
/**
 * Leaving a floor above the bottom one, with no exit door: out through the balcony doors to the
 * railing straight ahead (`jump`), up onto its top (`railTop` high), and over it by parachute. The
 * chute circles down onto the lot in front of the garage: `out` further from the building than it
 * opened, and `east` (a random bit of it) along, clear of the balconies below and the street lamp by
 * the balcony doors.
 */
export const PARACHUTE = { jump: { x: BALCONY_DOOR.u, z: BALCONY.maxZ - 0.45 }, railTop: 1.09, out: 1.2, east: [0.6, 1.8] } as const;

// ---- The rooftop bar (see shared/rooftop.ts) ------------------------------------------------------
// The roof of the building, level with the office floor's y = 0 and the same size, so the elevator
// comes up in its usual spot. A glass railing runs round the edge, and the city is far below.

/**
 * How far below the roof the street is, with `floors` floors under it: the building is this tall.
 * The roof stands a STOREY over the top floor, where a floor above it would be.
 */
export function roofDrop(floors: number): number {
  return -streetBelow(Math.max(1, floors));
}
/** The DJ's stage, against the north edge west of the elevator, with the dance floor in front of it. */
export const STAGE = { minX: -8, maxX: 2, minZ: FLOOR.minZ, maxZ: -9.2, height: 0.6 } as const;
/** Where the DJ stands behind the decks, facing the dance floor (+z). */
export const DJ_BOOTH = { x: -3, z: -11.3 } as const;
/** LED tiles, a meter each, lighting up with the music. */
export const DANCE_FLOOR = { minX: -8, maxX: 2, minZ: -9.2, maxZ: -2.2 } as const;
/** The bar along the east side: its counter (x is its middle), with the bartender and the bottles behind it. */
export const ROOF_BAR = { x: 12.95, minZ: -6, maxZ: 4, depth: 0.7, height: 1.1 } as const;
/** The fire pit in the lounge, in the south-west corner, with sofas round three sides of it. */
export const FIRE_PIT = { x: -12, z: 8.2, r: 0.9 } as const;
/** Tall tables to stand at, between the elevator and the bar. */
export const ROOF_TABLES: readonly { x: number; z: number }[] = [
  { x: 6.6, z: 5.2 },
  { x: 9.6, z: 8.8 },
  { x: 6, z: 10.8 },
];
/** Sun loungers along the south edge, looking out over the street. */
const LOUNGERS = [-2.2, 0.6, 3.4];

/**
 * Something to sit on, standing at x, z on the floor at `y` (the loft's, for what's up there). You
 * sit facing `rotY` (0 = +z). A couch or a bench has a few places side by side; a chair, a stool or a beanbag has one.
 */
export interface SeatDef {
  id: string;
  /** What the hint calls it. */
  label: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  /** Where each place is along it, sideways from its middle. */
  places: readonly number[];
  /** How high above its floor your hips go: on the cushion, sunk in a little. */
  hips: number;
  /** How far in front of its middle you sit (negative: further back, against the backrest). */
  depth: number;
  /** Getting up, you step off this far in front of where you sat (negative: behind, away from a desk or a table). */
  out: number;
  /** It faces the lounge TV: sitting down there puts whatever's being shared up on your screen. */
  tv?: boolean;
  /** It faces the boss's monitor: E there, sitting down, plays Minesweeper on it. */
  game?: boolean;
  /** Up on the rooftop bar, not in the office. */
  roof?: boolean;
  /** At the bar: E there, sitting down, orders a drink. */
  bar?: boolean;
}

/**
 * Where people can sit: the office's couches, beanbags, chairs and the balcony bench (buildOffice puts
 * them there). Workers have their own seats, the desks and bean bags in SEATS.
 */
export const SEATING: SeatDef[] = [
  // The lounge couch, its back to the room, facing east across the lounge.
  { id: 'couch', label: '🛋️ Couch', x: LOUNGE.x - 2.9, y: 0, z: LOUNGE.z, rotY: Math.PI / 2, places: [-1.2, 0, 1.2], hips: 0.5, depth: -0.05, out: 0.9, tv: true },
  // Beanbags either side of the lounge, turned to the TV.
  { id: 'lounge-beanbag-1', label: '🫘 Beanbag', x: LOUNGE.x - 0.9, y: 0, z: LOUNGE.z + 3.5, rotY: Math.atan2(TV.x - (LOUNGE.x - 0.9), TV.z - (LOUNGE.z + 3.5)), places: [0], hips: 0.42, depth: -0.1, out: 1.2 },
  { id: 'lounge-beanbag-2', label: '🫘 Beanbag', x: LOUNGE.x + 1.1, y: 0, z: LOUNGE.z - 3.4, rotY: Math.atan2(TV.x - (LOUNGE.x + 1.1), TV.z - (LOUNGE.z - 3.4)), places: [0], hips: 0.42, depth: -0.1, out: 1.2 },
  // Up in the boss office: the couch against the east wall, and the chair at the big desk, facing the glass.
  { id: 'loft-couch', label: '🛋️ Couch', x: LOFT.maxX - 0.65, y: LOFT.y, z: (LOFT.minZ + LOFT.maxZ) / 2, rotY: -Math.PI / 2, places: [-0.5, 0.5], hips: 0.5, depth: -0.05, out: 0.9 },
  { id: 'boss-chair', label: "🪑 Boss's chair", x: (LOFT.minX + LOFT.maxX) / 2 + 0.5, y: LOFT.y, z: (LOFT.minZ + LOFT.maxZ) / 2 + 0.7, rotY: Math.PI, places: [0], hips: 0.62, depth: -0.05, out: -0.8, game: true },
  // Out on the balcony: the bench under the window, looking out over the street, and a stool either side of the bistro table.
  { id: 'bench', label: '🪑 Bench', x: -9, y: 0, z: BALCONY.minZ + 0.3, rotY: 0, places: [-0.5, 0.5], hips: 0.47, depth: 0, out: 0.8 },
  { id: 'stool-1', label: '🪑 Stool', x: -0.6, y: 0, z: (BALCONY.minZ + BALCONY.maxZ) / 2 + 0.2, rotY: Math.PI / 2, places: [0], hips: 0.5, depth: 0, out: -0.7 },
  { id: 'stool-2', label: '🪑 Stool', x: 1, y: 0, z: (BALCONY.minZ + BALCONY.maxZ) / 2 + 0.2, rotY: -Math.PI / 2, places: [0], hips: 0.5, depth: 0, out: -0.7 },
  // On the roof: bar stools along the counter, facing the bar…
  ...[0, 1, 2, 3, 4, 5].map((i) => ({ id: `roof-stool-${i + 1}`, label: '🪑 Bar stool', x: ROOF_BAR.x - ROOF_BAR.depth / 2 - 0.45, y: 0, z: ROOF_BAR.minZ + 0.9 + i * 1.64, rotY: Math.PI / 2, places: [0], hips: 0.78, depth: 0, out: -0.75, roof: true, bar: true })),
  // …sofas round the fire pit, open to the view on the south…
  { id: 'roof-sofa-1', label: '🛋️ Sofa', x: FIRE_PIT.x, y: 0, z: FIRE_PIT.z - 2.3, rotY: 0, places: [-1.1, 0, 1.1], hips: 0.5, depth: -0.05, out: 0.8, roof: true },
  { id: 'roof-sofa-2', label: '🛋️ Sofa', x: FIRE_PIT.x - 2.9, y: 0, z: FIRE_PIT.z + 0.4, rotY: Math.PI / 2, places: [-0.6, 0.6], hips: 0.5, depth: -0.05, out: 0.8, roof: true },
  { id: 'roof-sofa-3', label: '🛋️ Sofa', x: FIRE_PIT.x + 2.9, y: 0, z: FIRE_PIT.z + 0.4, rotY: -Math.PI / 2, places: [-0.6, 0.6], hips: 0.5, depth: -0.05, out: 0.8, roof: true },
  // …and sun loungers facing out over the city.
  ...LOUNGERS.map((x, i) => ({ id: `roof-lounger-${i + 1}`, label: '🏖️ Lounger', x, y: 0, z: FLOOR.maxZ - 1.5, rotY: 0, places: [0], hips: 0.42, depth: -0.2, out: -1, roof: true })),
];
export const SEATING_BY_ID = new Map(SEATING.map((s) => [s.id, s]));

/** One place on a seat: where your feet go on its floor, the way you face, and the rest of what sitting there takes. */
export interface SeatPlace {
  /** What a peer's `seat` says while they sit here: the seat's id and which place, like "couch:1". */
  key: string;
  seatId: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  hips: number;
  out: number;
}

export function seatPlace(seat: SeatDef, i: number): SeatPlace {
  const fx = Math.sin(seat.rotY);
  const fz = Math.cos(seat.rotY);
  const along = seat.places[i] ?? 0;
  return {
    key: `${seat.id}:${i}`,
    seatId: seat.id,
    x: seat.x + fx * seat.depth + fz * along,
    y: seat.y,
    z: seat.z + fz * seat.depth - fx * along,
    rotY: seat.rotY,
    hips: seat.hips,
    out: seat.out,
  };
}

/** The place a peer's `seat` names, or undefined if there's no such place. */
export function seatAt(key: string): SeatPlace | undefined {
  const m = /^([\w-]+):(\d+)$/.exec(key);
  const seat = m ? SEATING_BY_ID.get(m[1]) : undefined;
  const i = Number(m?.[2]);
  return seat && i < seat.places.length ? seatPlace(seat, i) : undefined;
}

/** The place `key` names, if it's somewhere you can sit from where you are: up on the roof, or down on a floor. */
export function seatHere(key: string, onRoof: boolean): SeatPlace | undefined {
  const place = seatAt(key);
  return place && !!SEATING_BY_ID.get(place.seatId)!.roof === onRoof ? place : undefined;
}

/**
 * The elevator: a shaft against the north wall, between the PR board and the gong, with its
 * doors facing into the room. Every floor has it in the same spot, so you step out where you got in.
 */
export const ELEVATOR = { x: 8.5, width: 2.6, depth: 2.4, wall: 0.14, doorWidth: 1.4, doorHeight: 2.4 } as const;
/** Where the doors are: the front of the shaft. */
export const ELEVATOR_FRONT = FLOOR.minZ + ELEVATOR.depth;
/** The inside of the car, where you stand to ride. */
export const ELEVATOR_CAR = {
  minX: ELEVATOR.x - ELEVATOR.width / 2 + ELEVATOR.wall,
  maxX: ELEVATOR.x + ELEVATOR.width / 2 - ELEVATOR.wall,
  minZ: FLOOR.minZ,
  maxZ: ELEVATOR_FRONT - ELEVATOR.wall,
} as const;

/** Somewhere inside the car, facing the doors (+z), a little apart from anyone else arriving. */
export function elevatorSpot(): { x: number; z: number } {
  return {
    x: ELEVATOR.x + (Math.random() - 0.5) * 0.7,
    z: (ELEVATOR_CAR.minZ + ELEVATOR_CAR.maxZ) / 2 + (Math.random() - 0.5) * 0.6,
  };
}

export function inElevator(x: number, z: number): boolean {
  return x > ELEVATOR_CAR.minX && x < ELEVATOR_CAR.maxX && z > ELEVATOR_CAR.minZ && z < ELEVATOR_CAR.maxZ;
}

/**
 * The ladder to the floors above and below: against the west wall at `z`, up through a hatch in the
 * ceiling and down through one in the floor (every floor has it in the same spot, one long shaft).
 * You climb it at `x`, facing the wall; `hatch` is the hole in the floor and the ceiling.
 */
export const LADDER = {
  z: 0,
  width: 0.62,
  x: FLOOR.minX + 0.62,
  hatch: { minX: FLOOR.minX, maxX: FLOOR.minX + 1, minZ: -0.5, maxZ: 0.5 },
  /** How far in from the wall the trapdoor starts: the ladder goes through a slot along the wall. */
  slot: 0.24,
} as const;

/** Where a fire pole can be. `open` is the way into its hole, where its railing has a gap (0 = +z, like rotY). */
export interface PoleSpot {
  x: number;
  z: number;
  open: number;
}

/**
 * The fire pole, slid down to the floor below. It goes the whole way down the building, through a hole
 * in every floor but the bottom one (where there's a mat to land on): it takes you down one floor, and
 * on a floor with another below you swing off it through the railing, ready to go again.
 */
export const POLES: readonly PoleSpot[] = [
  // Out in the open between the desks and the lounge, where you step out of the elevator.
  { x: 6.8, z: 1.6, open: Math.PI },
];
/** A pole's hole in the floor, the railing round it, and how far from the pole you hang on. */
export const POLE = { hole: 0.68, rail: 0.9, grip: 0.4, radius: 0.055 } as const;

/**
 * Every outside wall is a glass front: floor-to-ceiling panes about `bay` wide, from a low kerb (`foot`)
 * to just under the ceiling (`head`), and a pane over each door. The wall stays solid only behind what
 * hangs on it or stands against it all the way up (`margin` either side of it), and wherever the gap
 * left between two such is narrower than `minPane`.
 */
export const GLASS_FRONT = { bay: 3, foot: 0.12, head: WALL_HEIGHT - 0.3, margin: 0.15, minPane: 0.6 } as const;

/** Panes along `wall` from `u0` to `u1`, round the `solid` stretches, each as near `GLASS_FRONT.bay` wide as fit evenly. */
export function glassFront(wall: Side, u0: number, u1: number, solid: readonly (readonly [number, number])[]): Opening[] {
  const panes: Opening[] = [];
  const glaze = (a: number, b: number) => {
    if (b - a < GLASS_FRONT.minPane) return;
    const n = Math.max(1, Math.round((b - a) / GLASS_FRONT.bay));
    const w = (b - a) / n;
    for (let i = 0; i < n; i++) panes.push({ wall, u: a + w * (i + 0.5), width: w, y0: GLASS_FRONT.foot, y1: GLASS_FRONT.head });
  };
  let u = u0;
  for (const [a, b] of [...solid].sort((p, q) => p[0] - q[0])) {
    glaze(u, a);
    u = Math.max(u, b);
  }
  glaze(u, u1);
  return panes;
}

/** The stretch of wall `size` wide round `u`, and the margin either side of it. */
const behind = (u: number, size: number) => [u - size / 2 - GLASS_FRONT.margin, u + size / 2 + GLASS_FRONT.margin] as const;
/** The whole of a door's column: its hole, with the pane over it (see WINDOWS). */
const doorway = (o: Opening) => [o.u - o.width / 2, o.u + o.width / 2] as const;
/** A pane over a door, filling its column up to the glass front's head. */
const transom = (o: Opening): Opening => ({ wall: o.wall, u: o.u, width: o.width, y0: o.y1 + 0.1, y1: GLASS_FRONT.head });

/**
 * Windows you can see out of: glass fronts all round. The north one is solid only behind the elevator
 * (and east of WING.minX, the back office's, see buildWing), with the kitchen and the machine's monitor
 * in front of it; the east is all glass, in EAST_PANE-wide panes the boards and the TV hang in front
 * of, and the west's only break is the exit door.
 */
export const WINDOWS: Opening[] = [
  ...glassFront('north', FLOOR.minX, WING.minX, [[ELEVATOR.x - ELEVATOR.width / 2, ELEVATOR.x + ELEVATOR.width / 2]]),
  ...glassFront('south', FLOOR.minX, FLOOR.maxX, [doorway(BALCONY_DOOR)]),
  transom(BALCONY_DOOR),
  ...glassFront('east', FLOOR.minZ, FLOOR.maxZ, []), // EAST_PANE wide: see there
  ...glassFront('west', FLOOR.minZ, FLOOR.maxZ, [doorway(EXIT_DOOR)]),
  transom(EXIT_DOOR),
];
