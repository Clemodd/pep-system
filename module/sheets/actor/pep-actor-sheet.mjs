export class PepActorSheet extends ActorSheet {

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["pep"], // Css appliqué
      template: "systems/pep/templates/actor/pep-actor-sheet.hbs",
      width: 600,
      height: 700,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "features" }]
    });
  }

  // Récupère les datas pour les envoyer uniquement au fichier HTML.
  async getData() {
    const context = super.getData();
    const actorData = context.data; // Copie des données acteur

    context.system = actorData.system;
    context.flags = actorData.flags;
    context.img = this.actor.getActiveTokens()[0]?.document.texture.src || "icons/svg/mystery-man.svg";
    context.rollData = context.actor.getRollData(); // Pour mettre du texte dynamique et récupérer des variables (ex:[[@str.mod]])
    context.limiteEmplacements = this.actor.system.caracteristique.vigueur.value + 5;
    context.isCombat = game.combat !== null && game.combat.round > 0;
    context.isDegatsBloques = this.actor.items
      .filter(i => i.type === "handicap")
      .some(handicap => handicap.system.modificateurs?.peut_infliger_degats?.value === false) && game.combat !== null && game.combat.round > 0;

    context.isRecoitDegatsSupplementaires = this.actor.items
      .filter(i => i.type === "handicap")
      .some(handicap => handicap.system.modificateurs?.recoit_degats_bonus?.value === true) && game.combat !== null && game.combat.round > 0;

    context.system.handicaps = this.actor.items.filter(i => i.type === "handicap"); // Pour drag and drop les handicaps
    context.system.equipements = this.actor.items.filter(i => ["armure", "arme", "consommable", "equipement"].includes(i.type)); // Pour drag and drop les équipements

    return context;
  }

  // Quand la fiche est affichée, ça se lance pour écouter les événements et faire des actions
  activateListeners(html) {
    super.activateListeners(html);

    this._GestionInput(html)
    this._GestionNavBar(html)
    this._SetNavbar(html)
    this._SetCaracteristiques(html)
    this._LancerSimpleDe(html)
    this._GestionCaracteristique(html)
    this._DragAndDropHandicap(html)
    this._DragAndDropEquipement(html)
    this._JetUsage(html)
    this._GestionArmes(html)
    this._UtiliserTactiques(html)
    this._Jet_Risque(html)
  }

  _setActiveTab(html, tab) {
    html.find(".tab-button").removeClass("active");
    html.find(`.tab-button[data-tab="${tab}"]`).addClass("active");
    html.find(".tab-content").removeClass("active");
    html.find(`#${tab}`).addClass("active");
  }

  _GestionNavBar(html) {
    const tabs = html.find(".tab-button");
    let activeTab = localStorage.getItem("pep-active-tab") || "informations-tab";

    this._setActiveTab(html, activeTab);

    tabs.on("click", (event) => {
      activeTab = event.currentTarget.dataset.tab;
      localStorage.setItem("pep-active-tab", activeTab); // Sauvegarde dans le stockage local
      this._setActiveTab(html, activeTab);
    });
  }

  _DragAndDropEquipement(html) {
    const dragDrop = new DragDrop({
      dragSelector: ".equipement-item",  // Ce qui peut être déplacé
      dropSelector: ".equipement-dropzone",  // Où ça peut être déposé
      permissions: {
        dragstart: true,
        drop: this._canDragDrop.bind(this, ".equipement-dropzone") // Nom "_canDragDrop" à garder, sinon la zone de drop est down
      },
      callbacks: {
        dragstart: this._onDragStart.bind(this),
        drop: this._onDropItemEquipement.bind(this)
      }
    });

    // Liaison du Drag & Drop à l'HTML
    dragDrop.bind(html[0]);

    // Ajoute l'événement pour ouvrir la fiche en cliquant sur le nom
    html.find(".equipement-name").on("click", (event) => {
      const itemId = event.currentTarget.dataset.itemId;
      const item = this.actor.items.get(itemId);
      if (item) {
        item.sheet.render(true);
      }
    });

    // Supprimer un equipement de la liste
    html.find(".delete-equipement").on("click", async (event) => {
      const itemId = event.currentTarget.dataset.itemId;
      const item = this.actor.items.get(itemId);

      await this.actor.deleteEmbeddedDocuments("Item", [itemId]);

      // Si c'était de type "armure", on recalcule la valeur totale
      this.UpdateArmure(item);

      ChatMessage.create({
        content: game.i18n.format('system.actorSheet.chat_message_item_deleted', { item_name: item.name, actor_name: this.actor.name }),
        type: CONST.CHAT_MESSAGE_STYLES.OTHER
      });
    });
  }

  async UpdateArmure(item) {
    if (item.type === "armure") {
      let total = 0;
      for (const armure of this.actor.items.filter(i => i.type === "armure")) {
        total += armure.system.bonus || 0;
      }
      await this.actor.update({ "system.armure.value": total });
    }
  }

  _DragAndDropHandicap(html) {
    const dragDrop = new DragDrop({
      dragSelector: ".handicap-item",  // Ce qui peut être déplacé
      dropSelector: ".handicap-dropzone",  // Où ça peut être déposé
      permissions: {
        dragstart: true,
        drop: this._canDragDrop.bind(this, ".handicap-dropzone") // Nom "_canDragDrop" à garder, sinon la zone de drop est down
      },
      callbacks: {
        dragstart: this._onDragStart.bind(this),
        drop: this._onDropItemHandicap.bind(this)
      }
    });

    // Liaison du Drag & Drop à l'HTML
    dragDrop.bind(html[0]);

    // Ajoute l'événement pour ouvrir la fiche en cliquant sur le nom
    html.find(".handicap-name").on("click", (event) => {
      const itemId = event.currentTarget.dataset.itemId;
      const item = this.actor.items.get(itemId);
      if (item) {
        item.sheet.render(true);
      }
    });

    // Supprimer un handicap de la liste
    html.find(".delete-handicap").on("click", async (event) => {
      const itemId = event.currentTarget.dataset.itemId;
      const item = this.actor.items.get(itemId);
      await this.actor.deleteEmbeddedDocuments("Item", [itemId]);

      ChatMessage.create({
        content: game.i18n.format('system.actorSheet.chat_message_handicap_removed', { item_name: item.name, actor_name: this.actor.name }),
        type: CONST.CHAT_MESSAGE_STYLES.OTHER
      });
    });
  }

  _canDragDrop(selector, val) { return selector === val; }

  _onDragStart(event) {
    const itemId = event.currentTarget.dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (!item) return;

    const dragData = {
      type: "Item",
      uuid: item.uuid
    };

    event.originalEvent.dataTransfer.setData("text/plain", JSON.stringify(dragData));
  }

  async _onDropItemHandicap(event) {
    event.preventDefault();
    const evt = event.originalEvent || event; // Vérifie où se trouve l'événement principal

    let data;
    try {
      data = JSON.parse(evt.dataTransfer.getData("text/plain"));
    } catch (err) {
      console.error(t("error_cannot_retrieve_item", { error: err }));
      return;
    }

    let item = await fromUuid(data.uuid);

    // 🔹 Met à jour `data` avec les informations réelles de l'item
    data.type = item.type;
    data._id = item.id;
    data.name = item.name;
    data.system = item.system || {};
    data.img = item.img;

    // Vérifie si l'item est bien de type "handicap"
    if (data.type !== "handicap") {
      ui.notifications.warn(game.i18n.localize(`system.actorSheet.warning_handicap_item`)
      );
      return;
    }

    // 🔹 Créer l'item
    let createdItems = await this.actor.createEmbeddedDocuments("Item", [data]);

    if (game.combat) {
      await createdItems[0].update({ "system.acquisition_tour": game.combat.round });
    }
    ui.notifications.info(game.i18n.format('system.actorSheet.info_ajout_data', { data_name: data.name, actor_name: this.actor.name }));

    ChatMessage.create({
      content: game.i18n.format('system.actorSheet.chat_message_item_equipped', { actor_name: this.actor.name, item_name: data.name, duration: data.system.duree, s: data.system.duree > 1 ? "s" : "" }),
      type: CONST.CHAT_MESSAGE_STYLES.OTHER
    });
  }

  async _onDropItemEquipement(event) {
    event.preventDefault();
    const evt = event.originalEvent || event; // Vérifie où se trouve l'événement principal
    let data;
    try {
      data = JSON.parse(evt.dataTransfer.getData("text/plain"));
    } catch (err) {
      console.error(t("error_cannot_retrieve_item", { error: err }));
      return;
    }

    let item = await fromUuid(data.uuid);

    const limiteEmplacements = this.actor.system.caracteristique.vigueur.value + 5;
    const equipements = this.actor.items.filter(i => ["armure", "arme", "consommable", "equipement"].includes(i.type));

    // Pour chaque équipement existant, calcule le nombre d'emplacements occupés.
    const emplacementsUtilisesAvant = equipements.reduce((acc, item) => {
      const q = Number(item.system.quantite) || 1;
      return acc + 1 + (q > 1 ? q - 1 : 0);
    }, 0);

    const quantiteAjoutee = item.system.quantite !== undefined ? Number(item.system.quantite) : 1;

    const totalEmplacementsPris = emplacementsUtilisesAvant + quantiteAjoutee;

    if (totalEmplacementsPris > limiteEmplacements) {
      ui.notifications.warn(game.i18n.localize(`system.actorSheet.error_item_limit_reached`));
      return;
    }

    // 🔹 Met à jour `data` avec les informations réelles de l'item
    data.type = item.type;
    data._id = item.id;
    data.name = item.name;
    data.system = item.system || {};
    data.img = item.img;

    // Vérifie si l'item est bien de type "handicap"
    if (data.type !== "armure" && data.type !== "consommable" && data.type !== "arme" && data.type !== "equipement") {
      ui.notifications.warn(game.i18n.localize(`system.actorSheet.warning_equipement_item`));
      return;
    }

    if (data.type === "armure") {
      this.actor.update({ "system.armure.bonus": data.system.bonus });
    }

    await this.actor.createEmbeddedDocuments("Item", [data]);

    // Puis on recalcule l'armure totale
    this.UpdateArmure(item);

    ui.notifications.info(game.i18n.format('system.actorSheet.info_ajout_data', { data_name: data.name, actor_name: this.actor.name }));

    ChatMessage.create({
      content: game.i18n.format('system.actorSheet.chat_message_item_in_bag', { actor_name: this.actor.name, item_name: data.name }),
      type: CONST.CHAT_MESSAGE_STYLES.OTHER
    });
  }

  _GestionMalusHandicap(handicapsActifs) {
    let resultats = {
      malus_global: 0,
      peutTirer: true,
      peutEsquiver: true,
      malus_mobilite: 0,
    };

    if (handicapsActifs.length === 0) {
      return resultats;
    }

    handicapsActifs.forEach(handicap => {
      const modCompetencesGlobales = handicap.system.modificateurs.competences_globales?.value ?? 0;
      const conditionCombat = handicap.system.modificateurs.condition_combat?.value ?? false;
      const peutTirer = handicap.system.modificateurs.peut_tirer?.value ?? true;
      const peutEsquiver = handicap.system.modificateurs.peut_esquiver?.value ?? true;

      if (modCompetencesGlobales !== 0) {
        if (conditionCombat) {
          if (!game.combat) {
            return;
          }
        }
        resultats.malus_global += modCompetencesGlobales;
      }

      if (!peutTirer) {
        if (conditionCombat) {
          resultats.peutTirer = game.combat ? false : true; // Permet de tirer hors combat
        } else {
          resultats.peutTirer = false;
        }
      }

      if (!peutEsquiver) {
        if (conditionCombat) {
          resultats.peutEsquiver = game.combat ? false : true; // Permet d'esquiver hors combat
        } else {
          resultats.peutEsquiver = false;
        }
      }
    });

    return resultats;
  }

  _JetUsage(html) {
    html.find('.jet-usage').on('click', async (event) => {
      const usageSteps = ["1d20", "1d12", "1d10", "1d8", "1d6", "1d4", "1d0"];

      let jet = event.currentTarget.dataset.key;
      let jetAvant = event.currentTarget.dataset.key;
      const type = event.currentTarget.dataset.type;
      const itemId = event.currentTarget.dataset.itemId;
      let isSupprime = false;

      let roll = new Roll(jet);
      await roll.evaluate();

      const resultat = roll.dice[0].results.map(r => r.result);

      if ([1, 2, 3].includes(resultat[0])) {
        let i = usageSteps.indexOf(jet);

        if (i >= 0 && i < usageSteps.length - 1) {
          let nextDie = usageSteps[i + 1];
          jet = nextDie;
        }

        await this.actor.items.get(itemId).update({ "system.de_usage": jet });

        if (jet === "1d0" && !this.actor.items.get(itemId).system.isArtefact) {
          isSupprime = true;
          await this.actor.items.get(itemId).delete();
        }
      }

      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: game.i18n.format('system.actorSheet.log_rolling_usage', { old_die: jetAvant, type: type, result: resultat, isSupprime: isSupprime ? game.i18n.localize(`system.actorSheet.error_out_of_uses`) : "" }),
      });
    });
  }

  _LancerSimpleDe(html) {
    html.find('.test').on('click', async (event) => {
      event.preventDefault();

      const key = event.currentTarget.dataset.key;
      const type = event.currentTarget.dataset.type;
      const parentKey = event.currentTarget.dataset.parent;

      const handicapsActifs = this.actor.items.filter(i => i.type === "handicap");
      const analyseHandicaps = this._GestionMalusHandicap(handicapsActifs);

      let messageHandicaps = "";
      if (handicapsActifs.length > 0) {
        messageHandicaps += game.i18n.localize(`system.actorSheet.message_handicap_titre`);
        handicapsActifs.forEach(handicap => {
          messageHandicaps += game.i18n.format('system.actorSheet.message_handicap', { name: handicap.name, duree: handicap.system.duree, s: handicap.system.duree > 1 ? "s" : "", description: handicap.system.description });
        });
      }

      if (key === "point_hero") {
        this.actor.update({
          [`system.${type}.${key}.value`]: this.actor.system[type][key]?.value === 1 ? 0 : 1
        });
        return;
      } else if (key === "tir" && !analyseHandicaps.peutTirer) {
        ui.notifications.error(game.i18n.format('system.actorSheet.error_cannot_shoot', { actor_name: this.actor.name }));
        return;
      } else if (key === "esquive" && !analyseHandicaps.peutEsquiver) {
        ui.notifications.error(game.i18n.format('system.actorSheet.error_cannot_dodge', { actor_name: this.actor.name }));
        return;
      } else if (key === "vitalite" || key === "mobilite") {
        return;
      }

      let nombreDe;
      if (parentKey) {
        nombreDe = (this.actor.system.caracteristique[parentKey]?.value) + (this.actor.system.caracteristique[parentKey]?.competence[key]?.value) - analyseHandicaps.malus_global;
      } else {
        nombreDe = this.actor.system[type][key].value - analyseHandicaps.malus_global;
      }

      if (nombreDe <= 0) return;

      const diceFormula = `${nombreDe}${CONFIG.PEP.JET_DE_FATE}`;

      let roll = new Roll(diceFormula);
      await roll.evaluate();

      const resultat = roll.dice[0].results.map(r => r.result);

      const nbSucces = resultat.filter(r => r === 1).length;
      const nbCrane = resultat.filter(r => r === 0).length;
      const nbTactique = resultat.filter(r => r === -1).length;

      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: game.i18n.format('system.actorSheet.chat_message_rolled_dice',
          {
            nombreDe: nombreDe,
            s: nombreDe > 1 ? "s" : "",
            test: game.i18n.localize(`system.attributes.${key}`),
            malus: analyseHandicaps.malus_global != 0 ? game.i18n.format('system.actorSheet.malus_of',
              { malus: analyseHandicaps.malus_global }) : "",
            nbSucces: nbSucces,
            nbTactique: nbTactique,
            nbCrane: nbCrane,
            messageHandicaps: messageHandicaps
          }
        )
      });

      if (game.combat !== null) {
        this.actor.update({ "system.jet_tactique": nbTactique });
      }
    });
  }

  _GestionInput(html) {
    html.find('input[type="number"]').on('input', (event) => {
      const actor = this.actor;
      const input = event.currentTarget;
      const key = event.currentTarget.dataset.key;

      const min = Number(input.getAttribute('min'));
      const max = Number(input.getAttribute('max'));
      const value = Number(input.value);

      // Applique les limites min/max
      if (input.value !== "") {
        if (value < min) input.value = min;
        if (value > max) input.value = max;

        ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          content: game.i18n.format('system.actorSheet.chat_message_input_edited', { actor_name: actor.name, key: key, value: value })
        });
      }
    });
  }

  _SetNavbar(html) {
    html.find('.tab-button').on('click', function () {
      const tabName = $(this).data('tab');

      // Retire l'ancienne classe active et met la nouvelle
      html.find('.tab-button').removeClass('active');
      $(this).addClass('active');

      // Cache toutes les sections et affiche seulement celle cliquée
      html.find('.tab-content').removeClass('active');
      html.find(`#${tabName}`).addClass('active');
    });
  }

  _SetCaracteristiques(html) {
    html.find('#reload-carac').on('click', async (event) => {
      event.preventDefault();

      const diceFormula = "4d12";

      let roll = new Roll(diceFormula);
      await roll.evaluate();

      const resultat = roll.dice[0].results.map(r => r.result).map(convertirValeur);

      const updateData = {
        "system.caracteristique.vigueur.value": resultat[0],
        "system.caracteristique_secondaire.vitalite.value": resultat[0],
        "system.vie.value": resultat[0],
        "system.caracteristique.agilite.value": resultat[1],
        "system.caracteristique_secondaire.mobilite.value": resultat[1],
        "system.caracteristique.sensibilite.value": resultat[2],
        "system.caracteristique.esprit.value": resultat[3],
        "system.caracteristique_secondaire.coeur.value": resultat[3],
        "system.blessure.value": 0,
        "system.caracteristique_secondaire.point_hero.value": 1,
        "system.jet_tactique": 0,

        // Réinitialisation des compétences de Vigueur
        "system.caracteristique.vigueur.competence.combat.value": 0,
        "system.caracteristique.vigueur.competence.athletisme.value": 0,
        "system.caracteristique.vigueur.competence.endurance.value": 0,

        // Réinitialisation des compétences d'Agilité
        "system.caracteristique.agilite.competence.equilibre.value": 0,
        "system.caracteristique.agilite.competence.esquive.value": 0,
        "system.caracteristique.agilite.competence.furtivite.value": 0,

        // Réinitialisation des compétences de Sensibilité
        "system.caracteristique.sensibilite.competence.tir.value": 0,
        "system.caracteristique.sensibilite.competence.fouille.value": 0,
        "system.caracteristique.sensibilite.competence.scouting.value": 0,

        // Réinitialisation des compétences d'Esprit
        "system.caracteristique.esprit.competence.erudition.value": 0,
        "system.caracteristique.esprit.competence.medecine.value": 0,
        "system.caracteristique.esprit.competence.persuasion.value": 0,
      };

      await this.actor.update(updateData);

      // Affiche le résultat dans le chat
      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: game.i18n.format('system.actorSheet.chat_message_init_roll',
          {
            de: diceFormula,
            vigueur: resultat[0],
            agilite: resultat[1],
            sensibilite: resultat[2],
            esprit: resultat[3]
          })
      });
    });
  }

  _Jet_Risque(html) {
    html.find('#jet-risque').on('click', async (event) => {
      event.preventDefault();

      let roll = new Roll(`1${CONFIG.PEP.JET_DE_FATE}`);
      await roll.evaluate();

      const resultat = roll.dice[0].results.map(r => r.result);

      const nbSucces = resultat.filter(r => r === 1).length;
      const nbCrane = resultat.filter(r => r === 0).length;

      // Affiche le résultat dans le chat
      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: game.i18n.format('system.actorSheet.chat_message_risk_roll',
          {
            nbSucces: nbSucces,
            nbCrane: nbCrane
          })
      });
    });
  }

  _GestionCaracteristique(html) {
    // Vitalité (Vigueur + Endurance)
    this._CalculsCaracteristique(html,
      "system.caracteristique_secondaire.vitalite.value",
      "system.caracteristique.vigueur.value",
      "system.caracteristique.vigueur.competence.endurance.value"
    );

    // Coeur (Esprit + Erudition)
    this._CalculsCaracteristique(html,
      "system.caracteristique_secondaire.coeur.value",
      "system.caracteristique.esprit.value",
      "system.caracteristique.esprit.competence.erudition.value"
    );

    let peut_se_deplacer = true;
    let malus_mobilite = 0;
    let reset_armure = false;
    this.actor.items.filter(i => i.type === "handicap").forEach(handicap => {
      peut_se_deplacer = handicap.system.modificateurs.peut_se_deplacer?.value;
      malus_mobilite = handicap.system.modificateurs.mobilite?.value;
      reset_armure = handicap.system.modificateurs.reset_armure?.value;
    });

    this._CalculArmure(html, reset_armure ? 0 : this.actor.system.armure.value);

    if (peut_se_deplacer) {
      // Mobilité (Agilité + Equilibre - Armure)
      this._CalculMobilite(html,
        "system.caracteristique_secondaire.mobilite.value",
        this.actor.system.caracteristique.agilite.value,
        this.actor.system.caracteristique.agilite.competence.equilibre.value,
        this.actor.system.armure.value, // Utilisation de l'opérateur ternaire
        malus_mobilite
      );
    } else {
      html.find(`input[name="system.caracteristique_secondaire.mobilite.value"]`).val(0);
    }
  }

  _CalculArmure(html, valeur) {
    const affichageArmure = html.find(`span[name="actor.system.armure.value"]`);
    affichageArmure.text(valeur);
  }

  _CalculMobilite(html, cible, valeur1, valeur2, armure = 0, malus) {
    const inputCible = html.find(`input[name="${cible}"]`);
    inputCible.val(Math.max(0, valeur1 + valeur2 - armure - malus)).trigger('change');
  }

  _CalculsCaracteristique(html, cible, source1, source2, source3) {
    // Sélectionne les inputs
    const inputSource1 = html.find(`input[name="${source1}"]`);
    const inputSource2 = html.find(`input[name="${source2}"]`);
    const inputSource3 = html.find(`input[name="${source3}"]`);
    const inputCible = html.find(`input[name="${cible}"]`);

    const ancienneValeurCible = parseInt(inputCible.val()) || 0;
    const ancienneValeur1 = parseInt(inputSource1.val()) || 0;
    const ancienneValeur2 = parseInt(inputSource2.val()) || 0;
    const ancienneValeur3 = parseInt(inputSource3.val()) || 0;

    const ValeurAjouteeManuellement = ancienneValeurCible - ancienneValeur2 - ancienneValeur1 + ancienneValeur3

    // Fonction pour mettre à jour la valeur cible
    function updateCible() {
      const valeur1 = parseInt(inputSource1.val()) || 0;
      const valeur2 = parseInt(inputSource2.val()) || 0;
      const valeur3 = parseInt(inputSource3.val()) || 0;
      const nouvelleValeur = valeur1 + valeur2 - valeur3 + ValeurAjouteeManuellement;

      if (ancienneValeurCible !== nouvelleValeur) {
        inputCible.val(Math.max(nouvelleValeur)).trigger('change');
      }
    }

    // Ajoute les écouteurs d'événements
    inputSource1.on('input', updateCible);
    inputSource2.on('input', updateCible);
    inputSource3.on('input', updateCible);

    // Met à jour immédiatement au chargement
    updateCible();
  }

  _GestionArmes(html) {
    html.find('.arme').on('click', async (event) => {
      event.preventDefault();
      const actor = this.actor;

      const itemId = event.currentTarget.dataset.itemId; // Récupère l'ID de l'arme cliquée
      const arme = actor.items.get(itemId); // Trouve l'arme dans l'inventaire

      const tactiqueBonus = actor.system.jet_tactique;
      const tactiquesCumules = arme.system.tactiques_cumules;
      const coutTactique = arme.system.cout_tactique;

      if (tactiqueBonus === 0) { return; }

      let nouvelleValeur = tactiquesCumules + 1;

      if (nouvelleValeur <= coutTactique) {
        await arme.update({ "system.tactiques_cumules": nouvelleValeur });
        await actor.update({ "system.jet_tactique": tactiqueBonus - 1 });

        ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          content: game.i18n.format('system.actorSheet.chat_message_tactiques_added', { actor_name: actor.name, tactique_bonus: tactiqueBonus, item_name: arme.name })
        });
      }
    });
  }

  _UtiliserTactiques(html) {
    html.find('.utiliser-tactique').on('click', async (event) => {
      event.preventDefault();
      const isTalentArmeBloque = this.actor.items
        .filter(i => i.type === "handicap")
        .some(handicap => handicap.system.modificateurs?.peut_utiliser_tactiques?.value === false) && game.combat !== null;

      if (isTalentArmeBloque) {
        ui.notifications.warn(game.i18n.localize(`system.actorSheet.error_tactique_disabled`));
        return;
      }
      const actor = this.actor;

      const itemId = event.currentTarget.dataset.itemId; // Récupère l'ID de l'arme cliquée
      const arme = actor.items.get(itemId); // Trouve l'arme dans l'inventaire

      await arme.update({ "system.tactiques_cumules": 0 });
    });
  }
}

function convertirValeur(resultat) {
  if (resultat === 1) return 1;
  if (resultat >= 2 && resultat <= 7) return 2;
  if (resultat >= 8 && resultat <= 11) return 3;
  if (resultat === 12) return 4;
  return 0; // Sécurité si jamais un résultat non attendu arrive
}