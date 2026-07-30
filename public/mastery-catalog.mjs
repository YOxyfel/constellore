const entries = [
  ["Earth", "Water", "Mud", "🟤", "nature"], ["Air", "Water", "Mist", "🌫️", "nature"],
  ["Earth", "Fire", "Lava", "🌋", "nature"], ["Lava", "Water", "Stone", "🪨", "nature"],
  ["Air", "Steam", "Cloud", "☁️", "nature"], ["Cloud", "Water", "Rain", "🌧️", "nature"],
  ["Stone", "Stone", "Mountain", "⛰️", "nature"], ["Snow", "Water", "Ice", "🧊", "nature"],
  ["Water", "Water", "Ocean", "🌊", "nature"], ["Sand", "Sand", "Desert", "🏜️", "nature"],
  ["Earth", "Energy", "Life", "🌱", "life"], ["Earth", "Life", "Plant", "🌿", "life"],
  ["Plant", "Water", "Tree", "🌳", "life"], ["Air", "Life", "Bird", "🐦", "life"],
  ["Life", "Water", "Fish", "🐟", "life"], ["Tree", "Tree", "Forest", "🌲", "life"],
  ["Field", "Plant", "Garden", "🪴", "life"], ["Earth", "Species", "Animal", "🐾", "life"],
  ["Mud", "Fire", "Brick", "🧱", "structure"], ["Brick", "Brick", "Wall", "🧱", "structure"],
  ["Wall", "Wall", "House", "🏠", "structure"], ["House", "House", "Village", "🏘️", "structure"],
  ["Village", "Village", "City", "🏙️", "structure"], ["Fire", "Stone", "Metal", "🔩", "structure"],
  ["Energy", "Metal", "Machine", "⚙️", "structure"], ["Clay", "Fire", "Pottery", "🏺", "structure"],
  ["Fire", "Water", "Steam", "♨️", "force"], ["Air", "Energy", "Light", "✨", "force"],
  ["Cloud", "Energy", "Storm", "⛈️", "force"], ["Energy", "Storm", "Lightning", "🌩️", "force"],
  ["Fire", "Fire", "Inferno", "🔥", "force"], ["Air", "Air", "Wind", "🌬️", "force"],
  ["Energy", "Energy", "Power", "🔋", "force"], ["Light", "Light", "Laser", "🔦", "force"],
  ["Air", "Light", "Sky", "🌌", "celestial"], ["Light", "Sky", "Star", "⭐", "celestial"],
  ["Glass", "Sky", "Telescope", "🔭", "celestial"], ["Machine", "Sky", "Rocket", "🚀", "celestial"],
  ["Fire", "Light", "Sun", "☀️", "celestial"], ["Sky", "Sky", "Space", "🌌", "celestial"],
  ["Star", "Star", "Galaxy", "🌌", "celestial"], ["Sky", "Star", "Constellation", "✨", "celestial"]
];

export const MASTERY_CATALOG = Object.freeze(entries.map(
  ([a, b, word, emoji, category]) => Object.freeze({ a, b, word, emoji, category })
));
