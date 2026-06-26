// Select background scene based on current hour
// 5–10: Ráno, 10–17: Den, 17–21: Soumrak, 21–5: Noc

const SCENES = [
  { id: 'scene-rano',    label: 'Ráno',    hours: [5, 10] },
  { id: 'scene-den',     label: 'Den',     hours: [10, 17] },
  { id: 'scene-soumrak', label: 'Soumrak', hours: [17, 21] },
  { id: 'scene-noc',     label: 'Noc',     hours: [21, 30] },
];

function getCurrentScene(hour) {
  const h = hour < 5 ? hour + 24 : hour;
  return SCENES.find(s => h >= s.hours[0] && h < s.hours[1]) || SCENES[3];
}

export function updateIllustration() {
  const hour = new Date().getHours();
  const scene = getCurrentScene(hour);
  const useEl = document.getElementById('bg-scene-use');
  if (useEl) useEl.setAttribute('href', `#${scene.id}`);
}

export function startIllustrationCycle() {
  updateIllustration();
  setInterval(updateIllustration, 10 * 60 * 1000);
}

export function getCurrentSceneLabel() {
  return getCurrentScene(new Date().getHours()).label;
}
