const log = (msg) => {
  const el = document.getElementById("battleLog");
  el.innerHTML += msg + "<br>";
  el.scrollTop = el.scrollHeight;
};

let battle = {
  started: false
};

document.getElementById("startBattle").onclick = () => {
  battle.started = true;
  log("Battle started!");
};

document.getElementById("attackBtn").onclick = () => {
  if (!battle.started) return;

  const level = 50;
  const power = 80;
  const atk = 120;
  const def = 100;

  let dmg = (((24 + level) * power * atk) / (32 * def)) + 8;

  log("Attack dealt " + Math.floor(dmg) + " damage");
};

document.getElementById("swapBtn").onclick = () => {
  if (!battle.started) return;
  log("Switch queued (end of turn)");
};

document.getElementById("blockBtn").onclick = () => {
  if (!battle.started) return;
  log("Blocking (60% reduction)");
};
