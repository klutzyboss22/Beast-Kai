const DATA = window.BEAST_KAI_DATA;
const beasts = DATA.beasts.filter(b => b.Competitive_Legal !== 'No');
const moves = DATA.moves;
const abilities = DATA.abilities;
const items = DATA.items;
const typeChart = DATA.typeChart;

const beastById = Object.fromEntries(beasts.map(b => [Number(b.Beast_Index), b]));
const moveById = Object.fromEntries(moves.map(m => [Number(m.Move_ID), m]));
const abilityByName = Object.fromEntries(abilities.map(a => [a.Ability, a]));
const itemByName = Object.fromEntries(items.map(i => [i.Item, i]));
const statusByKey = Object.fromEntries((DATA.statuses || []).map(s => [String(s.Status || '').toLowerCase(), s]));
const STORAGE_KEY = 'beast-kai-team-v2';
const MAX_ABILITY_STACKS = 3;

const TYPE_COLORS = {Aqua:'#5cc9f5',Flame:'#ff8a5b',Flora:'#78d16b',Terra:'#b99662',Plasma:'#f8d55f',Toxic:'#9c78ff',Frost:'#8fe6ff',Wind:'#b6d4ff',Primal:'#c9a36d',Alloy:'#c8d0e0',Soul:'#9ea7ff',Monster:'#ff7a7a',Mind:'#f7b1ff',Mythic:'#86e0c8',Cosmic:'#b595ff'};
const stageMods = {0:1,1:1.25,2:1.5,3:1.75,4:2,'-1':0.8,'-2':0.67,'-3':0.57,'-4':0.5};

let team = loadSavedTeam() || Array.from({length:6}, (_,i)=>({slot:i+1, beast:null, ability:'', item:'', moves:[]}));
let wikiKind = 'all';
let sim = {playerRoster:[], enemyRoster:[], started:false, state:null};

function el(tag, attrs={}, children=[]) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v]) => {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null) node.setAttribute(k, v);
  });
  (Array.isArray(children) ? children : [children]).forEach(ch => {
    if (ch === null || ch === undefined) return;
    node.append(ch.nodeType ? ch : document.createTextNode(String(ch)));
  });
  return node;
}

function saveTeam(){ try { localStorage.setItem(STORAGE_KEY, JSON.stringify(team)); } catch {} }
function loadSavedTeam(){
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length !== 6) return null;
    return arr.map((s,i)=>({slot:i+1, beast:s.beast ? Number(s.beast) : null, ability:s.ability || '', item:s.item || '', moves:(s.moves || []).map(Number).filter(Boolean).slice(0,4)}));
  } catch { return null; }
}

function normalizeText(s){ return String(s || '').trim().toLowerCase(); }
function typePills(types=[]) { return types.map(t => `<span class="pill" style="border-color:${TYPE_COLORS[t]||'#345'};color:${TYPE_COLORS[t]||'#fff'}">${t}</span>`).join(''); }
function beastSearchText(b){ return [b.Beast,b.Legacy_Name,b.Display_Name,b.Type,b.Primary_Role,b.Secondary_Role,b.Gen,(b.Ability_List||[]).join(' ')].join(' ').toLowerCase(); }
function getLegalMoves(beast) { return (beast?.Move_IDs || []).map(id => moveById[Number(id)]).filter(Boolean); }
function getAbilityData(name){ return abilityByName[name] || {Ability:name, Description:''}; }
function getItemData(name){ return itemByName[name] || {Item:name, Description:''}; }
function moveFlags(move){ return normalizeText(move?.Machine_Flags).split(',').map(x=>x.trim()).filter(Boolean); }
function statusByName(name){ return statusByKey[normalizeText(name)] || null; }
function ruleTextContains(fragment){ return (DATA.rules || []).some(r => normalizeText(r.Rule).includes(normalizeText(fragment))); }

function setPanel(tabId) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === tabId));
}
document.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => setPanel(btn.dataset.tab)));

function renderBeastList(filter='') {
  const q = filter.trim().toLowerCase();
  const list = document.getElementById('builderBeastList');
  list.innerHTML = '';
  beasts.filter(b => !q || beastSearchText(b).includes(q))
    .sort((a,b)=>a.Beast.localeCompare(b.Beast)).forEach(beast => {
      list.append(el('div',{class:'list-item', onclick:()=>fillFirstOpenSlot(Number(beast.Beast_Index)), html:`<strong>${beast.Beast}</strong><div class="small">#${beast.Beast_Index} • ${beast.Type} • BST ${beast.BST}${beast.Legacy_Name && beast.Legacy_Name !== beast.Beast ? ` • formerly ${beast.Legacy_Name}` : ''}</div>${typePills(beast.Types)}`}));
    });
}

function fillFirstOpenSlot(id){
  const idx = team.findIndex(s=>!s.beast);
  updateSlot(idx === -1 ? 0 : idx, {beast:id, ability:beastById[id].Ability_List[0] || '', item:'', moves:getLegalMoves(beastById[id]).slice(0,4).map(m=>Number(m.Move_ID))});
}

function updateSlot(index, patch) {
  team[index] = {...team[index], ...patch};
  saveTeam();
  renderTeam();
}

function getTeamMetrics(currentTeam=team) {
  const chosen = currentTeam.filter(s => s.beast).map(s => beastById[s.beast]);
  const bst = chosen.reduce((sum,b)=>sum + (Number(b?.BST) || 0), 0);
  const dupBeasts = chosen.length - new Set(chosen.map(b=>b.Beast_Index)).size;
  const usedItems = currentTeam.filter(s=>s.item).map(s=>s.item);
  const dupItems = usedItems.length - new Set(usedItems).size;
  const legendary = chosen.filter(b=>b.Legendary_Flag === 'Yes').length;
  return {count:chosen.length, bst, dupBeasts, dupItems, legendary, legal: bst <= 3400 && dupBeasts === 0 && dupItems === 0 && legendary === 0 && chosen.length === 6};
}

function renderTeamSummary(){
  const m = getTeamMetrics();
  document.getElementById('teamSummary').innerHTML = `<div class="summary-grid">
    <div class="metric">Slots Filled<strong>${m.count}/6</strong></div>
    <div class="metric">BST Sum<strong class="${m.bst>3400?'bad':'ok'}">${m.bst}/3400</strong></div>
    <div class="metric">Duplicate Beasts<strong class="${m.dupBeasts?'bad':'ok'}">${m.dupBeasts}</strong></div>
    <div class="metric">Duplicate Items<strong class="${m.dupItems?'bad':'ok'}">${m.dupItems}</strong></div>
  </div>
  <p class="small ${m.legal?'ok':'warn'}" style="margin-top:12px">${m.legal ? 'Team is builder-legal.' : 'Team still needs to satisfy the doubles builder checks: 6 beasts, BST cap 3400, no duplicate beast, no duplicate item, no legendaries.'}</p>`;
}

function renderTeam() {
  renderTeamSummary();
  const container = document.getElementById('teamSlots');
  container.innerHTML = '';
  team.forEach((slot, i) => {
    const beast = slot.beast ? beastById[slot.beast] : null;
    const card = document.getElementById('teamSlotTemplate').content.firstElementChild.cloneNode(true);
    card.querySelector('.slot-head').innerHTML = `<h3>Slot ${i+1}</h3>${beast ? typePills(beast.Types) : '<span class="pill">Empty</span>'}`;
    const body = card.querySelector('.slot-body');

    const beastSelect = el('select', {onchange:e => {
      const id = Number(e.target.value) || null;
      const nextBeast = id ? beastById[id] : null;
      updateSlot(i, {beast:id, ability:nextBeast?.Ability_List?.[0] || '', item:'', moves:nextBeast ? getLegalMoves(nextBeast).slice(0,4).map(m=>Number(m.Move_ID)) : []});
    }});
    beastSelect.append(el('option',{value:''},'Choose Beast'));
    beasts.slice().sort((a,b)=>a.Beast.localeCompare(b.Beast)).forEach(b => beastSelect.append(el('option',{value:b.Beast_Index}, `${b.Beast} (#${b.Beast_Index})`)));
    beastSelect.value = beast?.Beast_Index || '';

    const abilitySelect = el('select',{onchange:e=>updateSlot(i,{ability:e.target.value})});
    abilitySelect.append(el('option',{value:''},'Choose Ability'));
    (beast?.Ability_List || []).forEach(name => abilitySelect.append(el('option',{value:name},name)));
    abilitySelect.value = slot.ability || '';

    const itemSelect = el('select',{onchange:e=>updateSlot(i,{item:e.target.value})});
    itemSelect.append(el('option',{value:''},'No Item'));
    items.forEach(it => itemSelect.append(el('option',{value:it.Item},it.Item)));
    itemSelect.value = slot.item || '';

    const moveFields = [];
    for(let m=0; m<4; m++){
      const ms = el('select',{onchange:e=>{
        const arr = [...slot.moves]; arr[m] = Number(e.target.value) || null;
        updateSlot(i,{moves:arr.filter(Boolean).slice(0,4)});
      }});
      ms.append(el('option',{value:''},`Move ${m+1}`));
      getLegalMoves(beast).slice().sort((a,b)=>a.Move_Name.localeCompare(b.Move_Name)).forEach(move => ms.append(el('option',{value:move.Move_ID}, `${move.Move_Name} (${move.Move_Type})`)));
      ms.value = slot.moves?.[m] || '';
      moveFields.push(el('div',{class:'field'},[el('label',{},`Move ${m+1}`), ms]));
    }

    const detailBits = beast ? `
      <div class="small"><strong>${beast.Beast}</strong> • ${beast.Gen} • ${beast.Primary_Role}${beast.Secondary_Role ? ' / '+beast.Secondary_Role : ''}</div>
      <div class="stat-grid" style="margin-top:10px">
        ${[['HP',beast.HP_Lv50],['Atk',beast.Attack],['SpA',beast.Sp_Attack],['Def',beast.Defense],['SpD',beast.Sp_Defense],['Spe',beast.Speed],['Eva',beast.Evasion],['BST',beast.BST]].map(([k,v])=>`<div class="stat"><b>${k}</b>${v}</div>`).join('')}
      </div>
      <div class="small" style="margin-top:10px"><strong>Ability:</strong> ${slot.ability || '—'} ${slot.ability ? `— ${getAbilityData(slot.ability).Description || ''}` : ''}</div>
      <div class="small" style="margin-top:6px"><strong>Item:</strong> ${slot.item || '—'} ${slot.item ? `— ${getItemData(slot.item).Description || ''}` : ''}</div>` : '<p class="small">Pick a beast to unlock legal abilities and moves.</p>';

    body.append(
      el('div',{class:'field'},[el('label',{},'Beast'), beastSelect]),
      el('div',{class:'inline-grid'},[
        el('div',{class:'field'},[el('label',{},'Ability'), abilitySelect]),
        el('div',{class:'field'},[el('label',{},'Item'), itemSelect]),
      ]),
      ...moveFields,
      el('div',{html:detailBits}),
      el('button',{onclick:()=>updateSlot(i,{beast:null, ability:'', item:'', moves:[]})},'Clear Slot')
    );
    container.append(card);
  });
  renderBattlePickers();
}

function wikiEntries() {
  return [
    ...beasts.map(b => ({kind:'beast', key:b.Beast, text:[b.Beast,b.Legacy_Name,b.Type,b.Primary_Role,b.Secondary_Role,b.Gen,(b.Ability_List||[]).join(' ')].join(' '), payload:b})),
    ...moves.map(m => ({kind:'move', key:m.Move_Name, text:[m.Move_Name,m.Move_Type,m.Category,m.Effect,m.Target_Class].join(' '), payload:m})),
    ...abilities.map(a => ({kind:'ability', key:a.Ability, text:[a.Ability,a.Description,a.Ability_Role,a.Trigger].join(' '), payload:a})),
    ...items.map(i => ({kind:'item', key:i.Item, text:[i.Item,i.Description,i.Item_Role,i.Trigger].join(' '), payload:i})),
  ];
}

function renderWiki(query='') {
  const q = query.trim().toLowerCase();
  const results = document.getElementById('wikiResults');
  results.innerHTML = '';
  const entries = wikiEntries().filter(e => (wikiKind === 'all' || e.kind === wikiKind) && (!q || e.text.toLowerCase().includes(q))).slice(0,250);
  entries.forEach(entry => {
    const sub = entry.kind==='beast' ? entry.payload.Type : entry.kind==='move' ? `${entry.payload.Move_Type} ${entry.payload.Category}` : entry.kind==='ability' ? entry.payload.Ability_Role : entry.payload.Item_Role;
    results.append(el('div',{class:'list-item', onclick:()=>renderWikiDetail(entry)},[
      el('strong',{},entry.key),
      el('div',{class:'small'}, `${entry.kind.toUpperCase()} • ${sub || ''}`)
    ]));
  });
  if (entries[0]) renderWikiDetail(entries[0]);
}

function renderWikiDetail(entry) {
  const wrap = document.getElementById('wikiDetail');
  if (!entry) { wrap.innerHTML = '<p>No result.</p>'; return; }
  if (entry.kind === 'beast') {
    const b = entry.payload;
    const learnset = getLegalMoves(b).slice().sort((a,b)=>a.Move_Name.localeCompare(b.Move_Name));
    wrap.innerHTML = `<h2>${b.Beast}</h2>${typePills(b.Types)}
      <p class="small">#${b.Beast_Index} • ${b.Gen} • Forms ${b.Forms} • ${b.Primary_Role}${b.Secondary_Role ? ' / '+b.Secondary_Role : ''}${b.Legacy_Name && b.Legacy_Name !== b.Beast ? ' • formerly ' + b.Legacy_Name : ''}</p>
      <div class="stat-grid">${[['HP',b.HP_Lv50],['Health',b.Health],['Atk',b.Attack],['SpA',b.Sp_Attack],['Def',b.Defense],['SpD',b.Sp_Defense],['Spe',b.Speed],['Eva',b.Evasion],['BST',b.BST]].map(([k,v])=>`<div class="stat"><b>${k}</b>${v}</div>`).join('')}</div>
      <h3>Abilities</h3><p>${b.Ability_List.map(a=>`<span class="pill">${a}</span>`).join(' ')}</p>
      <h3>Learnset (${learnset.length})</h3>
      <div>${learnset.map(m=>`<span class="pill">${m.Move_Name}</span>`).join(' ')}</div>`;
  } else if (entry.kind === 'move') {
    const m = entry.payload;
    wrap.innerHTML = `<h2>${m.Move_Name}</h2><p>${typePills(getMoveTypes(m))}</p>
      <div class="stat-grid">${[['Power',m.Power ?? '—'],['Acc',m.Accuracy],['PP',m.PP],['Priority',m.Priority],['Target',m.Target_Class],['Mode',m.Damage_Mode || 'Standard'],['Category',m.Category],['Effect Class',m.Effect_Class]].map(([k,v])=>`<div class="stat"><b>${k}</b>${v}</div>`).join('')}</div>
      <h3>Effect</h3><p>${m.Effect || 'No extra effect listed.'}</p>`;
  } else if (entry.kind === 'item') {
    const i = entry.payload;
    wrap.innerHTML = `<h2>${i.Item}</h2><p class="small">${i.Item_Role || 'Item'} • ${i.Trigger || 'Passive'}</p><p>${i.Description || 'No description.'}</p>`;
  } else {
    const a = entry.payload;
    wrap.innerHTML = `<h2>${a.Ability}</h2><p class="small">${a.Ability_Role || 'Ability'} • ${a.Trigger || 'Passive'} • ${a.Timing || ''}</p><p>${a.Description || 'No description.'}</p>`;
  }
}

function renderRules() {
  document.getElementById('rulesList').innerHTML = DATA.rules.map(r => `<div class="list-item"><strong>${r.System}</strong><div class="small">${r.Rule_Type}</div><div>${r.Rule}</div></div>`).join('');
  document.getElementById('statusTerrainList').innerHTML = `
    <h3>Status</h3>${DATA.statuses.map(s=>`<div class="list-item"><strong>${s.Status}</strong><div>${s.Damage_or_Residual || ''}</div><div class="small">${s.Stat_Modifier || 'No stat change'} • ${s.Default_Duration}</div></div>`).join('')}
    <h3 style="margin-top:16px">Terrain</h3>${DATA.terrains.map(t=>`<div class="list-item"><strong>${t.Name}</strong><div>${t.Effect || ''}</div><div class="small">${t.Terrain_Class}${t.Notes ? ' • '+t.Notes : ''}</div></div>`).join('')}`;
  const table = document.getElementById('typeChartTable');
  const types = Object.keys(typeChart);
  table.innerHTML = `<tr><th>Atk \\ Def</th>${types.map(t=>`<th>${t}</th>`).join('')}</tr>` + types.map(a=>`<tr><td>${a}</td>${types.map(d=>`<td>${typeChart[a][d]}x</td>`).join('')}</tr>`).join('');
}

function randomTeam() {
  const pool = [...beasts].filter(b=>b.Legendary_Flag !== 'Yes').sort(()=>Math.random()-0.5).slice(0,6);
  return pool.map((b,i)=>({slot:i+1, beast:Number(b.Beast_Index), ability:b.Ability_List[0] || '', item:'', moves:getLegalMoves(b).slice(0,4).map(m=>Number(m.Move_ID)), selected:i<4, lead:i<2}));
}

function exportTeamJSON(){ return JSON.stringify(team,null,2); }
function exportTeamText(){
  return team.map(slot => {
    if (!slot.beast) return `Empty Slot\n`;
    const b = beastById[slot.beast];
    const lines = [`${b.Beast}${slot.item ? ` @ ${slot.item}` : ''}`, `Ability: ${slot.ability || b.Ability_List[0] || 'None'}`, `Types: ${b.Types.join('/')}`];
    (slot.moves || []).map(id=>moveById[id]).filter(Boolean).forEach(m=>lines.push(`- ${m.Move_Name}`));
    return lines.join('\n');
  }).join('\n\n');
}
function importTeam(text){
  try {
    const incoming = JSON.parse(text);
    if (!Array.isArray(incoming) || incoming.length !== 6) throw new Error('Need 6 slots');
    team = incoming.map((s,i)=>({slot:i+1, beast:s.beast ? Number(s.beast) : null, ability:s.ability || '', item:s.item || '', moves:(s.moves || []).map(Number).filter(Boolean).slice(0,4)}));
    saveTeam();
    renderTeam();
    alert('Team imported.');
  } catch (e) { alert('Import failed: ' + e.message); }
}

function baseUnitFromSlot(slot, side, pos, bench){
  const b = beastById[slot.beast];
  return {
    side, position:pos, bench, beastId:Number(b.Beast_Index), name:b.Beast, type1:b.Type_1, type2:b.Type_2 || null, types:[b.Type_1,b.Type_2].filter(Boolean),
    stats:{atk:Number(b.Attack), spa:Number(b.Sp_Attack), def:Number(b.Defense), spd:Number(b.Sp_Defense), spe:Number(b.Speed), eva:Number(b.Evasion)},
    baseStats:{atk:Number(b.Attack), spa:Number(b.Sp_Attack), def:Number(b.Defense), spd:Number(b.Sp_Defense), spe:Number(b.Speed), eva:Number(b.Evasion)},
    maxHp:Number(b.HP_Lv50), hp:Number(b.HP_Lv50), ability:slot.ability || b.Ability_List[0] || '', item:slot.item || '',
    moves:(slot.moves || []).map(id=>moveById[Number(id)]).filter(Boolean), blocking:false, consecutiveBlocks:0, fainted:false,
    status:null, statusCounter:0, currentActionIndex:-1,
    volatile:{headbandLock:null, riotShieldHits:0, onceItemUsed:false, switchedInTurn:0, burrowed:false, burrowEndsOnAttack:false, blockReductionOverride:null, accuracyBuffTurns:0, pendingSwitchTarget:null, sourceTerrains:[], immuneTypes:new Set()},
    temp:{acted:false}
  };
}

function clearTemporaryState(unit){
  unit.blocking = false;
  unit.temp.acted = false;
  if (unit.volatile.blockReductionOverrideTurns) {
    unit.volatile.blockReductionOverrideTurns -= 1;
    if (unit.volatile.blockReductionOverrideTurns <= 0) unit.volatile.blockReductionOverride = null;
  }
}

function initUnit(unit, ally, turn=1){
  unit.volatile.switchedInTurn = turn;
  unit.currentActionIndex = -1;
  clearTemporaryState(unit);
  const ability = normalizeText(unit.ability);
  const item = normalizeText(unit.item);
  if (ability === 'hasty') {
    unit.stats.spe = Math.round(unit.stats.spe * stageMods[2]);
    unit.blockBase = 0.50;
  }
  if (ability === 'bond') {
    const stats = ['atk','spa','def','spd','spe'];
    const best = [...stats].sort((a,b)=>unit.stats[b]-unit.stats[a])[0];
    unit.stats[best] = Math.round(unit.stats[best] * stageMods[1]);
    unit.stats.spe = Math.round(unit.stats.spe * (best === 'spe' ? stageMods[2] : stageMods[1]));
  }
  if ((ability === 'positive' && normalizeText(ally?.ability) === 'negative') || (ability === 'negative' && normalizeText(ally?.ability) === 'positive')) {
    const stats = ['atk','spa','def','spd','spe'];
    const best = [...stats].sort((a,b)=>unit.stats[b]-unit.stats[a])[0];
    unit.stats[best] = Math.round(unit.stats[best] * stageMods[1]);
    unit.stats.spe = Math.round(unit.stats.spe * stageMods[1]);
  }
  if (item === 'hermes boots') unit.stats.spe = Math.round(unit.stats.spe * stageMods[1]);
  if (item === 'weighted ball') unit.stats.spe = Math.max(1, Math.round(unit.stats.spe * 0.5));
  if (item === 'hypno watch') {
    const oldAtk = unit.stats.atk;
    unit.stats.atk = unit.stats.spa;
    unit.stats.spa = oldAtk;
    unit.stats.def = Math.max(1, Math.round(unit.stats.def * 0.8));
    unit.stats.spd = Math.max(1, Math.round(unit.stats.spd * 0.8));
  }
  if (item === 'radiant crystal') {
    unit.stats.spa = Math.round(unit.stats.spa * 1.3);
    applyStatus(unit, 'Poison', true);
  }
  if (item === 'dry icecream') applyStatus(unit, 'Freeze', true);
  if (item === 'scary mask' && ally) ally.pendingEnemyAtkDrop = true;
}

function activeAll() { return [...sim.state.player.active, ...sim.state.enemy.active].filter(Boolean); }
function getOpposingSide(sideKey){ return sideKey === 'player' ? sim.state.enemy : sim.state.player; }
function getOwnSide(sideKey){ return sim.state[sideKey]; }
function getMoveTypes(move, actor=null){
  let types = String(move?.Move_Type || '').split(':').map(s=>s.trim()).filter(Boolean);
  const flags = moveFlags(move);
  if (actor && normalizeText(actor.ability) === 'thunderous' && flags.includes('sound')) types = ['Plasma'];
  return types.length ? types : ['Neutral'];
}

function getTerrainRecord(name){ return (DATA.terrains || []).find(t => normalizeText(t.Name) === normalizeText(name)); }

function terrainSetterInfo(unit){
  const ability = abilityByName[unit.ability];
  if (!ability) return null;
  const flags = moveFlags({Machine_Flags: ability.Machine_Flags});
  if (ability.Terrain_Name || flags.includes('terrain_setter')) {
    const terrainName = ability.Terrain_Name || ability.Ability;
    const terrainDef = getTerrainRecord(terrainName);
    const cls = normalizeText(terrainDef?.Terrain_Class || '').includes('secondary') ? 'secondary' : 'primary';
    return {name: terrainName, class: cls};
  }
  return null;
}

function activateTerrain(name, cls, sourceUnit){
  if (!name || !sourceUnit) return;
  const state = sim.state;
  if (cls === 'secondary') {
    state.terrain.secondary = state.terrain.secondary.filter(t => !(t.name === name && t.source.side === sourceUnit.side));
    if (state.terrain.secondary.length >= 2) state.terrain.secondary.shift();
    state.terrain.secondary.push({name, source: sourceUnit});
    sourceUnit.volatile.sourceTerrains.push({name, class:'secondary'});
    log(`${sourceUnit.name} activated ${name} terrain.`);
    return;
  }
  const old = state.terrain.primary;
  state.terrain.primary = {name, source: sourceUnit};
  sourceUnit.volatile.sourceTerrains.push({name, class:'primary'});
  if (old && old.name !== name) log(`${old.name} faded.`);
  log(`${sourceUnit.name} activated ${name} terrain.`);
}

function removeTerrainsFromSource(sourceUnit){
  const state = sim.state;
  if (state.terrain.primary?.source === sourceUnit) {
    log(`${state.terrain.primary.name} ended.`);
    state.terrain.primary = null;
  }
  const before = state.terrain.secondary.length;
  state.terrain.secondary = state.terrain.secondary.filter(t => t.source !== sourceUnit);
  if (before !== state.terrain.secondary.length) log(`${sourceUnit.name}'s secondary terrain ended.`);
}

function applyEntryAbility(unit, sourceText='entered the battle'){
  if (!unit || unit.fainted) return;
  const side = getOwnSide(unit.side);
  const enemy = getOpposingSide(unit.side);
  const ally = side.active.find(x => x && x !== unit && !x.fainted) || null;
  const ability = normalizeText(unit.ability);
  const terrainInfo = terrainSetterInfo(unit);
  if (terrainInfo) activateTerrain(terrainInfo.name, terrainInfo.class, unit);
  if (ability === 'daunting') {
    enemy.active.filter(x=>!x.fainted).forEach(t => {
      t.stats.atk = Math.max(1, Math.round(t.stats.atk * stageMods['-1']));
    });
    log(`${unit.name}'s Daunting lowered the opposing side's Attack.`);
  }
  if (ability === 'space scraper') {
    side.accuracyBuffTurns = 3;
    unit.stats.spe = Math.max(1, Math.round(unit.stats.spe * stageMods['-1']));
    log(`${unit.name}'s Space Scraper boosted allied accuracy for 3 turns.`);
  }
  if (ability === 'monster king') {
    [unit, ally].filter(Boolean).forEach(x => x.volatile.immuneTypes.add('Monster'));
    log(`${unit.name}'s Monster King granted Monster immunity to its side.`);
  }
  if (ability === 'stormy' && terrainInfo) {
    log(`${unit.name}'s Stormy also empowered Plasma attacks while active.`);
  }
  if (ability === 'bomb holster') log(`${unit.name}'s Bomb Holster will prevent self-KO from bomb moves.`);
  if (sourceText) log(`${unit.name} ${sourceText}.`);
}

function applyInitialEntries(){
  ['player','enemy'].forEach(sideKey => {
    const side = sim.state[sideKey];
    initUnit(side.active[0], side.active[1], sim.state.turn);
    initUnit(side.active[1], side.active[0], sim.state.turn);
  });
  const entrants = activeAll().filter(u=>!u.fainted);
  const setters = entrants.filter(u=>terrainSetterInfo(u)).sort((a,b)=>a.stats.spe - b.stats.spe); // slower wins when simultaneous
  const nonSetters = entrants.filter(u=>!terrainSetterInfo(u));
  setters.concat(nonSetters).forEach(u => applyEntryAbility(u, 'entered the battle'));
}

function renderBattlePickers(){
  const player = document.getElementById('playerBattlePicker');
  const enemy = document.getElementById('enemyBattlePicker');
  sim.playerRoster = team.filter(s=>s.beast).map((s,i)=>({...s, selected:i<4, lead:i<2}));
  if (!sim.enemyRoster.length) sim.enemyRoster = randomTeam();

  player.innerHTML='';
  player.append(el('p',{class:'small'},'No team preview is active. Choose exactly 4 beasts, then mark exactly 2 leads.'));
  sim.playerRoster.forEach((s,idx)=>{
    const b = beastById[s.beast]; if(!b) return;
    const selectBox = el('input',{type:'checkbox'});
    selectBox.checked = !!s.selected;
    const leadBox = el('input',{type:'checkbox'});
    leadBox.checked = !!s.lead;
    leadBox.disabled = !selectBox.checked;

    selectBox.addEventListener('change',()=>{
      sim.playerRoster[idx].selected = selectBox.checked;
      if (!selectBox.checked) sim.playerRoster[idx].lead = false;
      const chosen = sim.playerRoster.filter(x=>x.selected);
      if (chosen.length > 4) { sim.playerRoster[idx].selected = false; selectBox.checked = false; alert('Choose exactly 4 battle beasts.'); }
      if (!selectBox.checked) leadBox.checked = false;
      leadBox.disabled = !selectBox.checked;
    });
    leadBox.addEventListener('change',()=>{
      if (!sim.playerRoster[idx].selected) { leadBox.checked = false; return; }
      sim.playerRoster[idx].lead = leadBox.checked;
      const leads = sim.playerRoster.filter(x=>x.lead);
      if (leads.length > 2) { sim.playerRoster[idx].lead = false; leadBox.checked = false; alert('Choose exactly 2 leads.'); }
    });

    player.append(el('div',{class:'list-item'},[
      el('div',{},[
        el('label',{},[selectBox, ' ', b.Beast]),
        el('div',{class:'small'}, `${b.Type} • BST ${b.BST}`)
      ]),
      el('label',{class:'small'},[leadBox, ' Lead'])
    ]));
  });

  enemy.innerHTML='';
  enemy.append(el('div',{class:'list-item'},[
    el('strong',{},'Enemy roster hidden'),
    el('div',{class:'small'},'No team preview. The AI randomly selects 4 of 6 and chooses 2 hidden leads.')
  ]));
}

function startBattle() {
  const playerChosen = sim.playerRoster.filter(x=>x.selected).slice(0,4);
  const playerLeads = playerChosen.filter(x=>x.lead).slice(0,2);
  if (playerChosen.length !== 4 || playerLeads.length !== 2) return alert('Choose exactly 4 beasts and exactly 2 leads.');
  sim.enemyRoster = randomTeam();
  const enemyChosen = sim.enemyRoster.slice(0,4);
  const shuffledEnemyChosen = [...enemyChosen].sort(()=>Math.random()-0.5);
  const enemyLeads = shuffledEnemyChosen.slice(0,2);
  const enemyBench = enemyChosen.filter(x => !enemyLeads.includes(x));
  const playerBench = playerChosen.filter(x => !playerLeads.includes(x));

  sim.state = {
    turn:1,
    player:{active:[baseUnitFromSlot(playerLeads[0],'player',0,false), baseUnitFromSlot(playerLeads[1],'player',1,false)], bench:[baseUnitFromSlot(playerBench[0],'player',2,true), baseUnitFromSlot(playerBench[1],'player',3,true)], accuracyBuffTurns:0},
    enemy:{active:[baseUnitFromSlot(enemyLeads[0],'enemy',0,false), baseUnitFromSlot(enemyLeads[1],'enemy',1,false)], bench:[baseUnitFromSlot(enemyBench[0],'enemy',2,true), baseUnitFromSlot(enemyBench[1],'enemy',3,true)], accuracyBuffTurns:0},
    terrain:{primary:null, secondary:[]},
    pendingReplacements:[]
  };
  sim.started = true;
  document.getElementById('battleBoard').classList.remove('hidden');
  document.getElementById('battleLog').innerHTML = '';
  log(`Battle started. No team preview. Double battle format: choose 4, lead 2.`);
  applyInitialEntries();
  renderBattle();
}

function getTypeMultiplier(move, target, actor=null){
  const atkTypes = getMoveTypes(move, actor);
  let total = 1;
  atkTypes.forEach(atkType => {
    if (target.volatile.immuneTypes.has(atkType)) {
      total *= 0;
      return;
    }
    [target.type1, target.type2].filter(Boolean).forEach(defType => {
      total *= (typeChart[atkType]?.[defType] ?? 1);
    });
  });
  if (normalizeText(actor?.item) === 'brass knuckles' && atkTypes.includes('Primal')) {
    const immuneMind = [target.type1,target.type2].includes('Mind');
    if (!immuneMind && total <= 1) total = 2;
  }
  return Math.min(total, 4);
}

function getAccuracyMultiplier(sideKey){
  const own = sim.state?.[sideKey];
  const accuracyBuff = own?.accuracyBuffTurns > 0 ? 1.2 : 1;
  const hasDeepAbyss = (sim.state?.terrain.secondary || []).some(t => t.name === 'Deep Abyss' && t.source.side === sideKey);
  return accuracyBuff * (hasDeepAbyss ? 1.05 : 1);
}

function hitChance(move, target, actor){
  const flags = moveFlags(move);
  const acc = Number(move.Accuracy || 100);
  if (target.blocking && move.Target_Class !== 'Self') return 100;
  if (acc >= 110 || flags.includes('sound')) return 100;
  let value = Math.floor(acc * (100 / Math.max(1, (target.stats.eva || 100))));
  value *= getAccuracyMultiplier(actor.side);
  if (normalizeText(actor.item) === 'lucky ring') value *= 1.1;
  if (normalizeText(actor.item) === 'glasses') value *= 1.3;
  if (target.status?.name === 'Blindness') value *= 0.8;
  const darknessActive = sim.state?.terrain.primary?.name === 'Darkness';
  if (darknessActive && !target.types.some(t => ['Soul','Monster'].includes(t))) value *= 0.7;
  if ((sim.state?.terrain.secondary || []).some(t => t.name === 'Deep Abyss' && t.source.side === actor.side) && !target.types.includes('Aqua')) value = Math.max(value, 70);
  return Math.max(35, Math.min(100, Math.round(value)));
}

function getBlockReduction(unit){
  if (unit.volatile.blockReductionOverride !== null) return Math.max(0, unit.volatile.blockReductionOverride);
  const item = normalizeText(unit.item);
  if (item === 'riot shield' && unit.blocking && unit.volatile.riotShieldHits < 3) return 1;
  let base = item === 'armor' ? 0.75 : (unit.blockBase ?? 0.60);
  if ((sim.state?.terrain.secondary || []).some(t => t.name === 'Mass Madness' && t.source.side !== unit.side)) base = 0.30;
  return Math.max(0, base - unit.consecutiveBlocks * 0.15);
}

function countAbilitySources(side, predicate){
  return side.active.filter(u => !u.fainted && predicate(normalizeText(u.ability), u)).length;
}

function getMovePowerModifier(actor, move, defender=null){
  let mod = 1;
  const ownSide = getOwnSide(actor.side);
  const enemySide = getOpposingSide(actor.side);
  const flags = moveFlags(move);
  const moveTypes = getMoveTypes(move, actor);

  const sameSideBoosts = [];
  ownSide.active.filter(u=>!u.fainted).forEach(source => {
    const ab = normalizeText(source.ability);
    if (ab === 'flame spec' && moveTypes.includes('Flame')) sameSideBoosts.push(1.2);
    if (ab === 'loud mouth' && flags.includes('sound')) sameSideBoosts.push(1.2);
    if (ab === 'stormy' && moveTypes.includes('Plasma')) sameSideBoosts.push(sim.state.terrain.primary?.name === 'Storm' ? 2 : 1.5);
    if (ab === 'adaptability' && moveTypes.some(t => source.types.includes(t))) sameSideBoosts.push(1.2);
  });
  sameSideBoosts.slice(0, MAX_ABILITY_STACKS).forEach(v => { mod *= v; });

  const item = normalizeText(actor.item);
  if (item === 'wet stone' && flags.includes('blade')) mod *= 1.25;
  if (item === 'crystal ball' && flags.includes('orb')) mod *= 1.35;
  if (item === 'headband') mod *= 1.5;
  if (item === 'ace card') mod *= 1.7;
  if (item === 'brass knuckles' && moveTypes.includes('Primal')) mod *= 1.2;
  if (actor.item && /orb$/i.test(actor.item)) {
    const orbType = actor.item.replace(/\s*Orb$/i,'').trim();
    if (moveTypes.some(t => normalizeText(t) === normalizeText(orbType))) mod *= 1.2;
  }

  const terrain = sim.state?.terrain.primary?.name;
  if (terrain === 'Drought' && moveTypes.includes('Flame')) mod *= 1.2;
  if (terrain === 'Storm' && (moveTypes.includes('Aqua') || moveTypes.includes('Wind'))) mod *= 1.2;
  if (terrain === 'Fallout' && moveTypes.includes('Toxic')) mod *= 1.3;
  if (terrain === 'Darkness' && (moveTypes.includes('Soul') || moveTypes.includes('Monster'))) mod *= 1.1;
  if (defender && normalizeText(defender.ability) === 'flame spec' && moveTypes.includes('Flame')) mod *= 0.5;
  if (defender && normalizeText(defender.item) === 'bulletproof vest' && moveTypes.includes('Alloy')) mod *= 0.5;
  return mod;
}

function maybeRedirect(move, enemySide, actor){
  const moveTypes = getMoveTypes(move, actor);
  const redirectItem = moveTypes.includes('Plasma') ? 'lightning rod' : moveTypes.includes('Terra') ? 'quake brace' : null;
  if (!redirectItem) return null;
  return enemySide.active.find(u => !u.fainted && normalizeText(u.item) === redirectItem) || null;
}

function getEffectiveDefenderStat(defender, move){
  let defStat = move.Category === 'Special' ? defender.stats.spd : defender.stats.def;
  const terrain = sim.state?.terrain.primary?.name;
  if (terrain === 'Blizzard' && defender.types.includes('Frost')) defStat *= 1.1;
  if (terrain === 'Drought' && defender.types.includes('Terra')) defStat *= 1.2;
  return Math.max(1, defStat);
}

function damage(attacker, defender, move, spread){
  if (normalizeText(defender.ability) === 'driller' && defender.volatile.burrowed) {
    if (!spread && move.Target_Class !== 'Both Foes') return 0;
  }
  const level = 50;
  const power = Number(move.Power || 0);
  if (!power) return 0;
  const atkStat = move.Category === 'Special' ? attacker.stats.spa : attacker.stats.atk;
  const defStat = getEffectiveDefenderStat(defender, move);
  const targets = spread ? 0.75 : 1;
  const moveTypes = getMoveTypes(move, attacker);
  const stab = moveTypes.some(t => attacker.types.includes(t)) ? 1.25 : 1;
  const type = getTypeMultiplier(move, defender, attacker);
  if (type === 0) return 0;
  const random = 0.93 + Math.random()*0.07;
  let dmg = ((((24 + level) * power * atkStat * getMovePowerModifier(attacker, move, defender)) / (32 * defStat)) + 8) * targets * 1 * stab * type * 1 * random;
  if (defender.volatile.burrowed && spread) dmg *= 0.5;
  if (defender.blocking && move.Target_Class !== 'Self') {
    const reduction = getBlockReduction(defender);
    dmg *= (1 - reduction);
  }
  return Math.max(1, Math.floor(dmg));
}

function chooseEnemyAction(unit, state) {
  const opponents = state.player.active.filter(x=>!x.fainted);
  if (!unit.moves.length || !opponents.length) return {type:'block'};
  if (unit.hp / unit.maxHp < 0.28) {
    const healthyBench = state.enemy.bench.find(b=>!b.fainted && b.bench);
    if (healthyBench) return {type:'switch', switchTo: healthyBench.beastId};
  }
  let best = null;
  for (const move of unit.moves) {
    const possibleTargets = getTargetPoolForMove(unit, move, true);
    if (!possibleTargets.length && move.Category !== 'Status') continue;
    const spread = isSpreadMove(move, unit);
    const targetChoices = spread ? [null] : possibleTargets;
    for (const target of targetChoices) {
      const score = move.Category === 'Status' ? 25 : (Number(move.Power || 0) * (target ? getTypeMultiplier(move, target, unit) : 1.2) * (spread ? 1.2 : 1));
      if (!best || score > best.score) best = {type:'move', move, targetId:target?.beastId || null, score};
    }
  }
  return best || {type:'block'};
}

function isSpreadMove(move, actor){
  const flags = moveFlags(move);
  if (move.Target_Class === 'Both Foes' || move.Target_Class === 'All Beasts') return true;
  if (flags.includes('sound') && move.Target_Class !== 'Self' && move.Target_Class !== 'Ally') return true;
  return flags.includes('spread');
}

function getTargetPoolForMove(actor, move, enemyOnly=false){
  const ownSide = getOwnSide(actor.side);
  const enemySide = getOpposingSide(actor.side);
  const tc = normalizeText(move.Target_Class);
  if (tc === 'self') return [actor];
  if (tc === 'ally' || tc === 'ally target') return ownSide.active.filter(u=>!u.fainted && u !== actor);
  if (isSpreadMove(move, actor)) return enemySide.active.filter(u=>!u.fainted);
  return enemySide.active.filter(u=>!u.fainted);
}

function collectPlayerAction(unit) {
  const actionWrap = document.getElementById('battleActions');
  const side = getOwnSide('player');
  const enemySide = getOpposingSide('player');
  const box = el('div',{class:'action-box'});
  box.append(el('h3',{},unit.name));

  const select = el('select');
  select.append(el('option',{value:'block'},'Block'));
  unit.moves.forEach(m => select.append(el('option',{value:`move:${m.Move_ID}`}, `${m.Move_Name} (${getMoveTypes(m, unit).join('/')})`)));
  side.bench.filter(b=>!b.fainted && b.bench).forEach(b => select.append(el('option',{value:`switch:${b.beastId}`}, `Switch → ${b.name}`)));
  box.append(select);

  const targetField = el('div',{class:'field'});
  const target = el('select');
  targetField.append(el('label',{},'Target'), target);
  box.append(targetField);

  function refreshTargets(){
    target.innerHTML = '';
    const [kind,id] = select.value.split(':');
    if (kind === 'move') {
      const move = moveById[Number(id)];
      const options = getTargetPoolForMove(unit, move);
      if (isSpreadMove(move, unit) || normalizeText(move.Target_Class)==='self' || normalizeText(move.Target_Class)==='field') {
        target.append(el('option',{value:''}, isSpreadMove(move, unit) ? 'Hits both opposing beasts' : 'No target needed'));
        target.disabled = true;
      } else {
        target.disabled = false;
        options.forEach(opt => target.append(el('option',{value:opt.beastId}, opt.name)));
        if (!options.length) target.append(el('option',{value:''}, 'No legal target'));
      }
    } else {
      target.append(el('option',{value:''}, kind === 'switch' ? 'No target needed' : 'Block all incoming damage reductions'));
      target.disabled = true;
    }
  }
  select.addEventListener('change', refreshTargets);
  refreshTargets();
  actionWrap.append(box);

  return () => {
    const [kind,id] = select.value.split(':');
    if (kind === 'move') return {type:'move', move:moveById[Number(id)], targetId:Number(target.value) || null};
    if (kind === 'switch') return {type:'switch', switchTo:Number(id)};
    return {type:'block'};
  };
}

function syncBench(sideKey){
  const side = sim.state[sideKey];
  side.bench = side.bench.filter(b=>b.bench && !side.active.includes(b));
}
function teamDown(side){ return [...side.active, ...side.bench].every(u=>u.fainted); }
function log(text){ document.getElementById('battleLog').prepend(el('div',{class:'log-entry'},`Turn ${sim.state?.turn || 0}: ${text}`)); }

function clearSwitchSensitiveStatuses(unit){
  if (!unit) return;
  if (unit.status?.name === 'Confusion' || unit.status?.name === 'Infected') unit.status = null;
  unit.statusCounter = 0;
  unit.volatile.burrowed = false;
}

function applyStatus(unit, statusName, silent=false){
  let normalized = statusName;
  if (normalizeText(statusName) === 'infect') normalized = 'Infected';
  const status = statusByName(normalized);
  if (!status) return false;
  if (normalizeText(unit.item) === 'guide book' && normalizeText(normalized) === 'stun') return false;
  if (normalizeText(unit.item) === 'hazard mask' && !unit.volatile.onceItemUsed) {
    unit.volatile.onceItemUsed = true;
    unit.item = '';
    if (!silent) log(`${unit.name}'s Hazard Mask blocked ${normalized}.`);
    return false;
  }
  if (unit.status?.name === 'Infected' && normalizeText(normalized) === 'infected') return false;
  unit.status = {name: status.Status};
  if (status.Status === 'Stun') unit.statusCounter = 1;
  else if (status.Status === 'Confusion') unit.statusCounter = 2;
  else unit.statusCounter = 0;
  if (!silent) log(`${unit.name} is now ${status.Status}.`);
  return true;
}

function inferStatusFromMove(move){
  const effect = normalizeText(move.Effect);
  if (effect.includes('burn')) return 'Burn';
  if (effect.includes('poison')) return 'Poison';
  if (effect.includes('freeze')) return 'Freeze';
  if (effect.includes('blind')) return 'Blindness';
  if (effect.includes('sleep')) return 'Sleep';
  if (effect.includes('stun')) return 'Stun';
  if (effect.includes('confus')) return 'Confusion';
  if (effect.includes('infect')) return 'Infected';
  return null;
}

function confusionSelfDamage(actor){
  const def = Math.max(1, actor.stats.def);
  const atk = Math.max(1, actor.stats.atk);
  return Math.max(1, Math.floor(((((24 + 50) * 40 * atk) / (32 * def)) + 8) * (0.93 + Math.random()*0.07)));
}

function beforeActionStatusCheck(actor){
  if (!actor.status) return true;
  const name = actor.status.name;
  if (name === 'Sleep') {
    log(`${actor.name} cannot act because of Sleep.`);
    return false;
  }
  if (name === 'Stun') {
    log(`${actor.name} cannot act because of Stun.`);
    actor.status = null;
    actor.statusCounter = 0;
    return false;
  }
  if (name === 'Confusion') {
    if (Math.random() < 0.33) {
      const selfDmg = confusionSelfDamage(actor);
      actor.hp = Math.max(0, actor.hp - selfDmg);
      log(`${actor.name} hurt itself in confusion for ${selfDmg}.`);
      if (actor.hp <= 0) actor.fainted = true;
      actor.statusCounter = Math.max(0, actor.statusCounter - 1);
      if (actor.statusCounter === 0) actor.status = null;
      return false;
    }
    actor.statusCounter = Math.max(0, actor.statusCounter - 1);
    if (actor.statusCounter === 0) actor.status = null;
  }
  return true;
}

function triggerOnWindMove(){
  activeAll().filter(u=>!u.fainted && normalizeText(u.ability)==='sky bender').forEach(u => {
    u.stats.spe = Math.round(u.stats.spe * stageMods[1]);
    u.stats.atk = Math.round(u.stats.atk * stageMods[1]);
    log(`${u.name}'s Sky Bender boosted its Attack and Speed.`);
  });
}

function applyMoveSpecialEffects(actor, move, targets, spread){
  const effect = normalizeText(move.Effect);
  if (move.Move_Name === 'Thunder Struck') {
    actor.stats.spe = Math.max(1, Math.round(actor.stats.spe * stageMods['-2']));
    log(`${actor.name}'s Speed fell sharply from Thunder Struck.`);
  }
  if (move.Move_Name === 'Molten Rock') {
    const enemySide = getOpposingSide(actor.side);
    enemySide.hazardMagma = true;
    enemySide.hazardSource = actor;
    log(`${actor.name} coated the opposing side in magma.`);
  }
  if (effect.includes('switches out user') || normalizeText(move.Move_Name) === 'smoke bomb') {
    const benchTarget = getOwnSide(actor.side).bench.find(b=>!b.fainted && b.bench);
    if (benchTarget) actor.volatile.pendingSwitchTarget = benchTarget.beastId;
  }
  if (effect.includes('terrain') || moveFlags(move).includes('terrain')) {
    const tName = (DATA.terrains || []).find(t => effect.includes(normalizeText(t.Name)) && t.Name !== 'General')?.Name;
    if (tName) activateTerrain(tName, normalizeText(getTerrainRecord(tName)?.Terrain_Class).includes('secondary') ? 'secondary' : 'primary', actor);
  }
  if (getMoveTypes(move, actor).includes('Wind')) triggerOnWindMove();
  if (move.Move_Name === 'Fuze') {
    // Fusion system not fully automated; keep log so users know why the move is special.
    log(`${actor.name} used Fuze. Fusion behavior still requires a dedicated multi-unit fusion implementation.`);
  }
}

function resolveSelfKOFromMove(actor, move){
  const isBomb = normalizeText(move.Move_Name).includes('bomb') || normalizeText(move.Effect).includes('self destruct');
  if (isBomb && normalizeText(actor.ability) !== 'bomb holster') {
    actor.hp = 0; actor.fainted = true;
    log(`${actor.name} fainted from ${move.Move_Name}.`);
  }
  if (normalizeText(actor.item) === 'brass knuckles' && getMoveTypes(move, actor).includes('Primal')) {
    const recoil = Math.max(1, Math.floor(actor.maxHp * 0.35));
    actor.hp = Math.max(0, actor.hp - recoil);
    log(`${actor.name} lost ${recoil} HP from Brass Knuckles.`);
    if (actor.hp <= 0) actor.fainted = true;
  }
}

function applyEndTurn(){
  for (const sideKey of ['player','enemy']) {
    const side = sim.state[sideKey];
    const ally0 = side.active[1], ally1 = side.active[0];
    side.active.forEach((unit, idx) => {
      if (unit.fainted) return;
      const status = unit.status?.name;
      if (status === 'Poison' || status === 'Burn') {
        const pct = 0.05;
        const dmg = Math.max(1, Math.floor(unit.maxHp * pct));
        unit.hp = Math.max(0, unit.hp - dmg);
        log(`${unit.name} took ${dmg} damage from ${status}.`);
        if (unit.hp <= 0) unit.fainted = true;
      }
      if (status === 'Infected') {
        const dmg = Math.max(1, Math.floor(unit.maxHp * 0.10));
        unit.hp = Math.max(0, unit.hp - dmg);
        log(`${unit.name} took ${dmg} damage from Infected.`);
        if (unit.hp <= 0) unit.fainted = true;
      }
      if (status === 'Freeze') unit.stats.spe = Math.max(1, Math.round(unit.stats.spe * 0.7));
      if (normalizeText(unit.item) === 'hot soup') {
        const heal = Math.max(1, Math.floor(unit.maxHp * 0.1));
        unit.hp = Math.min(unit.maxHp, unit.hp + heal);
        log(`${unit.name} restored ${heal} HP with Hot Soup.`);
      }
      if (normalizeText(unit.item) === 'dry icecream') {
        const heal = Math.max(1, Math.floor(unit.maxHp * 0.05));
        unit.hp = Math.min(unit.maxHp, unit.hp + heal);
        log(`${unit.name} restored ${heal} HP with Dry Icecream.`);
      }
      if (normalizeText(unit.ability) === 'doctor') {
        const ally = idx === 0 ? ally0 : ally1;
        if (ally && !ally.fainted) {
          const heal = Math.max(1, Math.floor(ally.maxHp / 16));
          ally.hp = Math.min(ally.maxHp, ally.hp + heal);
          log(`${unit.name}'s Doctor healed ${ally.name} for ${heal}.`);
        }
      }
      if ((normalizeText(unit.item) === 'medical brew' || normalizeText(unit.item) === 'candy apple') && !unit.volatile.onceItemUsed && unit.hp <= unit.maxHp * (normalizeText(unit.item) === 'medical brew' ? 0.25 : 0.5)) {
        const heal = Math.floor(unit.maxHp * 0.5);
        unit.hp = Math.min(unit.maxHp, unit.hp + heal);
        unit.volatile.onceItemUsed = true;
        log(`${unit.name} consumed ${getItemData(unit.item).Item} and healed ${heal} HP.`);
      }
      if (sim.state.terrain.primary?.name === 'Storm' && unit.types.includes('Flora')) {
        const heal = Math.max(1, Math.floor(unit.maxHp / 6));
        unit.hp = Math.min(unit.maxHp, unit.hp + heal);
        log(`${unit.name} healed ${heal} HP from Storm terrain.`);
      }
      if (sim.state.terrain.primary?.name === 'Blizzard' && !unit.types.some(t=>['Frost','Flame'].includes(t)) && Math.random() < 0.15) applyStatus(unit, 'Freeze');
      if ((sim.state.terrain.secondary || []).some(t => t.name === 'Flower Garden')) {
        const healPct = unit.types.includes('Flora') ? 0.10 : 0.06;
        const heal = Math.max(1, Math.floor(unit.maxHp * healPct));
        unit.hp = Math.min(unit.maxHp, unit.hp + heal);
        log(`${unit.name} healed ${heal} HP from Flower Garden.`);
      }
      if (unit.status?.name === 'Infected') {
        const adjacentEnemy = getOpposingSide(unit.side).active.find(x=>!x.fainted && !x.status);
        if (adjacentEnemy && Math.random() < 0.20) applyStatus(adjacentEnemy, 'Infected');
      }
    });
    if (side.accuracyBuffTurns > 0) side.accuracyBuffTurns -= 1;
  }
  handlePendingReplacements();
}

function handlePendingReplacements(){
  ['player','enemy'].forEach(sideKey => {
    const side = sim.state[sideKey];
    side.active = side.active.map(unit => {
      if (!unit.fainted) return unit;
      removeTerrainsFromSource(unit);
      const replacement = side.bench.find(b=>!b.fainted && b.bench);
      if (replacement) {
        replacement.position = unit.position;
        replacement.bench = false;
        initUnit(replacement, side.active.find(x=>x!==unit && !x.fainted), sim.state.turn + 1);
        if (side.hazardMagma && replacement !== side.hazardSource && !replacement.types.includes('Flame')) {
          const hazard = Math.max(1, Math.floor(replacement.maxHp * 0.2));
          replacement.hp = Math.max(0, replacement.hp - hazard);
          log(`${replacement.name} took ${hazard} damage from magma on entry.`);
          if (replacement.hp <= 0) replacement.fainted = true;
        }
        log(`${replacement.name} entered for ${sideKey} at end of turn.`);
        applyEntryAbility(replacement, 'entered the battle');
        return replacement;
      }
      return unit;
    });
    syncBench(sideKey);
  });
}

function renderCombatant(unit){
  const pct = Math.max(0, Math.round((unit.hp / unit.maxHp) * 100));
  return `<div class="combatant ${unit.fainted?'fainted':''}">
    <strong>${unit.name}</strong>
    <div class="small">${unit.types.join('/')} • ${unit.ability || 'No ability selected'}${unit.item ? ` • ${unit.item}` : ''}</div>
    <div class="hpbar"><span style="width:${pct}%"></span></div>
    <div>${Math.max(0,unit.hp)}/${unit.maxHp} HP</div>
    <div class="small">${unit.status ? `Status: ${unit.status.name}` : (unit.blocking ? `Blocking (${Math.max(0,Math.round(getBlockReduction(unit)*100))}% reduction)` : (unit.volatile.burrowed ? 'Burrowed' : 'Ready'))}</div>
  </div>`;
}

function renderBattle(){
  if (!sim.state) return;
  ['player','enemy'].forEach(sideKey => {
    document.getElementById(`${sideKey}Active`).innerHTML = sim.state[sideKey].active.map(renderCombatant).join('');
    document.getElementById(`${sideKey}Bench`).innerHTML = sim.state[sideKey].bench.map(renderCombatant).join('');
  });
  const actionWrap = document.getElementById('battleActions');
  const primaryTerrain = sim.state.terrain.primary?.name || 'None';
  const secondary = (sim.state.terrain.secondary || []).map(t=>t.name).join(', ') || 'None';
  actionWrap.innerHTML = `<p class="small">Turn ${sim.state.turn}. Choose an action for each active beast.<br><strong>Primary terrain:</strong> ${primaryTerrain}<br><strong>Secondary terrain:</strong> ${secondary}</p>`;
  const readers = sim.state.player.active.filter(u=>!u.fainted).map(u => ({unit:u, read:collectPlayerAction(u)}));
  actionWrap.append(el('button',{onclick:()=>resolveTurn(readers)},'Resolve Turn'));
}

function getPriority(actor, action){
  let p = Number(action.move?.Priority || 0);
  if (action.type === 'switch') p += 0;
  if (normalizeText(actor.ability) === 'quickdraw' && action.move?.Category === 'Special') p += 1;
  if (normalizeText(actor.item) === 'star gem' && action.move?.Category === 'Status' && !actor.volatile.onceItemUsed) p += 1;
  if (normalizeText(actor.item) === 'brass knuckles' && action.move && getMoveTypes(action.move, actor).includes('Primal')) p -= 10;
  return p;
}

function performSwitch(actor, switchToId){
  const side = getOwnSide(actor.side);
  const benchIdx = side.bench.findIndex(b => !b.fainted && b.bench && b.beastId === switchToId);
  if (benchIdx === -1) {
    log(`${actor.name} had no legal switch target.`);
    return;
  }
  if ((sim.state.terrain.secondary || []).some(t => t.name === 'Spirit Chain' && t.source.side !== actor.side) && actor.hp > actor.maxHp * 0.5) {
    log(`${actor.name} could not switch because of Spirit Chain.`);
    return;
  }
  const replacement = side.bench[benchIdx];
  side.bench.splice(benchIdx, 1);
  const oldPos = actor.position;
  const activeIdx = side.active.findIndex(u => u === actor);
  clearSwitchSensitiveStatuses(actor);
  removeTerrainsFromSource(actor);
  actor.bench = true;
  actor.position = replacement.position;
  side.bench.push(actor);
  replacement.position = oldPos;
  replacement.bench = false;
  side.active[activeIdx] = replacement;
  initUnit(replacement, side.active.find(x=>x!==replacement && !x.fainted), sim.state.turn);
  if (side.hazardMagma && replacement !== side.hazardSource && !replacement.types.includes('Flame')) {
    const hazard = Math.max(1, Math.floor(replacement.maxHp * 0.2));
    replacement.hp = Math.max(0, replacement.hp - hazard);
    log(`${replacement.name} took ${hazard} damage from magma on entry.`);
    if (replacement.hp <= 0) replacement.fainted = true;
  }
  log(`${actor.name} switched out. ${replacement.name} entered.`);
  applyEntryAbility(replacement, 'entered the battle');
}

function resolveTurn(readers){
  const state = sim.state;
  const playerActions = readers.map(r=>({actor:r.unit, action:r.read()}));
  const enemyActions = state.enemy.active.filter(u=>!u.fainted).map(u=>({actor:u, action:chooseEnemyAction(u,state)}));
  const queue = [...playerActions, ...enemyActions].sort((a,b) => {
    const pa = getPriority(a.actor, a.action), pb = getPriority(b.actor, b.action);
    if (pa !== pb) return pb - pa;
    if (normalizeText(a.actor.ability) === 'pack tactics' || normalizeText(b.actor.ability) === 'pack tactics') {
      const aAlly = state[a.actor.side].active.find(x=>x!==a.actor && !x.fainted);
      const bAlly = state[b.actor.side].active.find(x=>x!==b.actor && !x.fainted);
      if (normalizeText(a.actor.ability) === 'pack tactics' && aAlly && a.actor.stats.spe < aAlly.stats.spe) return 1;
      if (normalizeText(b.actor.ability) === 'pack tactics' && bAlly && b.actor.stats.spe < bAlly.stats.spe) return -1;
    }
    return b.actor.stats.spe - a.actor.stats.spe;
  });

  activeAll().forEach(u=>u.blocking=false);
  queue.forEach((step, idx) => step.actor.currentActionIndex = idx);

  for (const step of queue) {
    const actor = step.actor;
    const {action} = step;
    if (actor.fainted) continue;
    actor.temp.acted = true;
    if (!beforeActionStatusCheck(actor)) continue;
    if (action.type === 'switch') {
      performSwitch(actor, action.switchTo);
      continue;
    }
    if (action.type === 'block') {
      actor.blocking = true;
      actor.consecutiveBlocks += 1;
      if (normalizeText(actor.ability) === 'driller') {
        actor.volatile.burrowed = true;
        actor.volatile.burrowEndsOnAttack = true;
        log(`${actor.name} blocked and burrowed underground.`);
      } else {
        log(`${actor.name} blocks.`);
      }
      continue;
    }
    actor.blocking = false;
    actor.consecutiveBlocks = 0;
    if (normalizeText(actor.ability) === 'driller' && actor.volatile.burrowEndsOnAttack) actor.volatile.burrowed = false;

    const move = action.move;
    const ownSide = getOwnSide(actor.side);
    const enemySide = getOpposingSide(actor.side);
    let targets = [];
    if (normalizeText(move.Target_Class) === 'self') targets = [actor];
    else if (normalizeText(move.Target_Class).includes('ally')) targets = ownSide.active.filter(x=>!x.fainted && x !== actor).slice(0,1);
    else if (isSpreadMove(move, actor)) targets = enemySide.active.filter(x=>!x.fainted);
    else {
      targets = [enemySide.active.find(x=>x.beastId === action.targetId && !x.fainted) || enemySide.active.find(x=>!x.fainted)].filter(Boolean);
    }
    const redirected = maybeRedirect(move, enemySide, actor);
    if (redirected && !isSpreadMove(move, actor) && !targets.includes(redirected)) {
      targets = [redirected];
      log(`${redirected.name} redirected ${move.Move_Name}.`);
    }
    if (!targets.length && move.Category !== 'Status') continue;
    if (normalizeText(actor.item) === 'headband' && !actor.volatile.headbandLock) actor.volatile.headbandLock = move.Move_ID;
    if (normalizeText(actor.item) === 'headband' && actor.volatile.headbandLock && actor.volatile.headbandLock !== move.Move_ID) {
      log(`${actor.name} is locked into its first move by Headband.`);
      continue;
    }
    if (normalizeText(actor.item) === 'star gem' && move.Category === 'Status' && !actor.volatile.onceItemUsed) actor.volatile.onceItemUsed = true;

    for (const target of targets.length ? targets : [null]) {
      if (target && target.fainted) continue;
      const hc = target ? hitChance(move, target, actor) : 100;
      if (target && Math.random()*100 > hc) { log(`${actor.name}'s ${move.Move_Name} missed ${target.name}.`); continue; }
      if (move.Category === 'Status' || !move.Power) {
        const inferred = inferStatusFromMove(move);
        if (target && inferred) applyStatus(target, inferred);
        else if (normalizeText(move.Effect).includes('heal')) {
          const healTarget = target || actor;
          const healMod = healTarget.status?.name === 'Infected' ? 0.5 : 1;
          const heal = Math.max(1, Math.floor(actor.maxHp * 0.25 * healMod));
          healTarget.hp = Math.min(healTarget.maxHp, healTarget.hp + heal);
          log(`${actor.name} used ${move.Move_Name} and healed ${healTarget.name} for ${heal}.`);
        } else {
          log(`${actor.name} used ${move.Move_Name}.${move.Effect ? ' ' + move.Effect : ''}`);
        }
        applyMoveSpecialEffects(actor, move, targets, false);
        continue;
      }
      const spread = isSpreadMove(move, actor);
      const hits = normalizeText(actor.item) === 'clover' && moveFlags(move).includes('multi_hit') ? 4 : 1;
      let totalDmg = 0;
      for (let h=0; h<hits; h++) {
        const dmg = damage(actor, target, move, spread);
        totalDmg += dmg;
        target.hp -= dmg;
        if (target.blocking && normalizeText(target.item) === 'riot shield') target.volatile.riotShieldHits += 1;
        if (normalizeText(target.ability) === 'haunted' && move.Category === 'Physical' && !target.fainted) {
          actor.volatile.blockReductionOverride = 0.45;
          actor.volatile.blockReductionOverrideTurns = 3;
          log(`${target.name}'s Haunted weakened ${actor.name}'s Block.`);
        }
        if (target.hp <= 0) { target.hp = 0; target.fainted = true; break; }
      }
      const typeMult = getTypeMultiplier(move, target, actor);
      log(`${actor.name} used ${move.Move_Name} on ${target.name} for ${totalDmg} damage${hits>1?` over ${hits} hits`:''}${typeMult > 1 ? ' (super effective)' : typeMult < 1 ? ' (resisted)' : ''}.`);
      const inferred = inferStatusFromMove(move);
      if (inferred && Math.random() < (normalizeText(actor.item) === 'lighter' && inferred === 'Burn' ? 0.4 : 0.3)) applyStatus(target, inferred);
      if (normalizeText(actor.item) === 'lighter' && !actor.status) applyStatus(actor, 'Burn');
      if (target.fainted) {
        removeTerrainsFromSource(target);
        log(`${target.name} fainted.`);
      }
    }
    applyMoveSpecialEffects(actor, move, targets, isSpreadMove(move, actor));
    resolveSelfKOFromMove(actor, move);
    if (actor.volatile.pendingSwitchTarget && !actor.fainted) {
      const targetId = actor.volatile.pendingSwitchTarget;
      actor.volatile.pendingSwitchTarget = null;
      performSwitch(actor, targetId);
    }
    if (teamDown(state.player) || teamDown(state.enemy)) break;
  }

  applyEndTurn();

  if (teamDown(state.player) || teamDown(state.enemy)) {
    log(teamDown(state.enemy) ? 'You win!' : 'Enemy wins.');
  } else {
    state.turn += 1;
    renderBattle();
  }
  ['player','enemy'].forEach(side => {
    document.getElementById(`${side}Active`).innerHTML = state[side].active.map(renderCombatant).join('');
    document.getElementById(`${side}Bench`).innerHTML = state[side].bench.map(renderCombatant).join('');
  });
}

document.getElementById('builderSearch').addEventListener('input', e=>renderBeastList(e.target.value));
document.getElementById('wikiSearch').addEventListener('input', e=>renderWiki(e.target.value));
document.querySelectorAll('.segment').forEach(btn => btn.addEventListener('click', ()=>{
  wikiKind = btn.dataset.kind; document.querySelectorAll('.segment').forEach(x=>x.classList.toggle('active', x===btn)); renderWiki(document.getElementById('wikiSearch').value);
}));

document.getElementById('sampleTeamBtn').addEventListener('click', ()=>{ team = randomTeam(); saveTeam(); renderTeam(); });
document.getElementById('exportTeamBtn').addEventListener('click', ()=>{
  const blob = new Blob([exportTeamJSON()], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'beast-kai-team.json'; a.click(); URL.revokeObjectURL(a.href);
});
document.getElementById('copyTeamBtn').addEventListener('click', async ()=>{ await navigator.clipboard.writeText(exportTeamText()); alert('Team text copied.'); });
document.getElementById('importTeamBtn').addEventListener('click', ()=>{ const text = prompt('Paste exported team JSON'); if (text) importTeam(text); });
document.getElementById('syncSimBtn').addEventListener('click', ()=>renderBattlePickers());
document.getElementById('randomEnemyBtn').addEventListener('click', ()=>{ sim.enemyRoster = randomTeam(); renderBattlePickers(); });
document.getElementById('startBattleBtn').addEventListener('click', startBattle);

renderBeastList();
renderTeam();
renderWiki();
renderRules();

/* ===== Phase 2 Canonical Mechanics Patch ===== */
(function(){
  function txt(v){ return normalizeText(v); }
  function hasType(unit, t){ return unit?.types?.some(x => txt(x) === txt(t)); }
  function hasFlag(move, flag){ return moveFlags(move).includes(txt(flag)); }
  function stageMult(stage){ return stageMods[stage] || 1; }
  function withCheatingCoinTie(a,b, cmp){
    if (cmp !== 0) return cmp;
    const aCoin = txt(a.item) === 'cheating coin';
    const bCoin = txt(b.item) === 'cheating coin';
    if (aCoin && !bCoin) return -1;
    if (!aCoin && bCoin) return 1;
    return Math.random() < 0.5 ? -1 : 1;
  }

  function getEffectiveSpeed(unit){
    let spe = unit.stats.spe;
    if (unit.status?.name === 'Freeze') spe = Math.max(1, Math.round(spe * 0.7));
    return spe;
  }

  function canUseMove(actor, move){
    if (!move) return false;
    if (actor.volatile.electricSurgeLock && actor.volatile.electricSurgeLock.moveId !== move.Move_ID) return false;
    if (move.Move_Name === 'Nightmare' && actor.status?.name !== 'Sleep') return false;
    return true;
  }

  function statusImmune(unit, statusName){
    const s = txt(statusName);
    if (s === 'sleep' && hasType(unit, 'Flora')) return true;
    if (s === 'burn' && (hasType(unit, 'Flame') || hasType(unit, 'Terra'))) return true;
    if (s === 'poison' && (hasType(unit, 'Toxic') || hasType(unit, 'Alloy'))) return true;
    if ((s === 'freeze' || s === 'frozen') && (hasType(unit, 'Frost') || hasType(unit, 'Flame'))) return true;
    return false;
  }

  applyStatus = function(unit, statusName, silent=false){
    let normalized = statusName;
    if (txt(statusName) === 'frozen') normalized = 'Freeze';
    if (txt(statusName) === 'infect') normalized = 'Infected';
    const status = statusByName(normalized);
    if (!status || !unit || unit.fainted) return false;
    if (statusImmune(unit, status.Status)) {
      if (!silent) log(`${unit.name} is immune to ${status.Status}.`);
      return false;
    }
    if (txt(unit.item) === 'guide book' && txt(status.Status) === 'stun') return false;
    if (txt(unit.item) === 'hazard mask' && !unit.volatile.onceItemUsed) {
      unit.volatile.onceItemUsed = true;
      unit.item = '';
      if (!silent) log(`${unit.name}'s Hazard Mask blocked ${status.Status}.`);
      return false;
    }
    unit.status = {name: status.Status};
    if (status.Status === 'Stun') unit.statusCounter = 1;
    else if (status.Status === 'Confusion') unit.statusCounter = 2;
    else if (status.Status === 'Sleep') unit.statusCounter = unit.statusCounter || 2;
    else unit.statusCounter = 0;
    if (!silent) log(`${unit.name} is now ${status.Status}.`);
    return true;
  };

  beforeActionStatusCheck = function(actor){
    if (!actor.status) return true;
    const name = actor.status.name;
    if (name === 'Sleep') {
      if (actor.pendingAction?.move?.Move_Name === 'Nightmare') return true;
      log(`${actor.name} cannot act because of Sleep.`);
      actor.statusCounter = Math.max(0, (actor.statusCounter || 1) - 1);
      if (actor.statusCounter === 0) actor.status = null;
      return false;
    }
    if (name === 'Stun') {
      log(`${actor.name} cannot act because of Stun.`);
      actor.status = null;
      actor.statusCounter = 0;
      return false;
    }
    if (name === 'Confusion') {
      if (Math.random() < 0.33) {
        const selfDmg = confusionSelfDamage(actor);
        actor.hp = Math.max(0, actor.hp - selfDmg);
        log(`${actor.name} hurt itself in confusion for ${selfDmg}.`);
        if (actor.hp <= 0) actor.fainted = true;
        actor.statusCounter = Math.max(0, actor.statusCounter - 1);
        if (actor.statusCounter === 0) actor.status = null;
        return false;
      }
      actor.statusCounter = Math.max(0, actor.statusCounter - 1);
      if (actor.statusCounter === 0) actor.status = null;
    }
    return true;
  };

  hitChance = function(move, target, actor){
    const flags = moveFlags(move);
    const acc = Number(move.Accuracy || 100);
    const moveName = move.Move_Name;
    if (!target) return 100;
    if (target.blocking && moveName !== 'Sand Burial') return 100;
    if (acc >= 110 || (flags.includes('sound') && !txt(move.Target_Class).includes('ally') && !txt(move.Target_Class).includes('self'))) return 100;
    let eva = Math.max(1, (target.stats.eva || 100));
    let value = Math.floor(acc * (100 / eva));
    value *= getAccuracyMultiplier(actor.side);
    if (txt(actor.item) === 'lucky ring') value *= 1.1;
    if (txt(actor.item) === 'glasses') value *= 1.3;
    if (actor.status?.name === 'Blindness') value *= 0.8;
    const darknessActive = sim.state?.terrain.primary?.name === 'Darkness';
    if (darknessActive && !target.types.some(t => ['Soul','Monster'].includes(t))) value *= 0.7;
    return Math.max(35, Math.min(100, Math.floor(value)));
  };

  activateTerrain = function(name, cls, sourceUnit, durationOverride){
    if (!name || !sourceUnit) return;
    const state = sim.state;
    if (cls === 'secondary') {
      state.terrain.secondary = state.terrain.secondary.filter(t => !(t.name === name && t.source.side === sourceUnit.side));
      state.terrain.secondary.push({name, source: sourceUnit, turnsRemaining: durationOverride ?? null});
      sourceUnit.volatile.sourceTerrains.push({name, class:'secondary'});
      log(`${sourceUnit.name} activated ${name}.`);
      return;
    }
    const old = state.terrain.primary;
    state.terrain.primary = {name, source: sourceUnit, turnsRemaining: durationOverride ?? 5};
    sourceUnit.volatile.sourceTerrains.push({name, class:'primary'});
    if (old && old.name !== name) log(`${old.name} faded.`);
    log(`${sourceUnit.name} activated ${name}.`);
  };

  removeTerrainsFromSource = function(sourceUnit){
    const state = sim.state;
    if (state.terrain.primary?.source === sourceUnit) {
      log(`${state.terrain.primary.name} ended.`);
      state.terrain.primary = null;
    }
    const before = state.terrain.secondary.length;
    state.terrain.secondary = state.terrain.secondary.filter(t => t.source !== sourceUnit);
    if (before !== state.terrain.secondary.length) log(`${sourceUnit.name}'s secondary terrain ended.`);
  };

  function getTerrainByName(name){ return (sim.state.terrain.secondary || []).find(t => t.name === name); }
  function reverseSpeedActive(){ return !!getTerrainByName('Shifting Reality'); }

  function scheduleSwitch(actor, switchToId){
    actor.volatile.pendingManualSwitchTarget = switchToId;
    log(`${actor.name} prepares to switch at end of turn.`);
  }

  function performSwitchAtEnd(actor, switchToId){
    const side = getOwnSide(actor.side);
    const benchIdx = side.bench.findIndex(b => !b.fainted && b.bench && b.beastId === switchToId);
    if (benchIdx === -1) return;
    if ((sim.state.terrain.secondary || []).some(t => t.name === 'Spirit Chain' && t.source.side !== actor.side) && actor.hp > actor.maxHp * 0.5) {
      log(`${actor.name} could not switch because of Spirit Chain.`);
      return;
    }
    const replacement = side.bench[benchIdx];
    side.bench.splice(benchIdx,1);
    const activeIdx = side.active.findIndex(u => u === actor);
    const oldPos = actor.position;
    clearSwitchSensitiveStatuses(actor);
    removeTerrainsFromSource(actor);
    actor.bench = true;
    side.bench.push(actor);
    replacement.position = oldPos;
    replacement.bench = false;
    side.active[activeIdx] = replacement;
    initUnit(replacement, side.active.find(x=>x!==replacement && !x.fainted), sim.state.turn + 1);
    if (side.hazardMagma && replacement !== side.hazardSource && !replacement.types.includes('Flame')) {
      const hazard = Math.max(1, Math.floor(replacement.maxHp * 0.2));
      replacement.hp = Math.max(0, replacement.hp - hazard);
      log(`${replacement.name} took ${hazard} damage from magma on entry.`);
      if (replacement.hp <= 0) replacement.fainted = true;
    }
    log(`${actor.name} switched out. ${replacement.name} entered.`);
    applyEntryAbility(replacement, 'entered the battle');
  }

  function resolveScheduledSwitches(){
    ['player','enemy'].forEach(sideKey => {
      const side = sim.state[sideKey];
      side.active.filter(u=>!u.fainted && u.volatile.pendingManualSwitchTarget).forEach(u => {
        const targetId = u.volatile.pendingManualSwitchTarget;
        u.volatile.pendingManualSwitchTarget = null;
        performSwitchAtEnd(u, targetId);
      });
    });
  }

  function applyEffectText(actor, move, targets){
    const effect = move.Effect || '';
    const text = txt(effect);
    if (move.Move_Name === 'Wish') {
      const ally = getOwnSide(actor.side).active.find(x=>!x.fainted && x !== actor);
      if (ally) {
        ally.volatile.wishBuff = {power:1.3, priorityBoost:1};
        log(`${ally.name} received a Wish buff for its next move.`);
      }
      return true;
    }
    if (move.Move_Name === 'Banishment') {
      targets.forEach(t => { if (t) t.volatile.banishment = 2; });
      return true;
    }
    if (move.Move_Name === 'Sand Burial') {
      targets.forEach(t => {
        if (!t || hasType(t,'Wind')) { if (t) log(`${t.name} is immune to Sand Burial.`); return; }
        t.volatile.sandBurial = 3;
        log(`${t.name} was trapped by Sand Burial.`);
      });
      return true;
    }
    if (move.Move_Name === 'Shifting Reality') {
      actor.volatile.pendingShiftingReality = 2;
      log(`Shifting Reality will reverse speed order after this turn.`);
      return true;
    }
    if (move.Move_Name === 'Fuze') {
      actor.volatile.usedFuzeThisTurn = true;
      return true;
    }
    if (move.Move_Name === 'Teleport') {
      const benchTarget = getOwnSide(actor.side).bench.find(b=>!b.fainted && b.bench);
      if (benchTarget) actor.volatile.pendingSwitchTarget = benchTarget.beastId;
      return true;
    }
    if (move.Move_Name === 'Scale Shed') {
      actor.status = null; actor.statusCounter = 0;
      actor.volatile.banishment = 0; actor.volatile.sandBurial = 0;
      log(`${actor.name} cleared its status and volatile effects.`);
      return true;
    }
    if (text.includes('heal')) {
      const healPct = text.includes('100%') ? 1 : text.includes('80%') ? 0.8 : text.includes('50%') ? 0.5 : text.includes('30%') ? 0.3 : text.includes('15%') ? 0.15 : 0.25;
      const healTarget = txt(move.Target_Class).includes('ally') ? (targets[0] || actor) : (targets[0] || actor);
      const heal = Math.max(1, Math.floor(healTarget.maxHp * healPct));
      healTarget.hp = Math.min(healTarget.maxHp, healTarget.hp + heal);
      log(`${actor.name} healed ${healTarget.name} for ${heal} HP with ${move.Move_Name}.`);
      if (text.includes('self destruct') || text.includes('faints user')) {
        actor.hp = 0; actor.fainted = true;
      }
      return true;
    }
    const inferred = inferStatusFromMove(move);
    if (inferred) {
      targets.forEach(t => t && applyStatus(t, inferred));
      return true;
    }
    if (text.includes('summons nebula')) { activateTerrain('Nebula Clouds','primary',actor); return true; }
    if (text.includes('summons total darkness')) { activateTerrain('Darkness','primary',actor); return true; }
    if (text.includes('starts a storm')) { activateTerrain('Storm','primary',actor); return true; }
    if (text.includes('starts a drought')) { activateTerrain('Drought','primary',actor); return true; }
    if (text.includes('starts a fallout')) { activateTerrain('Fallout','primary',actor); return true; }
    if (text.includes('starts a blizzard')) { activateTerrain('Blizzard','primary',actor); return true; }
    if (text.includes('removes terrain')) {
      if (sim.state.terrain.primary) log(`${sim.state.terrain.primary.name} was removed.`);
      sim.state.terrain.primary = null;
      return true;
    }
    return false;
  }

  applyMoveSpecialEffects = function(actor, move, targets, spread){
    const effect = txt(move.Effect);
    if (move.Move_Name === 'Thunder Struck') {
      actor.stats.spe = Math.max(1, Math.round(actor.stats.spe * stageMods['-2']));
      log(`${actor.name}'s Speed fell sharply from Thunder Struck.`);
    }
    if (move.Move_Name === 'Molten Rock') {
      const enemySide = getOpposingSide(actor.side);
      enemySide.hazardMagma = true;
      enemySide.hazardSource = actor;
      log(`${actor.name} coated the opposing side in magma.`);
    }
    if (effect.includes('switches out user') || move.Move_Name === 'Smoke Bomb' || move.Move_Name === 'Bouncing Orb' || move.Move_Name === 'Leaf Hurricane') {
      const benchTarget = getOwnSide(actor.side).bench.find(b=>!b.fainted && b.bench);
      if (benchTarget) actor.volatile.pendingSwitchTarget = benchTarget.beastId;
    }
    if (getMoveTypes(move, actor).includes('Wind')) triggerOnWindMove();
    if (move.Move_Name === 'Electric Surge') {
      actor.volatile.electricSurgeLock = {moveId: move.Move_ID, remaining: 2};
      log(`${actor.name} is locked into Electric Surge for 2 more turns.`);
    }
    if (move.Move_Name === 'Precise Slice') {
      targets.forEach(t => {
        if (!t) return;
        t.volatile.preciseSlice = true;
        log(`${t.name}'s Defense was cut in half until it switches.`);
      });
    }
    if (move.Move_Name === 'Nightmare' && actor.status?.name === 'Sleep' && Math.random() < 0.5) {
      actor.status = null; actor.statusCounter = 0;
      log(`${actor.name} woke up after using Nightmare.`);
    }
  };

  resolveSelfKOFromMove = function(actor, move){
    const isBomb = txt(move.Move_Name).includes('bomb') || txt(move.Effect).includes('self destruct');
    if (isBomb && txt(actor.ability) !== 'bomb holster') {
      actor.hp = 0; actor.fainted = true;
      log(`${actor.name} fainted from ${move.Move_Name}.`);
      return;
    }
    if (move.Move_Name === 'Furious Soul') {
      const recoil = Math.max(1, Math.floor(actor.maxHp * 0.25));
      actor.hp = Math.max(0, actor.hp - recoil);
      log(`${actor.name} took ${recoil} recoil from Furious Soul.`);
      if (actor.hp <= 0) actor.fainted = true;
    }
    if (txt(actor.item) === 'brass knuckles' && getMoveTypes(move, actor).includes('Primal')) {
      const recoil = Math.max(1, Math.floor(actor.maxHp * 0.35));
      actor.hp = Math.max(0, actor.hp - recoil);
      log(`${actor.name} lost ${recoil} HP from Brass Knuckles.`);
      if (actor.hp <= 0) actor.fainted = true;
    }
  };

  function decrementTerrainDurations(){
    const primary = sim.state.terrain.primary;
    if (primary && primary.turnsRemaining != null) {
      primary.turnsRemaining -= 1;
      if (primary.turnsRemaining <= 0) {
        log(`${primary.name} ended.`);
        sim.state.terrain.primary = null;
      }
    }
    sim.state.terrain.secondary = sim.state.terrain.secondary.filter(t => {
      if (t.turnsRemaining == null) return true;
      t.turnsRemaining -= 1;
      if (t.turnsRemaining <= 0) {
        log(`${t.name} ended.`);
        return false;
      }
      return true;
    });
  }

  applyEndTurn = function(){
    for (const sideKey of ['player','enemy']) {
      const side = sim.state[sideKey];
      const ally0 = side.active[1], ally1 = side.active[0];
      side.active.forEach((unit, idx) => {
        if (unit.fainted) return;
        const status = unit.status?.name;
        if (status === 'Poison' || status === 'Burn') {
          const dmg = Math.max(1, Math.floor(unit.maxHp * 0.05));
          unit.hp = Math.max(0, unit.hp - dmg);
          log(`${unit.name} took ${dmg} damage from ${status}.`);
          if (unit.hp <= 0) unit.fainted = true;
        }
        if (unit.volatile.sandBurial > 0) {
          const dmg = Math.max(1, Math.floor(unit.maxHp * 0.125));
          unit.hp = Math.max(0, unit.hp - dmg);
          unit.volatile.sandBurial -= 1;
          log(`${unit.name} took ${dmg} damage from Sand Burial.`);
          if (unit.hp <= 0) unit.fainted = true;
        }
        if (unit.volatile.banishment > 0) {
          unit.volatile.banishment -= 1;
          if (unit.volatile.banishment <= 0) {
            unit.hp = 0; unit.fainted = true;
            log(`${unit.name} was banished!`);
          }
        }
        if (txt(unit.item) === 'hot soup') {
          const heal = Math.max(1, Math.floor(unit.maxHp * 0.1));
          unit.hp = Math.min(unit.maxHp, unit.hp + heal);
          log(`${unit.name} restored ${heal} HP with Hot Soup.`);
        }
        if (txt(unit.item) === 'dry icecream') {
          const heal = Math.max(1, Math.floor(unit.maxHp * 0.05));
          unit.hp = Math.min(unit.maxHp, unit.hp + heal);
          log(`${unit.name} restored ${heal} HP with Dry Icecream.`);
        }
        if (txt(unit.ability) === 'doctor') {
          const ally = idx === 0 ? ally0 : ally1;
          if (ally && !ally.fainted) {
            const heal = Math.max(1, Math.floor(ally.maxHp / 16));
            ally.hp = Math.min(ally.maxHp, ally.hp + heal);
            log(`${unit.name}'s Doctor healed ${ally.name} for ${heal}.`);
          }
        }
        if ((txt(unit.item) === 'medical brew' || txt(unit.item) === 'candy apple') && !unit.volatile.onceItemUsed && unit.hp <= unit.maxHp * (txt(unit.item) === 'medical brew' ? 0.25 : 0.5)) {
          const heal = Math.floor(unit.maxHp * 0.5);
          unit.hp = Math.min(unit.maxHp, unit.hp + heal);
          unit.volatile.onceItemUsed = true;
          log(`${unit.name} consumed ${getItemData(unit.item).Item} and healed ${heal} HP.`);
        }
        if (sim.state.terrain.primary?.name === 'Storm' && unit.types.includes('Flora')) {
          const heal = Math.max(1, Math.floor(unit.maxHp / 6));
          unit.hp = Math.min(unit.maxHp, unit.hp + heal);
          log(`${unit.name} healed ${heal} HP from Storm terrain.`);
        }
        if (sim.state.terrain.primary?.name === 'Blizzard' && !unit.types.some(t=>['Frost','Flame'].includes(t)) && Math.random() < 0.15) applyStatus(unit, 'Freeze');
        if ((sim.state.terrain.secondary || []).some(t => t.name === 'Flower Garden')) {
          const healPct = unit.types.includes('Flora') ? 0.10 : 0.06;
          const heal = Math.max(1, Math.floor(unit.maxHp * healPct));
          unit.hp = Math.min(unit.maxHp, unit.hp + heal);
          log(`${unit.name} healed ${heal} HP from Flower Garden.`);
        }
        if (unit.volatile.electricSurgeLock) {
          unit.volatile.electricSurgeLock.remaining -= 1;
          if (unit.volatile.electricSurgeLock.remaining <= 0) {
            unit.hp = 0; unit.fainted = true;
            unit.volatile.electricSurgeLock = null;
            log(`${unit.name} fainted after the final Electric Surge.`);
          }
        }
        if (unit.status?.name === 'Sleep') {
          unit.statusCounter = Math.max(0, (unit.statusCounter || 1) - 1);
          if (unit.statusCounter === 0) unit.status = null;
        }
        if (unit.volatile.blockReductionOverrideTurns) {
          unit.volatile.blockReductionOverrideTurns -= 1;
          if (unit.volatile.blockReductionOverrideTurns <= 0) {
            unit.volatile.blockReductionOverride = null;
            unit.volatile.blockReductionOverrideTurns = 0;
          }
        }
      });
      if (side.accuracyBuffTurns > 0) side.accuracyBuffTurns -= 1;
    }
    activeAll().forEach(u => {
      if (u.volatile.pendingShiftingReality) {
        activateTerrain('Shifting Reality','secondary',u,u.volatile.pendingShiftingReality);
        u.volatile.pendingShiftingReality = 0;
      }
    });
    decrementTerrainDurations();
    resolveScheduledSwitches();
    handlePendingReplacements();
  };

  damage = function(attacker, defender, move, spread){
    if (txt(defender.ability) === 'driller' && defender.volatile.burrowed) {
      if (!spread && move.Target_Class !== 'Both Foes') return 0;
    }
    if (move.Move_Name === 'Furious Soul') {
      let dmg = attacker.hp;
      if (defender.blocking) dmg = Math.max(1, Math.floor(dmg * (1 - getBlockReduction(defender))));
      return Math.max(1, Math.floor(dmg));
    }
    let defStat = getEffectiveDefenderStat(defender, move);
    if (defender.volatile.preciseSlice) defStat = Math.max(1, Math.floor(defStat * 0.5));
    const level = 50;
    const power = Number(move.Power || 0);
    if (!power) return 0;
    const atkStat = move.Category === 'Special' ? attacker.stats.spa : attacker.stats.atk;
    const targets = spread ? 0.75 : 1;
    const moveTypes = getMoveTypes(move, attacker);
    const stab = moveTypes.some(t => attacker.types.includes(t)) ? 1.25 : 1;
    const type = getTypeMultiplier(move, defender, attacker);
    if (type === 0) return 0;
    const random = 0.93 + Math.random()*0.07;
    let dmg = ((((24 + level) * power * atkStat * getMovePowerModifier(attacker, move, defender)) / (32 * defStat)) + 8) * targets * 1 * stab * type * 1 * random;
    if (defender.volatile.burrowed && spread) dmg *= 0.5;
    if (defender.blocking && move.Move_Name !== 'Sand Burial' && move.Move_Name !== 'Phantom Slash') {
      dmg *= (1 - getBlockReduction(defender));
    }
    return Math.max(1, Math.floor(dmg));
  };

  resolveTurn = function(readers){
    const state = sim.state;
    const playerActions = readers.map(r=>({actor:r.unit, action:r.read()}));
    const enemyActions = state.enemy.active.filter(u=>!u.fainted).map(u=>({actor:u, action:chooseEnemyAction(u,state)}));
    const queue = [...playerActions, ...enemyActions].sort((a,b) => {
      const pa = getPriority(a.actor, a.action), pb = getPriority(b.actor, b.action);
      if (pa !== pb) return pb - pa;
      const rev = reverseSpeedActive();
      const as = getEffectiveSpeed(a.actor), bs = getEffectiveSpeed(b.actor);
      let cmp = rev ? as - bs : bs - as;
      if (txt(a.actor.ability) === 'pack tactics' || txt(b.actor.ability) === 'pack tactics') {
        const aAlly = state[a.actor.side].active.find(x=>x!==a.actor && !x.fainted);
        const bAlly = state[b.actor.side].active.find(x=>x!==b.actor && !x.fainted);
        if (txt(a.actor.ability) === 'pack tactics' && aAlly && as < getEffectiveSpeed(aAlly)) cmp = 1;
        if (txt(b.actor.ability) === 'pack tactics' && bAlly && bs < getEffectiveSpeed(bAlly)) cmp = -1;
      }
      return withCheatingCoinTie(a.actor,b.actor,cmp);
    });

    activeAll().forEach(u=>{u.blocking=false; u.temp.acted=false;});

    for (const step of queue) {
      const actor = step.actor;
      const action = step.action;
      actor.pendingAction = action;
      if (actor.fainted) continue;
      if (action.type === 'move' && !canUseMove(actor, action.move)) {
        log(`${actor.name} cannot use ${action.move.Move_Name}.`);
        continue;
      }
      if (!beforeActionStatusCheck(actor)) continue;
      actor.temp.acted = true;
      if (action.type === 'switch') {
        scheduleSwitch(actor, action.switchTo);
        continue;
      }
      if (action.type === 'block') {
        actor.blocking = true;
        actor.consecutiveBlocks += 1;
        if (txt(actor.ability) === 'driller') {
          actor.volatile.burrowed = true;
          actor.volatile.burrowEndsOnAttack = true;
          log(`${actor.name} blocked and burrowed underground.`);
        } else {
          log(`${actor.name} blocks.`);
        }
        continue;
      }
      actor.blocking = false;
      actor.consecutiveBlocks = 0;
      if (txt(actor.ability) === 'driller' && actor.volatile.burrowEndsOnAttack) actor.volatile.burrowed = false;
      const move = action.move;
      const ownSide = getOwnSide(actor.side);
      const enemySide = getOpposingSide(actor.side);
      let targets = [];
      const tclass = txt(move.Target_Class);
      if (tclass === 'self') targets = [actor];
      else if (tclass.includes('ally')) targets = ownSide.active.filter(x=>!x.fainted && x !== actor).slice(0,1);
      else if (isSpreadMove(move, actor)) targets = tclass === 'all beasts' ? activeAll().filter(x=>!x.fainted && x!==actor) : enemySide.active.filter(x=>!x.fainted);
      else targets = [enemySide.active.find(x=>x.beastId === action.targetId && !x.fainted) || enemySide.active.find(x=>!x.fainted)].filter(Boolean);
      const redirected = maybeRedirect(move, enemySide, actor);
      if (redirected && !isSpreadMove(move, actor) && !targets.includes(redirected) && !hasType(redirected,'Mind')) {
        targets = [redirected];
        log(`${redirected.name} redirected ${move.Move_Name}.`);
      }
      if (!targets.length && move.Category !== 'Status') continue;
      if (txt(actor.item) === 'headband' && !actor.volatile.headbandLock) actor.volatile.headbandLock = move.Move_ID;
      if (txt(actor.item) === 'headband' && actor.volatile.headbandLock && actor.volatile.headbandLock !== move.Move_ID) { log(`${actor.name} is locked into its first move by Headband.`); continue; }
      let wishBoost = actor.volatile.wishBuff; 
      if (move.Category === 'Status' || !move.Power) {
        if (!applyEffectText(actor, move, targets)) log(`${actor.name} used ${move.Move_Name}.${move.Effect ? ' ' + move.Effect : ''}`);
        applyMoveSpecialEffects(actor, move, targets, false);
      } else {
        const spread = isSpreadMove(move, actor);
        const multi = hasFlag(move,'multi_hit') || /hits \d/.test(txt(move.Effect));
        let hits = 1;
        if (move.Move_Name === 'Double Hit' || move.Move_Name === 'Dragon Claws' || move.Move_Name === 'Spinning Kick') hits = 2;
        else if (move.Move_Name === 'Six Shooter') hits = 6;
        else if (multi) {
          const match = String(move.Effect||'').match(/hits\s*(\d)\s*-\s*(\d)/i);
          if (match) {
            const lo = Number(match[1]), hi = Number(match[2]);
            hits = lo + Math.floor(Math.random()*(hi-lo+1));
          }
        }
        if (txt(actor.item) === 'clover' && multi) hits = Math.max(hits, 4);
        for (const target of targets) {
          if (!target || target.fainted) continue;
          const hc = hitChance(move, target, actor);
          if (Math.random()*100 > hc) { log(`${actor.name}'s ${move.Move_Name} missed ${target.name}.`); continue; }
          let totalDmg = 0;
          for (let h=0; h<hits; h++) {
            let dmg = damage(actor, target, move, spread);
            if (wishBoost) {
              dmg = Math.max(1, Math.floor(dmg * wishBoost.power));
            }
            totalDmg += dmg;
            target.hp = Math.max(0, target.hp - dmg);
            if (target.blocking && txt(target.item) === 'riot shield') target.volatile.riotShieldHits += 1;
            if (txt(target.ability) === 'haunted' && move.Category === 'Physical' && !target.fainted) {
              actor.volatile.blockReductionOverride = 0.45;
              actor.volatile.blockReductionOverrideTurns = 3;
              log(`${target.name}'s Haunted weakened ${actor.name}'s Block.`);
            }
            if (target.hp <= 0) { target.fainted = true; break; }
          }
          const typeMult = getTypeMultiplier(move, target, actor);
          log(`${actor.name} used ${move.Move_Name} on ${target.name} for ${totalDmg} damage${hits>1?` over ${hits} hits`:''}${typeMult > 1 ? ' (super effective)' : typeMult < 1 ? ' (resisted)' : ''}.`);
          const inferred = inferStatusFromMove(move);
          if (inferred) {
            const chance = /40%/.test(move.Effect||'') ? 0.4 : /35%/.test(move.Effect||'') ? 0.35 : /25%/.test(move.Effect||'') ? 0.25 : /20%/.test(move.Effect||'') ? 0.2 : /15%/.test(move.Effect||'') ? 0.15 : /10%/.test(move.Effect||'') ? 0.1 : /5%/.test(move.Effect||'') ? 0.05 : 0.3;
            if (Math.random() < chance) applyStatus(target, inferred);
          }
          if (target.fainted) { removeTerrainsFromSource(target); log(`${target.name} fainted.`); }
        }
        applyMoveSpecialEffects(actor, move, targets, isSpreadMove(move, actor));
        resolveSelfKOFromMove(actor, move);
      }
      actor.volatile.wishBuff = null;
      if (actor.volatile.pendingSwitchTarget && !actor.fainted) {
        const targetId = actor.volatile.pendingSwitchTarget; actor.volatile.pendingSwitchTarget = null; scheduleSwitch(actor, targetId);
      }
      if (teamDown(state.player) || teamDown(state.enemy)) break;
    }
    // fusion check after actions
    ['player','enemy'].forEach(sideKey => {
      const side = state[sideKey];
      const activeFuze = side.active.filter(u=>!u.fainted && u.volatile.usedFuzeThisTurn);
      if (activeFuze.length === 2) {
        const [a,b] = activeFuze;
        const beastsOk = [a.legacyName, a.name, b.legacyName, b.name].join(' ').toLowerCase();
        if (beastsOk.includes('franken') && beastsOk.includes('monster')) {
          const frank = beastsOk.indexOf('franken') !== -1 && (txt(a.legacyName).includes('franken') || txt(a.name).includes('frank')) ? a : b;
          const monster = frank === a ? b : a;
          const fused = JSON.parse(JSON.stringify(frank));
          fused.name = 'Monstrospark';
          fused.types = ['Plasma','Monster'];
          fused.type1 = 'Plasma'; fused.type2 = 'Monster';
          fused.maxHp = Math.max(a.maxHp,b.maxHp); fused.hp = Math.max(a.hp,b.hp);
          fused.stats = {
            atk: Math.max(a.stats.atk,b.stats.atk),
            spa: Math.max(a.stats.spa,b.stats.spa),
            def: Math.max(a.stats.def,b.stats.def),
            spd: Math.max(a.stats.spd,b.stats.spd),
            spe: Math.max(a.stats.spe,b.stats.spe),
            eva: Math.max(a.stats.eva,b.stats.eva)
          };
          fused.item = frank.item;
          fused.ability = 'Laboratory';
          fused.moves = [frank.moves[0], frank.moves[1], monster.moves[2], monster.moves[3]].filter(Boolean);
          fused.legacyName = 'Frankenstein&Monster';
          fused.beastId = 154155;
          removeTerrainsFromSource(a); removeTerrainsFromSource(b);
          state.terrain.primary = null; state.terrain.secondary = [];
          side.active = [fused, {fainted:true,name:'Fusion Empty',position:1,battleHidden:true,volatile:{sourceTerrains:[],immuneTypes:new Set()},stats:{atk:1,spa:1,def:1,spd:1,spe:1,eva:1},types:['Monster'],maxHp:1,hp:0,side:sideKey,bench:false,item:'',ability:''}];
          log(`${a.name} and ${b.name} fused into ${fused.name}!`);
        }
      }
      side.active.forEach(u => { if (u) u.volatile.usedFuzeThisTurn = false; });
    });
    applyEndTurn();
    if (teamDown(state.player) || teamDown(state.enemy)) log(teamDown(state.enemy) ? 'You win!' : 'Enemy wins.'); else { state.turn += 1; renderBattle(); }
    ['player','enemy'].forEach(side => {
      document.getElementById(`${side}Active`).innerHTML = state[side].active.filter(Boolean).map(renderCombatant).join('');
      document.getElementById(`${side}Bench`).innerHTML = state[side].bench.map(renderCombatant).join('');
    });
  };

})();
