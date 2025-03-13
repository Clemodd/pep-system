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
  CONFIG.ActiveEffect.legacyTransferral = false; // TODO doc
  CONFIG.Combat.initiative.formula = "1d20";
  CONFIG.PEP = {
    JET_DE_4: "1d4",
    JET_DE_CAPACITE: "1d6",
    JET_DE_FATE: "dF"
  };

  Actors.registerSheet("pep", PepActorSheet, {
    makeDefault: true,
    types: ["joueur"],
    label: "Feuille de joueur PEP"
  });

  Actors.registerSheet("pep", PepPnjSheet, {
    makeDefault: true,
    types: ["pnj"],
    label: "Feuille de PNJ PEP"
  });

  Actors.registerSheet("pep", PepPnjParamsSheet, {
    makeDefault: false,
    types: ["pnj"],
    label: "Paramètres des PNJ"
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
    label: "Paramètres Handicap"
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
      ui.notifications.warn("Vous ne pouvez pas ouvrir la fiche de ce PNJ !");
      return;
    }

    // Sinon, on exécute le rendu normal
    return originalRender.apply(this, args);
  };

  const originalItemRender = ItemSheet.prototype._render;
  ItemSheet.prototype._render = async function (...args) {
    // Vérifier si l'utilisateur est un joueur (pas un GM) et si l'item ne lui appartient pas
    if (!game.user.isGM) {
      ui.notifications.warn("Vous ne pouvez pas ouvrir cet objet !");
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
      console.log(`🔄 Mise à jour de system.vie.max pour ${actor.name} : ${nouvelleValeurMax}`);
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
    console.log(`🔄 Mise à jour de system.vie.value : ${vitalite}`);
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
        console.log(`❗ ${actor.name} a un handicap lié au repos : ${handicap.name}`);

        if (isRepose) {
          console.log(`🟢 Suppression du handicap lié au repos`);
          actor.deleteEmbeddedDocuments("Item", [handicap.id]);
        }
      }
    });
  } else {
    console.log(`✅ ${actor.name} n'a actuellement aucun handicap.`);
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
  if (!item || item.type !== "handicap" || item.type !== "armure" || item.type !== "arme" || item.type !== "consommable" || item.type !== "equipement") return;

  console.log(`➕ Ajouté : ${item.name} (${item.id})`);
  item.parent.sheet.render(); // Recharge la fiche de l'acteur
});

Hooks.on("updateItem", (item) => {
  if (!item || item.type !== "handicap" || item.type !== "armure" || item.type !== "arme" || item.type !== "consommable" || item.type !== "equipement") return;

  console.log(`♻️ Mise à jour : ${item.name} (${item.id})`);
  item.parent.sheet.render();
});

Hooks.on("deleteItem", (item) => {
  if (!item || item.type !== "handicap" || item.type !== "armure" || item.type !== "arme" || item.type !== "consommable" || item.type !== "equipement") return;

  console.log(`❌ Supprimé : ${item.name} (${item.id})`);
  item.parent.sheet.render();
});

// Maj du nom sur Actor + token
Hooks.on("updateActor", (actor, updates) => {
  if (updates.hasOwnProperty('name') || updates.hasOwnProperty('img')) {
    const tokens = actor.getActiveTokens();

    if (tokens.length > 0) {
      const token = tokens[0];

      const tokenData = {
        name: updates.name || token.name
      };

      try {
        token.document.update(tokenData);
        console.log("Token mis à jour avec succès !");
      } catch (error) {
        console.error("Erreur lors de la mise à jour du token : ", error);
      }
    } else {
      console.warn("Aucun token actif trouvé pour cet acteur.");
    }
  } else {
    console.log("Pas de changement détecté sur le nom ou l'image.");
  }
});