// Em systems/erigor-rpg/javascript/sheets/item-sheet.js
export class ErigorRpgItemSheet extends ItemSheet {

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["erigor-rpg", "sheet", "item", "erigor-item-sheet"],
      template: "systems/erigor-rpg/templates/items/item-sheet.html",
      width: 620,
      height: "auto",
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }],
      scrollY: [".sheet-body .tab"]
    });
  }

  get template() {
    return `systems/erigor-rpg/templates/items/item-sheet.html`;
  }

  async getData(options) {
    const context = await super.getData(options);
    const item = this.item;
    const itemData = item.toObject(false); 
    
    context.item = itemData; 
    context.system = itemData.system; 
    context.flags = itemData.flags;
    context.config = CONFIG.ERIGOR_RPG; 

    if (CONFIG.ERIGOR_RPG) {
      context.itemTypesOptions = foundry.utils.duplicate(CONFIG.ERIGOR_RPG.itemTypes || {});
      if (item.type && !context.itemTypesOptions[item.type]) {
        context.itemTypesOptions[item.type] = item.type.capitalize(); 
      }
      
      if (item.type === "arma" && CONFIG.ERIGOR_RPG.tiposDeArma) {
        context.tiposDeArmaOptions = foundry.utils.duplicate(CONFIG.ERIGOR_RPG.tiposDeArma);
      }
      if (item.type === "consumivel" && CONFIG.ERIGOR_RPG.categoriasConsumivel) {
        context.categoriasConsumivelOptions = foundry.utils.duplicate(CONFIG.ERIGOR_RPG.categoriasConsumivel);
      }
      if (item.type === "acessorio" && CONFIG.ERIGOR_RPG.slotsAcessorio) {
        context.slotsAcessorioOptions = foundry.utils.duplicate(CONFIG.ERIGOR_RPG.slotsAcessorio);
      }
    } else { 
        context.itemTypesOptions = {[item.type]: item.type.capitalize()};
    }
    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);
  }
}