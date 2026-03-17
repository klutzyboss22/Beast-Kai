const log = (msg) => {
  const el = document.getElementById("battleLog");
  el.innerHTML += msg + "<br>";
  el.scrollTop = el.scrollHeight;
};

let battleActive = false;

document.getElementById("startBattle").onclick = () => {
  battleActive = true;
  log("Battle Started!");
};

document.getElementById("attackBtn").onclick = () => {
  if (!battleActive) return;

  // Example calc using your formula
  const level = 50;
  const power = 80;
  const atk = 100;
  const def = 100;

  let damage =
    (((24 + level) * power * atk) / (32 * def) + 8);

  log("Attack dealt " + Math.floor(damage) + " damage");
};

document.getElementById("swapBtn").onclick = () => {
  if (!battleActive) return;
  log("Swap queued (will occur end of turn)");
};

document.getElementById("blockBtn").onclick = () => {
  if (!battleActive) return;
  log("Blocking (60% damage reduction)");
};
