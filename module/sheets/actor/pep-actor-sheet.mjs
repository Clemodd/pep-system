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
  getData() {
    const context = super.getData();
    const actorData = context.data; // Copie des données acteur

    context.system = actorData.system;
    context.flags = actorData.flags;
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

    context.effects = prepareActiveEffectCategories( // Récupère tous les effets (buffs, debuffs, conditions)
      this.actor.allApplicableEffects()
    );

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
    html.find("#delete-equipement").on("click", async (event) => {
      const itemId = event.currentTarget.dataset.itemId;
      const item = this.actor.items.get(itemId);

      await this.actor.deleteEmbeddedDocuments("Item", [itemId]);

      // Si c'était de type "armure", on recalcule la valeur totale
      this.UpdateArmure(item);
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
    html.find("#delete-handicap").on("click", async (event) => {
      const itemId = event.currentTarget.dataset.itemId;
      await this.actor.deleteEmbeddedDocuments("Item", [itemId]);
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
      console.log("PEP | Données de l'item reçu :", data);
    } catch (err) {
      console.error("PEP | Impossible de récupérer les données de l'item", err);
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
      console.warn("PEP | Type d'item non valide après correction :", data.type);
      ui.notifications.warn("Seuls les items de type 'Handicap' peuvent être ajoutés ici !");
      return;
    }

    // 🔹 Créer l'item
    let createdItems = await this.actor.createEmbeddedDocuments("Item", [data]);

    if (game.combat) {
      await createdItems[0].update({ "system.acquisition_tour": game.combat.round });
    }
    ui.notifications.info(`${data.name} ajouté au personnage ${this.actor.name} !`);

    ChatMessage.create({
      content: `<b>${this.actor.name}</b> est <b>${data.name}</b> pendant <b>${data.system.duree} tour${data.system.duree > 1 ? "s" : ""}</b>.`,
      type: CONST.CHAT_MESSAGE_STYLES.OTHER
    });
  }

  async _onDropItemEquipement(event) {
    event.preventDefault();
    const evt = event.originalEvent || event; // Vérifie où se trouve l'événement principal
    let data;
    try {
      data = JSON.parse(evt.dataTransfer.getData("text/plain"));
      console.log("PEP | Données de l'item reçu :", data);
    } catch (err) {
      console.error("PEP | Impossible de récupérer les données de l'item", err);
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
      ui.notifications.warn("Tu as atteint la limite d'emplacements pour les équipements !");
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
      console.warn("PEP | Type d'item non valide après correction :", data.type);
      ui.notifications.warn("Seuls les items de type 'Equipement' peuvent être ajoutés ici !");
      return;
    }

    if (data.type === "armure") {
      this.actor.update({ "system.armure.bonus": data.system.bonus });
    }

    await this.actor.createEmbeddedDocuments("Item", [data]);

    // Puis on recalcule l'armure totale
    this.UpdateArmure(item);

    ui.notifications.info(`${data.name} ajouté au personnage ${this.actor.name} !`);

    ChatMessage.create({
      content: `<b>${data.name}</b> est dans le sac de <b>${this.actor.name}</b>.`,
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
      console.log(`✅ ${this.actor.name} n'a aucun handicap.`);
      return resultats;
    }

    handicapsActifs.forEach(handicap => {
      console.log(`🛑 Handicap : ${handicap.name}`);
      console.log(`🔹 Durée : ${handicap.system.duree} tours`);

      const modCompetencesGlobales = handicap.system.modificateurs.competences_globales?.value ?? 0;
      const conditionCombat = handicap.system.modificateurs.condition_combat?.value ?? false;
      const peutTirer = handicap.system.modificateurs.peut_tirer?.value ?? true;
      const peutEsquiver = handicap.system.modificateurs.peut_esquiver?.value ?? true;

      if (modCompetencesGlobales !== 0) {
        console.log(`⚠️ Il y a un malus global (-${modCompetencesGlobales})`);

        if (conditionCombat) {
          console.log(`⚠️ Le malus s'applique en combat`);

          if (!game.combat) {
            console.log("🔸 Pas de combat, malus non appliqué");
            return;
          }
        }

        console.log("🔹 Malus appliqué");
        resultats.malus_global += modCompetencesGlobales;
      }

      if (!peutTirer) {
        console.log(`🚫 ${handicap.name} bloque l'utilisation des tirs.`);
        if (conditionCombat) {
          console.log("⚔️ Interdiction de tirer active uniquement en combat");
          resultats.peutTirer = game.combat ? false : true; // Permet de tirer hors combat
        } else {
          console.log("🚫 Interdiction de tirer sans condition");
          resultats.peutTirer = false;
        }
      }

      if (!peutEsquiver) {
        console.log(`🚫 ${handicap.name} bloque l'utilisation des esquives.`);
        if (conditionCombat) {
          console.log("⚔️ Interdiction d'esquiver en combat");
          resultats.peutEsquiver = game.combat ? false : true; // Permet de tirer hors combat
        } else {
          console.log("🚫 Interdiction d'esquiver sans condition");
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
        flavor: `Jet d'usage ${jetAvant} pour l'objet ${type}.
                 <br>
                 <b>Résultat</b> : ${resultat}
                 ${isSupprime ? "<br>L'objet est épuisé" : ""}
                 `
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
        messageHandicaps += `<br><b>⚠️ Handicaps actifs :</b>`;
        handicapsActifs.forEach(handicap => {
          messageHandicaps += `<br> - <b>${handicap.name}</b> (${handicap.system.duree} tour${handicap.system.duree > 1 ? "s" : ""}) : ${handicap.system.description}`;
        });
      }

      if (key === "point_hero") {
        this.actor.update({
          [`system.${type}.${key}.value`]: this.actor.system[type][key]?.value === 1 ? 0 : 1
        });
        return;
      } else if (key === "tir" && !analyseHandicaps.peutTirer) {
        ui.notifications.error(`${this.actor.name} ne peut pas tirer à cause d'un handicap.`);
        return;
      } else if (key === "esquive" && !analyseHandicaps.peutEsquiver) {
        ui.notifications.error(`${this.actor.name} ne peut pas esquiver à cause d'un handicap.`);
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
        flavor: `Jet de ${nombreDe} dé${nombreDe > 1 ? "s" : ""} pour le test <b>${game.i18n.localize(`system.attributes.${key}`)}</b>. ${analyseHandicaps.malus_global != 0 ? `(Malus de -${analyseHandicaps.malus_global})` : ""}
                 <br>
                 <b>Détails du jet</b> : <br>
                 ✅ <b>Succès</b> : ${nbSucces} <br>
                 ⚔️ <b>Tactiques</b> : ${nbTactique} <br>
                 💀 <b>Crânes</b> : ${nbCrane}
                  ${messageHandicaps}` // 🔹 Ajout des handicaps actifs
      });

      if (game.combat !== null) {
        this.actor.update({ "system.jet_tactique": nbTactique });
      }
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
        flavor: `Jet de ${diceFormula} 🎲<br>
        Vigueur : ${resultat[0]}<br>
        Agilité : ${resultat[1]}<br>
        Sensibilité : ${resultat[2]}<br>
        Esprit : ${resultat[3]}`
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
      console.log("🚷 Un handicap bloque la mobilité, mise à 0.");
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
          content: `<b>${actor.name}</b> a ajouté <b>${tactiqueBonus}</b> tactiques à <b>${arme.name}</b>.`
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
        ui.notifications.warn("Vous êtes désarmés et ne pouvez pas utiliser de talents d'armes.");
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

/**
 * Classe les effets actifs en catégories (Temporaire, Passif, Inactif)
 * @param {Array} effects - Liste des effets actifs
 * @returns {Object} Catégories triées des effets
 */
function prepareActiveEffectCategories(effects) {
  const categories = {
    temporary: {
      type: 'temporary',
      label: game.i18n.localize('PEP.Effect.Temporary'),
      effects: [],
    },
    passive: {
      type: 'passive',
      label: game.i18n.localize('PEP.Effect.Passive'),
      effects: [],
    },
    inactive: {
      type: 'inactive',
      label: game.i18n.localize('PEP.Effect.Inactive'),
      effects: [],
    },
  };

  // Tri des effets dans les bonnes catégories
  for (let e of effects) {
    if (e.disabled) categories.inactive.effects.push(e);
    else if (e.isTemporary) categories.temporary.effects.push(e);
    else categories.passive.effects.push(e);
  }

  return categories;
}  