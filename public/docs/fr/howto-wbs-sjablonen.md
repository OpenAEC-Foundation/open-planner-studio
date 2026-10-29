# Enregistrer et insérer des modèles de WBS

Objectif : enregistrer une phase avec ses sous-tâches et leurs relations comme modèle, puis l'insérer à nouveau plus tard, dans le même projet ou dans un autre.

## Quand vous en avez besoin

Vous planifiez sans cesse le même type de travaux : chaque maison a des fondations avec terrassement, armature, coulage et durcissement. Au lieu de créer ces tâches encore et encore et de les lier entre elles, vous enregistrez la phase une seule fois comme **modèle**. Un modèle est une branche de votre WBS : une tâche avec tout ce qui se trouve en dessous d'elle.

## Étapes

### Enregistrer une branche comme modèle

1. Construisez la branche comme vous voulez la réutiliser : une tâche récapitulative avec des sous-tâches et les relations entre elles.
2. Faites un clic droit sur cette tâche récapitulative et choisissez *Enregistrer la branche comme modèle*. Cet élément de menu n'apparaît que pour les tâches ayant des sous-tâches.

L'application affiche *Branche enregistrée comme modèle 'Foundation'*. L'application ne demande pas de nom : le modèle prend le nom de la tâche supérieure de la branche.

### Insérer un modèle

1. Sélectionnez la tâche sous laquelle le modèle doit aller, ou ne sélectionnez rien.
2. Choisissez *Planification › Structure › Modèles*. La liste affiche le nom de chaque modèle et, par exemple, *4 tâches, 2 relations*.
3. Cliquez sur le modèle.

Si une tâche est sélectionnée, le modèle est inséré comme dernière sous-tâche de cette tâche. Cette tâche devient ainsi une tâche récapitulative. Si plusieurs tâches sont sélectionnées, c'est la première sur laquelle vous avez cliqué qui compte. Si rien n'est sélectionné, la branche est ajoutée en bas de la liste, au niveau supérieur. La branche insérée est ensuite sélectionnée.

Toutes les tâches insérées commencent au début du projet, et le planning n'est plus à jour. Appuyez sur **Calculer** (F5), par exemple via *Accueil › Planification › Calculer*, et les dates découlent des relations. Une seule action *Annuler* défait toute l'insertion. L'enregistrement ou la suppression d'un modèle n'en fait pas partie.

### Supprimer un modèle

Ouvrez *Planification › Structure › Modèles* et cliquez sur la petite poubelle à droite du modèle (*Supprimer le modèle*). L'application ne demande pas de confirmation.

### Ce qu'un modèle contient

Pour chaque tâche, un modèle conserve le nom, la description, la catégorie de travaux, le fait qu'il s'agit d'un jalon, et la durée en jours. Parmi les relations, il conserve celles entre deux tâches de la branche, avec leur type et leur décalage. Un décalage en heures (`4h`) n'est pas repris et devient 0. Un décalage en jours ouvrés, en jours calendaires ou en pourcentage est repris.

Tout le reste n'est pas repris dans le modèle : dates, avancement et dates réelles, affectations de ressources, codes et champs personnalisés (voir [Codes et champs personnalisés](docs://howto-codes-en-velden)), calendrier, contraintes et échéances, priorité, une catégorie de travaux personnalisée, pour un jalon la nature et la case *Obligatoire (contractuel)*, et les relations avec des tâches hors de la branche. Après l'insertion, vous devez les renseigner à nouveau : les affectations, les codes, le calendrier et les contraintes sont vides, et toutes les tâches commencent au début du projet.

Une tâche exprimée en heures revient comme tâche en jours, avec sa durée convertie en fraction d'un jour ouvré. Une tâche de 5 heures, avec un jour ouvré de 8 heures, devient 0,625 jour.

## Pièges et comportement de l'application

**Les modèles n'appartiennent pas au projet.** L'application les conserve dans le stockage de l'application sur cet appareil, et non dans le fichier du projet. Un collègue qui ouvre votre fichier ne voit pas vos modèles. Dans la version navigateur, un modèle appartient à ce navigateur. Si vos modèles sont importants, conservez-les aussi ailleurs : mettez-les dans un projet que vous enregistrez comme fichier.

**Un même nom peut apparaître plusieurs fois.** Si vous enregistrez la branche deux fois, la liste contient deux modèles portant le même nom. L'application n'écrase rien.

**La durée de la tâche supérieure ne compte pas.** Une tâche récapitulative reçoit sa durée de ses sous-tâches, dès que vous utilisez Calculer.

**Une tâche avec affectations de ressources comme cible.** Si vous sélectionnez une tâche avec affectations de ressources, sans sous-tâches, et que vous y insérez un modèle, l'application refuse. La tâche deviendrait une tâche récapitulative, et une tâche récapitulative ne porte pas d'affectations. La tâche supérieure d'un modèle a déjà des sous-tâches, donc les affectations n'auraient nulle part où aller. L'application vous le signale et ne modifie rien. Choisissez alors une autre tâche, ou rien, comme emplacement. Un jalon qui reçoit un modèle perd sa marque de jalon, avec un message.

**Une relation non valide dans le modèle.** Si une relation du modèle n'est pas autorisée, par exemple d'une tâche vers sa propre phase, ou si elle existe déjà, l'application l'ignore et vous indique combien de relations ont été ignorées.

## Voir aussi

- [Ajuster la structure](docs://howto-structuur-aanpassen) : déplacer ou mettre en retrait la branche insérée.
- [Ajouter des relations](docs://howto-relaties-leggen) : créer soi-même des relations dans une branche avant de l'enregistrer.
- [Chemin critique et marge](docs://uitleg-kritiek-pad) : ce qui arrive à la branche insérée après Calculer.
