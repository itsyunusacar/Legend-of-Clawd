// Legend of Claude — pixel art. Each sprite is a list of rows, one character per
// pixel; '.' is transparent. Player frames share their left edge and feet, so they
// swap without jitter. Drawn facing right; mirrored around BODY_W for facing left.

export const BODY_W = 16

export const PALETTE = {
  O: 0xd97757, A: 0xe8916e, D: 0xb35a3e, K: 0x1e1412, // Clawd
  H: 0x3fa34d, h: 0x27783a, L: 0x74cc5c, // hat, bushes
  Y: 0xf2c230, y: 0xbf8a1a, // hat band
  S: 0xe6ebf2, s: 0x96a2b4, W: 0xffffff, // blade, eyes
  G: 0x3a5fd6, g: 0x1f2f80, // hilt
  B: 0x2f5bd3, b: 0x1c3384, R: 0xd83a2a, T: 0xf7d23e, M: 0xc3cad6, m: 0x7c8696, // shield
  c: 0x8fd0ff, C: 0xe6f6ff, // sword arc
  X: 0x9b3fc4, x: 0x5e2580, // bugs
  P: 0x5fd8c8, p: 0x2f9a90, // slime
  F: 0xfff07a, w: 0x7cc8ff, // fairy
  E: 0x3ee08a, e: 0xc4ffe0, f: 0x1f9a55, // rupee
  r: 0x4a4a56, // empty heart
  n: 0x8b5a2b, N: 0x6b4423, // wood
}

const IDLE = [
  '.......hHHL...W.',
  '.....hhHHHHL..Ss',
  '...hhHHHHHHHL.Ss',
  '.hhhHHHHHHHHHLSs',
  'hh.yYYYYYYYYY.Ss',
  '...OOOKOOOKOO.Ss',
  '.MMMOOKOOOKOOGGG',
  'MBTBMOOOOOOOOOg.',
  'MBBBMOOOOOOOO.G.',
  'MRRRMOOOOOOOO...',
  '.MRmD.D..D.D....',
  '..m.D.D..D.D....',
]

const WALK_B = [
  ...IDLE.slice(0, 10),
  '.MRmD.D..D.D....',
  '..mD.D..D.D.....',
]

const WALK_C = [
  '................',
  ...IDLE.slice(0, 10),
  '.MRmDD.D.DD.....',
]

const JUMP = [
  ...IDLE.slice(0, 10),
  '.MRmDD....DD....',
  '..m.............',
]

const SLASH = [
  '.......hHHL.......cc....',
  '.....hhHHHHL........cc..',
  '...hhHHHHHHHL.........c.',
  '.hhhHHHHHHHHHL.........c',
  'hh.yYYYYYYYYY..........c',
  '...OOOKOOOKOO.........c.',
  '.MMMOOKOOOKOO..G.....Cc.',
  'MBTBMOOOOOOOOOgGSSSSSW..',
  'MBBBMOOOOOOOO..Gsssss...',
  'MRRRMOOOOOOOO...........',
  '.MRmD.D..D.D............',
  '..m..D.D..D.D...........',
]

const GUARD = [
  '.......hHHL.....',
  '.....hhHHHHL....',
  '...hhHHHHHHHL...',
  '.hhhHHHHHHHHHL..',
  'hh.yYYYYYYYYY...',
  '...OOOKOOOKOMMM.',
  'Ss.OOOKOOOKMBTBM',
  '.SgOOOOOOOOMBBBM',
  '..GOOOOOOOOMRRRM',
  '...OOOOOOOO.MRm.',
  '....D.D..D.D.m..',
  '....D.D..D.D....',
]

const HURT = [
  '................',
  '......hHHL......',
  '....hhHHHHL.....',
  '..hhHHHHHHHL....',
  'hhhHHHHHHHHHL...',
  'h..yYYYYYYYYY...',
  '...OOOOOOOOOO...',
  '.MMMOOKKOKKOO...',
  'MBTBMOOOOOOOOO..',
  'MBBBMOOOOOOOOgGS',
  'MRRRMOOOOOOOO..s',
  '.MRmD.D..D.D....',
]

// Facing the camera, both arms up: the treasure goes above the head
const HOLD_UP = [
  '.O............O.',
  '.O.....hHL....O.',
  '.O....hHHHL...O.',
  '.O...hHHHHHL..O.',
  '.O..hHHHHHHHL.O.',
  '.OOyYYYYYYYYYOO.',
  '...OOKOOOOKOO...',
  '...OOKOOOOKOO...',
  '...OOOOOOOOOO...',
  '...OOOOOOOOOO...',
  '....D.D..D.D....',
  '....D.D..D.D....',
]

export const FRAMES = {
  idle: IDLE,
  walk: [IDLE, WALK_B, IDLE, WALK_C],
  jump: JUMP,
  slash: SLASH,
  guard: GUARD,
  hurt: HURT,
  holdUp: HOLD_UP,
}

// ---- Enemies ----
export const BUG = [
  '.x....x.',
  '..x..x..',
  '.XXXXXX.',
  'XXWXXWXX',
  'XxXXXXxX',
  'XXXXXXXX',
  '.x.xx.x.',
  'x..x.x.x',
]

export const BAT_UP = [
  'X.......X',
  'XX.....XX',
  '.XXXXXXX.',
  '..XWXWX..',
  '...XXX...',
]

export const BAT_DOWN = [
  '.........',
  '...XXX...',
  'XXXWXWXXX',
  'XX.XXX.XX',
  'X.......X',
]

export const SLIME = [
  '..PPPP..',
  '.PPPPPP.',
  'PPWPPWPP',
  'PPKPPKPP',
  'PPPPPPPP',
  'pPPPPPPp',
]

export const SLIME_SMALL = ['.PPP.', 'PWPWP', 'PPPPP', 'pPPPp']

// The Bug King, facing left: crown, mandibles, too many legs
export const KING = [
  '.......T.T.T......',
  '.......TTTTT......',
  '.....XXXXXXXXX....',
  '...XXXXXXXXXXXXX..',
  '..XWWXXXXXXXWWXXX.',
  'MmXWKXXXXXXXWKXXXx',
  '.MXXXXXXXXXXXXXXXx',
  'MmXxXXXXXXXXXXXxXX',
  '..XXXxXXXXXXXxXXXX',
  '..XXXXXXXXXXXXXXXX',
  '...XXXXXXXXXXXXXX.',
  '...x..x..xx..x..x.',
  '..x..x..x..x..x..x',
  '.x..x...x..x...x..',
]

// ---- Things ----
export const FAIRY = ['w...w', 'ww.ww', '.wFw.', '..F..']
export const HEART = ['.R.R.', 'RRRRR', '.RRR.', '..R..']
export const HEART_EMPTY = ['.r.r.', 'rrrrr', '.rrr.', '..r..']
export const RUPEE = ['.e.', 'eEf', 'EEf', 'Eff', '.f.']

export const BUSH = [
  '..LLHH..',
  '.LHHHHh.',
  'LHHLHHHh',
  'HHHHHHhh',
  'hHHHHHhh',
  '.hhhhhh.',
]

export const SIGN = [
  'nnnnnnn',
  'nNNNNNn',
  'nnnnnnn',
  '...N...',
  '...N...',
]

// The golden triangle: light on each run's left edge, shade on its right
export const TRIFORCE = [
  '.......T.......',
  '......YTt......',
  '.....YTTTt.....',
  '....YTTTTTt....',
  '...T.......T...',
  '..YTt.....YTt..',
  '.YTTTt...YTTTt.',
  'YTTTTTt.YTTTTTt',
]
export const TRIFORCE_COLORS = { T: 0xf7d23e, Y: 0xfff6b0, t: 0xc4901a }

// Claude's spark, as a pixel asterisk
export const SPARK = [
  '....O....',
  '.O..O..O.',
  '..O.O.O..',
  '...AOA...',
  'OOOOWOOOO',
  '...AOA...',
  '..O.O.O..',
  '.O..O..O.',
  '....O....',
]
