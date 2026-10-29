# Formats d'import et d'export

Par format de fichier : si vous pouvez l'ouvrir, l'enregistrer et l'exporter, ce qui est repris ou non, et avec quel profil de calcul il s'ouvre. Le pourquoi de tout cela, avec un exemple chiffré, se trouve dans [Fichiers et formats](docs://uitleg-bestanden).

## En bref

**Ouverture** : IFC, CSV, MS Project XML, Primavera P6 XML, `.mpp` et `.xer` s'ouvrent. Un fichier avec une autre extension est traité par l'application comme un IFC.

**Enregistrement** écrit toujours un fichier IFC. Seul un fichier IFC ouvert devient la cible d'enregistrement ; un projet provenant d'un autre format n'a pas de fichier après l'ouverture, et *Enregistrer* demande alors où le fichier IFC doit être placé.

**Exportation** est possible vers IFC, MS Project XML, Primavera P6 XML, CSV et deux feuilles d'avancement (Excel et CSV). Une exportation ne modifie pas votre projet.

**Lecture seule** : les fichiers `.mpp` et `.xer`. L'application peut les ouvrir, mais pas les écrire.

**PDF** provient uniquement d'un rapport (voir [Types de rapport](docs://ref-rapporttypes)). L'application ne lit pas le PDF.

**Où.** Ouvrir : *Accueil › Fichier › Ouvrir*, *Fichier › Ouvrir* ou Ctrl+O. Exporter : *Accueil › Fichier › Exporter* ou *Fichier › Exporter*. Vous importez une feuille d'avancement remplie via *Fichier › Importer*, ou avec le bouton *Mettre à jour l'avancement depuis une feuille* dans le groupe de ruban *Avancement*, sur les onglets *Planification*, *Tableau* et *Rapport*.

**Profil de calcul à l'ouverture.** Chaque format s'ouvre avec un profil de calcul ; ce que c'est est expliqué dans [Options de calcul et conventions](docs://ref-rekenopties-en-conventies). `.xer` s'ouvre avec *Primavera P6*, `.mpp` avec *Microsoft Project*, et CSV, MS Project XML et P6 XML avec *Open Planner Studio*. IFC garde le profil enregistré dans le fichier. Pour `.xer` et `.mpp`, l'application indique que le projet calcule de cette façon. Seul IFC contient le profil de calcul et les options de calcul ; parmi les options de calcul, MS Project XML écrit au maximum le seuil critique. Une exportation réouverte d'un autre format calcule comme *Open Planner Studio*.

## IFC

**Ouverture** — oui, `.ifc`. L'application lit IFC4 et IFC 4.3 (également ADD2). Un fichier dans un autre schéma, comme IFC2X3, s'ouvre aussi. Lors du premier enregistrement, vous choisissez alors un schéma que l'application peut écrire (voir [Choisir le schéma IFC](docs://howto-ifc-schema-kiezen)). Profil de calcul : celui du fichier.

**Enregistrement** — oui, et c'est le seul format qui s'enregistre. *Enregistrer* écrit tout votre projet dans un fichier IFC, dans le schéma IFC du projet (par défaut IFC 4.3 ADD2). Le fichier devient la cible d'enregistrement.

**Exportation** — oui, comme *IFC*, dans le schéma IFC du projet (par défaut IFC 4.3 ADD2). Nom par défaut : le nom du projet avec l'extension `.ifc`. Si votre projet est lié à une bibliothèque de ressources, la case *Enregistrer aussi le fichier de bibliothèque* se trouve sous les cartes dans *Fichier › Exporter*. Si la case est cochée, l'application demande un emplacement pour *nom-du-projet-bibliotheek.ifc*, après le projet. La case ne figure pas dans la liste de l'onglet *Accueil*.

**Ce qui est repris** — tout ce qui appartient au projet : tâches avec structure, durée, dates et avancement ; relations avec décalage ; contraintes et échéances ; calendriers ; ressources et affectations, y compris la répartition horaire ; références ; codes d'activité et champs personnalisés ; notes ; relations externes vers d'autres projets ; interruptions ; types de tâche et catégories de travaux personnalisées ; les paramètres du projet, comme la date d'état, le mode d'avancement, le profil de calcul et les options de calcul ; la connexion avec une bibliothèque de ressources. Pour un projet issu d'un `.xer`, le fichier source d'origine est aussi repris. Une catégorie de travaux personnalisée est enregistrée comme type IFC `USERDEFINED`, avec son nom dans le champ ObjectType, pour que les autres programmes IFC lisent la tâche normalement ; l'application conserve aussi l'identifiant fixe de la catégorie de travaux, donc un changement de nom ne rompt pas l'association. Si quelqu'un ouvre le fichier sur un autre ordinateur, la catégorie de travaux apparaît là sous *De ce projet*, et non dans ses propres *Mes catégories de travaux*.

**Ce qui n'est pas repris** — la mise en page de l'écran (zoom, position de défilement, tâche sélectionnée, phases repliées, filtre et regroupement choisis) et les paramètres de l'application ([Paramètres de l'application](docs://ref-instellingen)). L'onglet *IFC* est un éditeur avec le texte IFC de votre projet. *Générer IFC* le met à jour, *Copier* le place dans le presse-papiers et *Appliquer* charge le texte comme votre projet, en remplaçant le projet dans cet onglet.

## MS Project XML (MSPDI)

**Ouverture** — oui. L'application reconnaît un fichier `.xml` comme MS Project XML grâce à l'élément racine `Project` dans l'espace de noms MS Project (ou sans espace de noms). Profil de calcul : *Open Planner Studio*. Après l'ouverture, l'application vous indique en un seul message ce qu'elle n'a pas repris ; voir [Ouvrir un fichier MS Project (.mpp)](docs://howto-mpp-openen).

**Enregistrement** — non. Un tel projet n'a pas de cible d'enregistrement.

**Exportation** — oui, comme *MS Project XML* (*À ouvrir dans Microsoft Project. Structure WBS complète.*). Nom par défaut : le nom du projet avec `.xml`.

**Ce qui est repris** — tâches avec structure (niveau et WBS), durée, dates et avancement ; relations avec décalage, aussi en heures ou en pourcentages ; contraintes, y compris l'échéance ; calendriers, y compris les calendriers de tâche et de ressource ; ressources et affectations, y compris la courbe ou la répartition horaire ; la date d'état ; le seuil critique, sous forme de nombre entier de jours ouvrés égal à 0 ou plus, avec *Marge totale ≤ seuil* ; la description d'une tâche (comme note) ; le type de tâche de chaque tâche (comme type de tâche MS Project) ; une catégorie de travaux personnalisée, dans un champ libre (`ExtendedAttribute`) que l'application relit et que MS Project peut ignorer. Parmi vos références, seule la référence active est reprise, comme référence 0. Une tâche en heures garde son unité, et un jalon garde son type (début, fin ou automatique).

**Ce qui n'est pas repris** — notes (la liste de contrôle d'une tâche), relations externes vers d'autres projets, codes d'activité et champs personnalisés, une deuxième contrainte, le marquage *Planifiée manuellement*, le retard de nivellement, le point de reprise et d'arrêt d'une tâche hors séquence, les conventions *Le travail restant reprend après la durée écoulée* et *Ne pas déplacer les tâches non commencées à la date d’état* d'un profil MS Project, et les autres options de calcul. Les tâches interrompues sans répartition horaire sont reprises sans leurs interruptions.

**Jours fériés à l'ouverture.** Un calendrier dérivé hérite des exceptions de son calendrier de base. Un calendrier ayant sa propre semaine de travail et aucune exception ne reçoit aucun jour férié. Seul un calendrier nu, sans calendrier de base, semaine de travail ni exception, conserve les jours fériés néerlandais standard. Si des jours fériés manquent, votre date de fin peut différer : voir [Génération des jours fériés et du congé du bâtiment](docs://howto-feestdagen-genereren).

**Ce qui change pendant le transfert** — une contrainte *Doit commencer le (MSO)* ou *Doit finir le (MFO)* sans le choix *Obligatoire (logique de verrouillage)* devient *Début au plus tôt le (SNET)* ou *Fin au plus tôt le (FNET)*. Un hamac devient une tâche ordinaire avec des dates calculées. MS Project XML n'enregistre les heures par jour que pour le calendrier du projet. Un autre calendrier, avec ses propres heures par jour, reçoit à l'ouverture du fichier ses horaires de travail comme heures par jour : 8 heures par jour avec des horaires de travail de 10 heures deviennent 10. Une tâche en jours sur un tel calendrier devient alors plus courte, par exemple 4 jours au lieu de 5.

## Fichier MS Project (`.mpp`)

**Ouverture** — oui, de MS Project 2010 à 2021. Profil de calcul : *Microsoft Project*. L'application lit seulement le fichier : elle ne modifie jamais votre `.mpp`. Un fichier de MS Project 2007 ou plus ancien, et un fichier protégé par mot de passe, l'application le refuse avec un message qui renvoie à l'exportation XML de MS Project. Après l'ouverture, l'application vous indique en un seul message ce qu'elle n'a pas repris.

**Enregistrement** — non, et il n'y a pas de cible d'enregistrement : *Enregistrer* écrit un nouveau fichier IFC.

**Exportation** — non.

**Ce qui est repris** — tâches avec structure, durée et contraintes ; relations avec décalage ; calendriers ; ressources et affectations ; avancement ; un code WBS que vous avez renseigné vous-même dans MS Project. Les dates et la marge que MS Project a calculées elles-mêmes sont aussi lues, pour la vue *Dates telles qu'enregistrées*.

**Ce qui n'est pas repris** — références, coûts et tarifs, notes, hyperliens, champs personnalisés de MS Project, liaison des sous-projets et des tâches externes, et seuil critique. Voir [Ouvrir un fichier MS Project (.mpp)](docs://howto-mpp-openen).

**Origine et licence** — le lecteur `.mpp` a été écrit pour Open Planner Studio et est dérivé du code source et de la connaissance structurelle de MPXJ (`github.com/joniles/mpxj`, Jon Iles et al.), une bibliothèque Java sous LGPL-2.1. La structure et les constantes des champs ont été portées en TypeScript. Open Planner Studio lui-même est un logiciel libre sous LGPL-3.0. Le lecteur `.xer` n'est pas un dérivé : MPXJ n'y a été consulté que pour s'informer.

## Primavera P6 XML

**Ouverture** — oui. L'application reconnaît un fichier `.xml` comme P6 XML grâce à l'élément racine `APIBusinessObjects`. Profil de calcul : *Open Planner Studio*.

**Plusieurs projets dans un fichier.** Chaque projet comportant des tâches s'ouvre dans son propre onglet, nommé *Nom du projet (ID du projet)*. L'application ignore un projet sans tâches. L'onglet actif est le projet qui a le plus de tâches. L'application ne reprend ni une relation vers un autre projet, ni une tâche qui n'appartient à aucun projet. Après l'ouverture, l'application indique combien de projets elle a ouverts.

**Jours fériés à l'ouverture.** Les mêmes règles s'appliquent que pour MS Project XML : un calendrier ayant sa propre semaine de travail et aucune exception ne reçoit aucun jour férié.

**Références.** Un `<BaselineProject>` dans le fichier devient une référence de son projet. La référence que P6 marque comme active est aussi active dans l'application.

**Taux d'une affectation.** Si du travail reste, le taux restant (`RemainingUnitsPerTime`) devient *Unités/j*. Sinon, c'est le taux planifié (`PlannedUnitsPerTime`). Pour une ressource matérielle, le taux planifié reste. L'application ne recalcule rien à l'ouverture du fichier. À l'exportation vers P6 XML, elle écrit le taux planifié comme `PlannedUnitsPerTime`. Elle n'écrit le taux restant comme `RemainingUnitsPerTime` que si l'affectation a un taux planifié distinct.

**Aucune tâche lisible.** Si l'application ne trouve aucune tâche qu'elle peut lire, elle n'ouvre pas d'onglet. Elle le signale, avec la raison lorsqu'elle la connaît. Exemples : des tâches sans `ObjectId`, ou des noms de colonnes XER dans un fichier XML. Exportez alors à nouveau le projet depuis P6 au format P6 XML, ou ouvrez-le comme `.xer`.

**Enregistrement** — non.

**Exportation** — oui, comme *Primavera P6 XML* (*Pour Oracle Primavera P6.*). Nom par défaut : le nom du projet avec `.xml`, suivi de l'ID du projet entre parenthèses si le projet en a un. Une exportation MS Project XML reçoit le même nom : donnez-leur vous-même des noms différents.

**Nom du projet et ID du projet.** L'application conserve l'ID du projet de P6 séparément du nom du projet, comme pour un `.xer`. *Paramètres du projet* n'affiche que le nom, par exemple *Bid for Facility Extension*. L'onglet affiche *Bid for Facility Extension (OZB-05)*. Si vous renommez le projet en *Hall extension*, l'onglet s'appelle *Hall extension (OZB-05)*. Une exportation vers P6 XML réécrit *OZB-05* comme ID du projet et *Hall extension* comme nom. Ainsi, P6 reconnaît le projet. Un projet issu d'un `.xer` garde aussi son ID de projet. L'ID du projet reste lorsque vous enregistrez le projet en IFC. Les parenthèses dans le nom lui-même, comme dans *New build (phase 2)*, restent dans le nom. Un projet sans ID de projet reçoit à l'exportation un ID unique propre, fourni par l'application, qui commence par *OPS:*.

**Ce qui est repris** — structure WBS et tâches avec durée, dates et avancement ; relations avec décalage ; contraintes (aussi une deuxième, comme contrainte souple) ; calendriers ; ressources et affectations ; la date d'état (comme `DataDate`) ; une catégorie de travaux personnalisée, dans un champ à part, `OPS Custom Task Type`, que l'application relit et que P6 peut ignorer.

**Ce qui n'est pas repris** — références et échéances ; codes d'activité, champs personnalisés, notes et relations externes ; les options de calcul ; les noms des jours fériés. P6 ne connaît pas de nom par jour non travaillé : après une réouverture, un jour férié s'appelle *Holiday* et une exception de travail *Working exception*. Des jours non travaillés consécutifs reviennent sous forme d'une seule plage. L'application raccourcit un nom ou un code plus long que P6 ne l'accepte : un nom de tâche à 120 caractères, un identifiant de tâche ou un code WBS à 40, un nom de WBS ou de projet à 100. Elle signale combien de noms et de codes elle a raccourcis. P6 ne connaît pas de décalage en pourcentages : l'application le convertit en un nombre fixe de jours. Un décalage en jours calendaires devient un décalage en horaires de travail : 3 jours calendaires deviennent 3 jours ouvrés. Un hamac devient une tâche ordinaire, une tâche planifiée manuellement devient une tâche ordinaire avec des dates calculées, et un retard de nivellement inférieur à un jour est supprimé.

## Fichier Primavera (`.xer`)

**Ouverture** — oui. Profil de calcul : *Primavera P6*. L'application lit seulement le fichier : elle n'écrit pas de `.xer` et ne modifie jamais votre fichier. Elle ouvre un onglet par projet contenant des tâches. Un fichier sans tâches ou avec des tables endommagées, l'application le refuse avec un message.

**Enregistrement** — non, et il n'y a pas de cible d'enregistrement : *Enregistrer* écrit un nouveau fichier IFC, avec le `.xer` d'origine à l'intérieur.

**Exportation** — non. Si vous exportez un projet issu d'un `.xer` vers CSV, MS Project XML ou P6 XML, l'application signale que les informations de la source XER sont perdues, même si vous avez enregistré le projet en IFC entre-temps. Vers IFC, rien n'est perdu.

**Ce qui est repris** — la structure WBS et les tâches avec durée, dates, contraintes et avancement ; relations avec décalage ; calendriers ; ressources avec affectations ; codes d'activité ; champs personnalisés (UDF) ; notes ; les paramètres de planification de P6. Une tâche de type *Level of Effort* devient un hamac. Un projet de référence devient la référence active du projet qui y renvoie. Une relation entre deux projets est conservée par l'application comme donnée source.

**Taux d'une affectation.** Si du travail reste à faire, le taux restant (`remain_qty_per_hr`) devient la valeur de *Unités/jour*. Sinon, c'est le taux planifié (`target_qty_per_hr`). Le travail planifié, le travail réel et le travail restant restent tels qu'ils sont dans le fichier. Pour le matériel, le taux planifié reste.

**Un samedi ou un dimanche libre qui n'est pas dans le fichier.** Certains exports P6 déplacent un jour de week-end libre, situé dans un bloc de plusieurs jours libres, vers le vendredi précédent ou le lundi suivant. Si le calendrier travaille le samedi ou le dimanche, ce jour deviendrait à tort un jour ouvré. Si l'application repère ce schéma dans un bloc d'au moins trois jours libres, elle rend malgré tout ce jour de week-end libre. Dans le calendrier, le jour s'appelle *Exception de calendrier (reconstruction du week-end)*, et il compte dans la ligne *N constats de calendrier.* du message. Sur un calendrier qui ne travaille pas le week-end, rien ne change.

**Marge jusqu'à la fin du projet, sans date de fin.** L'option P6 de calcul de la marge jusqu'à la fin du projet est-elle activée, alors que le fichier ne contient ni date de fin pour le projet ni date de fin planifiée pour aucune tâche ? Alors l'application désactive l'option *Calculer la marge jusqu’à la date de fin du projet*. Elle calcule ensuite les dates au plus tard à rebours depuis la fin au plus tôt la plus tardive. Cela compte dans la ligne *N paramètres de planification P6 ont utilisé des replis sûrs.* du message.

**Tâches terminées à la date d’état.** Certains fichiers n'enregistrent pas les dates réelles d'une tâche terminée, mais une fenêtre autour de la date d’état. Dans la vue *Dates telles qu'enregistrées*, une telle tâche est alors une barre étroite à la date d’état. Si le recalcul la place ailleurs, elle compte dans le nombre de tâches que donne la bande. La convention *Tâche terminée dans la fenêtre de la date d’état* calcule une telle fenêtre, et seulement avec cette convention une tâche terminée reçoit une vraie marge, grâce à l'option de calcul *Tâche terminée : dates au plus tard à partir de la date d’état*. Cette convention est une approximation : l'application n'a observé ce comportement que dans des sorties P3, et Primavera ne le confirme nulle part. C'est pourquoi cette convention est désactivée dans chaque profil intégré, aussi sous *Primavera P6*. Vous l'activez dans le bloc *Profil de calcul et options* ; le projet reçoit alors un profil personnalisé. Voir [Options de calcul et conventions](docs://ref-rekenopties-en-conventies).

**Nombres avec une virgule comme séparateur décimal.** P6 enregistre le séparateur décimal et le séparateur des milliers dans la table `CURRTYPE`. L'application lit ces caractères avant de convertir les durées, le travail et la marge. Si cette information manque, l'application utilise un point comme séparateur décimal. Si le fichier contient encore des nombres avec une virgule décimale, l'application n'ouvre rien. Ainsi, un planning avec des nombres mal lus ne s'ouvre jamais.

**Ce qui n'est pas repris** — un projet sans tâches, et une relation entre deux projets comme vraie relation dans votre planning. Voir [Ouvrir un fichier Primavera P6 (.xer)](docs://howto-xer-openen).

## CSV

**Ouverture** — oui. L'application lit `;` et `,` comme séparateur. Elle reconnaît les en-têtes de colonnes en anglais et en néerlandais (par exemple `Name` ou `Naam`, `Duration` ou `Duur`, `Predecessors` ou `Voorgangers`). Les dates peuvent être *aaaa-mm-jj*, *jj-mm-aaaa* ou *jj/mm/aaaa*. Vous écrivez un prédécesseur comme code WBS, type de relation et décalage, par exemple `1.2FS+2d`. Profil de calcul : *Open Planner Studio*. Le projet s'appelle *CSV Import*. La colonne `Task Type` contient la catégorie de travaux, et non le type de tâche ; l'application lit aussi les en-têtes `Werksoort` et `Work category`. Un `Task Type` qui ne correspond à aucun des codes fixes (comme `CONSTRUCTION` ou `INSTALLATION`, que l'application écrit elle-même) devient une catégorie de travaux personnalisée sous *De ce projet*, et non dans *Mes catégories de travaux* ; avec `OPS Custom Task Type ID`, l'identifiant d'une catégorie de travaux personnalisée est conservé.

**Enregistrement** — non.

**Exportation** — oui, comme *CSV (;)* (*Export tableau universel. Toutes les tâches avec dates et durées.*), sur la carte *CSV (séparé par des points-virgules)*. Le fichier utilise un point-virgule comme séparateur, est en UTF-8 avec BOM et a des en-têtes de colonnes en anglais.

**Ce qui est repris** — par tâche, ces colonnes : `OPS Task ID`, `WBS`, `Outline Level`, `Name`, `Duration (days)`, `Start`, `Finish`, `Predecessors`, `Task Type`, `OPS Custom Task Type ID`, `Status`, `Completion (%)`, `Actual Start`, `Actual Finish`, `Critical`, `Total Float` et `Description`. La colonne `Task Type` contient la catégorie de travaux. L'avancement est exprimé en pourcentages entiers. Un décalage en heures reçoit le signe d'heure de la langue de l'application : `1.2FS+2h` en anglais, `1.2FS+2u` en néerlandais. L'ouverture lit les deux.

**Ce qui n'est pas repris** — ressources, affectations, calendriers, contraintes, échéances, références et la date d’état. Si les dates sont dans la vue *Dates telles qu'enregistrées*, l'exportation laisse vides `Critical` et `Total Float` pour les tâches dont le fichier source ne l'a pas enregistré.

## Feuille d'avancement (Excel et CSV)

**Ouverture** — oui, via *Fichier › Importer* (*Mettre à jour l'avancement depuis une feuille*) ou via le bouton de même nom dans le groupe de ruban *Avancement*, sur *Planification*, *Tableau* et *Rapport*. L'application lit les fichiers `.xlsx` et `.csv`, jusqu'à 16 Mo et 50 000 lignes. Cela n'ouvre pas de projet : cela met à jour l'avancement de votre projet ouvert. Voir [Importer l'avancement depuis une feuille](docs://howto-voortgang-importeren).

**Enregistrement** — non.

**Exportation** — oui, comme *Feuille d’avancement (Excel)* (*Avancement (Excel)* dans la liste) et *Feuille d’avancement (CSV)* (*Avancement (CSV)*). Nom par défaut : *nom-du-projet-voortgang*. Le bouton *Exporter la feuille d’avancement* dans le même groupe de ruban crée la feuille Excel en un clic. La feuille Excel a des largeurs de colonnes fixes, des champs verrouillés et une vérification des dates ; la feuille CSV contient le même contenu en texte brut.

**Ce qui est repris** — les colonnes `OPS Task ID`, `WBS`, `Name`, `Start`, `Finish`, `Completion (%)`, `Actual Start` et `Actual Finish`. À la lecture, l'application utilise `Completion (%)`, `Actual Start` et `Actual Finish` ; `Start` et `Finish` servent seulement à reconnaître la notation des dates et ne modifient pas votre planning. L'application relie les lignes aux tâches par `OPS Task ID`, ou sinon par un code WBS unique.

**Ce qui n'est pas repris** — tout ce qui se trouve hors de ces colonnes : durée, relations, ressources et le reste de votre planning. Une tâche récapitulative ne reçoit pas d'avancement de la feuille.

## PDF

**Ouverture** — non.

**Enregistrement** — non.

**Exportation** — oui, depuis un rapport : sous l'onglet *Rapport*, le bouton *Exporter en PDF*. L'application n'envoie pas elle-même un rapport à une imprimante ; le chemin vers le papier passe par le PDF. Le contenu dépend du type de rapport : voir [Types de rapport](docs://ref-rapporttypes) et [Créer et imprimer un rapport](docs://howto-rapport-maken-en-afdrukken).

## Voir aussi

- [Fichiers et formats](docs://uitleg-bestanden) : pourquoi IFC est le format natif et ce qu'une exportation perd, avec un exemple.
- [Ouvrir et enregistrer un fichier](docs://howto-bestand-openen-en-opslaan) : les étapes.
- [Exporter](docs://howto-exporteren) : choisir un format et les messages après une exportation.
- [Dates telles qu'enregistrées](docs://uitleg-datums-zoals-opgeslagen) : pourquoi un fichier ouvert peut afficher d'autres dates.
- [Options de calcul et conventions](docs://ref-rekenopties-en-conventies) : les profils de calcul.
