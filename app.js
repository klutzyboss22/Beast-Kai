const DATA = window.BEAST_KAI_DATA;
const beasts = DATA.beasts.filter(b => b.Competitive_Legal !== 'No');
const moves = DATA.moves;
const abilities = DATA.abilities;
const items = DATA.items;
const typeChart = DATA.typeChart;

const beastById = Object.fromEntries(beasts.map(b => [b.Beast_Index, b]));
const moveById = Object.fromEntries(moves.map(m => [m.Move_ID, m]));
const abilityByName = Object.fromEntries(abilities.map(a => [a.Ability, a]));
const itemByName = Object.fromEntries(items.map(i => [i.Item, i]));
const STORAGE_KEY = 'beast-kai-team-v1';

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

function typePills(types=[]) {
  return types.map(t => `<span class="pill" style="border-color:${TYPE_COLORS[t]||'#345'};color:${TYPE_COLORS[t]||'#fff'}">${t}</span>`).join('');
}

function getLegalMoves(beast) { return (beast?.Move_IDs || []).map(id => moveById[id]).filter(Boolean); }
function getAbilityData(name){ return abilityByName[name] || {Ability:name, Description:''}; }
function getItemData(name){ return itemByName[name] || {Item:name, Description:''}; }
function normalizeText(s){ return String(s||'').toLowerCase(); }
function moveFlags(move){ return normalizeText(move.Machine_Flags).split(',').map(x=>x.trim()).filter(Boolean); }
function statusByName(name){ return DATA.statuses.find(s => normalizeText(s.Status) === normalizeText(name)); }

function setPanel(tabId) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === tabId));
}
document.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => setPanel(btn.dataset.tab)));

function renderBeastList(filter='') {
  const q = filter.trim().toLowerCase();
  const list = document.getElementById('builderBeastList');
  list.innerHTML = '';
  beasts.filter(b => !q || [b.Beast,b.Type,b.Primary_Role,b.Secondary_Role,b.Gen].join(' ').toLowerCase().includes(q))
    .sort((a,b)=>a.Beast.localeCompare(b.Beast)).forEach(beast => {
      list.append(el('div',{class:'list-item', onclick:()=>fillFirstOpenSlot(beast.Beast_Index), html:`<strong>${beast.Beast}</strong><div class="small">#${beast.Beast_Index} • ${beast.Type} • BST ${beast.BST}</div>${typePills(beast.Types)}`}));
    });
}

function fillFirstOpenSlot(id){
  const idx = team.findIndex(s=>!s.beast);
  updateSlot(idx === -1 ? 0 : idx, {beast:id, ability:beastById[id].Ability_List[0] || '', item:'', moves:getLegalMoves(beastById[id]).slice(0,4).map(m=>m.Move_ID)});
}

function updateSlot(index, patch) {
  team[index] = {...team[index], ...patch};
  saveTeam();
  renderTeam();
}

function getTeamMetrics(currentTeam=team) {
  const chosen = currentTeam.filter(s => s.beast).map(s => beastById[s.beast]);
  const bst = chosen.reduce((sum,b)=>sum + (b?.BST || 0), 0);
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
      updateSlot(i, {beast:id, ability:nextBeast?.Ability_List?.[0] || '', item:'', moves:nextBeast ? getLegalMoves(nextBeast).slice(0,4).map(m=>m.Move_ID) : []});
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
    ...beasts.map(b => ({kind:'beast', key:b.Beast, text:[b.Beast,b.Type,b.Primary_Role,b.Secondary_Role,b.Gen].join(' '), payload:b})),
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
      <p class="small">#${b.Beast_Index} • ${b.Gen} • Forms ${b.Forms} • ${b.Primary_Role}${b.Secondary_Role ? ' / '+b.Secondary_Role : ''}</p>
      <div class="stat-grid">${[['HP',b.HP_Lv50],['Health',b.Health],['Atk',b.Attack],['SpA',b.Sp_Attack],['Def',b.Defense],['SpD',b.Sp_Defense],['Spe',b.Speed],['Eva',b.Evasion],['BST',b.BST]].map(([k,v])=>`<div class="stat"><b>${k}</b>${v}</div>`).join('')}</div>
      <h3>Abilities</h3><p>${b.Ability_List.map(a=>`<span class="pill">${a}</span>`).join(' ')}</p>
      <h3>Learnset (${learnset.length})</h3>
      <div>${learnset.map(m=>`<span class="pill">${m.Move_Name}</span>`).join(' ')}</div>`;
  } else if (entry.kind === 'move') {
    const m = entry.payload;
    wrap.innerHTML = `<h2>${m.Move_Name}</h2><p>${typePills([m.Move_Type])}</p>
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
  return pool.map((b,i)=>({slot:i+1, beast:b.Beast_Index, ability:b.Ability_List[0] || '', item:'', moves:getLegalMoves(b).slice(0,4).map(m=>m.Move_ID)}));
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
    side, position:pos, bench, beastId:b.Beast_Index, name:b.Beast, type1:b.Type_1, type2:b.Type_2 || null, types:b.Types,
    stats:{atk:b.Attack, spa:b.Sp_Attack, def:b.Defense, spd:b.Sp_Defense, spe:b.Speed, eva:b.Evasion},
    maxHp:b.HP_Lv50, hp:b.HP_Lv50, ability:slot.ability || b.Ability_List[0], item:slot.item || '',
    moves:(slot.moves || []).map(id=>moveById[id]).filter(Boolean), blocking:false, consecutiveBlocks:0, fainted:false,
    status:null, statusCounter:0, volatile:{headbandLock:null, riotShieldHits:0, onceItemUsed:false, doctorName:'', switchedInTurn:0}
  };
}

function initUnit(unit, ally, turn=1){
  const ability = normalizeText(unit.ability);
  const item = normalizeText(unit.item);
  unit.volatile.switchedInTurn = turn;
  if (ability === 'hasty') {
    unit.stats.spe = Math.round(unit.stats.spe * stageMods[2]);
    unit.blockBase = 0.50;
  }
  if (ability === 'bond') {
    const stats = ['atk','spa','def','spd','spe'];
    const best = stats.sort((a,b)=>unit.stats[b]-unit.stats[a])[0];
    unit.stats[best] = Math.round(unit.stats[best] * stageMods[1]);
    unit.stats.spe = Math.round(unit.stats.spe * (best === 'spe' ? stageMods[2] : stageMods[1]));
  }
  if ((ability === 'positive' && normalizeText(ally?.ability) === 'negative') || (ability === 'negative' && normalizeText(ally?.ability) === 'positive')) {
    const stats = ['atk','spa','def','spd','spe'];
    const best = stats.sort((a,b)=>unit.stats[b]-unit.stats[a])[0];
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
  if (item === 'dry icecream') {
    applyStatus(unit, 'Freeze', true);
  }
  if (item === 'scary mask' && ally) {
    ally.pendingEnemyAtkDrop = true;
  }
}

function applyBattlefieldPassives(){
  ['player','enemy'].forEach(sideKey => {
    const side = sim.state[sideKey];
    initUnit(side.active[0], side.active[1], sim.state.turn);
    initUnit(side.active[1], side.active[0], sim.state.turn);
  });
}

function renderBattlePickers(){
  const player = document.getElementById('playerBattlePicker');
  const enemy = document.getElementById('enemyBattlePicker');
  sim.playerRoster = team.filter(s=>s.beast).map((s,i)=>({...s, selected:i<4}));
  if (!sim.enemyRoster.length) sim.enemyRoster = randomTeam().map((s,i)=>({...s, selected:i<4}));
  [ [player, sim.playerRoster, true], [enemy, sim.enemyRoster, true] ].forEach(([node, roster, editable])=>{
    node.innerHTML='';
    roster.forEach((s,idx)=>{
      const b = beastById[s.beast]; if(!b) return;
      const checkbox = el('input',{type:'checkbox'}); checkbox.checked = !!s.selected; checkbox.disabled = !editable;
      checkbox.addEventListener('change',()=>{
        roster[idx].selected = checkbox.checked;
        const chosen = roster.filter(x=>x.selected);
        if (chosen.length > 4) { roster[idx].selected = false; checkbox.checked = false; alert('Choose exactly 4 battle beasts.'); }
      });
      node.append(el('div',{class:'list-item'},[
        el('label',{},[checkbox, ' ', b.Beast]),
        el('div',{class:'small'}, `${b.Type} • BST ${b.BST}`)
      ]));
    });
  });
}

function startBattle() {
  const playerChosen = sim.playerRoster.filter(x=>x.selected).slice(0,4);
  const enemyChosen = sim.enemyRoster.filter(x=>x.selected).slice(0,4);
  if (playerChosen.length !== 4 || enemyChosen.length !== 4) return alert('Pick exactly 4 beasts for each side.');
  sim.state = {
    turn:1,
    player:{active:[baseUnitFromSlot(playerChosen[0],'player',0,false), baseUnitFromSlot(playerChosen[1],'player',1,false)], bench:[baseUnitFromSlot(playerChosen[2],'player',2,true), baseUnitFromSlot(playerChosen[3],'player',3,true)]},
    enemy:{active:[baseUnitFromSlot(enemyChosen[0],'enemy',0,false), baseUnitFromSlot(enemyChosen[1],'enemy',1,false)], bench:[baseUnitFromSlot(enemyChosen[2],'enemy',2,true), baseUnitFromSlot(enemyChosen[3],'enemy',3,true)]},
    terrain:null,
  };
  applyBattlefieldPassives();
  sim.started = true;
  document.getElementById('battleBoard').classList.remove('hidden');
  log(`Battle started. Double battle format: 2 active and 2 reserves per side.`);
  renderBattle();
}

function getTypeMultiplier(move, target){
  const types = [move.Move_Type];
  if (move.Move_Type && String(move.Move_Type).includes(':')) types.splice(0,1,...String(move.Move_Type).split(':'));
  let total = 1;
  types.forEach(atkType => {
    [target.type1, target.type2].filter(Boolean).forEach(defType => {
      total *= (typeChart[atkType]?.[defType] ?? 1);
    });
  });
  return Math.min(total, 4);
}

function hitChance(move, target, actor){
  const flags = moveFlags(move);
  const acc = Number(move.Accuracy || 100);
  if (acc >= 110 || flags.includes('sound')) return 100;
  let value = Math.max(35, Math.min(100, Math.floor(acc * (100 / (target.stats.eva || 100)))));
  if (normalizeText(actor.item) === 'lucky ring') value *= 1.1;
  if (normalizeText(actor.item) === 'glasses') value *= 1.3;
  if (target.status?.name === 'Blindness') value *= 0.8;
  return Math.max(35, Math.min(100, Math.round(value)));
}

function getBlockReduction(unit){
  const item = normalizeText(unit.item);
  if (item === 'riot shield' && unit.blocking && unit.volatile.riotShieldHits < 3) return 1;
  const base = item === 'armor' ? 0.75 : (unit.blockBase ?? 0.60);
  return Math.max(0, base - unit.consecutiveBlocks * 0.15);
}

function getMovePowerModifier(actor, move){
  let mod = 1;
  const ability = normalizeText(actor.ability);
  const item = normalizeText(actor.item);
  const flags = moveFlags(move);
  if (ability === 'flame spec' && normalizeText(move.Move_Type) === 'flame') mod *= 1.2;
  if (ability === 'loud mouth' && flags.includes('sound')) mod *= 1.2;
  if (item === 'wet stone' && flags.includes('blade')) mod *= 1.25;
  if (item === 'crystal ball' && flags.includes('orb')) mod *= 1.35;
  if (item === 'headband') mod *= 1.5;
  if (item === 'ace card') mod *= 1.7;
  const typeOrbMatch = itemByName[actor.item]?.Description?.match(/boost that types attack by (\d+)%/i) && actor.item?.endsWith(' Orb');
  if (typeOrbMatch) {
    const orbType = actor.item.replace(/\s*Orb$/i,'').trim();
    if (normalizeText(move.Move_Type) === normalizeText(orbType)) mod *= 1.2;
  }
  return mod;
}

function maybeRedirect(move, enemySide){
  const type = normalizeText(move.Move_Type);
  const redirectItem = type === 'plasma' ? 'lightning rod' : type === 'terra' ? 'quake brace' : null;
  if (!redirectItem) return null;
  return enemySide.active.find(u => !u.fainted && normalizeText(u.item) === redirectItem) || null;
}

function damage(attacker, defender, move, spread){
  const level = 50;
  const power = Number(move.Power || 0);
  if (!power) return 0;
  const atkStat = move.Category === 'Special' ? attacker.stats.spa : attacker.stats.atk;
  const defStat = move.Category === 'Special' ? defender.stats.spd : defender.stats.def;
  const targets = spread ? 0.75 : 1;
  const stab = attacker.types.includes(move.Move_Type) || (String(move.Move_Type).includes(':') && String(move.Move_Type).split(':').some(t=>attacker.types.includes(t))) ? 1.25 : 1;
  const type = getTypeMultiplier(move, defender);
  const random = 0.93 + Math.random()*0.07;
  let dmg = ((((24 + level) * power * atkStat * getMovePowerModifier(attacker, move)) / (32 * Math.max(1,defStat))) + 8) * targets * 1 * stab * type * 1 * random;
  if (normalizeText(defender.ability) === 'flame spec' && normalizeText(move.Move_Type) === 'flame') dmg *= 0.5;
  if (normalizeText(defender.item) === 'bulletproof vest' && normalizeText(move.Move_Type) === 'alloy') dmg *= 0.5;
  if (defender.blocking && move.Target_Class !== 'Self') {
    const reduction = getBlockReduction(defender);
    dmg *= (1 - reduction);
  }
  return Math.max(1, Math.floor(dmg));
}

function chooseEnemyAction(unit, state) {
  const opponents = state.player.active.filter(x=>!x.fainted);
  const available = unit.moves;
  if (!available.length || !opponents.length) return {type:'block'};
  let best = null;
  for (const move of available) {
    for (const target of opponents) {
      const spread = move.Target_Class === 'Both Foes' || move.Target_Class === 'All Beasts';
      const score = move.Category === 'Status' ? 25 : (Number(move.Power || 0) * getTypeMultiplier(move, target) * (spread ? 1.2 : 1));
      if (!best || score > best.score) best = {type:'move', move, target:target.position, score};
    }
  }
  return best || {type:'block'};
}

function collectPlayerAction(unit) {
  const actionWrap = document.getElementById('battleActions');
  const box = el('div',{class:'action-box'});
  box.append(el('h3',{},unit.name));
  const select = el('select');
  select.append(el('option',{value:'block'},'Block'));
  unit.moves.forEach(m => select.append(el('option',{value:`move:${m.Move_ID}`}, `${m.Move_Name} (${m.Move_Type})`)));
  box.append(select);
  const target = el('select');
  target.append(el('option',{value:'0'},'Enemy Left'));
  target.append(el('option',{value:'1'},'Enemy Right'));
  box.append(el('div',{class:'field'},[el('label',{},'Target'), target]));
  actionWrap.append(box);
  return () => {
    const [kind,id] = select.value.split(':');
    if (kind === 'move') return {type:'move', move:moveById[Number(id)], target:Number(target.value)};
    return {type:'block'};
  };
}

function replaceIfFainted(sideKey){
  const side = sim.state[sideKey];
  side.active = side.active.map(unit => {
    if (!unit.fainted) return unit;
    const replacement = side.bench.find(b=>!b.fainted && b.bench);
    if (replacement) {
      replacement.position = unit.position;
      replacement.bench = false;
      initUnit(replacement, side.active.find(x=>x!==unit && !x.fainted), sim.state.turn);
      log(`${replacement.name} enters for ${sideKey}.`);
      return replacement;
    }
    return unit;
  });
}
function syncBench(sideKey){
  const side = sim.state[sideKey];
  side.bench = [...side.bench.filter(b=>b.bench && !side.active.includes(b))];
}
function teamDown(side){ return [...side.active, ...side.bench].every(u=>u.fainted); }
function log(text){ document.getElementById('battleLog').prepend(el('div',{class:'log-entry'},`Turn ${sim.state?.turn || 0}: ${text}`)); }

function applyStatus(unit, statusName, silent=false){
  const status = statusByName(statusName);
  if (!status || normalizeText(unit.item) === 'guide book' && normalizeText(statusName) === 'stun') return false;
  if (normalizeText(unit.item) === 'hazard mask' && !unit.volatile.onceItemUsed) {
    unit.volatile.onceItemUsed = true;
    unit.item = '';
    if (!silent) log(`${unit.name}'s Hazard Mask blocked ${statusName}.`);
    return false;
  }
  unit.status = {name: status.Status};
  unit.statusCounter = /2/.test(status.Default_Duration || '') || ['Stun','Confusion'].includes(status.Status) ? 2 : 0;
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

function beforeActionStatusCheck(actor){
  if (!actor.status) return true;
  const name = actor.status.name;
  if (name === 'Sleep' || name === 'Stun') {
    actor.statusCounter = Math.max(0, actor.statusCounter - 1);
    log(`${actor.name} cannot act because of ${name}.`);
    if (actor.statusCounter === 0 && name === 'Stun') actor.status = null;
    return false;
  }
  if (name === 'Confusion') {
    actor.statusCounter = Math.max(0, actor.statusCounter - 1);
    if (Math.random() < 0.33) {
      const selfDmg = Math.max(1, Math.floor(actor.maxHp * 0.08));
      actor.hp = Math.max(0, actor.hp - selfDmg);
      log(`${actor.name} hurt itself in confusion for ${selfDmg}.`);
      if (actor.hp <= 0) actor.fainted = true;
      if (actor.statusCounter === 0) actor.status = null;
      return false;
    }
    if (actor.statusCounter === 0) actor.status = null;
  }
  return true;
}

function applyEndTurn(){
  for (const sideKey of ['player','enemy']) {
    const side = sim.state[sideKey];
    const ally0 = side.active[1], ally1 = side.active[0];
    side.active.forEach((unit, idx) => {
      if (unit.fainted) return;
      const status = unit.status?.name;
      if (status === 'Poison' || status === 'Burn' || status === 'Infected') {
        const pct = status === 'Infected' ? 0.1 : 0.05;
        const dmg = Math.max(1, Math.floor(unit.maxHp * pct));
        unit.hp = Math.max(0, unit.hp - dmg);
        log(`${unit.name} took ${dmg} damage from ${status}.`);
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
    });
  }
  replaceIfFainted('player'); replaceIfFainted('enemy'); syncBench('player'); syncBench('enemy');
}

function renderCombatant(unit){
  const pct = Math.max(0, Math.round((unit.hp / unit.maxHp) * 100));
  return `<div class="combatant ${unit.fainted?'fainted':''}">
    <strong>${unit.name}</strong>
    <div class="small">${unit.types.join('/')} • ${unit.ability || 'No ability selected'}${unit.item ? ` • ${unit.item}` : ''}</div>
    <div class="hpbar"><span style="width:${pct}%"></span></div>
    <div>${Math.max(0,unit.hp)}/${unit.maxHp} HP</div>
    <div class="small">${unit.status ? `Status: ${unit.status.name}` : (unit.blocking ? `Blocking (${Math.max(0,Math.round(getBlockReduction(unit)*100))}% reduction)` : 'Ready')}</div>
  </div>`;
}

function renderBattle(){
  if (!sim.state) return;
  ['player','enemy'].forEach(sideKey => {
    document.getElementById(`${sideKey}Active`).innerHTML = sim.state[sideKey].active.map(renderCombatant).join('');
    document.getElementById(`${sideKey}Bench`).innerHTML = sim.state[sideKey].bench.map(renderCombatant).join('');
  });
  const actionWrap = document.getElementById('battleActions');
  actionWrap.innerHTML = `<p class="small">Turn ${sim.state.turn}. Choose an action for each active beast.</p>`;
  const readers = sim.state.player.active.filter(u=>!u.fainted).map(u => ({unit:u, read:collectPlayerAction(u)}));
  actionWrap.append(el('button',{onclick:()=>resolveTurn(readers)},'Resolve Turn'));
}

function getPriority(actor, action){
  let p = Number(action.move?.Priority || 0);
  if (normalizeText(actor.ability) === 'quickdraw' && action.move?.Category === 'Special') p += 1;
  if (normalizeText(actor.item) === 'star gem' && action.move?.Category === 'Status' && !actor.volatile.onceItemUsed) p += 1;
  return p;
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

  [...state.player.active, ...state.enemy.active].forEach(u=>u.blocking=false);

  for (const step of queue) {
    const actor = step.actor;
    const {action} = step;
    if (actor.fainted) continue;
    if (!beforeActionStatusCheck(actor)) continue;
    if (action.type === 'block') {
      actor.blocking = true;
      actor.consecutiveBlocks += 1;
      log(`${actor.name} blocks.`);
      continue;
    }
    actor.blocking = false;
    actor.consecutiveBlocks = 0;
    const move = action.move;
    const enemySide = actor.side === 'player' ? state.enemy : state.player;
    let targets = move.Target_Class === 'Both Foes' ? enemySide.active.filter(x=>!x.fainted) : [enemySide.active[action.target] || enemySide.active.find(x=>!x.fainted)].filter(Boolean);
    const redirected = maybeRedirect(move, enemySide);
    if (redirected && !targets.includes(redirected)) {
      targets = [redirected];
      log(`${redirected.name} redirected ${move.Move_Name}.`);
    }
    if (!targets.length) continue;
    if (normalizeText(actor.item) === 'headband' && !actor.volatile.headbandLock) actor.volatile.headbandLock = move.Move_ID;
    if (normalizeText(actor.item) === 'headband' && actor.volatile.headbandLock && actor.volatile.headbandLock !== move.Move_ID) {
      log(`${actor.name} is locked into its first move by Headband.`);
      continue;
    }
    if (normalizeText(actor.item) === 'star gem' && move.Category === 'Status' && !actor.volatile.onceItemUsed) actor.volatile.onceItemUsed = true;

    for (const target of targets) {
      const hc = hitChance(move, target, actor);
      if (Math.random()*100 > hc) { log(`${actor.name}'s ${move.Move_Name} missed ${target.name}.`); continue; }
      if (move.Category === 'Status' || !move.Power) {
        const inferred = inferStatusFromMove(move);
        if (inferred) applyStatus(target, inferred);
        else if (normalizeText(move.Effect).includes('heal')) {
          const heal = Math.max(1, Math.floor(actor.maxHp * 0.25));
          actor.hp = Math.min(actor.maxHp, actor.hp + heal);
          log(`${actor.name} used ${move.Move_Name} and healed ${heal}.`);
        } else {
          log(`${actor.name} used ${move.Move_Name}. ${move.Effect || 'Status effect not fully automated in this build.'}`);
        }
        continue;
      }
      const spread = move.Target_Class === 'Both Foes' || move.Target_Class === 'All Beasts';
      const hits = normalizeText(actor.item) === 'clover' && moveFlags(move).includes('multi_hit') ? 4 : 1;
      let totalDmg = 0;
      for (let h=0; h<hits; h++) {
        const dmg = damage(actor, target, move, spread);
        totalDmg += dmg;
        target.hp -= dmg;
        if (target.blocking && normalizeText(target.item) === 'riot shield') target.volatile.riotShieldHits += 1;
        if (target.hp <= 0) { target.hp = 0; target.fainted = true; break; }
      }
      const typeMult = getTypeMultiplier(move, target);
      log(`${actor.name} used ${move.Move_Name} on ${target.name} for ${totalDmg} damage${hits>1?` over ${hits} hits`:''}${typeMult > 1 ? ' (super effective)' : typeMult < 1 ? ' (resisted)' : ''}.`);
      const inferred = inferStatusFromMove(move);
      if (inferred && Math.random() < (normalizeText(actor.item) === 'lighter' && inferred === 'Burn' ? 0.4 : 0.3)) applyStatus(target, inferred);
      if (normalizeText(actor.item) === 'lighter' && !actor.status) applyStatus(actor, 'Burn');
      if (normalizeText(actor.item) === 'heart gem' && !target.fainted && target.hp <= 0 && !target.volatile.onceItemUsed) {
        target.hp = 1; target.volatile.onceItemUsed = true; log(`${target.name}'s Heart Gem kept it at 1 HP.`);
      }
      if (target.fainted) log(`${target.name} fainted.`);
    }
    replaceIfFainted('player'); replaceIfFainted('enemy'); syncBench('player'); syncBench('enemy');
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
document.getElementById('randomEnemyBtn').addEventListener('click', ()=>{ sim.enemyRoster = randomTeam().map((s,i)=>({...s, selected:i<4})); renderBattlePickers(); });
document.getElementById('startBattleBtn').addEventListener('click', startBattle);

renderBeastList();
renderTeam();
renderWiki();
renderRules();
