export class PepItemArmureSheet extends ItemSheet {

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['pep-autre'], // Css appliqué
      template: "systems/pep/templates/item/equipement/armure/pep-armure-sheet.html",
      width: 500,
      height: 270,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "features" }]
    });
  }

  getData() {
    const context = super.getData();
    const itemData = context.data; // Copie des données acteur

    context.system = itemData.system;
    context.flags = itemData.flags;
    context.rollData = context.item.getRollData(); // Pour mettre du texte dynamique et récupérer des variables (ex:[[@str.mod]])

    return context;
  }

  // Quand la fiche est affichée, ça se lance pour écouter les événements et faire des actions
  activateListeners(html) {
    super.activateListeners(html);
  }
}