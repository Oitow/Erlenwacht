import { RUNIC_BURST, THORN_LANCE } from '../combat/skills.js';

export const DEFAULT_CLASS_ID = 'runenweber';

export const CLASSES = [
  {
    id: 'bastion',
    name: 'Bastion',
    description: 'Mit schwerem Schild und 22 zusätzlichem Leben hält die Bastion die Front.',
    maxHealthBonus: 22,
    speedMultiplier: 0.92,
    incomingMultiplier: 0.88,
    avatar: { mantle: 0x8a493e, trim: 0xc58d56, width: 1.14 },
    primary: {
      name: 'Schildhieb',
      description: 'Trifft Gegner in deiner unmittelbaren Nähe. Höhere Ränge erhöhen Reichweite und Schaden.',
      shape: 'circle', radius: 4.6, power: 1.56, cooldown: 0.94, duration: 0.4, tint: 0xe3ad78,
    },
    secondary: {
      name: 'Eisenwacht',
      description: 'Unterbricht Angriffe in der Nähe und halbiert für drei Sekunden erlittenen Schaden. Höhere Ränge verstärken den Gegenstoß.',
      shape: 'circle', radius: 5.2, power: 0.85, cooldown: 6.2, duration: 0.55, tint: 0xffcb91,
      interrupt: true, guard: 3,
    },
  },
  {
    id: 'waldlaeufer',
    name: 'Waldläufer',
    description: 'Die schnellste Klasse sucht Abstand und nimmt Gegner mit dem Bogen ins Visier.',
    maxHealthBonus: -6,
    speedMultiplier: 1.12,
    incomingMultiplier: 1,
    avatar: { mantle: 0x54724e, trim: 0xb9a36d, width: 0.91 },
    primary: {
      name: 'Schnellschuss',
      description: 'Ein schneller Pfeil trifft den ersten Gegner auf seiner Bahn. Höhere Ränge erhöhen Schaden und Reichweite.',
      shape: 'line', range: 13, width: 0.42, power: 1.24, cooldown: 0.78, duration: 0.34, tint: 0xe9dcaa,
      single: true,
    },
    secondary: {
      name: 'Fächerschuss',
      description: 'Ein Pfeilfächer trifft alle Gegner vor dir. Höhere Ränge erhöhen Reichweite und Schaden.',
      shape: 'cone', range: 9.1, angle: 0.59, power: 1.9, cooldown: 4.1, duration: 0.44, tint: 0xe9d9a0,
    },
  },
  {
    id: 'runenweber',
    name: 'Runenweber',
    description: 'Bringt ganze Gruppen mit Flächenzaubern zu Fall. Das geringere Leben verlangt etwas Abstand.',
    maxHealthBonus: -12,
    speedMultiplier: 1,
    incomingMultiplier: 1,
    avatar: { mantle: 0x5e518c, trim: 0xb19be0, width: 0.96 },
    primary: {
      ...RUNIC_BURST,
      name: 'Runenstoß',
      description: 'Eine Runenwelle beschädigt alle Gegner um dich herum. Höhere Ränge erhöhen Schaden und Reichweite.',
      shape: 'circle', power: 1.12,
    },
    secondary: {
      name: 'Glutkreis',
      description: 'Eine Flammenrune explodiert um dein anvisiertes Ziel. Höhere Ränge erhöhen Reichweite und Schaden.',
      shape: 'target', range: 12, radius: 3.9, power: 2.65, cooldown: 4.8, duration: 0.56, tint: 0xff895a,
    },
  },
  {
    id: 'dornhueter',
    name: 'Dornhüter',
    description: 'Hält Gegner mit Wurzeln auf Abstand und nutzt enge Wege für durchdringende Angriffe.',
    maxHealthBonus: 5,
    speedMultiplier: 1.02,
    incomingMultiplier: 1,
    avatar: { mantle: 0x527967, trim: 0xadd17d, width: 1.02 },
    primary: {
      name: 'Dornenwelle',
      description: 'Ein Dornenfächer verletzt und verlangsamt Gegner. Höhere Ränge verlängern die Verlangsamung.',
      shape: 'cone', range: 7.6, angle: 0.67, power: 1.19, cooldown: 0.91, duration: 0.44, tint: 0x9dd78d,
      slow: 1.35,
    },
    secondary: {
      ...THORN_LANCE,
      name: 'Dornlanze',
      description: 'Eine Lanze durchdringt Gegner in einer Linie und unterbricht ihre Angriffe. Höhere Ränge verbessern die Trefferfläche.',
      shape: 'line', interrupt: true,
    },
  },
];

const byId = new Map(CLASSES.map(playerClass => [playerClass.id, playerClass]));

export function getClass(id) {
  return byId.get(id) ?? byId.get(DEFAULT_CLASS_ID);
}
