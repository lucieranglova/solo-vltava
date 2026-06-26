import {
  getFirestore, collection, doc, setDoc, addDoc, getDocs,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getDb, getCurrentUid } from './auth.js';
import { saveRaceConfig, saveProfile } from './firestore.js';

// Pevná konfigurace závodu
const RACE_CONFIG = {
  raceName: 'Vltava Run',
  raceDate: '2028-05-05',          // přesné datum zatím neznámé, upřesní se
  raceLocation: 'Zadov-Churáňov → Praha Braník',
  targetDistanceKm: 375,
  targetElevationM: 10000          // odhad
};

// 36 úseků Vltava Run (vzdálenosti a obtížnost z vltavarun.cz)
// Převýšení jsou odhady podle obtížnosti — update po zveřejnění GPS dat
const SEGMENTS = [
  { n:  1, name: 'Zadov–Churáňov → Kvilda',             km: 9.3,  d: 2,   surface: 'trail'  },
  { n:  2, name: 'Kvilda → Borová Lada',                km: 12.2, d: 2.5, surface: 'trail'  },
  { n:  3, name: 'Borová Lada → Strážný',               km: 15.3, d: 3,   surface: 'trail'  },
  { n:  4, name: 'Strážný → Lenora',                    km: 7.8,  d: 1,   surface: 'trail'  },
  { n:  5, name: 'Lenora → Stožec',                     km: 8.4,  d: 2,   surface: 'trail'  },
  { n:  6, name: 'Stožec → Nová Pec',                   km: 15.3, d: 2,   surface: 'trail'  },
  { n:  7, name: 'Nová Pec → Horní Planá',              km: 8.0,  d: 1,   surface: 'trail'  },
  { n:  8, name: 'Horní Planá → Černá v Pošumaví',      km: 11.8, d: 3,   surface: 'trail'  },
  { n:  9, name: 'Černá v Pošumaví → Milná',            km: 9.4,  d: 2,   surface: 'trail'  },
  { n: 10, name: 'Milná → Lipno nad Vltavou',           km: 13.7, d: 3,   surface: 'trail'  },
  { n: 11, name: 'Lipno nad Vltavou → Vyšší Brod',      km: 10.0, d: 4,   surface: 'trail'  },
  { n: 12, name: 'Vyšší Brod → Rožmberk',               km: 6.9,  d: 2.5, surface: 'trail'  },
  { n: 13, name: 'Rožmberk → Rožmitál na Šumavě',       km: 8.2,  d: 3,   surface: 'trail'  },
  { n: 14, name: 'Rožmitál na Šumavě → Věžovatá Pláně', km: 9.8,  d: 3,   surface: 'mixed'  },
  { n: 15, name: 'Věžovatá Pláně → Plešovice',          km: 14.2, d: 3.5, surface: 'mixed'  },
  { n: 16, name: 'Plešovice → Boršov nad Vltavou',      km: 12.9, d: 4,   surface: 'mixed'  },
  { n: 17, name: 'Boršov nad Vltavou → České Budějovice',km: 9.8, d: 1.5, surface: 'mixed'  },
  { n: 18, name: 'České Budějovice → Hluboká',          km: 9.9,  d: 1,   surface: 'mixed'  },
  { n: 19, name: 'Hluboká → Purkarec',                  km: 12.6, d: 2,   surface: 'mixed'  },
  { n: 20, name: 'Purkarec → Hněvkovice',               km: 10.1, d: 1.5, surface: 'mixed'  },
  { n: 21, name: 'Hněvkovice → Chřášťany',              km: 13.3, d: 3,   surface: 'mixed'  },
  { n: 22, name: 'Chřášťany → Slabčice',                km: 6.5,  d: 2,   surface: 'mixed'  },
  { n: 23, name: 'Slabčice → Jetětice',                 km: 9.4,  d: 2.5, surface: 'mixed'  },
  { n: 24, name: 'Jetětice → Květov',                   km: 9.4,  d: 2,   surface: 'mixed'  },
  { n: 25, name: 'Květov → Kostelec nad Vltavou',       km: 12.5, d: 3,   surface: 'mixed'  },
  { n: 26, name: 'Kostelec nad Vltavou → Klučenice',    km: 9.5,  d: 3,   surface: 'mixed'  },
  { n: 27, name: 'Klučenice → Hřebeny',                 km: 7.6,  d: 1.5, surface: 'mixed'  },
  { n: 28, name: 'Hřebeny → Kamýk nad Vltavou',         km: 10.1, d: 3,   surface: 'trail'  },
  { n: 29, name: 'Kamýk nad Vltavou → Líchovy',         km: 8.2,  d: 2,   surface: 'trail'  },
  { n: 30, name: 'Líchovy → Štola Josef',               km: 10.3, d: 2.5, surface: 'trail'  },
  { n: 31, name: 'Štola Josef → Živohošť',              km: 11.1, d: 4,   surface: 'trail'  },
  { n: 32, name: 'Živohošť → Rabyně',                   km: 12.3, d: 4,   surface: 'trail'  },
  { n: 33, name: 'Rabyně → Hradištko',                  km: 13.8, d: 5,   surface: 'trail'  },
  { n: 34, name: 'Hradištko → Davle',                   km: 5.7,  d: 1,   surface: 'mixed'  },
  { n: 35, name: 'Davle → Vrané nad Vltavou',           km: 8.8,  d: 3.5, surface: 'trail'  },
  { n: 36, name: 'Vrané nad Vltavou → Praha Braník',    km: 11.6, d: 1,   surface: 'mixed'  },
];

function elevFromDiff(d, km) {
  // Odhad převýšení podle obtížnosti: d * km * 10 m
  return Math.round(d * km * 10);
}

export async function seedIfNeeded() {
  await saveRaceConfig(RACE_CONFIG);

  // Profil: jméno z localStorage nebo defaultně Vojtěch
  const storedName = localStorage.getItem('profileName') || 'Vojtěch';
  const storedRole = localStorage.getItem('profileRole') || 'runner';
  await saveProfile(getCurrentUid(), {
    name: storedName,
    role: storedRole,
    avatarColor: storedRole === 'runner' ? '#2BC4B0' : '#FF8C5A'
  });

  // Úseky — přidej jen pokud ještě žádné nejsou
  const existing = await getDocs(collection(getDb(), 'routeSegments'));
  if (!existing.empty) return;

  for (let i = 0; i < SEGMENTS.length; i++) {
    const s = SEGMENTS[i];
    const gain = elevFromDiff(s.d, s.km);
    await addDoc(collection(getDb(), 'routeSegments'), {
      orderIndex: i,
      name: s.name,
      distanceKm: s.km,
      elevationGainM: gain,
      elevationLossM: gain,     // odhad, aktualizuj podle GPS dat
      surfaceType: s.surface,
      difficulty: s.d,
      notes: '',
      tried: false,
      triedDate: null,
      photoIds: [],
      createdAt: serverTimestamp()
    });
  }
}
