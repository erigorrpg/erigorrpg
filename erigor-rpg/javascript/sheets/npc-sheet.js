// systems/erigor-rpg/javascript/sheets/npc-sheet.js
// Dentro da classe ErigorRpgNpcSheet

  async _onRollNpcInitiative(event) {
    event.preventDefault();
    const actor = this.actor;
    if (!actor || !actor.system) { console.error("ERI-GOR RPG | Ator NPC ou npc.system não definido em _onRollNpcInitiative"); ui.notifications.error("NPC inválido para rolagem."); return; }

    const initiativeValue = actor.system.estatisticasCombate?.iniciativa;
    const modifierString = (typeof initiativeValue === 'number' && initiativeValue !== 0) ? `${initiativeValue >= 0 ? '+' : ''} ${initiativeValue}` : "";
    const rollFormula = `1d10 ${modifierString}`.trim();
    const label = game.i18n.localize("ERI-GOR.Label.Iniciativa");
    console.log(`ERI-GOR RPG | Iniciativa para NPC: ${actor.name}, Fórmula: ${rollFormula}`);
    
    let roll;
    try {
        roll = new Roll(rollFormula, actor.getRollData());
        await roll.evaluate({async: true});
    } catch(err) {
        console.error("ERI-GOR RPG | Erro ao avaliar rolagem de iniciativa NPC:", err, rollFormula);
        ui.notifications.error("Fórmula de iniciativa inválida.");
        return;
    }
      
    if (game.combat) {
      const combatant = game.combat.combatants.find(c => c.actorId === actor.id);
      if (combatant?.id) await game.combat.setInitiative(combatant.id, roll.total);
    }
    
    const templateData = {
      title: label, // "Iniciativa"
      actorName: actor.name,
      actorImg: actor.img,
      formula: roll.formula,
      tooltip: await roll.getTooltip(),
      total: Math.round(roll.total * 100) / 100
    };
    console.log("ERI-GOR RPG | npc-sheet.js (_onRollNpcInitiative) - Dados para initiative-roll-card.html:", templateData);

    let messageContent;
    const templatePath = "systems/erigor-rpg/templates/chat/initiative-roll-card.html";
    try {
      messageContent = await renderTemplate(templatePath, templateData);
      console.log(`ERI-GOR RPG | npc-sheet.js (_onRollNpcInitiative) - Conteúdo HTML renderizado para ${templatePath}:`, messageContent);
    } catch (renderError) {
      console.error(`ERI-GOR RPG | Erro ao renderizar o template ${templatePath} para NPC:`, renderError, templateData);
      ui.notifications.error(`Erro ao renderizar card de iniciativa para ${actor.name}. Verifique o console.`);
      messageContent = `Iniciativa de ${actor.name}: ${roll.total} (Fórmula: ${roll.formula})`;
    }
    
    ChatMessage.create({
      user: game.user.id, 
      speaker: ChatMessage.getSpeaker({ actor: actor }),
      content: messageContent, 
      rolls: [roll], // Anexa o objeto Roll
      sound: CONFIG.sounds.dice
    });
  }
  // ... resto da classe ErigorRpgNpcSheet ...