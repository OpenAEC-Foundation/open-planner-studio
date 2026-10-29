# Colonnes du tableau

Le tableau des tâches contient 86 colonnes fixes, plus une colonne par code d’activité et par champ personnalisé du projet, et huit colonnes par référence. Cet article indique, pour chaque colonne, ce qu'elle affiche, si vous pouvez la modifier et sous quelle forme la valeur est écrite. Le choix et l'ordre des colonnes sont expliqués dans [Personnaliser les colonnes du tableau](docs://howto-tabelkolommen-aanpassen).

## Où vous choisissez les colonnes

Le tableau des tâches à côté du Gantt et le tableau de l'onglet *Tableau* ont chacun leur propre choix de colonnes. Le signe plus à droite de l'en-tête ouvre le sélecteur de colonnes (titre de la fenêtre : *Choisir une colonne*). Sur l'onglet *Tableau*, vous pouvez aussi utiliser *Tableau › Colonnes › Colonnes…*. Le sélecteur affiche les colonnes par catégorie : *Tâche*, *Planification*, *Contraintes*, *Relations*, *Ressources*, *Avancement*, *Calculé*, *Référence*, *Personnalisé* et *Technique*. Vous cherchez par nom, et *Utilisées récemment* se trouve en haut. *Réinitialiser par défaut* rétablit les colonnes par défaut.

Par défaut, le tableau à côté du Gantt affiche *WBS*, *Nom de tâche* et *Durée*. Le tableau de l'onglet *Tableau* affiche *WBS*, *Nom de tâche*, *Durée*, *Début*, *Fin*, *Catégorie de travaux*, *Critique*, *Marge totale* et *Avancement*, ainsi qu'une colonne par code d’activité et par champ personnalisé du projet.

## Comment les valeurs sont lues et modifiées

- **Colonnes calculées** — les colonnes de la catégorie *Calculé* et plusieurs autres sont en lecture seule : elles proviennent du calcul. Si vous essayez de modifier une cellule en lecture seule, l'application affiche *Cette colonne calculée ne peut pas être modifiée.* Ce texte est le message général pour chaque cellule en lecture seule, aussi lorsque la colonne n'est pas calculée. Si elles sont obsolètes parce que vous avez modifié quelque chose, *obsolète* apparaît à côté jusqu'à ce que vous choisissiez *Calculer*.
- **Dates** — apparaissent dans la notation que vous avez choisie sous *Paramètres de l'app*, onglet *Apparence*, rubrique *Format de date*.
- **Durées et marges** — une durée apparaît dans l'unité de la tâche (`5d`, `12h`), ou selon *Affichage de la durée* sur le même onglet (*Automatique (unité propre à chaque tâche)*, *Toujours en jours* ou *Toujours en heures*). La marge apparaît en jours ouvrés avec deux décimales et avec le séparateur décimal de votre langue.
- **Oui/non** — une valeur oui/non apparaît comme *Oui* ou *Non* ; une valeur vide apparaît comme un tiret (—).
- **Modification** — saisissez ou choisissez une valeur. Une valeur non valide est refusée, avec une raison sous la cellule, par exemple *Saisissez une durée valide, par exemple 5d ou 8h.* ou *Saisissez un pourcentage entre 0 et 100.* Le collage d'un bloc de cellules se fait cellule par cellule ; les cellules en lecture seule sont ignorées et l'application indique combien il y en a.

## Tâche

- **Nom de tâche** — le nom de la tâche. Modifiable ; obligatoire. Une tâche récapitulative s'affiche en gras, avec un fond légèrement teinté dans la cellule du nom ; un jalon s'affiche en gras dans la couleur des jalons (la même famille de couleurs que le jalon dans le Gantt). Une tâche ordinaire ne change pas. Il ne s'agit que de mise en forme : la sélection, le glissement et la modification fonctionnent de la même façon.
- **Description** — la description. Modifiable ; texte libre.
- **WBS** — le code WBS. Modifiable et obligatoire, mais en lecture seule tant que *WBS auto* est activé.
- **Catégorie de travaux** — la catégorie de travaux (*Construction*, *Installation*, *Démolition*, *Logistique*, *Inspection*, *Déplacement*, *Rénovation*, *Maintenance* ou *Autre*). Modifiable avec une liste.
- **Catégorie de travaux personnalisée** — la catégorie de travaux personnalisée du projet, ou un tiret. Modifiable avec une liste des catégories de travaux personnalisées du projet.
- **Couleur** — la couleur enregistrée de la tâche, sous forme de code couleur, par exemple `#1a73e8`. Modifiable avec un sélecteur de couleur. Elle est enregistrée dans le fichier IFC, mais aucune barre ni aucun rapport ne l'utilise ; vous définissez les couleurs des barres sous *Affichage › Références et avancement › Couleurs des barres*.
- **Notes** — les notes, sous la forme `✓ text; ○ text`. Modifiable tant qu'il y a au plus une note (vous modifiez alors son texte) ; avec davantage de notes, en lecture seule.

## Planification

- **Jalon** — indique si la tâche est un jalon. Modifiable. Si vous l'activez, la durée devient 0 ; l'application le refuse pour une tâche récapitulative et pour une tâche avec des affectations.
- **Type de jalon** — *Jalon de début* ou *Jalon de fin*, ou un tiret pour automatique. Modifiable uniquement sur un jalon.
- **Jalon obligatoire** — l'indicateur *Obligatoire (contractuel)*. Modifiable uniquement sur un jalon.
- **Priorité de nivellement** — un nombre entier de 0 à 1000, 500 par défaut. Modifiable. 1000 verrouille la tâche pour le nivellement.
- **Écarts de fractionnement** — le nombre d'interruptions, sous la forme `Split gaps: 2`, ou un tiret. En lecture seule ; vous les modifiez dans le volet *Propriétés*.
- **Type de tâche** — le type de la tâche ; vide correspond à la valeur par défaut du projet. Modifiable avec une liste, mais vide et en lecture seule sur un jalon, une tâche récapitulative ou un hamac. Visible dans le sélecteur uniquement lorsque les types de tâche sont visibles (*Utiliser les types de tâche*, ou lorsque le fichier contient des types de tâche).
- **Hamac (durée dérivée)** — indique si la tâche est un hamac. Modifiable, sauf sur un jalon ou une tâche récapitulative.
- **Calendrier** — l'identifiant du calendrier propre à la tâche ; vide (—) correspond au calendrier du projet. Vous saisissez ou choisissez un identifiant parmi les suggestions ; un identifiant inconnu est refusé. Remarque : la cellule affiche pour l'instant l'identifiant interne au lieu du nom ; choisissez de préférence un calendrier dans le volet *Propriétés*.
- **Type de durée** — *Temps de travail* (la durée s'exprime en jours ouvrés ou en horaires de travail du calendrier) ou *Temps écoulé* (la durée se mesure en temps d'horloge continu, sans calendrier). Modifiable.
- **Unité de durée** — *Jours* ou *Heures*. Modifiable, sauf sur une tâche récapitulative, un hamac ou un jalon ; le changement n'est possible que si la conversion est exacte et si *Activer la planification horaire* est activé.
- **Durée** — la durée de la tâche, dans l'unité de la tâche ou selon *Affichage de la durée*. Modifiable : saisissez `5d`, `12h` ou `1h 30m` ; un nombre dans l'unité de la tâche est aussi accepté. En lecture seule sur une tâche récapitulative, un hamac et un jalon de durée 0.
- **Début** — le début affiché, à la même date que la barre du Gantt. Pour une tâche qui a commencé, c'est le début réel. Modifiable. Une tâche avec un prédécesseur à laquelle vous donnez un nouveau début reçoit la contrainte *Début au plus tôt le (SNET)* à cette date. En lecture seule sur une tâche récapitulative ou un hamac, sauf si elle est planifiée manuellement, et sur une tâche qui a commencé (*Cette tâche a commencé ; son début est le début réel. Modifiez-le via l’avancement.*).
- **Fin** — la fin affichée. Pour une tâche terminée, c'est la fin réelle. Modifiable : une nouvelle fin devient une nouvelle durée. L'application la refuse pour un jalon, une tâche en temps écoulé et une tâche avec interruptions, ainsi que pour une fin antérieure au début (*La fin est antérieure au début.*). En lecture seule sur une tâche récapitulative ou un hamac, sauf si elle est planifiée manuellement, et sur une tâche terminée (*Cette tâche est terminée ; sa fin est la fin réelle. Modifiez-la via l’avancement.*).
- **Début planifié** — le point d'ancrage de la planification à partir duquel le calcul démarre (pas forcément le début affiché). Modifiable ; même effet que la saisie dans *Début*.
- **Fin planifiée** — la fin saisie. Modifiable uniquement sur une tâche planifiée manuellement ; sinon l'application affiche *La fin planifiée ne s’applique qu’à une tâche planifiée manuellement. Modifiez la fin via la colonne Fin ou via la durée.*

## Contraintes

- **Type de contrainte** — le type de la contrainte, de *Dès que possible (ASAP)* à *Doit finir le (MFO)*. Modifiable ; une tâche sans contrainte affiche *ASAP*.
- **Date de contrainte** — la date de la contrainte. Modifiable.
- **Contrainte stricte** — l'indicateur *Obligatoire (logique de verrouillage)*. Modifiable uniquement sur *MSO* et *MFO*.
- **Type de contrainte secondaire** — le type de la seconde borne, ou un tiret. Modifiable ; le tableau propose tous les types, mais une combinaison non autorisée est refusée : la contrainte secondaire doit être *SNET*, *FNET*, *SNLT* ou *FNLT*, la contrainte principale doit être une borne (pas *ASAP*, *ALAP*, *MSO*, *MFO* ni une contrainte stricte), et les deux doivent se trouver de part et d'autre (une borne inférieure *SNET*/*FNET* avec une borne supérieure *SNLT*/*FNLT*, ou l'inverse).
- **Date de contrainte secondaire** — la date de la seconde borne. Modifiable.
- **Échéance** — la date cible de la fin. Modifiable.

## Relations

- **Prédécesseurs** — les prédécesseurs, sous la forme `WBS type±lag`, séparés par `; `, par exemple `1.2 FS+2d`. Modifiable en saisissant la même forme. Vous n'ajoutez pas de relation externe ici, mais avec *Planification › Relations › Lier › Ajouter une relation externe…*.
- **Successeurs** — les successeurs, sous la même forme. Modifiable.
- **Relations déterminantes** — les relations qui fixent la date de cette tâche, sous la forme `← 1.2` (prédécesseur) ou `→ 1.4` (successeur). En lecture seule ; elles restent *obsolètes* jusqu'à ce que vous choisissiez *Calculer*.
- **Marge libre** (dans la catégorie *Relations*) — la marge libre par relation, sous la forme `← 1.2: 3d`. Ce n'est pas la même colonne que *Marge libre* dans *Calculé*, qui affiche la marge de la tâche elle-même. En lecture seule.
- **Avertissements** — avertissements par relation, par exemple *Hors séquence* ou *Non pris en compte dans le calcul*. En lecture seule. Voir [Notifications et avertissements](docs://ref-meldingen).

## Ressources

- **Ressources affectées** — les noms des ressources affectées, séparés par des virgules. Modifiable : ajouter un nom affecte la ressource à raison de 1 unité par jour, supprimer un nom supprime l'affectation. En lecture seule sur un jalon ou une tâche récapitulative.
- **Unités d’affectation par jour** — les unités par ressource, sous la forme `Name: 1; Name: 0.5`, avec au plus deux décimales. La valeur enregistrée reste exacte. Modifiable sur une tâche avec des affectations.
- **Unités planifiées par jour** — le taux planifié par ressource, sous la forme `Name: 1.11`, avec au plus deux décimales, comme *Unités d’affectation par jour*. Uniquement pour une affectation issue de Primavera P6 avec un taux restant différent ; *Unités d’affectation par jour* affiche alors le taux restant. En lecture seule.
- **Courbe d’affectation** — la courbe par ressource, sous la forme `Name: Uniform`. Modifiable sur une tâche avec des affectations.
- **Début de la fenêtre de travail** et **Fin de la fenêtre de travail** — la fenêtre de travail par ressource, issue d'un fichier importé, sous la forme `Name: date`. En lecture seule.
- **Travail prévu (heures)** et **Travail réel (heures)** — le travail prévu et le travail réel par ressource, en heures, sous la forme `Name: 617.14`, avec au plus deux décimales, issus d'un fichier importé. En lecture seule.
- **Travail restant (heures)** — le travail restant par ressource, en heures, sous la forme `Name: 6` ou `Name: 26.67` : le travail enregistré, sinon la durée restante × unités. Modifiable sur une tâche avec des affectations auxquelles un type de tâche s'applique, avec une virgule ou un point comme séparateur décimal. Visible dans le sélecteur uniquement lorsque les types de tâche sont visibles. Un ⚠ jaune dans la cellule signifie que le travail enregistré diffère de unités × durée restante, comme le ⚠ à *Travail (rest.)* dans le volet de la tâche.

## Avancement

- **Statut** — *Non démarrée*, *En cours* ou *Terminée*. Modifiable, sauf sur une tâche récapitulative.
- **Avancement** — le pourcentage, sous la forme `40%`. Modifiable avec un nombre de 0 à 100, sauf sur une tâche récapitulative.
- **Début réel** — la date de début de la tâche. Modifiable, sauf sur une tâche récapitulative.
- **Fin réelle** — la date à laquelle la tâche a été terminée. Modifiable, sauf sur une tâche récapitulative.
- **Durée réelle** — la durée réelle, sous forme de nombre. Modifiable, sauf sur une tâche récapitulative.
- **Restant** — la durée restante, dans l'unité de la tâche. Modifiable, sauf sur une tâche récapitulative.
- **Date de reprise** et **Date d'arrêt** — la reprise et l'arrêt d'une tâche en cours, issus d'un fichier MS Project ou Primavera. En lecture seule.

Les colonnes d'avancement suivent les règles d'avancement de l'application : une date réelle postérieure à la date d’état est refusée. Sur une tâche récapitulative, l'application affiche *L'avancement d'une tâche récapitulative est dérivé de ses sous-tâches et ne peut pas être modifié ici.*

## Calculé

Toutes les colonnes de cette catégorie sont en lecture seule.

- **Retard de nivellement** — de combien de jours ouvrés le nivellement a retardé la tâche ; un tiret si aucun nivellement n'a été appliqué.
- **Début au plus tôt** et **Fin au plus tôt** — les dates au plus tôt issues du calcul. Pour une tâche qui a commencé, elles peuvent différer de *Début* et *Fin* : le profil de calcul *Primavera P6* place le début au plus tôt d'une tâche en cours ou terminée à la date d'état.
- **Début au plus tard** et **Fin au plus tard** — les dates au plus tard auxquelles la tâche peut encore commencer ou se terminer sans retarder le projet.
- **Marge libre** — les jours ouvrés dont la tâche peut glisser sans retarder un successeur.
- **Marge totale** — les jours ouvrés dont la tâche peut glisser sans retarder la fin du projet. Négative si une contrainte ou une échéance ne peut pas être respectée.
- **Critique** — *Oui* si la tâche se trouve sur le chemin critique.
- **Marge interférente** — marge totale moins marge libre.
- **Quasi critique** — *Oui* pour une tâche quasi critique. Rempli uniquement si *Marquer quasi critique* est activé (*Paramètres du projet*, bloc *Profil de calcul et options*) ; sinon un tiret.
- **Chemin de marge** — le numéro du chemin de marge, 1 pour le plus critique. Rempli uniquement si *Plusieurs chemins de marge* est activé ; sinon un tiret.
- **Source des dates enregistrées** — tant que l'application affiche les dates du fichier : *Partiellement non enregistré* sur une tâche dont le fichier ne contient pas tout. Visible dans le sélecteur uniquement dans cette vue. Sur un axe non enregistré, *Non enregistré* apparaît dans les colonnes des dates au plus tard et des marges.

Voir [Chemin critique et marge](docs://uitleg-kritiek-pad).

## Référence

Pour chaque référence du projet, des colonnes sont ajoutées, avec le nom de la référence devant le nom de la colonne (`<baseline> — Scheduled start`). Elles sont en lecture seule. Une tâche absente de la référence affiche un tiret, avec l'info-bulle *Absent de cette référence*.

- **Début planifié**, **Fin planifiée** et **Durée** — le début, la fin et la durée telles que la référence les a enregistrés.
- **Écart de début** et **Écart de fin** — le nombre de jours ouvrés entre la référence et le début ou la fin affiché, dans le calendrier du projet ; positif si la tâche est plus tardive.
- **Écart de durée** — la durée courante moins la durée de la référence, en jours ouvrés.

## Personnalisé

- **Code d’activité** — une colonne par code d’activité, avec le nom du code. Affiche le code de la valeur choisie. Modifiable : vous saisissez le code ou le choisissez parmi les suggestions ; un code inconnu est refusé, et si un code apparaît plus d'une fois, l'application vous demande de le choisir dans la liste.
- **Champ personnalisé** — une colonne par champ personnalisé, avec son nom. La saisie correspond au type : texte, nombre, entier, coût, date ou oui/non. Modifiable.

Ces colonnes appartiennent au projet dans lequel se trouve le code ou le champ. Voir [Codes et champs personnalisés](docs://howto-codes-en-velden).

## Technique

Toutes les colonnes de cette catégorie sont en lecture seule. Elles affichent des données que l'application enregistre sans les montrer dans une colonne ordinaire, par exemple pour vérifier un import.

- **ID de tâche** — l'identifiant interne de la tâche.
- **ID de la tâche parente** et **ID des tâches enfants** — les identifiants de la tâche parente et des tâches enfants.
- **ID des ressources** — les identifiants des ressources de la tâche.
- **ID d’affectation**, **ID de tâche d’affectation** et **ID de ressource d’affectation** — les identifiants des affectations, des tâches et des ressources de cette tâche.
- **Durée (minutes)** et **Restant (minutes)** — la durée et la durée restante en minutes ; rempli uniquement sur une tâche en heures.
- **Retard de nivellement (minutes)** et **Retard de nivellement en temps écoulé** — le retard de nivellement issu de MS Project en minutes, et l'indication s'il se mesure en temps d'horloge.
- **Planifiée manuellement** — indique si la tâche est planifiée manuellement.
- **Type de tâche MS Project (import)** et **Piloté par l’effort** — le type de tâche et l'indicateur piloté par l'effort tels que MS Project les avait.
- **Provenance Primavera P6** — les champs source d'un fichier Primavera, sous la forme `key: value`.
- **Tâche récapitulative explicite** — indique si la tâche est une récapitulative explicite sans sous-tâches (issue d'un fichier Primavera).
- **Plancher de fin phasé**, **Ancrage de début phasé**, **Segments de durée phasés** et **Profils phasés** — la répartition horaire issue d'un fichier MS Project, sous forme de dates et de nombres.
- **Données de code d’activité**, **Données de champ personnalisé** et **Données de note** — le nombre d'affectations de codes, de champs personnalisés et de notes.
- **Données de relations internes** et **Données de relations externes** — le nombre de relations internes et externes.
- Pour chaque référence, **Jalon** et **Type de jalon** figurent aussi ici, tels que la référence les a enregistrés.
