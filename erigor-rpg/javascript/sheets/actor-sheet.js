// systems/erigor-rpg/javascript/sheets/actor-sheet.js


/*************************************************************/
/* COMBATE – SONS E ANIMAÇÕES (TOKEN DO ATOR)                */
/*************************************************************/
function playCombatEffect(type, actor) {

  if (!actor) return;

  // 🔊 Sons
  const sounds = {
    armasBrancas: "systems/erigor-rpg/assets/sounds/sword-slice-393847.mp3",
    distancia: "systems/erigor-rpg/assets/sounds/arrow-body-impact-146419.mp3",
    desarmado: "systems/erigor-rpg/assets/sounds/power-punch-192118.mp3",
    espiritual: "systems/erigor-rpg/assets/sounds/magical-spell-cast-190272.mp3"
  };

  const soundPath = sounds[type];
  if (soundPath) {
    AudioHelper.play(
      { src: soundPath, volume: 0.2, autoplay: true, loop: false },
      true
    );
  }

  // ✨ Animações (JB2A + Sequencer)
  if (game.modules.get("sequencer")?.active) {
    let file;

    switch (type) {
      case "armasBrancas":
        file = "modules/JB2A_DnD5e/Library/Generic/Weapon_Attacks/Melee/Legacy/Sword01_01_Regular_White_800x600.webm";
        break;
      case "distancia":
        file = "modules/JB2A_DnD5e/Library/Generic/RangedSpell/04/RangedProjectile04_01_Regular_Green_30ft_1600x400.webm";
        break;
      case "desarmado":
        file = "modules/JB2A_DnD5e/Library/Generic/Creature/Claw/CreatureAttackClaw_001_003_Red_800x600.webm";
        break;
      case "espiritual":
        file = "modules/JB2A_DnD5e/Library/2nd_Level/Divine_Smite/DivineSmiteReversed_01_Regular_BlueYellow_Caster_400x400.webm";
        break;
    }

    if (!file) return;

    // 🎯 Pega um token ativo do ator
    const token =
      actor.getActiveTokens(true)[0] ??
      canvas.tokens.placeables.find(t => t.actor?.id === actor.id);

    if (!token) return;

    new Sequence()
      .effect()
      .file(file)
      .atLocation(token)
      .scale(0.7)
      .play();
  }
}



/*************************************************************/
/* FUNÇÃO AUXILIAR – CRÍTICO / FALHA CRÍTICA                 */
/*************************************************************/
function checkDoubleCritical(roll) {
  const die = roll.dice?.[0];
  if (!die || die.results.length < 2) return null;

  // pega apenas os dados USADOS (importante para kh/kl)
  const results = die.results
    .filter(r => r.active !== false)
    .map(r => r.result);

  if (results.length < 2) return null;
  if (results[0] === 10 && results[1] === 10) return "critical-success";
  if (results[0] === 1 && results[1] === 1) return "critical-failure";
  return null;
}

/*************************************************************/
/* ACTOR SHEET                                               */
/*************************************************************/
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
    return "systems/erigor-rpg/templates/actors/actor-sheet.html";
  }

  async getData(options) {
    const context = await super.getData(options);

    if (!this.actor || !this.actor.system) {
      ui.notifications.error("Erro crítico ao carregar dados do ator.");
      return context;
    }

    const actorData = this.actor.toObject(false);
    context.actor = actorData;
    context.system = actorData.system;
    context.flags = actorData.flags;
    context.config = CONFIG.ERIGOR_RPG;

    context.actorItems = {};
    if (CONFIG.ERIGOR_RPG?.itemTypes) {
      for (const key of Object.keys(CONFIG.ERIGOR_RPG.itemTypes)) {
        context.actorItems[key] = [];
      }
    }

    for (const item of this.actor.items) {
      if (context.actorItems[item.type]) {
        context.actorItems[item.type].push(item.toObject(false));
      }
    }

    return context;
  }

async _onSendAbilityToChat(event) {
  event.preventDefault();
  event.stopPropagation(); // Extra segurança contra bubbling
  const button = event.currentTarget;
  const path = button.dataset.habPath;
  if (!path) return;

  // PEGA O VALOR DIRETO DA TEXTAREA (mais confiável que getProperty)
  const textarea = button.closest('.habilidade-slot').querySelector('textarea');
  let text = textarea ? textarea.value.trim() : "";

  // Fallback: tenta pegar do system (caso textarea não encontre)
  if (!text) {
    text = foundry.utils.getProperty(this.actor.system, path) || "";
    text = text.trim();
  }

  if (!text) {
    ui.notifications.warn("A habilidade está vazia!");
    return;
  }

  // Extrai título até o primeiro "–" ou "—"
 const titleMatch = text.match(/^([^–—\n\r]+)/);
const title = titleMatch ? titleMatch[1].trim() : "Habilidade";

// remove o título do corpo do texto
let bodyText = text;
if (titleMatch) {
  bodyText = text.slice(titleMatch[0].length).trim();
}

const formattedText = bodyText.replace(/\n/g, "<br>");

  const content = `
    <div class="erigor-ability-chat" style="padding: 10px; border-left: 4px solid #ff6400; background: rgba(0,0,0,0.5); margin: 5px 0; border-radius: 4px;">
      <h3 style="margin: 0 0 8px 0; color: #ffaa00; border-bottom: 1px solid #ff6400;">${title}</h3>
      <div style="font-size: 1.1em; line-height: 1.5;">${formattedText}</div>
    </div>
  `;

  await ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor: this.actor }),
    content: content,
    type: CONST.CHAT_MESSAGE_TYPES.OTHER
  });
}

  activateListeners(html) {
    super.activateListeners(html);

    // Impede Enter em inputs
    html.find('input[type="text"], input[type="number"]').keypress(ev => {
      if (ev.which === 13) ev.preventDefault();
    });

    // Listeners para rolagens
    html.find('.rollable-attribute, .rollable-combat, .rollable-initiative')
      .click(this._onRoll.bind(this));
    html.find('.rollable-weapon-attack')
      .click(this._onAttackRoll.bind(this));
    html.find('.rollable-manual-damage')
      .click(this._onRollDamage.bind(this));

    // === BOTÃO DE ENVIAR HABILIDADE AO CHAT (DELEGAÇÃO – NUNCA DUPLICA) ===
    // Usa delegação no container pai (a ficha inteira)
    html.off('click', '.send-to-chat-btn'); // Limpa qualquer listener antigo no container
    html.on('click', '.send-to-chat-btn', this._onSendAbilityToChat.bind(this));
  }

  /*************************************************************/
  /* TESTES (ATRIBUTO / COMBATE / INICIATIVA + MORAL)          */
  /*************************************************************/
  async _onRoll(event) {
    event.preventDefault();

    const actor = this.actor;
    const dataset = event.currentTarget.dataset;

    let baseDiceFormula = "";
    let modifierPart = "";
    let title = "";
    let isInitiative = false;
    let isStandardTest = false;

    if (!actor || !actor.system) return;

    if (dataset.rollType === "attribute") {
      const attr = actor.system.atributos?.[dataset.key];
      if (!attr) return;

      baseDiceFormula = "2d10";
      modifierPart = attr.mod ? `${attr.mod >= 0 ? "+" : ""}${attr.mod}` : "";
      title = game.i18n.format("ERI-GOR.RollTest", { skill: dataset.key });
      isStandardTest = true;
    }

    if (dataset.rollType === "combat") {
  const stat = actor.system.combates?.[dataset.key];
  if (!stat) return;

  // 🔊 SOM + ANIMAÇÃO
  playCombatEffect(dataset.key, actor);

  baseDiceFormula = "2d10";
  modifierPart = stat.total ? `${stat.total >= 0 ? "+" : ""}${stat.total}` : "";
  title = game.i18n.format("ERI-GOR.RollTest", { skill: dataset.key });
  isStandardTest = true;
}

    if (dataset.rollType === "initiative") {
      const ini = actor.system.estatisticasCombate?.iniciativa ?? 0;
      baseDiceFormula = "1d10";
      modifierPart = ini ? `${ini >= 0 ? "+" : ""}${ini}` : "";
      title = game.i18n.localize("ERI-GOR.Label.Iniciativa");
      isInitiative = true;
    }

    const performActualRoll = async (diceFormula, modPart, chatTitle) => {
      const roll = new Roll(`${diceFormula} ${modPart}`, actor.getRollData());
      await roll.evaluate({ async: true });

      // 🎯 CRÍTICO / FALHA CRÍTICA
      const critical = checkDoubleCritical(roll);
      if (critical) {
        await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          content: `
            <div>
              <h2>${critical === "critical-success" ? "✨ ACERTO CRÍTICO!" : "💀 FALHA CRÍTICA!"}</h2>
              <p><strong>${actor.name}</strong> obteve um resultado extremo.</p>
            </div>
          `,
          sound: CONFIG.sounds.dice
        });
      }

      // Iniciativa
      if (isInitiative && game.combat) {
        const combatant = game.combat.combatants.find(c => c.actorId === actor.id);
        if (combatant) await game.combat.setInitiative(combatant.id, roll.total);
      }

      let templatePath;
let templateData;

if (isInitiative) {
  templatePath = "systems/erigor-rpg/templates/chat/initiative-roll-card.html";
  templateData = {
    title: chatTitle,
    actorName: actor.name,
    actorImg: actor.img,
    formula: roll.formula,
    tooltip: await roll.getTooltip(),
    total: Math.round(roll.total)
  };
} else {
  templatePath = "systems/erigor-rpg/templates/chat/roll-card.html";
  templateData = {
    title: chatTitle,
    formula: roll.formula,
    tooltip: await roll.getTooltip(),
    total: Math.round(roll.total),
    actorId: actor.id
  };
}

const chatContent = await renderTemplate(templatePath, templateData);

      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: chatContent,
        rolls: [roll],
        sound: CONFIG.sounds.dice
      });
    };

    // 🧠 MORAL
    if (isStandardTest) {
      new Dialog({
        title: game.i18n.localize("ERI-GOR.Dialog.Moral.Title"),
        content: `<p style="text-align:center;">
          ${game.i18n.localize("ERI-GOR.Dialog.Moral.Prompt")}
        </p>`,
        buttons: {
          elevado: {
            label: game.i18n.localize("ERI-GOR.Moral.Elevado"),
            callback: () =>
              performActualRoll(
                "3d10kh2",
                modifierPart,
                `${title} (${game.i18n.localize("ERI-GOR.Moral.ElevadoShort")})`
              )
          },
          normal: {
            label: game.i18n.localize("ERI-GOR.Moral.Normal"),
            callback: () =>
              performActualRoll(
                baseDiceFormula,
                modifierPart,
                `${title} (${game.i18n.localize("ERI-GOR.Moral.NormalShort")})`
              )
          },
          abalado: {
            label: game.i18n.localize("ERI-GOR.Moral.Abalado"),
            callback: () =>
              performActualRoll(
                "3d10kl2",
                modifierPart,
                `${title} (${game.i18n.localize("ERI-GOR.Moral.AbaladoShort")})`
              )
          }
        },
        default: "normal"
      }).render(true);
    } else {
      performActualRoll(baseDiceFormula, modifierPart, title);
    }
  }

  /*************************************************************/
  /* ATAQUE                                                   */
  /*************************************************************/
  async _onAttackRoll(event) {
    event.preventDefault();

    const actor = this.actor;
    const dataset = event.currentTarget.dataset;

    const roll = new Roll(dataset.attackFormula, actor.getRollData());
    await roll.evaluate({ async: true });

    const dice = roll.dice?.[0]?.results.map(r => r.result) ?? [];
    const target = [...game.user.targets][0];
    if (!target) return;

    const defense =
      foundry.utils.getProperty(target.actor.system, dataset.targetDefenseStat) ?? 10;

    const success = roll.total >= defense;
    const isCriticalSuccess = dice[0] === 10 && dice[1] === 10;
    const isCriticalFailure = dice[0] === 1 && dice[1] === 1;

    if (isCriticalSuccess || isCriticalFailure) {
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `
          <div>
            <h2>${isCriticalSuccess ? "🔥 ATAQUE CRÍTICO!" : "☠️ FALHA CRÍTICA!"}</h2>
            <p><strong>${actor.name}</strong>
            ${isCriticalSuccess ? "executa um golpe devastador!" : "comete um erro terrível!"}</p>
          </div>
        `,
        sound: CONFIG.sounds.dice
      });
    }

    const chatContent = await renderTemplate(
      "systems/erigor-rpg/templates/chat/attack-roll-card.html",
      {
        title: `Ataque`,
        attackerName: actor.name,
        attackerImg: actor.img,
        rollFormula: roll.formula,
        rollTooltip: await roll.getTooltip(),
        rollTotal: roll.total,
        targetName: target.name,
        targetDefenseValue: defense,
        success,
        isCriticalSuccess,
        isCriticalFailure
      }
    );

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: chatContent,
      rolls: [roll],
      sound: CONFIG.sounds.dice
    });
  }

  async _onRollDamage(event) {
    event.preventDefault();
    const actor = this.actor;
    const formula = foundry.utils.getProperty(actor, event.currentTarget.dataset.damagePath);
    if (!formula) return;

    const roll = new Roll(formula, actor.getRollData());
    await roll.evaluate({ async: true });

    const chatContent = await renderTemplate(
      "systems/erigor-rpg/templates/chat/roll-card.html",
      {
        title: "Dano",
        formula: roll.formula,
        tooltip: await roll.getTooltip(),
        total: roll.total,
        isDamageRoll: true,
        actorId: actor.id
      }
    );

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: chatContent,
      rolls: [roll],
      sound: CONFIG.sounds.dice
    });
  }
}
