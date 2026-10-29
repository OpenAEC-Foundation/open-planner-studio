# Paramètres

Chaque paramètre de l'application : ce qu'il fait, sa valeur de départ, ce qui change et où vous le trouvez. Pour les options de calcul d'un projet (profil de calcul, définition des tâches critiques), voir [Options de calcul et conventions](docs://ref-rekenopties-en-conventies) : celles-ci font partie du fichier de projet, pas de l'application.

## Où les trouver et comment ils fonctionnent

Le panneau des paramètres se trouve à trois endroits, et partout c'est le même panneau : la roue dentée en haut de la fenêtre, *Paramètres › Projet › Paramètres de l'application* et *Fichier › Paramètres de l'application*. Le panneau a trois onglets : *Apparence*, *Planification* et *Avancé*. Chaque paramètre ci-dessous indique seulement son onglet.

Une modification prend effet immédiatement. Il n'y a ni bouton *Appliquer* ni bouton *Annuler*.

**Pour toute l'application, pas par projet.** Tous les paramètres de cet article s'appliquent à tous vos projets et appartiennent à cet appareil. L'application les garde dans le stockage de l'application ou de votre navigateur, pas dans le fichier de projet. Une autre personne qui ouvre votre fichier voit donc ses propres paramètres. Un navigateur dont vous effacez le stockage repart avec les valeurs de départ.

## Onglet Apparence

**Thème** — le thème de couleurs de l'interface. Choisissez parmi *Sombre*, *Clair* et *Contraste élevé*. Par défaut : *Sombre*. Effet : les couleurs de toute l'interface, y compris le Gantt et l'histogramme. Où : *Apparence*.

**Suivre le thème du système** — laisse le thème de couleurs de votre système d'exploitation décider. Par défaut : désactivé. Effet : l'application est *Clair* ou *Sombre*, selon votre système ; les trois cartes de thème sont alors désactivées. *Contraste élevé* ne suit pas votre système : vous le choisissez vous-même. Si vous désactivez cette option, le thème affiché à ce moment-là reste. Où : *Apparence*, sous *Thème*.

**Langue** — la langue de l'interface. Par défaut : la langue de votre navigateur ou de votre système si l'application la connaît, sinon l'anglais. Effet : tous les textes de l'application ; les langues sont classées selon leur code court. L'arabe et le persan inversent l'interface de droite à gauche. Vous réglez la langue des articles d'aide séparément, sous *Langue de la documentation* dans *Fichier › Aide*. Où : *Apparence*.

**Police** — la police de toute l'interface. Choisissez parmi *Par défaut*, *Système*, *Serif* et *Monospace*. Par défaut : *Par défaut*. Effet : les titres et les textes de la fenêtre, ainsi que les textes du Gantt et de l'histogramme. Une application web ne suit pas la police de votre système d'elle-même ; c'est pourquoi vous la choisissez ici. Où : *Apparence*.

**Taille du texte** — l'échelle de l'interface. Choisissez parmi 90 %, 100 %, 110 % et 125 %. Par défaut : 100 %. Effet : le texte et la disposition du ruban, des panneaux et des boîtes de dialogue deviennent plus grands ou plus petits, et la hauteur des lignes du tableau et du Gantt suit. Il n'y a pas de choix au-dessus de 125 %, car les libellés des boutons du ruban se couperaient alors sur plusieurs lignes. Où : *Apparence*.

**Format de date** — la façon dont les dates apparaissent dans l'application. Choisissez parmi *jj-mm-aaaa*, *mm-jj-aaaa* et *aaaa-mm-jj*. Par défaut : *jj-mm-aaaa*. Effet : les dates du tableau, des boîtes de dialogue, des rapports et de l'impression. Les fichiers et les calculs ne changent pas : seul l'affichage change. Où : *Apparence*.

**Format de l'heure** — la façon dont les heures apparaissent dans l'application. Choisissez parmi *24 heures (13:00)* et *12 heures (1:00 PM)*. Par défaut : *24 heures (13:00)*. Effet : les heures dans la fenêtre *Calendriers*, la date et l'heure des tâches en heures (tableau, fractionnements, messages) et l'échelle de temps *Heure* dans le Gantt. Dans un champ d'heure, vous pouvez saisir l'une ou l'autre forme : *13:00*, *1300*, *13*, *1:00 PM* ou *1 pm*. Minuit comme fin de journée s'écrit *24:00* ou *12:00 AM*. Les fichiers et les calculs ne changent pas : ils restent en 24 heures. Où : *Apparence*.

**Affichage de la durée** — l'unité dans laquelle la durée d'une tâche est affichée. Choisissez parmi *Automatique (unité propre à chaque tâche)*, *Toujours en jours* et *Toujours en heures*. Par défaut : *Automatique (unité propre à chaque tâche)*. Effet : dans le tableau des tâches, les libellés des barres du Gantt, l'info-bulle, l'impression et les rapports. Avec *Automatique*, une tâche en jours affiche des jours et une tâche en heures affiche des heures. Avec *Toujours en jours* ou *Toujours en heures*, l'application convertit selon les heures par jour du calendrier de la tâche et, si l'unité de la tâche est différente, ajoute son unité propre entre parenthèses, par exemple `2.25d(18h)`. Seul l'affichage change ; la tâche garde sa propre unité. Où : *Apparence*.

**Style de passage entre projets** — la façon dont vous passez d'un projet ouvert à l'autre. Choisissez parmi *Onglets horizontaux*, *Onglets verticaux* et *Pastille*. Par défaut : *Onglets horizontaux*. Effet : *Onglets horizontaux* place une barre d'onglets sous le ruban ; *Onglets verticaux* une barre de projets à gauche ; *Pastille* un petit bouton de projet dans la barre de titre. Où : *Apparence*.

### Section Gantt

**Afficher uniquement les jours ouvrés** — compresse l'axe temporel. Par défaut : désactivé. Effet : les week-ends et les jours fériés du calendrier du projet sont sautés ; une tâche de 5 jours ouvrés fait donc exactement 5 jours de large. Les raccourcis *Aller à aujourd'hui* et *Ajuster au projet* comptent alors aussi en jours ouvrés. Le rapport a sa propre case du même nom, indépendante de ce paramètre. Où : *Apparence*, sous *Gantt › Axe temporel*.

**Afficher les quarts d'heure en zoom poussé** — une échelle de temps plus fine. Par défaut : désactivé. Effet : vous pouvez zoomer davantage, et l'échelle des heures reçoit une ligne supplémentaire pour le quart d'heure. Faire glisser la barre d'une tâche en heures peut alors s'aligner sur les quarts d'heure au lieu des heures entières. Vous ne voyez cela que lorsque *Activer la planification horaire* est activé. Où : *Apparence*, sous *Gantt › Zoom au quart d'heure*.

**Barres de tâche lors des interruptions** — si une tâche en heures est dessinée en blocs. Choisissez parmi *Ne jamais scinder*, *Scinder à la sélection* et *Toujours scinder*. Par défaut : *Scinder à la sélection*. Effet : la barre d'une tâche en heures est alors dessinée par plage horaire, au lieu d'une seule barre continue. *Scinder à la sélection* ne le fait que pour la tâche sélectionnée. Cela ne concerne que les tâches en heures ; une tâche réellement fractionnée (avec *Fractionner la tâche*) affiche son interruption, quel que soit ce paramètre. Où : *Apparence*, sous *Gantt*.

**Défilement & zoom › Mode** — ce que fait la molette de la souris au-dessus du Gantt. Choisissez parmi *Position*, *Touches* et *Zoom + glisser*. Par défaut : *Zoom + glisser*. Effet : avec *Zoom + glisser*, la molette zoome autour du curseur, Maj+molette fait défiler les lignes, vous déplacez la chronologie en faisant glisser le fond, et Ctrl+glisser (Cmd sur Mac) dessine un cadre de sélection. Avec *Position*, la fonction de la molette dépend de l'endroit où se trouve le curseur ; Ctrl+molette zoome toujours et Maj+molette défile toujours horizontalement. Avec *Touches*, vous choisissez vous-même la touche qui fait quoi. Ce choix s'applique aussi à la seconde chronologie de la vue partagée. Où : *Apparence*, sous *Gantt › Défilement & zoom*.

**Défilement & zoom › Division de l'écran** — où se trouve le curseur, selon la fonction. Visible seulement en mode *Position*. Choisissez parmi *Gauche/droite*, *Haut/bas* et *Coin supérieur droit*. Par défaut : *Gauche/droite*. Effet : avec *Gauche/droite*, la molette défile verticalement sur la moitié gauche et horizontalement sur la moitié droite. Avec *Haut/bas*, la molette défile horizontalement sur les 30 % du haut (près de l'échelle de temps) et verticalement en dessous. Avec *Coin supérieur droit*, la molette défile horizontalement dans le quadrant supérieur droit et verticalement dans le reste. Où : *Apparence*, sous *Gantt › Défilement & zoom*.

**Défilement & zoom › Vertical, Horizontal, Zoom** — quelle touche correspond à quelle fonction de la molette. Visible seulement en mode *Touches*. Pour chaque fonction, vous choisissez parmi *Défiler*, *Ctrl + molette* ou *Maj + molette*. Par défaut : *Vertical* sur *Défiler*, *Zoom* sur *Ctrl + molette* et *Horizontal* sur *Maj + molette*. Effet : si vous choisissez une touche déjà utilisée, elle est échangée avec la fonction qui l'avait. Où : *Apparence*, sous *Gantt › Défilement & zoom*.

## Onglet Planification

**Activer le mode construction** — valeurs de départ orientées construction pour les nouveaux projets. Par défaut : activé. Effet : activé, un nouveau projet reçoit le calendrier *Bouwkalender NL* avec les jours fériés néerlandais, vous laisse choisir un jour férié du bâtiment lors de la génération des jours fériés, propose les modèles de phasage *Construction résidentielle* et *Tertiaire / rénovation*, et donne aux nouvelles tâches la catégorie de travaux *Construction*. Désactivé, le projet reçoit le calendrier *Standaardkalender* sans jours fériés, seulement le modèle *Vide* et la catégorie de travaux *Autre*. Une nouvelle tâche sous une tâche parente qui a une catégorie de travaux reprend d'abord cette catégorie ; *Construction* ou *Autre* s'applique ensuite. Les tâches et les calendriers existants ne changent pas. Où : *Planification*.

**Activer la planification horaire** — la planification en heures, à côté des jours ouvrés. Par défaut : désactivé. Effet : l'échelle de temps *Heure* apparaît sous *Affichage › Échelle de temps* ; dans la fenêtre *Calendriers*, un calendrier ordinaire peut recevoir des plages horaires (le bloc *Horaires de travail* ; un calendrier qui a déjà des plages les affiche toujours) ; et la fenêtre *Nouveau projet* reçoit les choix *Équipe* et *Unité par défaut des nouvelles tâches*. *Paramètres du projet* reçoit aussi le choix *Unité par défaut des nouvelles tâches*. Désactivé, l'application travaille au jour près. Les tâches déjà en heures restent et sont prises en compte dans le calcul ; vous ne pouvez modifier leur durée qu'après avoir activé la planification horaire. Où : *Planification*, sous *Planification horaire*. Voir [Activer la planification horaire](docs://howto-urenplanning-aanzetten).

**Autoriser la planification mixte jours/heures** — si vous choisissez l'unité pour chaque tâche. Visible seulement lorsque *Activer la planification horaire* est activé. Par défaut : activé. Effet : activé, affiche la liste déroulante *Unité de durée* à côté de la durée de chaque tâche. Désactivé, cette liste est masquée. Où : *Planification*, sous *Planification horaire*. Voir [Jours et heures](docs://uitleg-dagen-en-uren).

**Début de la semaine** — le premier jour de la semaine. Choisissez parmi *Lundi* et *Dimanche*. Par défaut : *Lundi*. Effet : la disposition de la semaine et les numéros de semaine de l'échelle de temps dans le Gantt et dans les rapports (l'impression du diagramme de Gantt), ainsi que l'ordre des jours de la semaine dans la fenêtre *Calendriers*. Où : *Planification*.

**Calculer automatiquement** — recalcule le planning dès qu'il n'est plus à jour. Par défaut : désactivé. Effet : désactivé, vous appuyez vous-même sur *Calculer* (F5). Activé, l'application recalcule le planning une fraction de seconde après une modification des tâches, des relations ou du calendrier. Pendant un geste de glissement, ou pendant que vous saisissez dans un champ, l'application attend et ne calcule qu'une fois que vous avez terminé. Après un calcul échoué, elle ne recalcule qu'après une modification de votre part. Où : *Planification*, sous *Calcul*.

**Utiliser les types de tâche** — les champs type de tâche et travail de l'application. Par défaut : désactivé. Effet : activé, affiche le champ *Type de tâche* sur une tâche et la colonne travail des affectations, et rend disponible la colonne de tableau *Type de tâche*. Désactivé, ils sont masqués ; la durée et les unités restent, et le travail suit. Un projet qui contient déjà des données de type de tâche ou de travail, par exemple issues d'un fichier `.mpp` ou `.xer`, les affiche toujours, même si ce paramètre est désactivé. Où : *Planification*, sous *Calcul*. Voir [Types de tâche : durée, unités et travail](docs://uitleg-werkregels).

## Onglet Avancé

**Afficher l'explication après l'ouverture de** — une case par format : *Fichier Primavera (.xer)*, *Fichier MS Project (.mpp)*, *MS Project XML*, *Primavera P6 XML* et *Fichier CSV*. Par défaut : toutes activées. Effet : activé, une fenêtre avec une courte explication du format s'affiche après l'ouverture d'un tel fichier : ce que l'application a repris, ce qu'elle n'a pas repris, et comment l'enregistrement et la réécriture fonctionnent. *Ne plus afficher pour …* dans cette fenêtre décoche la case ici ; ici, vous la réactivez. Un fichier IFC, un exemple et un projet ouvert par un assistant IA ou une extension n'affichent jamais cette explication. Où : *Avancé*, sous *Afficher l'explication après l'ouverture de*. Voir [Ouvrir et enregistrer un fichier](docs://howto-bestand-openen-en-opslaan).

**Activer le mode IA** — permet à un assistant IA de travailler avec votre planning. Par défaut : désactivé. Effet : activé, affiche l'onglet *IA* avec le pont MCP, afin qu'un assistant IA puisse travailler avec votre planning via le Model Context Protocol. Désactivé, l'onglet est masqué et le pont s'arrête. Où : *Avancé*, sous *Mode IA*. Voir [Connecter un assistant IA (MCP)](docs://howto-ai-assistent-koppelen).

**Démarrer le pont automatiquement** — démarre le pont MCP au lancement de l'application. Ce paramètre ne peut être activé que lorsque *Activer le mode IA* est activé. Par défaut : désactivé. Effet : le pont est actif tout de suite, afin qu'un client IA puisse se connecter sans que vous ayez d'abord ouvert l'onglet *IA*. Cela ne fonctionne que dans l'application de bureau, et une seule fois par démarrage : si vous désactivez ensuite le pont vous-même, il ne redémarre pas. Où : *Avancé*, sous *Mode IA*.

**Activer le terminal de débogage** — un panneau de journal pour le dépannage. Par défaut : désactivé. Effet : activé, place un bouton de terminal dans la barre d'état, qui affiche ou masque le panneau de journal. Désactivé, le panneau se ferme. Où : *Avancé*, sous *Terminal de débogage*.

**Benchmark…** — mesure les performances du moteur de planification. Effet : ouvre une fenêtre dans laquelle un planning d'essai d'une taille choisie est généré et les phases principales sont mesurées. Votre projet ouvert reste intact. C'est un bouton, pas un paramètre : il n'y a rien à retenir. Où : *Avancé*, sous *Benchmark*.

**Statistiques…** — combien de fois l'application a été téléchargée. Effet : ouvre la fenêtre *Statistiques de téléchargement* avec des chiffres publics de GitHub Releases ; rien n'est collecté auprès de vous. C'est un bouton, pas un paramètre. Où : *Avancé*, sous *Statistiques*. Dans la fenêtre :

- *Téléchargements par système d’exploitation* — par système, les colonnes *Téléchargements*, *Installateurs* (ce qu'une personne télécharge) et *Mises à jour* (ce que le programme de mise à jour de l'application récupère), avec un *Total*. Sous Linux, les deux ne peuvent pas être séparés : le programme de mise à jour récupère le même fichier `.deb`, `.rpm` ou `.AppImage` que celui que les gens téléchargent à la main ; là, seul le fichier snap compte comme installateur. En dessous, *Vérifications de mise à jour depuis l'application* : combien de fois le programme de mise à jour d'une application installée a récupéré le fichier de version sur GitHub pour chercher une nouvelle version. Ce sont des vérifications, pas des installations.
- *Par version* — les mêmes téléchargements par version, avec la date ; d'abord les six plus récentes, avec *Afficher les … versions* pour les autres.
- *Source* — la date des chiffres (GitHub Releases, mis à jour chaque semaine) et *Actualiser maintenant*. L'application garde les chiffres récupérés pendant une demi-heure. Si la récupération échoue, la fenêtre l'indique. Les installations via le Snap Store ne passent pas par GitHub : elles manquent.

**Lancer la visite guidée** — la visite d'introduction, à nouveau. Effet : ferme la fenêtre *Paramètres de l'application* et lance la visite guidée depuis la première étape. Où : *Avancé*, sous *Visite guidée*.

**Version** — le numéro de version de l'application, avec deux boutons. *Rechercher des mises à jour* ouvre la fenêtre de mise à jour. *Nouveautés* affiche les nouveautés de la version actuelle. Où : *Avancé*, sous *Version*.

**Afficher les boutons d'affichage classiques** — une fonction remplacée, sous *Fonctions héritées*. Par défaut : désactivé. Effet : activé, remet un groupe *Affichage* dans l'onglet *Affichage*, avec les boutons séparés *Colonnes…*, *Filtre…*, *Grouper…* et *Trier…*. Ils ont été remplacés par le signe plus dans l'en-tête du tableau, les boutons de disposition et la fenêtre de disposition. Où : *Avancé*, sous *Fonctions héritées*.

## Choix d'affichage mémorisés hors du panneau

L'application conserve aussi ces choix sur cet appareil, mais vous les réglez sur l'élément lui-même, et non dans le panneau des paramètres.

**Superposition de la référence** — la référence active sous forme de fine barre sous la barre de tâche. Par défaut : activé. Emplacement : *Affichage › Références et avancement › Superposition de la référence*.

**Ligne d’avancement** — la ligne en zigzag de l'avancement à la date d'état. Par défaut : activé. Effet : la ligne n'apparaît que si le projet a une date d'état, et elle remplace alors la ligne de date d'état séparée. Emplacement : *Affichage › Références et avancement › Ligne d’avancement*.

**Ligne de date d’état** — une ligne pointillée à la date d'état. Par défaut : activé. Effet : si la ligne d'avancement est activée, elle dessine elle-même le repère. Emplacement : *Affichage › Références et avancement › Ligne de date d’état*.

**Accent ressource** — une fine bande de la couleur de la ressource sous la barre de tâche. Par défaut : désactivé. Emplacement : *Affichage › Références et avancement › Accent ressource*.

**Bande de marge** — la marge sous forme de bande derrière les barres non critiques, sauf pour les tâches terminées. Par défaut : activé. Emplacement : *Affichage › Références et avancement › Bande de marge*.

**Couleurs des barres** — ce dont dépend la couleur d'une barre. Choisissez parmi *Chemin critique*, *Par tâche — automatique* et *Par catégorie*. Par défaut : *Chemin critique*. Effet : s'applique en même temps au Gantt et au rapport. Emplacement : *Affichage › Références et avancement › Couleurs des barres*.

**Histogramme** — la bande de l'histogramme sous le Gantt. Par défaut : désactivé. Emplacement : *Ressources › Histogramme › Histogramme*, *Affichage › Panneaux › Histogramme* ou Ctrl+Maj+H. Vous réglez la hauteur de la bande (par défaut 160 pixels, entre 80 et 480) en faisant glisser son bord.

**Mini-carte** — une carte d'ensemble de la chronologie. Par défaut : désactivé. Emplacement : *Affichage › Présentation › Mini-carte*.

**Réduire le ruban** — un ruban compact. Par défaut : désactivé. Emplacement : le bouton fléché en bas à droite du ruban.

**Largeur du tableau des tâches** — par défaut 350 pixels, entre 150 et 800. Vous la réglez en faisant glisser le séparateur à côté du tableau, ou avec les touches flèche gauche et flèche droite quand le séparateur a le focus.

**Largeur du panneau de droite** — par défaut 280 pixels, entre 200 et 900. Vous la réglez en faisant glisser le bord du panneau.

**Hauteur de *Propriétés* et *Avertissements* dans le panneau de droite** — par défaut 240 et 220 pixels, entre 120 et 2000. *Propriétés* garde cette hauteur quand la liste des ressources est ouverte aussi. Vous réglez la hauteur avec la poignée entre les sections. L'application ne mémorise pas si les sections sont ouvertes ou fermées.

**Également mémorisés, décrits ailleurs** — les colonnes du tableau ([Adapter les colonnes du tableau](docs://howto-tabelkolommen-aanpassen)), vos dispositions ([Créer et utiliser une disposition](docs://howto-layouts-gebruiken)), les options de rapport ([Types de rapport](docs://ref-rapporttypes)), vos propres modèles de profil de calcul ([Options de calcul et conventions](docs://ref-rekenopties-en-conventies)) et la *Langue de la documentation* de l'Aide (*Fichier › Aide*) sont aussi conservés par l'application sur cet appareil, et non dans le fichier du projet.

## Voir aussi

- [Options de calcul et conventions](docs://ref-rekenopties-en-conventies) : les options qui font partie d'un projet.
- [Activer la planification horaire](docs://howto-urenplanning-aanzetten) : les étapes pour l'interrupteur *Activer la planification horaire*.
- [Jours et heures](docs://uitleg-dagen-en-uren) : la façon dont l'application compte les jours et les heures.
- [Types de tâche : durée, unités et travail](docs://uitleg-werkregels) : ce que rend visible *Utiliser les types de tâche*.
- [Raccourcis clavier](docs://ref-sneltoetsen) : toutes les touches de l'application, y compris celles pour le zoom et le défilement.
