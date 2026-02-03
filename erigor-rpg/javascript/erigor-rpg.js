// systems/erigor-rpg/javascript/erigor-rpg.js

import { ErigorRpgActor } from "./actor.js";
import { ErigorRpgItem } from "./item.js";
import { ErigorRpgActorSheet } from "./sheets/actor-sheet.js";
import { ErigorRpgItemSheet } from "./sheets/item-sheet.js";

Hooks.once('init', async function() {
  console.log("ERI-GOR RPG | Inicializando sistema ERI-GOR RPG");

  game.erigorRpg = { ErigorRpgActor, ErigorRpgItem };

  CONFIG.Actor.documentClass = ErigorRpgActor;
  CONFIG.Item.documentClass = ErigorRpgItem;

  CONFIG.ERIGOR_RPG = {
    itemTypes: {
        "arma": "ERI-GOR.ItemType.Arma", "armadura": "ERI-GOR.ItemType.Armadura", "escudo": "ERI-GOR.ItemType.Escudo",
        "acessorio": "ERI-GOR.ItemType.Acessorio", "consumivel": "ERI-GOR.ItemType.Consumivel", "municao": "ERI-GOR.ItemType.Municao",
        "runa": "ERI-GOR.ItemType.Runa", "itemMagico": "ERI-GOR.ItemType.ItemMagico", "kit": "ERI-GOR.ItemType.Kit",
        "ferramenta": "ERI-GOR.ItemType.Ferramenta", "itemGeral": "ERI-GOR.ItemType.ItemGeral", "habilidade": "ERI-GOR.ItemType.Habilidade",
        "pericia": "ERI-GOR.ItemType.Pericia", "qualidade": "ERI-GOR.ItemType.Qualidade", "defeito": "ERI-GOR.ItemType.Defeito",
        "antecedente": "ERI-GOR.ItemType.Antecedente", "veiculo": "ERI-GOR.ItemType.Veiculo", "embarcacao": "ERI-GOR.ItemType.Embarcacao"
    },
    tiposDeArma: {
        "branca": "ERI-GOR.ArmaTipo.Branca", "longoAlcance": "ERI-GOR.ArmaTipo.LongoAlcance", "desarmado": "ERI-GOR.ArmaTipo.Desarmado"
    },
    categoriasConsumivel: {
        "pocao": "ERI-GOR.ConsumivelCat.Pocao", "alimento": "ERI-GOR.ConsumivelCat.Alimento", "veneno": "ERI-GOR.ConsumivelCat.Veneno",
        "bomba": "ERI-GOR.ConsumivelCat.Bomba", "outro": "ERI-GOR.ConsumivelCat.Outro"
    },
    slotsAcessorio: {
        "anelBrinco": "ERI-GOR.Slot.AnelBrinco", "oculosMascara": "ERI-GOR.Slot.OculosMascara", "capacete": "ERI-GOR.Slot.Capacete",
        "amuleto": "ERI-GOR.Slot.Amuleto", "botas": "ERI-GOR.Slot.Botas", "braceletesLuvas": "ERI-GOR.Slot.BraceletesLuvas",
        "capa": "ERI-GOR.Slot.Capa", "cinto": "ERI-GOR.Slot.Cinto", "estandarte": "ERI-GOR.Slot.Estandarte"
    },
    attributeLabels: {
        "porte": "ERI-GOR.porte", "destreza": "ERI-GOR.destreza", "intelecto": "ERI-GOR.intelecto", "espirito": "ERI-GOR.espirito"
    },
    combatLabels: {
        "armasBrancas": "ERI-GOR.combat.armasBrancas", "distancia": "ERI-GOR.combat.distancia",
        "desarmado": "ERI-GOR.combat.desarmado", "espiritual": "ERI-GOR.combat.espiritual"
    }
  };

  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("erigor-rpg", ErigorRpgActorSheet, {
    types: ["personagem", "npc"], makeDefault: true, label: "ERI-GOR.Sheet.Actor"
  });

  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("erigor-rpg", ErigorRpgItemSheet, {
    types: Object.keys(CONFIG.ERIGOR_RPG.itemTypes || {}), makeDefault: true, label: "ERI-GOR.Sheet.Item"
  });

  const templatePaths = [
    "systems/erigor-rpg/templates/actors/actor-sheet.html",
    "systems/erigor-rpg/templates/actors/npc-sheet.html",
    "systems/erigor-rpg/templates/items/item-sheet.html",
    "systems/erigor-rpg/templates/chat/roll-card.html",
    "systems/erigor-rpg/templates/chat/damage-applied-card.html",
    "systems/erigor-rpg/templates/chat/attack-roll-card.html",
    "systems/erigor-rpg/templates/chat/initiative-roll-card.html"
  ];
  loadTemplates(templatePaths);
  
  // Helpers Handlebars (ESSA PARTE É CRUCIAL)
  if (Handlebars) { 
    Handlebars.registerHelper('contains', function(haystack, needle) {
      if (typeof haystack !== 'string' || typeof needle !== 'string') {
        return false;
      }
      return haystack.includes(needle);
    });

    Handlebars.registerHelper('uppercase', function(str) {
      if (typeof str !== 'string') return '';
      return str.toUpperCase();
    });
  }

  console.log("ERI-GOR RPG | Sistema ERI-GOR RPG carregado.");
});

Hooks.once('ready', async function() {
  console.log("ERI-GOR RPG | Foundry está pronto!");
});

// =========================================
// ERI-GOR | DANO / CURA FLUTUANTE (V12 ROBUSTO)
// =========================================

const ERIGOR_PRE_PV = new Map();

// Guarda o PV ANTES da mudança
Hooks.on("preUpdateActor", (actor, changes) => {
  const pvPath = "system.energias.pv.valor";
  if (!foundry.utils.hasProperty(changes, pvPath)) return;

  const oldPV = foundry.utils.getProperty(actor, pvPath);
  if (typeof oldPV === "number") {
    ERIGOR_PRE_PV.set(actor.id, oldPV);
  }
});

// Aplica efeito APÓS a mudança
Hooks.on("updateActor", (actor, changes) => {
  const pvPath = "system.energias.pv.valor";
  const pvMaxPath = "system.energias.pv.max";

  if (!foundry.utils.hasProperty(changes, pvPath)) return;

  const oldPV = ERIGOR_PRE_PV.get(actor.id);
  const newPV = foundry.utils.getProperty(actor, pvPath);

  // limpa cache
  ERIGOR_PRE_PV.delete(actor.id);

  if (typeof oldPV !== "number" || typeof newPV !== "number") return;

  // Se PV máximo mudou junto, é buff/recalculo → ignora efeitos
  if (foundry.utils.hasProperty(changes, pvMaxPath)) return;

  const diff = newPV - oldPV;
  if (diff === 0) return;

  const tokens = actor.getActiveTokens(true);
  if (!tokens.length) return;

  for (const token of tokens) {
    const texto = diff > 0 ? `+${diff}` : `${diff}`;
    const cor = diff > 0 ? "#3CFF3C" : "#FF3C3C";

    canvas.interface.createScrollingText(token.center, texto, {
      fill: cor,
      fontSize: 80,
      stroke: "#000000",
      strokeThickness: 8,
      duration: 3000,
screenSpace: true,

    });

    // FX JB2A
    if (game.modules.get("sequencer")?.active) {
      new Sequence()
        .effect()
        .file(
          diff > 0
            ? "modules/JB2A_DnD5e/Library/Generic/Healing/HealingAbility_01_Green_400x400.webm"
            : "modules/JB2A_DnD5e/Library/Generic/Weapon_Attacks/Melee/Legacy/Sword01_01_Regular_White_800x600.webm"
        )
        .atLocation(token)
        .scaleToObject(1.6)
        .play();
    }
  }
});

Hooks.on('renderChatMessage', async (chatMessage, html, messageData) => {
  const applyDamageButton = html.find('button.apply-damage-button');
  if (applyDamageButton.length > 0) {
    const damageValue = parseInt(applyDamageButton.data('damage-value'));
    const damageTypeString = chatMessage.flags?.erigorRpg?.damageType || applyDamageButton.data('damage-type') || "normal"; 

    if (isNaN(damageValue) || damageValue < 0) { return; }

    applyDamageButton.off('click.erigorDamageSystem').on('click.erigorDamageSystem', async (event) => {
      event.preventDefault(); event.stopPropagation();
      const targets = Array.from(game.user.targets);
      if (targets.length === 0) { ui.notifications.warn("ERI-GOR RPG | Selecione alvos."); return; }

      let canApply = true;
      for (const targetToken of targets) {
        const targetActor = targetToken.actor;
        if (!targetActor || (!targetActor.isOwner && !game.user.isGM)) {
          canApply = false; break;
        }
      }
      if (!canApply) { ui.notifications.warn("ERI-GOR RPG | Sem permissão para um ou mais alvos."); return; }
      
      ui.notifications.info(`ERI-GOR RPG | Aplicando ${damageValue} de dano (${damageTypeString}) a ${targets.length} alvo(s).`);
      const opcoesDano = { 
          tipoDano: damageTypeString,
          attackerName: chatMessage.speaker.alias || chatMessage.speaker.actor 
      };

      for (const targetToken of targets) {
        const targetActor = targetToken.actor;
        if (targetActor && typeof targetActor.aplicarDano === 'function') {
          await targetActor.aplicarDano(damageValue, opcoesDano);
        } else if (targetActor) { 
          console.warn(`ERI-GOR RPG | Fallback: ${targetActor.name} não tem aplicarDano.`);
          const hpPath = "system.energias.pv.valor";
          let valorProtecaoFallback = Number(targetActor.system.estatisticasCombate?.protecaoFinal) || Number(foundry.utils.getProperty(targetActor.system, "equipamentosManuais.armadura.protecao")) || 0;
          valorProtecaoFallback = Math.min(valorProtecaoFallback, 10);
          let danoAplicadoFallback = damageValue;
          let danoAbsorvidoFallback = 0;
          if (opcoesDano.tipoDano !== "bruto") {
              danoAbsorvidoFallback = Math.min(damageValue, valorProtecaoFallback);
              danoAplicadoFallback = Math.max(0, damageValue - valorProtecaoFallback);
          }
          const currentHp = foundry.utils.getProperty(targetActor.system, hpPath);
          if (typeof currentHp === 'number' && !isNaN(currentHp)) {
            const newHp = Math.max(0, currentHp - danoAplicadoFallback);
            try {
              await targetActor.update({ [hpPath]: newHp });
              const fallbackTemplateData = {
                cardTitle: `Dano em ${targetActor.name} (Fallback)`, targetName: targetActor.name,
                damageAppliedValue: danoAplicadoFallback,
                wasAbsorbed: (opcoesDano.tipoDano !== "bruto" && valorProtecaoFallback > 0 && danoAbsorvidoFallback > 0),
                protectionValue: valorProtecaoFallback, damageAbsorbedValue: danoAbsorvidoFallback,
                isBrute: (opcoesDano.tipoDano === "bruto"),
                attackerName: opcoesDano.attackerName
              };
              const fallbackChatContent = await renderTemplate("systems/erigor-rpg/templates/chat/damage-applied-card.html", fallbackTemplateData);
              ChatMessage.create({ speaker: ChatMessage.getSpeaker({actor: targetActor}), content: fallbackChatContent });
              if (newHp === 0 && currentHp > 0) {
                  ChatMessage.create({ speaker: ChatMessage.getSpeaker({actor: targetActor}), content: `<strong>${targetActor.name} atingiu 0 Pontos de Vida (via fallback)!</strong>` });
              }
            } catch (err) { console.error(`ERI-GOR RPG | Falha update ${targetActor.name} fallback:`, err); }
          } else { ui.notifications.error(`Fallback: PV inválido para ${targetActor.name}.`); }
        }
      }
    });
  }

  const attackCardDamageButton = html.find('.attack-roll-card button.rollable-damage');
  if (attackCardDamageButton.length > 0) {
    attackCardDamageButton.off('click.erigorAttackDamage').on('click.erigorAttackDamage', async (event) => {
        event.preventDefault(); event.stopPropagation();
        const element = event.currentTarget;
        const actorId = element.dataset.actorId;
        const actor = game.actors.get(actorId);

        if (actor) {
            const rollFormula = element.dataset.roll;
            const label = element.dataset.label; 
            const damageType = element.dataset.damageType || "normal";

            if (!rollFormula) { ui.notifications.warn("Fórmula de dano não encontrada!"); return; }
            
            let roll = new Roll(rollFormula, actor.getRollData());
            try {
                await roll.evaluate({async: true});
            } catch (err) {
                console.error("ERI-GOR RPG | Erro ao avaliar rolagem de dano do card de ataque:", err, rollFormula);
                ui.notifications.error("Erro ao processar fórmula de dano.");
                return;
            }

            const templateData = {
                title: label,
                formula: roll.formula,
                tooltip: await roll.getTooltip(),
                total: roll.total,
                isDamageRoll: true, 
                actorId: actor.id
            };
            const chatContent = await renderTemplate("systems/erigor-rpg/templates/chat/roll-card.html", templateData);
            
            ChatMessage.create({
                user: game.user.id,
                speaker: ChatMessage.getSpeaker({ actor: actor }),
                content: chatContent,
                type: CONST.CHAT_MESSAGE_TYPES.ROLL,
                roll: roll,
                flags: { "erigorRpg": { damageType: damageType, isDamageRollMessage: true } } 
            });
        } else { 
            console.error("ERI-GOR RPG | Ator atacante não encontrado (attack-roll-card).");
            ui.notifications.error("Atacante não encontrado.");
        }
    });
  }
});
