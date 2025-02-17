export class PepItemHandicapParamSheet extends ItemSheet {

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
        template: "systems/pep/templates/item/handicap/pep-handicap-params-sheet.html",
        width: 400,
        height: 500,
        resizable: false,
        classes: ["pep-autre"]
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

    html.find('input').on('input', (event) => {
      const input = event.currentTarget;
      console.log(`Modification : ${input.name} = ${input.value}`);
      console.log("Modificateurs après modification :", modificateurs);
    });
  }
}