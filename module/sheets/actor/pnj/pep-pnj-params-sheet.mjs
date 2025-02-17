export class PepPnjParamsSheet extends ActorSheet {

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['pep-autre'], // Css appliqué
      template: "systems/pep/templates/actor/pnj/pep-pnj-params-sheet.html",
      width: 500,
      height: 500,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "features" }]
    });
  }

  getData() {
    const context = super.getData();
    const actorData = context.data; // Copie des données pnj

    context.system = actorData.system;
    context.flags = actorData.flags;

    context.rollData = context.actor.getRollData(); // Pour mettre du texte dynamique et récupérer des variables (ex:[[@str.mod]])

    return context;
  }

  // Quand la fiche est affichée, ça se lance pour écouter les événements et faire des actions
  activateListeners(html) {
    super.activateListeners(html);

    this._GestionActivitePassive(html);
    this._GestionActiviteActive(html);
  }

  _GestionActiviteActive(html) {
    html.find("#new-capacite-description").on("blur", async (event) => {
      event.preventDefault();
      const input = event.currentTarget;
      if (input.value === "") return;

      let capacites = Object.values(this.actor.system.capacite_active.value);
      capacites.push({
        de: "0",
        description: input.value.trim()
      });

      await this.actor.update({ "system.capacite_active.value": capacites });
    });

    // Mise à jour d'une capacité modifiée en direct
    html.find(".capacite-active").on("blur", async (event) => {
      event.preventDefault();
      const input = event.currentTarget;
      const parentKey = event.currentTarget.dataset.parent;
      const index = Number(input.dataset.index);

      let capacites = Object.values(this.actor.system.capacite_active.value);

      if (parentKey === "de") {
        let inputValue = input.textContent.trim();
        let valeurs = inputValue.split(/\s*[,/]\s*/).filter(val => val !== "");

        let valeursValides = valeurs.every(val => /^\d+$/.test(val) && val >= 1 && val <= 6);

        if (valeursValides) {
          capacites[index].de = valeurs.map(Number);
        } else {
          ui.notifications.error(`La valeur à saisir doit être compris entre 1 et 6, séparés par des virgules ou "/".`);
          return;
        }
      } else {
        capacites[index].description = input.textContent.trim();
      }

      console.log(capacites);

      await this.actor.update({ [`system.capacite_active.value`]: capacites });
    });

  }

  _GestionActivitePassive(html) {
    // Suppression d'une capacité
    html.find(".remove-capacite").on("click", async (event) => {
      event.preventDefault();
      const type = event.currentTarget.dataset.type;
      const index = Number(event.currentTarget.dataset.index);
      let capacites = Object.values(this.actor.system[type].value) || [];

      // Supprime la capacité de la liste
      capacites.splice(index, 1);
      await this.actor.update({ [`system.${type}.value`]: capacites });
    });

    // Ajout d'une capacité en écrivant dans le textarea vide
    html.find("#new-capacite").on("blur", async (event) => {
      event.preventDefault();
      const input = event.currentTarget;
      if (input.value === "") return;

      let capacites = Object.values(this.actor.system.capacite_passive.value) || [];
      capacites.push(input.value);

      await this.actor.update({ "system.capacite_passive.value": capacites });
    });

    // Mise à jour d'une capacité modifiée en direct
    html.find(".capacite-input").on("blur", async (event) => {
      event.preventDefault();
      const index = Number(event.currentTarget.dataset.index);
      const nouvelleValeur = event.currentTarget.textContent.trim();

      if (nouvelleValeur === "") return; // Ne pas enregistrer une valeur vide

      let capacites = [...(this.actor.system.capacite_passive.value || [])];
      capacites[index] = nouvelleValeur; // Mise à jour du tableau

      await this.actor.update({ "system.capacite_passive.value": capacites });
    });
  }
}

Handlebars.registerHelper('affichageJetsDe', function (de) {
  if (!Array.isArray(de) || de.length === 0) return '';
  const sorted = de.slice().sort((a, b) => a - b);
  if (sorted.length === 1) return String(sorted[0]);
  if (sorted.length === 2) {
    const min = sorted[0], max = sorted[1];
    const range = [];
    for (let i = min; i <= max; i++) range.push(i);
    return range.join("-");
  }
  return sorted.join("-");
});
