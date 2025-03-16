import { PepActorSheet } from "./sheets/actor/pep-actor-sheet.mjs";
import { PepPnjSheet } from "./sheets/actor/pnj/pep-pnj-sheet.mjs";
import { PepPnjParamsSheet } from "./sheets/actor/pnj/pep-pnj-params-sheet.mjs";
import { PepItemArmeSheet } from "./sheets/item/equipement/arme/pep-arme-sheet.mjs";
import { PepItemArmureSheet } from "./sheets/item/equipement/armure/pep-armure-sheet.mjs";
import { PepItemConsommableSheet } from "./sheets/item/equipement/consommable/pep-consommable-sheet.mjs";
import { PepItemEquipementSheet } from "./sheets/item/equipement/equipement/pep-equipement-sheet.mjs";
import { PepItemHandicapSheet } from "./sheets/item/handicap/pep-handicap-sheet.mjs";
import { PepItemHandicapParamSheet } from "./sheets/item/handicap/pep-handicap-params-sheet.mjs";

Hooks.once("init", function () {
  console.log("PEP | Initialisation...");

  // Constantes de configuration
  CONFIG.ActiveEffect.legacyTransferral = false;
  CONFIG.Combat.initiative.formula = "1d20";
  CONFIG.PEP = {
    JET_DE_CAPACITE: "1d6",
    JET_DE_FATE: "dF"
  };

  Actors.registerSheet("pep", PepActorSheet, {
    makeDefault: true,
    types: ["joueur"],
    label: game.i18n.localize(`system.attributes.feuille_joueur_label`)
  });

  Actors.registerSheet("pep", PepPnjSheet, {
    makeDefault: true,
    types: ["pnj"],
    label: game.i18n.localize(`system.attributes.feuille_pnj_label`)
  });

  Actors.registerSheet("pep", PepPnjParamsSheet, {
    makeDefault: false,
    types: ["pnj"],
    label: game.i18n.localize(`system.attributes.parametres_pnj_label`)
  });

  Items.registerSheet("pep", PepItemArmureSheet, {
    types: ["armure"],
    makeDefault: true
  });

  Items.registerSheet("pep", PepItemArmeSheet, {
    types: ["arme"],
    makeDefault: true
  });

  Items.registerSheet("pep", PepItemConsommableSheet, {
    types: ["consommable"],
    makeDefault: true
  });

  Items.registerSheet("pep", PepItemEquipementSheet, {
    types: ["equipement"],
    makeDefault: true
  });

  Items.registerSheet("pep", PepItemHandicapSheet, {
    types: ["handicap"],
    makeDefault: true
  });

  Items.registerSheet("pep", PepItemHandicapParamSheet, {
    makeDefault: false,
    label: game.i18n.localize(`system.attributes.parametres_handicap_label`)
  });

  Combat.prototype.rollNPC = async function () {
    for (let combatant of this.combatants) {
      if (combatant.actor?.type === "pnj") { // Pour le clique "Roll NPCs"
        await combatant.rollInitiative();
      }
    }
  };

  //Surcharge de ActorSheet._render pour bloquer l'accès aux PNJ pour les joueurs
  const originalRender = ActorSheet.prototype._render;

  ActorSheet.prototype._render = async function (...args) {
    // Si l'acteur est un PNJ et l'utilisateur n'est pas GM, on bloque l'accès
    if (this.actor.type === "pnj" && !game.user.isGM) {
      ui.notifications.warn(game.i18n.localize(`system.attributes.acces_pnj_interdit`));
      return;
    }

    // Sinon, on exécute le rendu normal
    return originalRender.apply(this, args);
  };

  const originalItemRender = ItemSheet.prototype._render;
  ItemSheet.prototype._render = async function (...args) {
    // Vérifier si l'utilisateur est un joueur (pas un GM) et si l'item ne lui appartient pas
    if (!game.user.isGM) {
      ui.notifications.warn(game.i18n.localize(`system.attributes.acces_objet_interdit`));
      return;
    }

    // Exécuter le rendu normal sinon
    return originalItemRender.apply(this, args);
  };
});

Hooks.on("updateActor", async (actor, update) => {
  if (!actor) return;

  if (actor.isToken) {
    return;
  }

  if (foundry.utils.getProperty(update, "system.caracteristiques.vitalite.max") !== undefined) {
    let nouvelleValeurMax = foundry.utils.getProperty(update, "system.caracteristiques.vitalite.max");

    if (actor.system.vie?.max !== nouvelleValeurMax) {
      console.log(game.i18n.format('system.attributes.maj_vie_max', { actor_name: actor.name, nouvelle_valeur_max: nouvelleValeurMax }));
      await actor.update({ "system.vie.max": nouvelleValeurMax });
    }
  }

  // 🟢 Vérifier si c'est une mise à jour de la vie depuis un Token ou une Fiche
  if (update.system?.vie?.value !== undefined) {
    let nouvelleVie = update.system.vie.value;

    let cheminVitalite = actor.type === "joueur"
      ? "system.caracteristique_secondaire.vitalite.value"
      : "system.caracteristiques.vitalite.value";

    let vitaliteActuelle = foundry.utils.getProperty(actor, cheminVitalite);

    if (nouvelleVie !== vitaliteActuelle) {
      // Vérifie que l'update en cours ne contient pas déjà cette modification pour éviter la boucle
      if (foundry.utils.getProperty(update, cheminVitalite) === undefined) {
        await actor.update({ [cheminVitalite]: nouvelleVie });
      }
    }
  }

  // 🟢 Vérifier et mettre à jour "system.vie.value" en fonction de la vitalité
  let vitalite = actor.type === "joueur"
    ? Math.min(actor.system.caracteristique_secondaire?.vitalite?.value ?? 0, 8)
    : actor.system.caracteristiques?.vitalite?.value ?? 0;

  if (actor.system.vie?.value !== vitalite) {
    console.log(game.i18n.format('system.attributes.maj_vie_value', { vitalite: vitalite }));
    // Vérifie que l'update en cours ne contient pas déjà cette modification pour éviter la boucle
    if (foundry.utils.getProperty(update, "system.vie.value") === undefined) {
      await actor.update({ "system.vie.value": vitalite });
    }
  }

  if (!actor || actor.type !== "joueur") return;

  // 🟢 Suppression automatique des handicaps si l'acteur est "Reposé"
  const isRepose = update.flags?.pep?.repose;
  if (isRepose === undefined) return;

  const handicaps = actor.items.filter(i => i.type === "handicap");

  if (handicaps.length > 0) {
    handicaps.forEach(handicap => {
      if (handicap.system.modificateurs?.condition_repos?.value) {
        console.log(game.i18n.format('system.attributes.handicap_lie_au_repos', { actor_name: actor.name, handicap_name: handicap.name }));
        if (isRepose) {
          console.log(game.i18n.localize(`system.attributes.suppression_handicap_repos`));
          actor.deleteEmbeddedDocuments("Item", [handicap.id]);
        }
      }
    });
  } else {
    console.log(game.i18n.format('system.attributes.aucun_handicap', { actor_name: actor.name }));
  }
});

Hooks.on("updateCombat", (combat, update) => {

  if (update.round !== undefined) {

    combat.combatants.forEach(combatant => {
      let actor = combatant.actor;
      const handicaps = actor.items.filter(i => i.type === "handicap");

      if (handicaps.length > 0) {
        handicaps.forEach(handicap => {
          if (handicap.system.acquisition_tour != 0) {
            const nouvelleDuree = handicap.system.duree - 1;
            if (nouvelleDuree != 0) {
              handicap.update({ "system.duree": nouvelleDuree });
            } else {
              actor.deleteEmbeddedDocuments("Item", [handicap.id]);
            }
          } else {
            // On donne un tour d'acquisition au handicap.
            handicap.update({ "system.acquisition_tour": combat.round });
          }
        });
      }
    });
  }
});

Hooks.on("deleteCombat", (combat) => {
  combat.combatants.forEach(combatant => {
    combatant.actor.update({ "system.jet_tactique": 0 });

    combatant.actor.items.forEach(item => {
      if (["arme", "armure"].includes(item.type)) {
        item.update({ "system.tactiques_cumules": 0 });
      }
    });
  });
});

Hooks.on("createItem", (item) => {
  if (!item || !["handicap", "armure", "arme", "consommable", "equipement"].includes(item.type)) return;
  game.i18n.format('system.attributes.ajout_item', { item_name: item.name, item_id: item.id })
  item.parent.sheet.render(); // Recharge la fiche de l'acteur
});

Hooks.on("updateItem", (item) => {
  if (!item || !["handicap", "armure", "arme", "consommable", "equipement"].includes(item.type)) return;
  game.i18n.format('system.attributes.mise_a_jour_item', { item_name: item.name, item_id: item.id })
  item.parent.sheet.render();
});

Hooks.on("deleteItem", (item) => {
  if (!item || !["handicap", "armure", "arme", "consommable", "equipement"].includes(item.type)) return;
  game.i18n.format('system.attributes.suppression_item', { item_name: item.name, item_id: item.id })
  item.parent.sheet.render();
});

// Maj du nom sur Actor + token
Hooks.on("updateActor", (actor, updates) => {
  if (updates.hasOwnProperty('name')) {
    const tokens = actor.getActiveTokens();

    if (tokens.length > 0) {
      const token = tokens[0];

      const tokenData = {
        name: updates.name || token.name
      };

      try {
        token.document.update(tokenData);
        console.log(game.i18n.localize(`system.attributes.maj_token_succes`));
      } catch (error) {
        console.error(game.i18n.format('system.attributes.maj_token_erreur', { error: error }));
      }
    } else {
      console.warn(game.i18n.localize(`system.attributes.aucun_token_trouve`));
    }
  } else {
    console.log(game.i18n.localize(`system.attributes.maj_nom_non_detecte`));
  }

  if (updates.hasOwnProperty("texture") && updates.texture.hasOwnProperty("src")) {
    const actor = token.actor;
    if (!actor) return;
    try {
      actor.update({ "img": updates.texture.src });
    } catch (error) {
      console.error(game.i18n.format('system.attributes.maj_image_erreur', { error: error }));
    }
  }
});