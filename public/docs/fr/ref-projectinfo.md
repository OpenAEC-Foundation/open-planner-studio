# Nouveau projet et Paramètres du projet

Les champs de la fenêtre *Nouveau projet* et de *Paramètres du projet* : ce que fait chaque champ, quelle est la valeur par défaut et où il prend effet. Ce sont deux côtés du même formulaire. *Nouveau projet* crée un nouveau projet et comporte quelques champs supplémentaires. *Paramètres du projet* modifie le projet que vous avez ouvert.

## Ouverture

**Nouveau projet** — *Fichier › Nouveau*, Ctrl+N, ou le bouton plus à droite des onglets de documents (*Démarrer un projet*, puis *Nouveau projet*). La fenêtre s’ouvre avec le curseur dans *Nom du projet*.

**Paramètres du projet** — *Paramètres › Projet › Paramètres du projet* ouvre le formulaire dans une fenêtre intitulée *Paramètres du projet*. *Fichier › Paramètres du projet* affiche le même formulaire dans l’écran *Fichier*. Le bloc *Profil de calcul et options* se trouve en bas, dans les deux cas ; son contenu est décrit dans [Options de calcul et conventions](docs://ref-rekenopties-en-conventies).

## Créer, appliquer et annuler

**Créer** (dans *Nouveau projet*) crée le projet. Si votre onglet actuel est vide et non modifié, l’application utilise cet onglet ; sinon, le projet s’ouvre dans un nouvel onglet. **Appliquer** (dans *Paramètres du projet*) écrit vos modifications dans le projet.

- **Uniquement au moment d’appliquer.** Vous saisissez dans un brouillon. Le projet ne change que lorsque vous cliquez sur *Appliquer*. *Appliquer* écrit uniquement ce que vous avez réellement modifié, en une seule étape dans *Annuler*. Si vous cliquez sur *Appliquer* sans rien modifier, rien ne se passe et aucune étape n’est ajoutée.
- **Annuler, la croix et Échap** ferment la fenêtre sans rien enregistrer. Un clic à côté de la fenêtre ne la ferme pas : ce que vous avez saisi reste.
- **Entrée** a le même effet que *Créer* ou *Appliquer*, sauf dans le champ *Description* et dans une liste déroulante ouverte.
- **Dans l’écran Fichier**, *Paramètres du projet* affiche *Modifications non appliquées — cliquez sur Appliquer pour les conserver.* en bas tant que votre brouillon diffère. Si vous quittez ensuite l’écran, l’application demande si vous voulez appliquer, abandonner ou annuler. Voir [Le ruban, onglet par onglet](docs://ref-lint).
- **Un profil de calcul personnalisé sans nom** bloque *Appliquer* et *Créer*. Donnez-lui un nom, ou abandonnez la modification.

## Champs dans les deux fenêtres

**Nom du projet** — le nom du projet dans la barre de titre, sur l’onglet et dans le nom du fichier lors de l’enregistrement. Par défaut : vide. Un champ vide est autorisé : le projet s’appelle alors *Nouvelle planification*, affiché en texte gris dans le champ. Où : tout l’écran.

**Description** — texte libre. Par défaut : vide. Effet : enregistrée avec le projet, dans le fichier IFC et dans l’export vers Primavera P6 XML, sans influence sur le planning.

**Auteur** — texte libre. Par défaut : vide. Effet : il entre dans le fichier IFC et apparaît comme *Auteur :* dans l’en-tête d’un rapport, où vous ne pouvez pas le retaper.

**Bibliothèque de ressources** — la bibliothèque de ressources à laquelle le projet est lié. Choisissez parmi *aucune (projet autonome)*, vos bibliothèques existantes et *+ Nouvelle bibliothèque de ressources…*. Par défaut : dans *Nouveau projet*, la bibliothèque par défaut ; dans *Paramètres du projet*, le rattachement actuel. Effet : voir [Utiliser la bibliothèque de ressources](docs://howto-resourcebibliotheek-gebruiken). Avec *+ Nouvelle bibliothèque de ressources…*, vous saisissez un nom dans un champ ci-dessous ; la bibliothèque n’est créée qu’au moment de *Créer* ou *Appliquer*, donc annuler ne laisse rien derrière. Le rattachement dans *Paramètres du projet* ne change que si vous touchez vous-même ce champ.

**Client / organisation** — texte libre. Par défaut : vide. Effet : il entre dans le fichier IFC et apparaît comme *Entreprise :* dans l’en-tête d’un rapport.

**Date de début** — le début du projet. Par défaut : dans *Nouveau projet*, la date du jour. Ce que fait ce champ est expliqué plus bas, sous *Ce que fait la date de début*.

**Date de fin** — la fin prévue du projet. Par défaut : vide. Effet : une information, pas une exigence : l’application ne planifie pas en fonction de cette date. Elle apparaît dans l’en-tête d’un rapport et dans les exports, et détermine jusqu’à quelle année les jours fériés sont générés. Seulement pour un fichier Primavera avec le paramètre *Calculer la marge jusqu’à la date de fin du projet* (voir [Options de calcul et conventions](docs://ref-rekenopties-en-conventies)), le calcul de la marge va jusqu’à cette date.

**Unité par défaut des nouvelles tâches** — visible uniquement si *Activer la planification horaire* est activé. Choisissez parmi *Jours* et *Heures*. Par défaut : *Jours*. Effet et conditions : voir [Activer la planification horaire](docs://howto-urenplanning-aanzetten).

**Profil de calcul et options** — dans *Paramètres du projet*, tout le bloc ; dans *Nouveau projet*, seulement la liste déroulante *Profil de calcul* avec *Primavera P6*, *Microsoft Project* et *Open Planner Studio*. Par défaut : *Open Planner Studio*. Choisir un profil définit aussi les options par défaut de ce profil. Voir [Options de calcul et conventions](docs://ref-rekenopties-en-conventies).

## Uniquement dans Paramètres du projet

**Schéma IFC à l’enregistrement** — le schéma IFC qui figure dans l’en-tête du fichier enregistré. Choix parmi *IFC 4.3 ADD2 (par défaut)*, *IFC 4.3* et *IFC4*. Par défaut : *IFC 4.3 ADD2 (par défaut)* ; pour un fichier IFC ouvert, le schéma de ce fichier. Effet : seul l’en-tête du fichier change, pas le contenu. Utilisez-le pour fusionner le planning avec une maquette du bâtiment dans le même schéma. Si un fichier ouvert a un autre schéma que celui par défaut, l’application demande la première fois que vous enregistrez si vous gardez ce schéma ; un choix ici compte comme réponse. Un autre choix ici ne constitue pas une étape dans *Annuler* : le schéma appartient au fichier. Voir [Choisir le schéma IFC](docs://howto-ifc-schema-kiezen).

## Uniquement dans la fenêtre Nouveau projet

**Modèle de phases** — avec quelles phases le projet démarre. Choisissez parmi *Vide*, *Construction résidentielle* et *Tertiaire / rénovation*. Par défaut : *Vide*. Effet : *Vide* crée un projet sans tâches. Les deux autres mettent en place huit tâches de phase prêtes, chacune d’une durée de 5 dans l’unité par défaut du projet (5 jours ouvrés, ou 5 heures si vous choisissez *Heures* sous *Unité par défaut des nouvelles tâches*), et sans relations ; vous les renommez, les déplacez et les prolongez vous-même. Pour *Construction résidentielle*, ce sont : Bouwplaats & grondwerk, Fundering, Ruwbouw / casco, Dak, Gevel & afbouw, Installaties (W/E), Afwerking et Oplevering. Pour *Tertiaire / rénovation* : Sloop & strip-out, Grondwerk & fundering, Hoofddraagconstructie, Gevel & dak, Installaties (W/E), Afbouw, Inregelen & testen et Oplevering. Les noms sont des données de votre projet et restent en néerlandais, également dans une autre langue de l’interface. Si *Activer le mode construction* est désactivé, seul *Vide* existe. Voir [Paramètres de l’application](docs://ref-instellingen).

**Équipe** — visible uniquement si *Activer la planification horaire* est activé. Choisissez parmi *Équipe de jour*, *2 équipes*, *3 équipes* et *24/7*. Par défaut : *Équipe de jour*. Effet : *Équipe de jour* laisse le calendrier standard tel quel, un calendrier de jour ordinaire du lundi au vendredi. Les trois autres placent des plages horaires dans le calendrier du projet, comme les boutons du même nom dans la fenêtre *Calendriers*. Les horaires exacts sont décrits dans [Définir les horaires de travail](docs://howto-werktijden-instellen). Avec *Équipe de jour*, *Heures* ne peut pas être choisi sous *Unité par défaut des nouvelles tâches*, car un calendrier de jour n’a pas de plages horaires.

**Jeu de jours fériés** — les jours de congé que reçoit le calendrier du projet. Pour *Pays*, vous choisissez *Pays-Bas* (par défaut), *Allemagne*, *Belgique*, *France*, *Royaume-Uni*, *Autriche*, *Suisse*, *Aucun jour férié* ou *Personnalisé…*. Si le pays a des régions, une liste déroulante *Région* apparaît. Pour les Pays-Bas, vous choisissez aussi, si *Activer le mode construction* est activé, les *Congés du bâtiment* : *Aucun* (par défaut), *Nord*, *Centre* ou *Sud*. Sous cela se trouve une ligne du type *36 jours fériés, 2025–2029*, que vous développez pour voir la liste. Les années vont de l’année avant la date de début à l’année après la date de fin, ou jusqu’à trois ans après l’année de début s’il n’y a pas de date de fin. *Personnalisé…* crée un calendrier sans jours fériés et ouvre la fenêtre *Calendriers* juste après la création, pour que vous les saisissiez vous-même. Le calendrier du projet s’appelle *Bouwkalender NL*, ou *Standaardkalender* si *Activer le mode construction* est désactivé ; le choix est alors aussi *Aucun jour férié*. Le fonctionnement du générateur est décrit dans [Générer les jours fériés et les congés du bâtiment](docs://howto-feestdagen-genereren).

## Ce que fait la date de début

La date de début est le point d’ancrage du projet. Trois règles :

- **Les nouvelles tâches commencent à la date de début.** Une tâche que vous ajoutez reçoit le début du projet comme début planifié.
- **Une tâche avec un prédécesseur ne commence jamais avant la date de début.** Si la fin du prédécesseur est plus tôt, la tâche attend la date de début. Une tâche *sans* prédécesseur garde sa propre date, même si elle se situe avant la date de début. C’est nécessaire pour afficher un planning de MS Project ou de Primavera comme le programme d’origine l’affiche. Une contrainte *Doit commencer le (MSO)* ou *Doit finir le (MFO)* déroge aux deux règles : une telle tâche reste à sa date, même si elle tombe avant la date de début.
- **Une date de début plus tardive déplace les tâches libres.** Si vous fixez la date de début plus tard dans *Paramètres du projet* et cliquez sur *Appliquer*, les tâches sans prédécesseur et sans contrainte qui fixe une limite inférieure (*début au plus tôt*, *doit commencer le*, *fin au plus tôt le* ou *doit finir le*) qui se situeraient avant la nouvelle date passent à cette date, dans la même étape d’*Annuler*. L’application indique combien de tâches ont été déplacées. Cela ne se produit que lorsque vous changez vous-même la date de début, jamais à l’ouverture d’un fichier. Fixer la date de début plus tard ne déplace pas le reste du planning : *Déplacer le projet* le fait, voir [Déplacer un projet](docs://howto-project-verplaatsen).

## Voir aussi

- [Options de calcul et conventions](docs://ref-rekenopties-en-conventies) : le bloc *Profil de calcul et options*.
- [Profils de calcul et conventions](docs://uitleg-rekenprofielen) : pourquoi un profil change le résultat.
- [Déplacer un projet](docs://howto-project-verplaatsen) : tout le planning vers un autre début.
- [Ajouter des tâches et des jalons](docs://howto-taken-en-mijlpalen-toevoegen) : pour commencer avec les premières tâches.
- [Générer les jours fériés et les congés du bâtiment](docs://howto-feestdagen-genereren) : le jeu de jours fériés en détail.
- [Choisir le schéma IFC](docs://howto-ifc-schema-kiezen) : enregistrer pour une maquette de bâtiment en IFC4.
