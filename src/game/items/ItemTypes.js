/**
 * Item type definitions
 */
export const ITEM_TYPES = {
  HOLY_WATER: {
    id: 'holy_water', name: '聖水', icon: '💧', color: '#66bbff',
    description: 'ソロ:5秒無敵 / マルチ:仲間を復活', duration: 5000, rarity: 0.15,
  },
  FLARE: {
    id: 'flare', name: '照明弾', icon: '🔥', color: '#ffaa33',
    description: '一時的に敵の行動を止める', duration: 3000, rarity: 0.18,
  },
  ROCKET_FIREWORK: {
    id: 'rocket_firework', name: 'ロケット花火', icon: '🚀', color: '#ff4466',
    description: '移動速度を1.3倍にする', duration: 5000, speedMultiplier: 1.3, rarity: 0.2,
  },
  BATTERY: {
    id: 'battery', name: '電池', icon: '🔋', color: '#ffcc00',
    description: '懐中電灯のバッテリーを補充', rarity: 0.25,
  },
  RADAR: {
    id: 'radar', name: 'レーダー', icon: '📡', color: '#44ff88',
    description: 'ミニマップに敵を10秒間表示', duration: 10000, rarity: 0.22,
  },
  AMMO: {
    id: 'ammo', name: '弾薬', icon: '🔫', color: '#ccaa00',
    description: '銃の弾を2発補充', refillAmount: 2, rarity: 0.15,
    stackable: true, gunOnly: true,
  },
};

export const SPECIAL_ITEMS = {
  LIGHT_FRAGMENT: {
    id: 'light_fragment', name: '光の欠片', icon: '✦', color: '#aaddff',
    description: '3つ集めると光の玉になる', isFragment: true,
  },
  LIGHT_ORB: {
    id: 'light_orb', name: '光の玉', icon: '🔮', color: '#ffffff',
    description: 'ポータルを生成して脱出できる', isOrb: true,
  },
};

export function getRandomItemType(hasGun = false) {
  const types = Object.values(ITEM_TYPES).filter(t => !t.gunOnly || hasGun);
  const totalWeight = types.reduce((sum, t) => sum + t.rarity, 0);
  let r = Math.random() * totalWeight;
  for (const type of types) { r -= type.rarity; if (r <= 0) return type; }
  return types[types.length - 1];
}

export function getRandomGroundItem(hasGun = false) {
  if (Math.random() > 0.03) return null;
  return getRandomItemType(hasGun);
}
