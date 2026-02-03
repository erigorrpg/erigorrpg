// systems/erigor-rpg/javascript/actor.js
export class ErigorRpgActor extends Actor {

  prepareDerivedData() {
    super.prepareDerivedData();
    const systemData = this.system;

    if (!systemData.atributos) systemData.atributos = {};
    const atributosBase = ["porte", "destreza", "intelecto", "espirito"];
    atributosBase.forEach(attr => {
      if (!systemData.atributos[attr] || typeof systemData.atributos[attr] !== 'object') systemData.atributos[attr] = { valor: 1, mod: -2 };
      if (typeof systemData.atributos[attr].valor !== 'number' || isNaN(systemData.atributos[attr].valor)) systemData.atributos[attr].valor = 1;
      systemData.atributos[attr].mod = this._calcularModificador(systemData.atributos[attr].valor);
    });

    const porteValor = systemData.atributos.porte?.valor || 0;
    const destrezaValor = systemData.atributos.destreza?.valor || 0;
    const intelectoValor = systemData.atributos.intelecto?.valor || 0;
    const espiritoValor = systemData.atributos.espirito?.valor || 0;
    const protecaoArmadura = Number(foundry.utils.getProperty(systemData, "equipamentosManuais.armadura.protecao")) || 0;


    if (!systemData.energias) systemData.energias = {};
    if (!systemData.energias.pv || typeof systemData.energias.pv !== 'object') systemData.energias.pv = { valor: 10, max: 10 };
    systemData.energias.pv.max = Math.max(10, (porteValor + protecaoArmadura) * 10);
    systemData.energias.pv.valor = Math.max(0, Math.min(systemData.energias.pv.valor ?? systemData.energias.pv.max, systemData.energias.pv.max));

    if (!systemData.energias.karma || typeof systemData.energias.karma !== 'object') systemData.energias.karma = { valor: 0, max: 0 };
    systemData.energias.karma.max = Math.max(0, (systemData.caminho && String(systemData.caminho).trim() !== "") ? (espiritoValor * 10) : 0);
    systemData.energias.karma.valor = Math.max(0, Math.min(systemData.energias.karma.valor ?? systemData.energias.karma.max, systemData.energias.karma.max));

    if (!systemData.estatisticasCombate) systemData.estatisticasCombate = {};
    
    let baseIniciativa = destrezaValor + intelectoValor;
    let rapidezEquipamentos = 0;
    const equipamentos = systemData.equipamentosManuais || {};

    const getRapidezValue = (equipamento) => {
        if (equipamento && typeof equipamento.rapidez !== 'undefined' && String(equipamento.rapidez).trim() !== "") {
            const valor = Number(equipamento.rapidez);
            return isNaN(valor) ? 0 : valor;
        }
        return 0;
    };

    rapidezEquipamentos += getRapidezValue(equipamentos.arma1);
    rapidezEquipamentos += getRapidezValue(equipamentos.arma2);
    rapidezEquipamentos += getRapidezValue(equipamentos.arma3);
    rapidezEquipamentos += getRapidezValue(equipamentos.armadura);
    rapidezEquipamentos += getRapidezValue(equipamentos.escudo);
    
    systemData.estatisticasCombate.iniciativa = baseIniciativa + rapidezEquipamentos;

    systemData.estatisticasCombate.defesa = 10 + destrezaValor;
    systemData.estatisticasCombate.fortitude = 10 + porteValor;
    systemData.estatisticasCombate.mente = 10 + intelectoValor;
    systemData.estatisticasCombate.defesaEspiritual = 10 + espiritoValor;

    let protecaoCalculada = Number(foundry.utils.getProperty(systemData, "equipamentosManuais.armadura.protecao")) || 0;
    systemData.estatisticasCombate.protecaoFinal = Math.max(0, Math.min(protecaoCalculada, 10));

    if (!systemData.combates) systemData.combates = { armasBrancas: {}, distancia: {}, desarmado: {}, espiritual: {} };
    const initCombatStat = (stat) => {
      if(!systemData.combates[stat] || typeof systemData.combates[stat] !== 'object') systemData.combates[stat] = {};
      systemData.combates[stat].nivel = Number(systemData.combates[stat].nivel) || 0;
    };
    ["armasBrancas", "distancia", "desarmado", "espiritual"].forEach(initCombatStat);
    
    const modDestreza = systemData.atributos.destreza?.mod || 0;
    const modPorte = systemData.atributos.porte?.mod || 0;
    const modIntelecto = systemData.atributos.intelecto?.mod || 0;
    const modEspirito = systemData.atributos.espirito?.mod || 0;

    systemData.combates.armasBrancas.mira = Math.floor((modDestreza + modPorte) / 2);
    systemData.combates.armasBrancas.total = systemData.combates.armasBrancas.nivel + systemData.combates.armasBrancas.mira;
    systemData.combates.distancia.mira = Math.floor((modDestreza + modIntelecto) / 2);
    systemData.combates.distancia.total = systemData.combates.distancia.nivel + systemData.combates.distancia.mira;
    systemData.combates.desarmado.mira = Math.floor((modDestreza + modPorte) / 2);
    systemData.combates.desarmado.total = systemData.combates.desarmado.nivel + systemData.combates.desarmado.mira;
    systemData.combates.espiritual.mira = Math.floor((modDestreza + modEspirito) / 2);
    systemData.combates.espiritual.total = systemData.combates.espiritual.nivel + systemData.combates.espiritual.mira;
  }

  _calcularModificador(valor) {
    const val = Number(valor);
    if (isNaN(val)) return 0;
    if (val <= 1) return -2; if (val <= 3) return -1; if (val <= 5) return 0;
    if (val <= 7) return 1;  if (val <= 9) return 2;  if (val <= 11) return 3;
    if (val <= 13) return 4; if (val <= 15) return 5;
    if (val > 15) return 5 + Math.floor((val - 15) / 2);
    return 0;
  }

  async aplicarDano(quantidadeDano, opcoes = {}) {
    if (typeof quantidadeDano !== 'number' || quantidadeDano < 0) { ui.notifications.warn("Qtd. dano inválida."); return; }
    const tipoDano = opcoes.tipoDano || "normal";
    const pvAtual = this.system.energias.pv.valor;

    if (typeof pvAtual !== 'number' || isNaN(pvAtual)) {
      ui.notifications.error(`Erro PV ${this.name}. Verifique o console (F12).`);
      console.error(`ERI-GOR RPG | PV CRÍTICO ${this.name}: ${pvAtual}`, duplicate(this.system));
      return;
    }
    let valorProtecao = this.system.estatisticasCombate?.protecaoFinal || 0;
    let danoAplicado = quantidadeDano;
    let danoAbsorvido = 0;
    if (tipoDano !== "bruto") {
      danoAbsorvido = Math.min(quantidadeDano, valorProtecao);
      danoAplicado = Math.max(0, quantidadeDano - valorProtecao);
    }
    const novoPv = Math.max(0, pvAtual - danoAplicado);
    await this.update({ "system.energias.pv.valor": novoPv });

    const templateData = {
      cardTitle: `Dano em ${this.name}`, targetName: this.name,
      damageAppliedValue: danoAplicado,
      wasAbsorbed: (tipoDano !== "bruto" && valorProtecao > 0 && danoAbsorvido > 0),
      protectionValue: valorProtecao, damageAbsorbedValue: danoAbsorvido,
      isBrute: (tipoDano === "bruto"),
      attackerName: opcoes.attackerName
    };
    const chatContent = await renderTemplate("systems/erigor-rpg/templates/chat/damage-applied-card.html", templateData);
    ChatMessage.create({ speaker: ChatMessage.getSpeaker({actor: this}), content: chatContent });

    if (novoPv === 0 && pvAtual > 0) {
      ChatMessage.create({ speaker: ChatMessage.getSpeaker({actor: this}), content: `<strong>${this.name} atingiu 0 Pontos de Vida!</strong>` });
    }
  }
}