// Mechanics shown to the player (intro cards and level badges).

export const MECHANICS = {
  locked: {
    name: 'Locked notes',
    short: 'Locked',
    text: 'Some notes are anchored to the sky. Arrange the others around them.',
  },
  void: {
    name: 'Empty sky',
    short: 'Shaped',
    text: 'Dark gaps are not part of the board. The melody flows around them.',
  },
  double: {
    name: 'Double notes',
    short: 'Double',
    text: 'One cell, two notes. They always play left, then right.',
  },
  chain: {
    name: 'Chains',
    short: 'Chain',
    text: 'Linked notes travel together. Move one and its partner follows.',
  },
  rest: {
    name: 'Silence',
    short: 'Silence',
    text: 'A rest is a note of silence. Place the pauses where the melody breathes.',
  },
  echo: {
    name: 'Echo',
    short: 'Echo',
    text: 'A note resting on an echo ring sings twice.',
  },
  reverse: {
    name: 'Reverse',
    short: 'Reverse',
    text: 'This sky is read backwards: bottom to top, right to left.',
  },
  mirror: {
    name: 'Mirror',
    short: 'Mirror',
    text: 'Every row is read right to left, from top to bottom.',
  },
  portal: {
    name: 'Portals',
    short: 'Portal',
    text: 'Drop a note into a portal and it appears in its twin.',
  },
  rotor: {
    name: 'Rotation',
    short: 'Rotate',
    text: 'Tap a turning note to rotate it. Only the face on top sings.',
  },
};

export function mechanicsOf(L) {
  const m = [];
  if (L.read === 'reverse') m.push('reverse');
  if (L.read === 'mirror') m.push('mirror');
  if (L.tiles.some((t) => t.locked)) m.push('locked');
  if (L.tiles.some((t) => t.kind === 'double')) m.push('double');
  if (L.tiles.some((t) => t.chain >= 0)) m.push('chain');
  if (L.tiles.some((t) => t.kind === 'rest')) m.push('rest');
  if (L.cells.some((c) => c.echo)) m.push('echo');
  if (L.cells.some((c) => c.portal >= 0)) m.push('portal');
  if (L.tiles.some((t) => t.kind === 'rotor')) m.push('rotor');
  return m;
}
