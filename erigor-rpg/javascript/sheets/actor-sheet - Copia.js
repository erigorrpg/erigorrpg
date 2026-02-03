// systems/erigor-rpg/javascript/sheets/actor-sheet.js
export class ErigorRpgActorSheet extends ActorSheet {

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["erigor-rpg", "sheet", "actor", "erigor-character-sheet"],
      template: "systems/erigor-rpg/templates/actors/actor-sheet.html",
      width: 850,
      height: 780,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "principal" }],
      scrollY: [".sheet-body"]
    });
  }

  get template() {
    return `systems/erigor-rpg/templates/actors/actor-sheet.html`;
  }

  async getData(options) {
    const context = await super.getData(options);
    const actorData = this.actor.toObject(false);
    context.actor = actorData;
    context.system = actorData.system;
    context.flags = actorData.flags;
    context.config = CONFIG.ERIGOR_RPG;

    context.actorItems = {};
    if (CONFIG.ERIGOR_RPG && CONFIG.ERIGOR_RPG.itemTypes) {
        for (const itemTypeKey of Object.keys(CONFIG.ERIGOR_RPG.itemTypes)) {
            context.actorItems[itemTypeKey] = [];
        }
    }

    if (this.actor.items) {
        for (const i of this.actor.items) {
          if (context.actorItems[i.type]) {
            context.actorItems[i.type].push(i.toObject(false));
          }
        }
    }
    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find('input[type="text"], input[type="number"], textarea').keypress(event => {
      if (event.which === 13 && event.target.type !== "textarea") event.preventDefault();
    });

    // Listeners para rolagens
    html.find('.rollable-attribute, .rollable-combat, .rollable-initiative').click(this._onRoll.bind(this));
    html.find('.rollable-weapon-attack').click(this._onAttackRoll.bind(this)); // Garanta que _onAttackRoll exista
    html.find('.rollable-manual-damage').click(this._onRollDamage.bind(this));

    // Listeners para gerenciamento de Itens (CRUD)
    // Adicionada checagem para .habilidades-card .item-control.item-create se você decidir usar itens para habilidades
    html.find('.items-list .item-control.item-create, .habilidades-card .item-control.item-create').click(this._onItemCreate.bind(this));
    html.find('.items-list .item-control.item-edit').click(this._onItemEdit.bind(this));
    html.find('.items-list .item-control.item-delete').click(this._onItemDelete.bind(this));
    html.find('.items-list .item-name-display a, .items-list .item-image-container img').click(this._onItemSheetOpen.bind(this));
  }

  async _onRoll(event) {
    event.preventDefault();
    const element = event.currentTarget; const dataset = element.dataset; const actor = this.actor;
    let baseDiceFormula = "", modifierPart = "", label = "";
    let chatDataProperties = { title: "Rolagem" };
    let isInitiativeRoll = false, isStandardTest = false, useInitiativeCard = false;

    if (!actor || !actor.system) { return; }

    if (dataset.rollType === "attribute") {
      const attributeKey = dataset.key; const attribute = actor.system.atributos?.[attributeKey];
      if (attribute && typeof attribute.mod === 'number') {
        label = game.i18n.localize(CONFIG.ERIGOR_RPG.attributeLabels?.[attributeKey] || `ERI-GOR.${attributeKey}`);
        baseDiceFormula = `2d10`; modifierPart = attribute.mod !== 0 ? `${attribute.mod >= 0 ? '+': ''} ${attribute.mod}` : "";
        chatDataProperties.title = game.i18n.format("ERI-GOR.RollTest", {skill: label}); isStandardTest = true;
      } else { ui.notifications.warn(`Atributo ou modificador de ${attributeKey} não encontrado/inválido.`); return; }
    } else if (dataset.rollType === "combat") {
      const combatKey = dataset.key; const combatStat = actor.system.combates?.[combatKey];
      if (combatStat && typeof combatStat.total === 'number') {
        label = game.i18n.localize(CONFIG.ERIGOR_RPG.combatLabels?.[combatKey] || `ERI-GOR.combat.${combatKey}`);
        baseDiceFormula = `2d10`; modifierPart = combatStat.total !== 0 ? `${combatStat.total >= 0 ? '+': ''} ${combatStat.total}` : "";
        chatDataProperties.title = game.i18n.format("ERI-GOR.RollTest", {skill: label}); isStandardTest = true;
      } else { ui.notifications.warn(`Valor de combate para ${combatKey} não encontrado/inválido.`); return; }
    } else if (dataset.rollType === "initiative") {
      label = game.i18n.localize("ERI-GOR.Label.Iniciativa");
      const initiativeValue = actor.system.estatisticasCombate?.iniciativa;
      if (typeof initiativeValue === 'number') {
        baseDiceFormula = `1d10`; modifierPart = initiativeValue !== 0 ? `${initiativeValue >= 0 ? '+': ''} ${initiativeValue}` : "";
        chatDataProperties.title = label; isInitiativeRoll = true; useInitiativeCard = true;
      } else { ui.notifications.warn("Valor de iniciativa inválido."); return; }
    } else { ui.notifications.error("Tipo de rolagem desconhecido."); return; }
    
    const performActualRoll = async (currentBase, currentMod, currentChatTitle) => {
      const finalRollFormula = `${currentBase} ${currentMod}`.trim();
      let roll = new Roll(finalRollFormula, actor.getRollData());
      try {
          await roll.evaluate({async: true});
      } catch(err) {
          console.error(`ERI-GOR RPG | Erro ao avaliar rolagem (${finalRollFormula}):`, err);
          ui.notifications.error(`Fórmula de rolagem inválida: ${finalRollFormula}`);
          return;
      }
        
      if (isInitiativeRoll && game.combat) {
        const combatant = game.combat.combatants.find(c => c.actorId === actor.id);
        if (combatant?.id) await game.combat.setInitiative(combatant.id, roll.total);
      }
      let templatePath = useInitiativeCard ? "systems/erigor-rpg/templates/chat/initiative-roll-card.html" : "systems/erigor-rpg/templates/chat/roll-card.html";
      let templateData = useInitiativeCard ? {
        title: currentChatTitle, actorName: actor.name, actorImg: actor.img,
        formula: roll.formula, tooltip: await roll.getTooltip(), total: Math.round(roll.total)
      } : {
        title: currentChatTitle, formula: roll.formula, tooltip: await roll.getTooltip(),
        total: Math.round(roll.total), isDamageRoll: false, actorId: actor.id
      };
      const messageContent = await renderTemplate(templatePath, templateData);
      ChatMessage.create({
        user: game.user.id, speaker: ChatMessage.getSpeaker({ actor: actor }),
        content: messageContent, rolls: [roll], sound: CONFIG.sounds.dice
      });
    };

    if (isStandardTest) {
      new Dialog({
        title: game.i18n.localize("ERI-GOR.Dialog.Moral.Title"),
        content: `<p style="text-align: center;">${game.i18n.localize("ERI-GOR.Dialog.Moral.Prompt")}</p>`,
        buttons: {
          elevado: { icon: '<i class="fas fa-angle-double-up"></i>', label: game.i18n.localize("ERI-GOR.Moral.Elevado"), callback: () => performActualRoll(`3d10kh2`, modifierPart, chatDataProperties.title + ` (${game.i18n.localize("ERI-GOR.Moral.ElevadoShort") || "Moral Elevado"})`) },
          normal: { icon: '<i class="fas fa-equals"></i>', label: game.i18n.localize("ERI-GOR.Moral.Normal"), callback: () => performActualRoll(baseDiceFormula, modifierPart, chatDataProperties.title + ` (${game.i18n.localize("ERI-GOR.Moral.NormalShort") || "Moral Normal"})`) },
          abalado: { icon: '<i class="fas fa-angle-double-down"></i>', label: game.i18n.localize("ERI-GOR.Moral.Abalado"), callback: () => performActualRoll(`3d10kl2`, modifierPart, chatDataProperties.title + ` (${game.i18n.localize("ERI-GOR.Moral.AbaladoShort") || "Moral Abalado"})`) }
        },
        default: "normal"
      }).render(true);
    } else { performActualRoll(baseDiceFormula, modifierPart, chatDataProperties.title); }
  }
  
  async _onAttackRoll(event) {
    event.preventDefault();
    const element = event.currentTarget; const dataset = element.dataset; const actor = this.actor;
    if (!actor || !actor.system) { ui.notifications.error("Ator inválido para ataque."); return; }

    const attackFormula = dataset.attackFormula;
    const targetDefenseStatPath = dataset.targetDefenseStat || "system.estatisticasCombate.defesa";
    const weaponName = dataset.weaponName || "Ataque";
    const damageFormula = dataset.damageFormula;
    const damageType = dataset.damageType || "normal";

    if (!attackFormula) { ui.notifications.warn("Fórmula de ataque não definida!"); return; }
    const targets = Array.from(game.user.targets);
    if (targets.length === 0) { ui.notifications.warn("Selecione um alvo."); return; }
    const targetToken = targets[0]; const targetActor = targetToken.actor;
    if (!targetActor || !targetActor.system) { ui.notifications.warn("Alvo inválido ou sem dados de sistema."); return; }

    const targetDefenseName = targetDefenseStatPath.split('.').pop();
    let targetDefenseValue = foundry.utils.getProperty(targetActor.system, targetDefenseStatPath);
    if(typeof targetDefenseValue !== 'number' || isNaN(targetDefenseValue)) {
        targetDefenseValue = 10; 
    }
    
    let roll = new Roll(attackFormula, actor.getRollData());
    try {
        await roll.evaluate({ async: true });
    } catch(err) {
        console.error("ERI-GOR RPG | Erro ao avaliar rolagem de ataque:", err, attackFormula);
        ui.notifications.error("Fórmula de ataque inválida.");
        return;
    }

    const success = roll.total >= targetDefenseValue;
    const diceResults = (roll.dice[0] && roll.dice[0].results) ? roll.dice[0].results.map(r => r.result) : [];
    const isCriticalSuccess = success && diceResults.length >= 2 && diceResults.slice(0, 2).every(r => r === 10);
    const isCriticalFailure = !success && diceResults.length >= 2 && diceResults.slice(0, 2).every(r => r === 1);

    const templateData = {
      title: `Ataque: ${weaponName}`, attackerName: actor.name, attackerImg: actor.img, attackerActorId: actor.id,
      weaponName: weaponName, damageFormula: damageFormula, damageType: damageType,
      rollFormula: roll.formula, rollTooltip: await roll.getTooltip(), rollTotal: roll.total,
      targetName: targetToken.name, 
      targetDefenseName: game.i18n.localize(CONFIG.ERIGOR_RPG.attributeLabels?.[targetDefenseName] || CONFIG.ERIGOR_RPG.combatLabels?.[targetDefenseName] || `ERI-GOR.${targetDefenseName}`) || targetDefenseName.capitalize(), 
      targetDefenseValue: targetDefenseValue,
      success: success, isCriticalSuccess: isCriticalSuccess, isCriticalFailure: isCriticalFailure
    };
    const chatContent = await renderTemplate("systems/erigor-rpg/templates/chat/attack-roll-card.html", templateData);
    ChatMessage.create({
      user: game.user.id, speaker: ChatMessage.getSpeaker({ actor: actor }),
      content: chatContent, rolls: [roll], sound: CONFIG.sounds.dice
    });
  }
  
  async _onRollDamage(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const actor = this.actor;
    if (!actor) return;

    const damagePath = element.dataset.damagePath; 
    if (!damagePath) { ui.notifications.warn("Caminho para fórmula de dano não definido no botão!"); return; }
    const damageFormula = foundry.utils.getProperty(actor.system, damagePath); // Corrigido para actor.system

    if (!damageFormula || typeof damageFormula !== 'string' || damageFormula.trim() === "") {
      ui.notifications.warn(game.i18n.localize("ERI-GOR.Error.InvalidDamageFormula") + ` (Para: ${damagePath})`);
      return;
    }

    const namePath = damagePath.substring(0, damagePath.lastIndexOf('.')) + ".nome";
    const weaponName = foundry.utils.getProperty(actor.system, namePath) || game.i18n.localize("ERI-GOR.Label.ArmaDesconhecida") || "Arma";
    
    let roll = new Roll(damageFormula, actor.getRollData());
    try {
      await roll.evaluate({ async: true }); 
    } catch (err) {
      console.error(`ERI-GOR RPG | Erro ao avaliar fórmula de dano manual "${damageFormula}" para ${weaponName}:`, err);
      ui.notifications.error(`Fórmula de dano manual inválida: ${damageFormula}`);
      return;
    }
    
    const chatTitle = game.i18n.format("ERI-GOR.RollDamageFor", {weapon: weaponName});
    const damageType = "normal"; 

    const templateData = {
      title: chatTitle, formula: roll.formula, tooltip: await roll.getTooltip(), total: roll.total,
      isDamageRoll: true, actorId: actor.id
    };
    const chatContent = await renderTemplate("systems/erigor-rpg/templates/chat/roll-card.html", templateData);
    
    await ChatMessage.create({
      user: game.user.id, speaker: ChatMessage.getSpeaker({ actor: actor }),
      content: chatContent, rolls: [roll], sound: CONFIG.sounds.dice,
      flags: { "erigorRpg": { damageType: damageType, isDamageRollMessage: true } }
    });
  }

  _onItemSheetOpen(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item")?.dataset.itemId;
    if (!itemId) return;
    const item = this.actor.items.get(itemId);
    if (item) item.sheet.render(true);
  }

  async _onItemCreate(event) {
    event.preventDefault();
    const header = event.currentTarget;
    const type = header.dataset.type;
    if (!type) return;
    const nameKey = CONFIG.ERIGOR_RPG.itemTypes?.[type] || type.capitalize();
    const name = game.i18n.format("ERI-GOR.ItemNew", {type: game.i18n.localize(nameKey)});
    const itemData = { name: name, type: type, system: {} };
    await Item.create(itemData, {parent: this.actor, renderSheet: true});
  }

  _onItemEdit(event) {
    event.preventDefault();
    const li = event.currentTarget.closest(".item");
    if (!li) return;
    const item = this.actor.items.get(li.dataset.itemId);
    if (item) item.sheet.render(true);
  }

  async _onItemDelete(event) {
    event.preventDefault();
    const li = event.currentTarget.closest(".item");
    if (!li) return;
    const item = this.actor.items.get(li.dataset.itemId);
    if (item) {
      await Dialog.confirm({
        title: game.i18n.localize("ERI-GOR.ItemDeleteConfirmTitle"),
        content: `<p>${game.i18n.format("ERI-GOR.ItemDeleteConfirmContent", {item: item.name})}</p>`,
        yes: () => item.delete(),
        no: () => {},
        defaultYes: false
      });
    }
  }
}