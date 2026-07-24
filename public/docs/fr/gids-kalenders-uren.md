# Calendriers & planification horaire

Une tâche d'une durée de « 5 jours » ne prend son sens qu'associée à un calendrier : quels jours sont des jours ouvrés, à quelles heures le travail se fait-il, et quels jours disparaissent en raison d'un jour férié ou d'une fermeture temporaire ? Ce guide couvre le calendrier du projet, les calendriers de ressources, et la planification horaire optionnelle pour quiconque souhaite planifier à l'heure près.

## Ce que vous allez apprendre ici

- Configurer le calendrier du projet : jours ouvrés, horaires de travail, jours fériés.
- Générer automatiquement les jours fériés par année, y compris les congés du bâtiment.
- Ajouter une fermeture ponctuelle et ad hoc (par exemple un arrêt pour gel).
- Donner à une ressource son propre calendrier, par exemple pour une semaine de travail de 4 jours.
- Activer l'interrupteur principal **Planification horaire** et configurer les plages horaires de travail/équipes.
- Comment les tâches en jours et les tâches en heures coexistent dans un même planning.

Suivez [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) (arrêt pour gel, calendrier de ressource à 4 jours) et [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc) (planification horaire pour le ferraillage et le coulage), tous deux également disponibles via **Fichier → Exemples**.

## Le calendrier du projet

Les calendriers se gèrent dans la fenêtre **Calendriers**, ouverte via le groupe de ruban **Calendrier** de l'onglet **Planification** (les boutons **Calendrier** et **Congés** ouvrent tous deux la même fenêtre). Cette fenêtre affiche à gauche une bibliothèque de tous les calendriers du projet — pas seulement le calendrier du projet, mais aussi tout calendrier de ressource (voir ci-dessous) — avec une étoile marquant le calendrier qui est actuellement le **Calendrier du projet**. Sélectionnez un calendrier à gauche et modifiez-le à droite ; utilisez **Définir comme calendrier par défaut du projet** pour faire d'un autre calendrier de la liste le nouveau calendrier du projet. Pour le calendrier sélectionné, vous définissez :

- **Jours ouvrés** — lesquels des sept jours de la semaine (lun. à dim.) comptent comme jour ouvré. Du lundi au vendredi par défaut.
- **Heures de travail** — **Début (heure)**, **Fin (heure)** et les **Heures par jour** qui en résultent.
- **Jours fériés** — une liste de jours de congé, chacun avec une **Description** et une date **Du**/**Au**.

Les modifications apportées au calendrier du projet prennent effet immédiatement dans le calcul : les tâches qui tomberaient autrement sur un jour désormais non ouvré se décalent au jour ouvré suivant.

### Générer automatiquement les jours fériés

Plutôt que de saisir les jours fériés un par un, vous pouvez les générer automatiquement via **Générer les jours fériés…** dans la fenêtre des calendriers. Choisissez un **Pays** (Pays-Bas, Allemagne, Belgique, France, Royaume-Uni, Autriche, Suisse) et éventuellement une **Région**. Pour les Pays-Bas, il existe aussi une option spécifique pour la construction : **Congés du bâtiment**, avec le choix entre **Nord**, **Centre** ou **Sud** (ou **Aucun**). Les dates de congés du bâtiment générées sont des dates indicatives — l'application le signale elle-même : vérifiez les dates exactes auprès de Bouwend Nederland pour l'année en cours. Après avoir choisi le pays/la région, la fenêtre affiche un aperçu — par exemple « 12 jours fériés, 1-1-2026–31-12-2026 » — avant que vous cliquiez sur **Générer**.

Si vous générez des jours fériés pour un projet qui s'étend au-delà d'un changement d'année, ou qui est prolongé ultérieurement, Open Planner Studio détecte que les jours fériés déjà générés ne couvrent plus toute la période du projet, et la fenêtre propose **Régénérer** pour ajouter les années manquantes — sans perdre les jours fériés que vous avez ajoutés manuellement auparavant.

### Fermetures ad hoc (par exemple un arrêt pour gel)

Toute interruption de travail n'est pas un jour férié récurrent annuel. Pour les fermetures ponctuelles, spécifiques au projet — une semaine d'arrêt pour gel, une fermeture liée à un événement local — vous ajoutez simplement une ligne supplémentaire manuellement via **Ajouter un jour férié** dans la même liste : donnez-lui une **Description** (par exemple « Arrêt pour gel ») et une période **Du**/**Au**. Une telle fermeture ad hoc fonctionne techniquement de manière identique à un jour férié généré — le calcul CPM en tient compte de la même façon — mais elle est distincte de la génération annuelle automatique, de sorte qu'une **Régénération** ultérieure ne l'écrasera pas.

Voyez une période d'arrêt pour gel en pratique dans l'exemple [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) : la fondation commune des six maisons comporte une période d'arrêt pour gel ajoutée comme entrée de type jour férié distincte sur le calendrier, en plus des jours fériés néerlandais générés automatiquement.

## Calendriers de ressources

Outre le calendrier unique du projet, chaque ressource peut avoir son propre calendrier — par exemple pour un sous-traitant disponible seulement quatre jours par semaine, tandis que le reste du projet fonctionne cinq jours. Les calendriers de ressources se gèrent via le champ **Calendrier** sur la ressource (avec le bouton **Modifier…** à côté) ou le titre de la fenêtre **Calendrier de la ressource** ; par défaut, une ressource est réglée sur **Calendrier du projet**.

Un calendrier de ressource utilise le même formulaire que le calendrier du projet (**Jours ouvrés**, **Heures de travail**, **Jours fériés**), mais il est purement informatif pour la ressource : il ne change rien aux dates CPM propres de la tâche. Ce qu'il affecte, c'est la **charge** (histogramme) et le **nivellement** : si une ressource est réglée sur une semaine de 4 jours alors que la tâche à laquelle elle est affectée s'étend sur 5 jours ouvrés, la charge de la ressource affiche un déficit le cinquième jour, et la fenêtre de nivellement (**Niveler les ressources**) avertit que la ressource ne travaille pas tous les jours dont la tâche a besoin — un décalage dans la marge ne résoudra pas automatiquement ce désaccord de calendrier.

Voyez un calendrier de ressource à 4 jours en pratique : les installateurs dans [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) fonctionnent sur leur propre calendrier avec une semaine de travail raccourcie, tandis que le reste du projet continue de fonctionner sur le calendrier normal du projet.

## Planification horaire : l'interrupteur principal

Par défaut, Open Planner Studio fonctionne entièrement en **granularité journalière** — chaque tâche a une durée en jours (ouvrés) entiers. Pour les tâches que vous préférez planifier à l'heure (pensez à un coulage qui démarre à 7h00 et doit être terminé à 14h00, bien avant que le temps ne se dégrade), il existe la **Planification horaire** optionnelle.

Activez l'interrupteur principal via **Paramètres → Chronologie / Zoom → Activer la planification horaire**. Cela ajoute une échelle de temps en heures, des équipes avec des plages horaires de travail, et des barres de tâche précises à l'heure près ; l'interrupteur désactivé, l'application fonctionne entièrement comme avant, en granularité journalière. Il existe également une option **Autoriser la planification mixte jour/heure**, que vous activez si vous voulez combiner des tâches en jours et des tâches en heures dans le même projet (voir ci-dessous).

## Plages horaires de travail et équipes

Avec la planification horaire activée, le calendrier reçoit une couche supplémentaire : au lieu de simplement « jour ouvré oui/non », vous définissez des **plages horaires de travail** par jour (la section **Horaires de travail** dans la fenêtre des calendriers) — les créneaux horaires exacts pendant lesquels le travail a lieu. Un intervalle entre deux plages devient automatiquement une pause ; pour planifier une pause, ajustez simplement les horaires des plages adjacentes de sorte qu'un intervalle apparaisse.

Pour éviter d'avoir à dessiner les plages à la main à chaque fois, il existe des **préréglages d'équipe** tout prêts :

- **Équipe de jour** — horaires de bureau habituels, une plage par jour.
- **2 équipes** — deux équipes consécutives.
- **3 équipes** — trois équipes consécutives, couvrant presque toute la journée.
- **Équipe de nuit** — une équipe qui s'étend au-delà de minuit.
- **24/7** — fonctionnement continu, sans interruption.

Outre ces préréglages, vous pouvez aussi **Définir par jour de la semaine…** les plages entièrement à la main, par exemple si le vendredi est plus court que le reste de la semaine. Vous avez composé une combinaison personnelle que vous voulez réutiliser plus souvent ? Enregistrez-la avec **Enregistrer comme préréglage…** — le préréglage est stocké localement sur cet appareil et peut ensuite être repris dans n'importe quel projet. La section affiche également les **Heures/jour dérivées** : le nombre d'heures de travail effectives qui découle des plages configurées.

## Tâches en heures

Avec la planification horaire activée et une tâche sur un **calendrier horaire** (un calendrier avec des plages horaires de travail plutôt que de simples journées entières), la fenêtre de modification de tâche affiche des champs supplémentaires : **Durée (heures)** à côté de **Durée (jours)**, et un total dans **Heures totales**. Un calendrier horaire est requis pour la saisie en heures — essayez de saisir des heures sur un calendrier journalier normal, et l'indication vous le signale.

C'est exactement ainsi que les tâches de coulage sont planifiées en pratique : une tâche « Vloer storten toren A » (Coulage du sol tour A) d'une durée de, disons, 6 heures, liée à un calendrier d'équipe qui a une équipe du matin ce jour-là. Voyez ce schéma dans le grand exemple [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc), qui utilise la planification horaire pour le ferraillage et les travaux de coulage.

## Mélanger tâches en jours et tâches en heures

Un projet n'a pas besoin de fonctionner entièrement à l'heure pour bénéficier de la planification horaire : avec **Autoriser la planification mixte jour/heure** cochée, les tâches en jours (sur le calendrier normal du projet) et les tâches en heures (sur un calendrier horaire) peuvent coexister et se relier entre elles dans le même planning. Dans ce cas, le tableau des tâches affiche la durée de chaque tâche dans sa propre unité — une tâche en jours en jours, une tâche en heures en heures — et avertit en bas du tableau lorsque des tâches avec des heures/jour différentes s'exécutent côte à côte, afin qu'il reste clair quelles comparaisons sont valables et lesquelles ne le sont pas.

## Poursuivre la lecture

- Voyez un arrêt pour gel et un calendrier de ressource à 4 jours en pratique : [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc).
- Voyez la planification horaire pour le ferraillage et le coulage en pratique : [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc).
- Les relations et le décalage/l'avance utilisent les mêmes unités de calendrier — lisez [Relations & contraintes](docs://gids-relaties-constraints) pour la différence entre le décalage en jours ouvrés et en temps écoulé.
