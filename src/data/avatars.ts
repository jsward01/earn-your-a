export interface PresetAvatar {
  id: string;
  label: string;
}

// Files live in public/avatars/<id>.webp. Adding one here is all the picker needs.
export const PRESET_AVATARS: PresetAvatar[] = [
  { id: "husky", label: "Husky" },
  { id: "wolf", label: "Wolf" },
  { id: "dino", label: "Dino" },
  { id: "astronaut", label: "Astronaut" },
  { id: "planet", label: "Planet" },
  { id: "sports-car", label: "Sports car" },
  { id: "controller", label: "Game controller" },
  { id: "basketball", label: "Basketball" },
  { id: "skateboard", label: "Skateboard" },
  { id: "hiker", label: "Hiker" },
  { id: "kitten", label: "Kitten" },
  { id: "cool-cat", label: "Cool cat" },
  { id: "unicorn", label: "Unicorn" },
  { id: "horse", label: "Horse" },
  { id: "horse-sunset", label: "Horse at sunset" },
  { id: "flowers", label: "Flowers" },
  { id: "sunflower", label: "Sunflower" },
  { id: "butterfly", label: "Butterfly" },
  { id: "headphones", label: "Headphones" },
];

export function presetAvatarValue(id: string): string {
  return `preset:${id}`;
}
