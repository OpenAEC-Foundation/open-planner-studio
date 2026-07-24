# Im-/export

Open Planner Studio stocke par défaut un projet au format IFC — pas de fichier de projet séparé à côté. Mais parfois, un planning doit aussi exister en dehors de l'application : dans Primavera P6, dans Microsoft Project, ou comme tableau plat pour un tableur. Ce guide explique ce que signifie réellement « IFC est le format natif », ce que chaque format d'export emporte et n'emporte pas, et où se trouvent l'import/l'export dans l'application.

## Ce que vous allez apprendre ici

- Ce que signifie précisément « IFC est le format natif » pour l'ouverture et l'enregistrement.
- Ce qui est et n'est pas conservé lors de l'export vers MS Project (MSPDI) et Primavera P6 XML.
- Ce que contient l'export CSV — et ce qui est délibérément omis.
- Où importer et exporter : **Backstage → Exporter** et **Backstage → Importer**.
- Comment les extensions peuvent ajouter des formats d'import supplémentaires.

## IFC : le format natif

Un projet Open Planner Studio *est* un fichier IFC 4x3 (le standard buildingSMART). Il n'y a pas de fichier JSON ou de fichier de projet séparé à côté : **Enregistrer** et **Ouvrir** (Backstage, ou **Ctrl+S**/**Ctrl+O**) lisent et écrivent directement l'IFC. Cela signifie que tout ce que vous faites dans l'application — tâches, WBS, relations avec contraintes, ressources et affectations, calendriers (le calendrier du projet et les calendriers de ressources), baselines, avancement, notes, codes d'activité et champs personnalisés, liens externes entre projets — se retrouve dans le même fichier et revient intégralement la prochaine fois que vous **Ouvrez** ce fichier. Si vous rencontrez un nouveau type de donnée de projet dans l'application, vous pouvez supposer qu'il fait l'aller-retour via IFC ; si quelque chose ne fait *pas* l'aller-retour, cela est explicitement signalé ci-dessous.

L'IFC est aussi la façon dont cette application se connecte au reste de la suite d'outils OpenAEC : le même fichier peut être lu par un logiciel BIM pour le lien 4D (planning aux côtés de la maquette du bâtiment).

## Exporter vers d'autres formats

Ouvrez **Backstage → Exporter** pour quatre formats :

- **CSV (séparé par des points-virgules)** — export tableau universel. Toutes les tâches avec dates et durées.
- **MS Project XML** — s'ouvre dans Microsoft Project. Structure WBS complète.
- **Primavera P6 XML** — pour Oracle Primavera P6.
- **IFC 4x3** — le standard buildingSMART, identique au format natif (pratique comme « enregistrer sous » vers un fichier séparé, ou pour partager une copie sans toucher au reste de vos documents ouverts).

Chaque format a ses propres limites : plus le format cible est riche, plus il conserve d'éléments, mais aucun des trois formats externes n'est un miroir complet de l'IFC.

### CSV

L'export CSV contient **uniquement le tableau des tâches** : code WBS, nom, durée (jours), début, fin, prédécesseurs (sous forme de code texte, par ex. `2.1FS+3d`), type de tâche, statut, avancement (%), début/fin réels, critique (oui/non), marge totale et description. **Les ressources, affectations, calendriers et baselines sont délibérément omis** — le CSV est purement un tableau de tâches pour quiconque veut visualiser ou modifier le planning dans un tableur, pas un échange de projet à fidélité complète. Lorsque vous **importez** un fichier CSV en retour, les baselines restent donc vides (il n'y avait rien à en lire).

### MS Project XML (MSPDI)

Le MSPDI est nettement plus riche que le CSV : les ressources, les affectations (y compris leur courbe de charge), les calendriers et les baselines sont bien conservés. Néanmoins, tout n'est pas exprimable en MSPDI. Lors de l'export, l'application avertit dans la console développeur (`console.warn`) chaque fois que quelque chose est perdu, avec le nombre exact d'éléments concernés :

- Les **liens externes** entre projets sont supprimés (la référence « fantôme » de l'autre tâche reste uniquement dans l'application).
- Les **contraintes souples Doit commencer le/Doit finir le** (MSO/MFO souples) sont dégradées en SNET/FNET — les codes MSPDI 2/3 sont *stricts* (Must), donc la borne de la variante souple est perdue. Les MSO/MFO stricts s'exportent exactement.
- Les **contraintes secondaires** sont perdues — MSPDI n'a qu'un seul champ de contrainte par tâche.
- Les **tâches hammock** (durée dérivée) sont exportées comme une tâche ordinaire avec les dates calculées — MSPDI n'a pas de type hammock/LOE natif.
- Les **notes de tâche** ne sont délibérément **pas** exportées, même si MSPDI possède un champ `<Notes>` : nos notes ont une forme de liste de contrôle avec cases à cocher qui ne se traduit pas proprement en texte brut.
- La **définition du chemin critique** (mode/seuil quasi critique) et d'autres options de planification ne sont pas exprimables nativement en MSPDI et sont donc perdues — elles ne sont préservées que via IFC.

### Primavera P6 XML

Le même type de compromis que MSPDI, avec quelques particularités propres à P6 :

- Les **liens externes** et les **tâches hammock** sont supprimés/simplifiés de la même manière qu'avec MSPDI, chacun avec un avertissement.
- Les **notes de tâche** sont également omises ici — le XML P6 n'a pas de champ adapté pour elles.
- Le **décalage en pourcentage** sur une relation (par ex. 40 % de la durée du prédécesseur) est « figé » en un nombre fixe de jours, car P6 n'a pas de concept de décalage en pourcentage.
- Le **décalage en jours calendaires** (décalage en jours écoulés plutôt qu'en jours ouvrés) est exporté comme un décalage horaire simple — P6 n'a pas d'unité de décalage distincte par relation.
- La courbe de charge **Pic tardif (LATE_PEAK)** n'a pas d'équivalent P6 et est exportée sous l'approximation la plus proche (« Early Peak »).
- Les options de planification (comme pour MSPDI) ne sont pas exportées.

Ces avertissements ne sont pas de la négligence — c'est un choix délibéré et explicite : un avertissement visible par élément supprimé vaut mieux qu'une perte de données silencieuse. Ouvrez par exemple le cas d'usage [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) (il contient des notes de tâche et une relation avec un décalage en pourcentage) et exportez vers P6 ou MS Project XML : la console développeur affiche alors exactement quels éléments ont été supprimés ou simplifiés, et combien.

## Importer

**Fichier → Ouvrir** (ou **Backstage → Ouvrir**) accepte les fichiers `.ifc`, `.csv` et `.xml`. Pour un fichier `.xml`, l'application détecte elle-même s'il s'agit d'un fichier Primavera P6 ou MS Project, en se basant sur le contenu. Comme décrit ci-dessus : un import CSV ou P6 produit un projet **sans baselines** (il n'y en avait pas dans la source), tandis que IFC et MSPDI apportent les baselines.

## Importateurs d'extension

Au-delà des formats fixes ci-dessus, les extensions installées peuvent ajouter leurs propres importateurs — par exemple pour un format qui n'est pas pris en charge par défaut. Ceux-ci apparaissent sous **Backstage → Importer**, chacun avec son propre nom, sa description et ses extensions de fichier correspondantes ; sans extension d'import installée, cette section est vide. Consultez **Backstage → Extensions** pour voir ce qui est disponible.

## Poursuivre la lecture

- Les baselines ne sont conservées que via IFC et MS Project XML, pas via CSV ou P6 — lisez le guide [Baselines & avancement](docs://gids-baselines-voortgang) pour savoir comment enregistrer une baseline.
- Ressources, affectations et courbes de charge — lisez le guide [Ressources, histogramme & nivellement](docs://gids-resources-histogram) pour savoir comment celles-ci sont construites avant d'exporter.
