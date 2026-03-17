const GAME_DATA = {
  beasts: [
    {
      name: "Testmon A",
      stats: { hp: 120, atk: 110, def: 100, spa: 90, spd: 90, spe: 80 },
      moves: ["Strike"]
    },
    {
      name: "Testmon B",
      stats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 },
      moves: ["Strike"]
    }
  ],

  moves: {
    Strike: {
      power: 80,
      type: "neutral",
      category: "physical",
      accuracy: 100
    }
  }
};
