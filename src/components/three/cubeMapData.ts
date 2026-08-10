export const CUBE_MAP_STEPS = 6;
export const CUBE_MAP_UNIT = 12;

export type CubeMapNodePosition = {
  x: number;
  y: number;
  z: number;
};

export type CubeMapPersona = {
  id: number;
  name: string;
  color: string;
  nodes: CubeMapNodePosition[];
};

export type CubeMapOverviewNode = CubeMapNodePosition & {
  key: string;
  personaIds: number[];
  names: string[];
  colors: string[];
  count: number;
};

export type CubeMapOverview = {
  nodes: CubeMapOverviewNode[];
  maxCount: number;
};

export const CUBE_MAP_PERSONAS: CubeMapPersona[] = [
  {
    id: 0,
    name: "김민지",
    color: "#4F73E3",
    nodes: [
      { x: 2, y: 4, z: 0 },
      { x: 2, y: 4, z: 2 },
      { x: 3, y: 4, z: 2 },
      { x: 4, y: 4, z: 2 },
      { x: 0, y: 4, z: 3 },
    ],
  },
  {
    id: 1,
    name: "박준호",
    color: "#E8534A",
    nodes: [
      { x: 5, y: 3, z: 4 },
      { x: 4, y: 3, z: 4 },
      { x: 5, y: 2, z: 0 },
      { x: 4, y: 2, z: 0 },
      { x: 5, y: 3, z: 0 },
    ],
  },
  {
    id: 2,
    name: "이수진",
    color: "#F09530",
    nodes: [
      { x: 1, y: 0, z: 5 },
      { x: 2, y: 0, z: 5 },
      { x: 3, y: 0, z: 5 },
      { x: 1, y: 1, z: 5 },
      { x: 2, y: 1, z: 5 },
    ],
  },
  {
    id: 3,
    name: "최동욱",
    color: "#3BAF7C",
    nodes: [
      { x: 0, y: 4, z: 3 },
      { x: 1, y: 4, z: 3 },
      { x: 0, y: 3, z: 3 },
      { x: 1, y: 3, z: 3 },
      { x: 2, y: 4, z: 3 },
    ],
  },
  {
    id: 4,
    name: "정미영",
    color: "#8B67D8",
    nodes: [
      { x: 1, y: 1, z: 0 },
      { x: 2, y: 1, z: 0 },
      { x: 1, y: 1, z: 1 },
      { x: 2, y: 1, z: 1 },
      { x: 2, y: 2, z: 0 },
    ],
  },
  {
    id: 5,
    name: "한승민",
    color: "#1ABBC8",
    nodes: [
      { x: 5, y: 2, z: 0 },
      { x: 4, y: 2, z: 0 },
      { x: 5, y: 2, z: 1 },
      { x: 4, y: 2, z: 1 },
      { x: 5, y: 3, z: 4 },
    ],
  },
  {
    id: 6,
    name: "오재원",
    color: "#E0673D",
    nodes: [
      { x: 2, y: 4, z: 2 },
      { x: 1, y: 5, z: 2 },
      { x: 2, y: 5, z: 3 },
      { x: 1, y: 5, z: 3 },
      { x: 0, y: 5, z: 3 },
    ],
  },
  {
    id: 7,
    name: "류나영",
    color: "#5585A4",
    nodes: [
      { x: 5, y: 3, z: 4 },
      { x: 4, y: 3, z: 4 },
      { x: 5, y: 4, z: 4 },
      { x: 4, y: 4, z: 4 },
      { x: 5, y: 4, z: 3 },
    ],
  },
  {
    id: 8,
    name: "신혜린",
    color: "#D95884",
    nodes: [
      { x: 0, y: 4, z: 3 },
      { x: 1, y: 4, z: 3 },
      { x: 0, y: 5, z: 3 },
      { x: 1, y: 5, z: 3 },
      { x: 0, y: 4, z: 2 },
    ],
  },
  {
    id: 9,
    name: "김현우",
    color: "#9B7848",
    nodes: [
      { x: 1, y: 1, z: 5 },
      { x: 2, y: 1, z: 5 },
      { x: 3, y: 1, z: 5 },
      { x: 1, y: 2, z: 5 },
      { x: 2, y: 2, z: 4 },
    ],
  },
];

export function buildCubeMapOverview(
  personas: CubeMapPersona[] = CUBE_MAP_PERSONAS,
): CubeMapOverview {
  const map = new Map<
    string,
    CubeMapNodePosition & {
      key: string;
      personaIds: Set<number>;
      names: string[];
      colors: string[];
    }
  >();

  personas.forEach((persona) => {
    persona.nodes.forEach((node) => {
      const key = `${node.x},${node.y},${node.z}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          ...node,
          personaIds: new Set<number>(),
          names: [],
          colors: [],
        });
      }

      const entry = map.get(key);

      if (entry && !entry.personaIds.has(persona.id)) {
        entry.personaIds.add(persona.id);
        entry.names.push(persona.name);
        entry.colors.push(persona.color);
      }
    });
  });

  const nodes = [...map.values()].map<CubeMapOverviewNode>((entry) => ({
    ...entry,
    count: entry.personaIds.size,
    personaIds: [...entry.personaIds],
  }));

  nodes.sort((a, b) => b.count - a.count || a.x - b.x || a.y - b.y || a.z - b.z);

  return {
    nodes,
    maxCount: Math.max(...nodes.map((node) => node.count), 1),
  };
}
