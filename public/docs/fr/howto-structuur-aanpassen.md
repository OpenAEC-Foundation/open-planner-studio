# Adapter la structure

Objectif : organiser les tâches en phases et sous-tâches, modifier leur ordre et garder les numéros WBS corrects.

## Quand en avez-vous besoin

Votre planning est un arbre : des phases (tâches récapitulatives) avec des sous-tâches en dessous, comme *Foundation* avec *Groundwork*, *Reinforcement* et *Pouring*. Vous adaptez cet arbre lorsque vous voulez placer des tâches sous une phase, en retirer une, ou lorsque l'ordre est incorrect. Le **code WBS** (1, 1.1, 1.2, 2, …) est le numéro d'une tâche dans cet arbre.

## Étapes

### Mettre une tâche en retrait

1. Sélectionnez la tâche. Vous pouvez sélectionner plusieurs tâches.
2. Choisissez *Planification › Structure › Mettre en retrait*. Vous pouvez aussi utiliser Alt+→ (ou Alt+Maj+→), ou *Mettre en retrait* dans le menu contextuel.

La tâche devient la dernière sous-tâche de la tâche précédente, au même niveau. Cette tâche devient ainsi une tâche récapitulative. Si vous sélectionnez un bloc continu, le bloc est mis en retrait dans son ensemble. Si la tâche n'a pas de tâche précédente au même niveau, rien ne se passe et aucun message n'apparaît.

### Réduire le retrait d'une tâche

Choisissez *Planification › Structure › Réduire le retrait*, appuyez sur Alt+← (ou Alt+Maj+←) ou choisissez *Réduire le retrait* dans le menu contextuel.

La tâche devient une tâche du même niveau, juste après la phase sous laquelle elle était placée. Ses propres sous-tâches la suivent. Les tâches qui venaient après elle dans cette phase restent dans cette phase. Une tâche au niveau supérieur ne peut pas être réduite davantage.

### Déplacer une tâche

Vous avez trois méthodes.

- **Avec le clavier.** Alt+↑ et Alt+↓ échangent la tâche avec la tâche voisine du même niveau. Une tâche récapitulative emporte ses sous-tâches. En haut ou en bas du niveau, rien ne se passe. Si plusieurs tâches sont sélectionnées, seule la tâche sur laquelle vous avez cliqué en premier se déplace.
- **Glisser dans le tableau des tâches.** Appuyez sur une ligne et glissez verticalement. Le quart supérieur d'une ligne signifie *avant*, le quart inférieur *après*. Le milieu d'une tâche récapitulative place la tâche sous elle, comme dernière sous-tâche. Le milieu d'une tâche ordinaire compte comme le bord le plus proche. Si vous glissez une ligne qui fait partie d'une sélection multiple, toute la sélection se déplace.
- **Glisser dans le Gantt.** Glissez la barre verticalement vers une autre ligne. Cela fonctionne comme glisser dans le tableau des tâches et ne modifie aucune date. Si vous glissez horizontalement, vous modifiez les dates à la place.

Chaque déplacement correspond à une étape pour *Annuler* (Ctrl+Z).

### Garder les numéros WBS à jour

Regardez le bouton *WBS auto* dans *Planification › Structure*.

- **Activé (la valeur par défaut dans un nouveau projet).** Également activé après l'ouverture d'un fichier sans ce réglage, si tous les codes WBS correspondent déjà à la numérotation de l'arbre (1, 1.1, 1.2 …). Les codes ne changent pas. Un fichier vide sans ce réglage reçoit aussi *activée*, comme un nouveau projet. L'application renumérote tout l'arbre à chaque ajout, suppression et déplacement. Le code WBS est alors en lecture seule : vous ne pouvez le saisir ni dans le tableau ni dans le volet *Propriétés*. *Renuméroter WBS* est désactivé.
- **Désactivé.** Valeur par défaut dans un fichier qui a ses propres codes, comme *A1000*, ou dont un code diffère de l'arbre. Les codes restent tels quels, aussi après un déplacement ou une mise en retrait. Vous les saisissez vous-même, dans la colonne *WBS* ou dans le champ *Code WBS* du volet *Propriétés*, ou vous les faites renuméroter une fois avec *Renuméroter WBS*. Cela écrase aussi les codes que vous avez saisis vous-même.

Si vous activez *WBS auto*, l'application numérote tout l'arbre immédiatement. *WBS auto* et *Renuméroter WBS* peuvent tous deux être annulés avec *Annuler*.

## Pièges et comportement de l'application

**Le filtrage, le regroupement ou le tri est activé.** L'ordre que vous voyez n'est alors pas l'ordre du planning, donc l'application bloque la structure. *Mettre en retrait* et *Réduire le retrait* sont désactivés, avec l'info-bulle *Non disponible pendant le filtrage/regroupement/tri*. Alt+→ et le glissement affichent le même texte dans un bandeau rouge, avec le bouton *Effacer*. Ce bouton supprime en une fois le filtre, le regroupement et le tri, et Ctrl+Z ne les rétablit pas. Le bandeau reste affiché jusqu'à ce que vous cliquiez sur la croix, que vous utilisiez Ctrl+Z ou Ctrl+Y, ou que vous passiez à un autre document. *Mettre en retrait* et *Réduire le retrait* manquent alors dans le menu contextuel.

Alt+↑ et Alt+↓ fonctionnent bien dans une telle vue, sans message. Avec un simple filtre, vous voyez tout de suite le nouvel ordre. Avec un tri, l'ordre du planning change bien, mais vous ne le voyez qu'après *Effacer*.

**WBS auto est désactivé.** Cela arrive avec un fichier qui a ses propres codes, ou avec un fichier qui enregistre le réglage comme *désactivée*. Une nouvelle tâche reçoit le code qui correspond à sa place dans l'arbre, même si une autre tâche possède déjà ce code. Des numéros en double peuvent ainsi apparaître. Après une mise en retrait aussi, les codes ne correspondent plus à l'arbre. *Renuméroter WBS* corrige les deux.

**Un jalon reçoit des sous-tâches.** Un jalon est un moment et n'a pas de sous-tâches. L'application retire le marqueur de jalon et vous en informe.

**Une tâche avec des affectations de ressources reçoit des sous-tâches.** Une tâche récapitulative ne porte pas elle-même d'affectations. L'application vous demande donc d'abord quoi faire avec elles, dans la fenêtre *La tâche devient une tâche récapitulative*. Cela se produit quand vous mettez une tâche en retrait, utilisez *Ajouter une sous-tâche* ou *Ajouter un jalon* sur une tâche, insérez un modèle, et dans *Modifier la tâche* quand vous choisissez une nouvelle *Tâche parente* : pour une tâche existante comme pour une nouvelle tâche. Dans *Modifier la tâche*, la question apparaît avant l'enregistrement. Si vous choisissez *Annuler* à cet endroit, *Modifier la tâche* reste ouvert avec vos modifications. Vous choisissez :

- *Annuler* : rien ne change, la structure reste également telle quelle.
- *Supprimer l'affectation* : la tâche reçoit ses sous-tâches et ses affectations sont supprimées. Le travail réel de ces affectations est supprimé aussi.
- *Déplacer vers « … »* : les affectations passent à la première nouvelle sous-tâche qui peut les porter, avec leur travail réel. Un jalon ou une tâche récapitulative ne porte aucune affectation.

Si cette sous-tâche a déjà la même ressource, ou s'il n'existe pas de sous-tâche appropriée, *Déplacer* est désactivé. Un bloc orange dans la fenêtre indique la raison.

Si une affectation comporte déjà du travail réel, le bloc orange indique le nombre d'heures par ressource, par exemple *L'affectation de Metselaar comporte déjà 8 heures de travail réel. La supprimer fait perdre ce travail.* *Annuler* est alors le bouton par défaut : Entrée ne change rien. Si vous voulez tout de même supprimer l'affectation, cliquez vous-même sur *Supprimer l'affectation*.

Tant que la fenêtre est ouverte, aucun raccourci en dehors de la fenêtre ne fonctionne, y compris *Annuler*, *Coller*, Suppr, F5 et Ctrl+S. Si une action crée plusieurs tâches récapitulatives à la fois, la fenêtre affiche les ressources par tâche, et votre choix s'applique à toutes. Un seul *Annuler* (Ctrl+Z) annule toute l'action.

**Une relation créerait un cycle.** Les relations d'une tâche récapitulative s'appliquent aussi à ses sous-tâches. Si un déplacement crée ainsi un cycle, l'application le refuse avec le message *Ce déplacement créerait un cycle dans le planning (…)*. Rien ne change.

**Une relation entre une tâche et sa propre phase.** Si vous placez une tâche sous une phase avec laquelle elle a déjà une relation, cette relation reste, mais ne compte plus dans le calcul. L'application vous en informe. Vous trouverez plus d'informations sur les relations des tâches récapitulatives dans [Relations et décalage](docs://uitleg-relaties).

**Le planning n'est plus à jour.** Un déplacement vers une autre phase peut modifier des dates. Appuyez sur **Calculer** (F5). Un simple échange d'ordre dans la même phase ne change pas les dates.

## Voir aussi

- [Ajouter des tâches et des jalons](docs://howto-taken-en-mijlpalen-toevoegen) : placer les nouvelles tâches au bon endroit.
- [Enregistrer et insérer des modèles WBS](docs://howto-wbs-sjablonen) : réutiliser une phase entière.
- [Ajouter des relations](docs://howto-relaties-leggen) : lier des tâches entre elles.
- [Sélectionner, supprimer et annuler des tâches](docs://howto-taken-selecteren-verwijderen) : annuler un déplacement.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc) : quatre phases avec leurs sous-tâches, comme vous les construisez en mettant en retrait.
