import { PepItemHandicapParamSheet } from "./pep-handicap-params-sheet.mjs";

export class PepItemHandicapSheet extends ItemSheet {

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['pep-autre'], // Css appliqué
      template: "systems/pep/templates/item/handicap/pep-handicap-sheet.html",
      width: 400,
      height: 200,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "features" }]
    });
  }

  getData() {
    const context = super.getData();
    const itemData = context.data; // Copie des données acteur

    context.system = itemData.system;
    context.flags = itemData.flags;
    context.rollData = context.item.getRollData(); // Pour mettre du texte dynamique et récupérer des variables (ex:[[@str.mod]])


    console.log(context.data.system.modificateurs);
    return context;
  }

  // Quand la fiche est affichée, ça se lance pour écouter les événements et faire des actions
  activateListeners(html) {
    super.activateListeners(html);

    const modificateurs = this.item.system.modificateurs;

    console.log("Modificateurs du handicap :", modificateurs);

    html.find(".open-params").on("click", (event) => {
      event.preventDefault();
      const itemId = event.currentTarget.dataset.itemId;
      const item = game.items.get(itemId) || this.item;

      if (!item) {
        ui.notifications.error("Erreur : Impossible de trouver l'item.");
        return;
      }

      new PepItemHandicapParamSheet(item).render(true);
    });
  }
}