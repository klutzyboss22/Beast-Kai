const logEl = document.getElementById("battleLog");

function log(msg) {
  logEl.innerHTML += msg + "<br>";
  logEl.scrollTop = logEl.scrollHeight;
}

let battle = {
  started: false,
  player: [],
  enemy: [],
  turn: 1
};

function calcHP(stat) {
  return 100 + stat * 3;
}

function damageCalc(attacker, defender, move) {
  const level = 50;

  const atkStat = move.category === "physical"
    ? attacker.stats.atk
    : attacker.stats.spa;

  const defStat = move.category === "physical"
    ? defender.stats.def
    : defender.stats.spd;

  let damage =
    (((24 + level) * move.power * atkStat) / (32 * defStat)) + 8;

  return Math.floor(damage);
}

function createBeast(data) {
  return {
    name: data.name,
    stats: data.stats,
    hp: calcHP(data.stats.hp),
    maxHp: calcHP(data.stats.hp),
    moves: data.moves,
    blocked: false
  };
}

function render() {
  document.getElementById("player1").innerHTML =
    `${battle.player[0].name}<br>HP: ${battle.player[0].hp}`;

  document.getElementById("enemy1").innerHTML =
    `${battle.enemy[0].name}<br>HP: ${battle.enemy[0].hp}`;
}

document.getElementById("startBattle").onclick = () => {
  battle.started = true;

  battle.player = [createBeast(GAME_DATA.beasts[0])];
  battle.enemy = [createBeast(GAME_DATA.beasts[1])];

  log("Battle Started");
  render();
};

document.getElementById("attackBtn").onclick = () => {
  if (!battle.started) return;

  const attacker = battle.player[0];
  const defender = battle.enemy[0];
  const move = GAME_DATA.moves[attacker.moves[0]];

  let dmg = damageCalc(attacker, defender, move);

  if (defender.blocked) {
    dmg *= 0.4; // 60% reduction
    defender.blocked = false;
  }

  defender.hp -= dmg;

  log(`${attacker.name} used ${attacker.moves[0]} for ${dmg}`);

  if (defender.hp <= 0) {
    log(`${defender.name} fainted`);
    battle.started = false;
  }

  render();
};

document.getElementById("blockBtn").onclick = () => {
  if (!battle.started) return;

  battle.player[0].blocked = true;
  log("Player is blocking");
};

document.getElementById("swapBtn").onclick = () => {
  if (!battle.started) return;
  log("Swap (not implemented yet)");
};
