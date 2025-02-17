import { PepPnjParamsSheet } from "./pep-pnj-params-sheet.mjs";

export class PepPnjSheet extends ActorSheet {

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['pep-autre'], // Css appliqué
      template: "systems/pep/templates/actor/pnj/pep-pnj-sheet.html",
      width: 600,
      height: 600,
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

    this._GestionInput(html);
    this._ModifierParams(html);
    this._JetDeCombat(html);
  }

  _JetDeCombat(html) {
    html.find('.combat').on('click', async (event) => {
      event.preventDefault();

      const nombreDeCombat = this.actor.system.caracteristiques.combat.value;
      const isCapaciteActive = this.actor.system.capacite_active.isActive;
      const allCapacitesActives = this.actor.system.capacite_active.value;

      if (nombreDeCombat <= 0) return;

      const diceFormula = `${nombreDeCombat}${CONFIG.PEP.JET_DE_FATE} + ${isCapaciteActive && allCapacitesActives.length >= 1 ? CONFIG.PEP.JET_DE_CAPACITE : 0}`;

      let roll = new Roll(diceFormula);
      await roll.evaluate();

      const resultat = roll.dice[0].results.map(r => r.result);
      const nbSucces = resultat.filter(r => r === 1).length;

      let valeurJetCapacite = 0;
      if (isCapaciteActive && roll.dice.length > 1) {
        const diceCapaciteResults = roll.dice[1].results.map(r => r.result);
        valeurJetCapacite = diceCapaciteResults.reduce((acc, curr) => acc + curr, 0);

        console.log(valeurJetCapacite);

        await this.actor.update({
          "system.valeur_jet_capacite_speciale": valeurJetCapacite
        });
        this.render();
      }

      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: `Jet de ${nombreDeCombat} dé${nombreDeCombat > 1 ? "s" : ""} pour le combat.
                 <br>
                 <b>Détails du jet</b> : <br>
                 ✅ <b>Succès</b> : ${nbSucces} <br>
                 ${isCapaciteActive ? `⚔️ <b>Capacité spéciale</b> : ${valeurJetCapacite}` : ""}`
      });
    });
  }

  _ModifierParams(html) {
    html.find(".open-params").on("click", (event) => {
      event.preventDefault();
      const acteur = this.actor;

      new PepPnjParamsSheet(acteur).render(true);
    });
  }

  _GestionInput(html) {
    html.find('input[type="number"]').on('input', (event) => {
      const input = event.currentTarget;

      const min = Number(input.getAttribute('min'));
      const max = Number(input.getAttribute('max'));
      const value = Number(input.value);
      console.log(`Saisie: ${value} | Min autorisé: ${min} | Max autorisé: ${max}`);

      // Applique les limites min/max
      if (input.value !== "") {
        if (value < min) input.value = min;
        if (value > max) input.value = max;
      }
    });
  }
}

Handlebars.registerHelper('contains', function (array, value) {
  if (!Array.isArray(array) || array.length === 0) return false;
  const min = Math.min(...array);
  const max = Math.max(...array);
  return value >= min && value <= max;
});
