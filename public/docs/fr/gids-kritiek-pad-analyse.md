# Chemin critique & analyse avancée

Chaque planning a une chaîne de tâches la plus longue qui détermine ensemble la date de fin du projet : le chemin critique. Tout ce qui se trouve en dehors a de la marge — de la place pour glisser sans toucher la date de fin. Ce guide va au-delà de « quelles barres sont rouges » : marge totale/libre/interférente, travail quasi critique, plusieurs chemins également critiques, hammocks, verrouillages durs et leur effet en amont, et liens externes entre projets.

## Ce que vous allez apprendre ici

- Lire le chemin critique, et la différence entre marge totale, libre et interférente.
- Le travail quasi critique : définir le seuil et reconnaître le marquage ambre.
- Plusieurs chemins critiques à la fois — quand cela se produit et comment le voir.
- Les verrouillages durs et leur effet sur la marge, y compris la marge négative apparaissant en amont.
- Les hammocks (Level of Effort) : ce qu'ils font et ne font pas.
- Les liens externes entre projets : l'ancrage figé, l'actualisation, et le statut « source manquante ».
- Tracer un chemin via le menu contextuel ou le ruban.
- La section **Calcul** dans les paramètres du projet.

Suivez [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc) — le grand cas d'usage « boîte à outils complète » avec trois tours parallèles qui illustre presque tous les sujets de ce guide : plusieurs chemins critiques, du travail quasi critique, un hammock, un verrouillage dur et un lien externe vers un fichier source séparé.

## Lire le chemin critique

Appuyez sur **F5** (ou le bouton **Calculer**) pour exécuter le planning. La barre d'état en bas affiche alors, par exemple, « Chemin critique : N tâches, M jours ouvrés » — le nombre de tâches sur le chemin critique et la durée totale. Dans le diagramme de Gantt, les tâches critiques reçoivent leur propre couleur de barre (rouge) : des tâches sans marge, où chaque jour de retard repousse directement la date de fin du projet.

Double-cliquez sur une tâche et regardez dans la section **Résultat CPM** pour les chiffres exacts : **Début au plus tôt**, **Fin au plus tôt**, **Début au plus tard**, **Fin au plus tard**, **Marge totale**, **Marge libre** et (le cas échéant) **Marge interférente**, ainsi que si la tâche est sur le **Chemin critique**. Vous voulez ces champs comme colonnes dans le tableau des tâches ? **Affichage → Colonnes…** et cochez-les.

### Marge totale, libre et interférente

- **Marge totale** — de combien une tâche peut glisser au total sans toucher la date de fin du projet. Zéro signifie critique.
- **Marge libre** — de combien une tâche peut glisser sans toucher son tout prochain successeur. Peut être inférieure à la marge totale : une tâche peut avoir une certaine marge totale, mais si elle glisse d'un seul jour, son successeur immédiat bouge déjà lui aussi (ce successeur a alors suffisamment de marge propre pour ne pas toucher la date de fin).
- **Marge interférente** — la différence entre les deux (marge totale − marge libre) : la partie de votre marge qui ne touche pas la date de fin mais qui « gêne » tout de même un successeur. Zéro signifie que la marge libre et la marge totale sont égales — glisser dans votre marge n'affecte alors personne.

## Travail quasi critique

Une tâche avec une petite marge totale non nulle est vulnérable : un léger contretemps la rend critique après tout. Activez cela via **Info projet → Calcul → Marquer quasi critique**, avec un **Seuil** en jours ouvrés (ou en heures, selon votre affichage de la durée). Chaque tâche avec une marge totale supérieure à zéro et inférieure ou égale à ce seuil reçoit une couleur de barre ambre dans le Gantt — entre le rouge du critique et le vert d'une marge ample.

Le grand exemple règle le seuil à 3 jours ouvrés. L'inspection finale de la **Tour C** a donc exactement 3 jours ouvrés de marge totale — juste dans le seuil — tandis que les inspections finales identiques des **Tour A** et **Tour B** sont à marge nulle et sont réellement critiques. La Tour C est identique aux deux autres en tâches et durées, à l'exception d'une tâche de finition légèrement plus courte ; cette petite différence suffit exactement à la faire passer de critique à quasi critique.

## Plusieurs chemins critiques

Normalement, il existe exactement une chaîne la plus longue, mais il peut arriver que deux chaînes ou plus aient exactement la même longueur — elles sont alors toutes également critiques. Activez **Plusieurs chemins de marge** (**Info projet → Calcul**) pour faire calculer cela : choisissez la **Méthode** (**Marge libre (peeling)** ou **Marge totale (classement)**) et un nombre de **Chemins max.**. Chaque tâche reçoit alors un numéro de **Chemin de marge** (1 = le plus critique) ; une tâche sans chemin de marge ne se trouve sur aucun des chemins calculés.

Dans le grand exemple, la Tour A et la Tour B sont entièrement symétriques en tâches et durées — elles se terminent exactement en même temps. Dès que vous activez **Plusieurs chemins de marge**, vous verrez plus d'un chemin dans les résultats (`criticalPaths.length` supérieur à 1 dans le calcul) : pas une seule chaîne la plus longue, mais plusieurs chaînes également critiques qui traversent le projet. C'est un signal différent de « un chemin critique avec un peu de travail quasi critique à côté » — cela signifie qu'un retard sur *n'importe lequel* de ces chemins affecte également la date de fin, donc vous ne pouvez pas concentrer votre attention sur une seule chaîne.

## Verrouillages durs et leur effet sur la marge

Un **verrouillage dur** (la case à cocher **Obligatoire (logique de verrouillage)** sur une contrainte MSO ou MFO) fixe une tâche à une date, même si ses prédécesseurs la contredisent logiquement. Le grand exemple utilise cela sur « Wegafzetting gemeente (vergunde stremmingsperiode) » (fermeture de voirie communale, période de fermeture autorisée) : la commune n'autorise la fermeture qu'exactement à cette date accordée, un point c'est tout — la logique du réseau se plie autour.

L'effet en amont est la partie délicate à comprendre : si les prédécesseurs d'une tâche verrouillée ont besoin de plus de temps que ce qui est disponible jusqu'à la date de verrouillage, une **marge négative** apparaît sur ces prédécesseurs. La marge négative n'est donc pas une erreur de calcul : c'est la façon dont le moteur vous dit « cette chaîne précédente ne tient plus dans le temps que le verrouillage autorise ». Si vous voyez une marge négative en amont d'un verrouillage dur, la question n'est pas « qu'est-ce qui est cassé ici » mais « lequel de ces deux éléments doit céder : la date de verrouillage, ou la durée de la chaîne qui la précède ».

Remarque : dans le grand exemple, toute la chaîne autour de « Wegafzetting gemeente » — y compris la tâche verrouillée elle-même — est depuis longtemps entièrement terminée (début et fin réels, bien avant la date de statut). De ce fait, vous verrez une petite marge négative résiduelle sur toute la chaîne de la phase 1 à cet endroit, y compris sur la tâche de verrouillage elle-même : c'est une caractéristique des tâches déjà terminées combinées à une date de statut, pas le scénario « les prédécesseurs ne tiennent pas » décrit ci-dessus. Pour voir ce scénario sous sa forme pure : effacez temporairement la date de statut (groupe de ruban **Baselines et avancement**, bouton **Effacer la date de statut**) et recalculez — la tâche de verrouillage elle-même revient alors à une marge totale nulle, et une marge négative n'apparaît qu'une fois que vous rendez délibérément la chaîne précédente plus longue que la place disponible avant la date de verrouillage.

## Hammocks (Level of Effort)

Un **hammock** (la case à cocher **Hammock (durée dérivée)** dans le panneau des propriétés) est une tâche sans saisie de durée propre : son début et sa fin découlent automatiquement de ses propres relations. Les relations entrantes **FS**/**SS** fournissent le **driver de début** (le début le plus précoce), les relations entrantes **FF**/**SF** fournissent le **driver de fin** (la fin la plus tardive) — le panneau affiche les deux en lecture seule dès que vous cochez la case hammock, afin que vous puissiez voir exactement quelles tâches déterminent l'intervalle. Sans driver de fin, l'intervalle revient à une longueur nulle, avec un avertissement dans le panneau.

Ce que fait un hammock : il montre, comme une sorte de barre englobante, l'intervalle complet d'un morceau de travail sans que vous ayez à maintenir vous-même une durée — pratique pour, disons, « supervision » ou « frais généraux de chantier » qui s'étendent littéralement aussi longtemps que le travail sous-jacent. Ce qu'un hammock ne fait pas : il ne porte aucune ressource ni logique propre qui affecte le calcul CPM — c'est une vue dérivée, pas une tâche déterminante. Le grand exemple utilise cela pour « Ruwbouw toren A (LOE) » (gros œuvre, Tour A) : un hammock qui démarre dès que la première vraie tâche de gros œuvre de la Tour A commence et se termine dès que la dernière est terminée, sans se situer lui-même nulle part entre les deux.

## Liens externes entre projets

Les grands projets se composent parfois de plusieurs sous-plannings gérés séparément — par exemple votre propre planning maître et un lot de travaux de voirie géré par un autre entrepreneur. Un **lien externe** (la fenêtre **Lien externe (inter-projets)**, ouverte via le bouton de l'onglet **Relations**) enregistre une relation vers une tâche d'un tel autre fichier, sans avoir à ouvrir ce fichier comme document.

Vous choisissez un **Fichier source** parmi vos fichiers récents (celui-ci est lu en lecture seule, jamais ouvert comme document) ou vous remplissez la solution **Manuelle** avec un identifiant de projet, un identifiant de tâche et une date d'ancrage si vous n'avez pas le fichier source sous la main. Vous choisissez ensuite la **Direction** (prédécesseur ou successeur), le **Type de relation** (FS/SS/FF/SF) et un **Décalage**. La **Date d'ancrage** — la date de la tâche source au moment où vous l'avez liée — est figée dans votre propre fichier ; cette date ne suit pas automatiquement si le projet source change.

Vous voulez savoir si le fichier source a été mis à jour depuis ? Allez sur l'onglet **Relations**, section **Liens externes**, et cliquez sur **Actualiser ce lien** (par lien) ou **Actualiser les ancrages externes** (tous à la fois) pour relire le fichier source et mettre à jour l'ancrage. Si le fichier source n'est pas disponible — déplacé, renommé, ou jamais fourni — le lien affiche l'étiquette **obsolète** avec l'infobulle « source non chargée — réimportez pour actualiser » : l'application ne peut alors pas vérifier elle-même si l'ancrage figé tient toujours.

Le grand exemple démontre délibérément exactement ce dernier cas : la tâche « Bestrating parkeerterrein » (revêtement du parking) est liée à un fichier source d'un sous-traitant de voirie qui n'est délibérément *pas* fourni avec l'exemple. Ouvrez la tâche et vous verrez le lien listé avec le statut « obsolète » — une démonstration honnête de ce qui se passe lorsqu'un fichier source externe n'est plus disponible, plutôt qu'un lien qui s'actualise toujours parfaitement.

## Tracer un chemin

Vous voulez voir exactement quelles tâches affectent une tâche donnée en amont et en aval ? Cliquez avec le bouton droit sur la tâche et choisissez **Tracer le chemin** (ou **Arrêter le traçage du chemin** pour le désactiver de nouveau) — cela met en surbrillance toute la chaîne de prédécesseurs et de successeurs en une fois. Pour un travail plus ciblé, le ruban (onglet **Planification** ou **Relations**, groupe de ruban **Traçage du chemin**) dispose d'une paire de boutons séparée **Prédécesseurs**/**Successeurs** : les deux désactivés n'affiche rien, un activé affiche cette direction, les deux activés équivaut à la commande du menu contextuel. Le traçage distingue également toutes les tâches logiquement connectées des tâches qui déterminent réellement la date (la même relation « Déterminante » affichée dans le tableau des relations) — vous voyez donc non seulement ce qui est connecté, mais ce qui pilote réellement.

## Paramètres de calcul

La section **Calcul** dans **Info projet** (Backstage → Info projet, ou la fenêtre **Info projet**) rassemble les options de calcul propres à ce projet précis — elles appartiennent au fichier, pas à l'application, de sorte qu'un collègue ouvrant le même fichier obtient le même résultat :

- **Définition du critique** — **Marge totale ≤ seuil** (seuil par défaut 0) ou **Chemin le plus long**, qui marque les tâches comme critiques en se basant sur la chaîne la plus longue du réseau, indépendamment de leur valeur de marge.
- **Calcul de la marge** — comment la marge totale est déterminée pour une tâche ayant à la fois un côté début et un côté fin : **Le plus petit (début/fin)** (par défaut), **Marge de début** ou **Marge de fin**.
- **Tâches à extrémité ouverte critiques** — traiter automatiquement comme critiques les tâches sans successeur.
- **Marquer quasi critique** avec **Seuil** (voir ci-dessus).
- **Plusieurs chemins de marge** avec **Méthode** et **Chemins max.** (voir ci-dessus).
- **Calendrier de décalage** — quel calendrier un décalage en jours ouvrés utilise : celui du **Prédécesseur**, celui du **Successeur**, toujours **24 heures**, ou le **Calendrier du projet**.

## Poursuivre la lecture

- Voyez plusieurs chemins critiques, du travail quasi critique, un hammock, un verrouillage dur et un lien externe, tous dans un seul planning : [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc).
- Les relations, le décalage/l'avance et les contraintes (y compris le verrouillage dur) sont expliqués plus en profondeur dans le guide [Relations & contraintes](docs://gids-relaties-constraints).
- Le nivellement peut changer la structure du chemin critique — lisez le guide [Ressources, histogramme & nivellement](docs://gids-resources-histogram).
- L'avancement et une date de statut peuvent produire une marge négative sur une tâche déjà fixée — lisez le guide [Baselines & avancement](docs://gids-baselines-voortgang).
