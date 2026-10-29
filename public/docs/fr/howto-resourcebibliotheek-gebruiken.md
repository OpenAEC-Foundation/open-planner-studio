# Utiliser la bibliothèque de ressources

But : utiliser dans votre projet des ressources de la bibliothèque de ressources, et mettre dans la bibliothèque une ressource que vous avez créée dans un projet, afin que chaque projet utilise les mêmes données.

## Quand vous en avez besoin

Vous avez une équipe fixe de maçons, une grue et un plâtrier qui apparaissent dans plusieurs projets. Sans bibliothèque, vous les saisissez à nouveau dans chaque projet, avec un risque de noms et de tarifs différents, et aucun projet ne voit qu'un autre demande aussi la même équipe. Dans la bibliothèque, vous les enregistrez une seule fois.

Ce qu'est la bibliothèque et ce qu'un projet en reprend, vous le lisez dans [La bibliothèque de ressources](docs://uitleg-resourcebibliotheek). Cet article porte sur les actions. Créer, exporter et supprimer des bibliothèques est expliqué dans [Gérer et partager les bibliothèques de ressources](docs://howto-bibliotheken-beheren).

## Étapes

### 1. Lier le projet à une bibliothèque de ressources

Vous ne travaillez avec la bibliothèque de ressources que si le projet y est lié. Sans lien, le panneau *Ressources* n'affiche pas le sélecteur *Bibliothèque*, *Projet* et *Occupation*.

Pour un nouveau projet :

1. Choisissez *Fichier › Nouveau*. La fenêtre *Nouveau projet* s'ouvre.
2. Regardez *Bibliothèque de ressources*. Le champ est réglé sur la bibliothèque de ressources par défaut. Vous pouvez en choisir une autre, *aucune (projet autonome)* ou *+ Nouvelle bibliothèque de ressources…*.
3. Cliquez sur *Créer*.

Pour un projet existant :

1. Choisissez *Fichier › Paramètres du projet*.
2. Sous *Bibliothèque de ressources*, choisissez la bibliothèque de ressources.
3. Cliquez sur *Appliquer*. Jusque-là, le bas de la fenêtre affiche *Modifications non appliquées — cliquez sur Appliquer pour les conserver.*

Si le projet a déjà des ressources qui portent le même nom qu'un élément de la bibliothèque de ressources, la fenêtre *Lier la bibliothèque de ressources* s'ouvre avec la section *Reconnaître*. Chaque ressource avec une correspondance indique *Suggestion : Bricklayer*. Cliquez sur *Lier* pour lier celle-ci, ou sur *Lier toutes les suggestions* s'il y en a plusieurs. L'application compare les noms sans tenir compte des majuscules ni des doubles espaces. Lors du lien, la ressource reprend le nom, le type, le tarif, l'unité et la description de l'élément de la bibliothèque de ressources. *Unités max* reste ce que vous aviez dans le projet. La fenêtre affiche aussi les calendriers du projet qui portent le même nom qu'un calendrier de la bibliothèque de ressources. Avec *Décider plus tard*, vous fermez la fenêtre sans lier.

### 2. Mettre une ressource dans la bibliothèque de ressources

1. Choisissez *Ressources › Gérer › Ressources*. Le panneau des ressources prend tout l'espace de travail. Il s'ouvre toujours sur *Projet*, aussi pour un projet lié.
2. En haut à droite, choisissez *Bibliothèque*. Au-dessus du tableau, il est écrit *Ceci modifie la bibliothèque et s'applique à tous les projets — hors annulation.*
3. Cliquez sur *Nouvelle ressource dans la bibliothèque*. Une ligne vide apparaît en bas du tableau.
4. Saisissez le nom, par exemple *Bricklayer*, et appuyez sur Entrée. La ressource est maintenant dans la bibliothèque de ressources, et une ligne vide s'ouvre tout de suite pour la suivante. Appuyez sur Échap quand vous avez terminé. Sans nom, l'application ne crée rien.
5. Remplissez le reste de la ligne. *Type* vaut *Main-d'œuvre* par défaut. Sous *Unités max*, saisissez le nombre total de cette ressource, par exemple 3 pour trois maçons. La vue d'occupation utilise ce nombre comme capacité. *Tarif/heure* est facultatif. Vous ne pouvez renseigner *Unité* que pour le type *Matériau*. Sous *Calendrier*, choisissez un calendrier de la bibliothèque de ressources, ou *+ Calendrier de ressource* pour en créer un, voir [Définir un calendrier de ressource](docs://howto-resourcekalender-instellen). L'application enregistre le nom, le tarif et l'unité quand vous quittez le champ, et les autres champs tout de suite.

Chaque modification de la bibliothèque de ressources se répercute aussitôt sur les copies non modifiées de vos projets ouverts.

### 3. Affecter une ressource à votre projet

1. Dans la vue *Bibliothèque*, choisissez *Affecter au projet* sur la ressource. Au-dessus du tableau, il est écrit *Ajouté.* Si vous cliquez à nouveau, il est écrit *Déjà présent dans le projet.* et aucune deuxième copie n'apparaît.
2. Choisissez *Projet*. La copie figure dans le tableau avec une petite icône de bibliothèque à côté du nom, appelée *Provient de la bibliothèque*. Le nom, le type, le tarif et l'unité sont en texte simple. Si vous survolez ces champs avec la souris, vous voyez *Valeur de bibliothèque — modifiez-la dans la vue Bibliothèque, ou dissociez cette ressource de la bibliothèque.*
3. Réglez *Unités max* pour ce projet. Le champ démarre avec la valeur de la bibliothèque de ressources et reste modifiable dans le projet.
4. Affectez maintenant la ressource à des tâches comme toute autre ressource, voir [Affecter des ressources avec une courbe](docs://howto-resource-toewijzen). *Ressources › Affectation › Affecter* n'affiche que les ressources déjà présentes dans le projet. Affectez donc d'abord une ressource de la bibliothèque de ressources au projet de cette manière.

*Affecter au projet* n'existe que dans la vue *Bibliothèque* d'un projet lié à cette bibliothèque de ressources.

### 4. Mettre une ressource de votre projet dans la bibliothèque de ressources

Vous faites cela pour une ressource que vous avez créée dans le projet et que vous utilisez souvent, par exemple une grue louée.

1. Dans la vue *Projet*, choisissez *Vers la bibliothèque* sur la ressource. Le bouton n'apparaît que sur une ressource qui a un nom et ne provient pas encore de la bibliothèque de ressources, dans un projet lié.
2. Lisez le message au-dessus du tableau.

Le message peut dire trois choses :

- *Ajouté.* La bibliothèque de ressources n'avait aucun élément de ce nom. Un nouvel élément a été créé et votre ressource y est liée.
- *Existait déjà dans la bibliothèque — désormais lié.* Il y avait un élément de même nom et aux mêmes données. Votre ressource y est liée.
- *Lié à l'élément existant de la bibliothèque — les valeurs diffèrent, voir le repère.* Il y avait un élément de même nom mais aux données différentes. Votre ressource est liée et immédiatement marquée *diffère — à décider*. Continuez à l'étape 6.

### 5. Dissocier une copie

Si vous voulez vous écarter de la bibliothèque de ressources dans un seul projet, par exemple avec un autre tarif, vous dissociez la copie.

1. Dans la vue *Projet*, cliquez sur l'icône *Dissocier de la bibliothèque* à la fin de la ligne.
2. La ressource est maintenant une ressource ordinaire du projet. Tous les champs sont modifiables et elle ne suit plus la bibliothèque de ressources. Le calendrier qui était venu avec la ressource est lui aussi dissocié, sauf si une autre ressource de ce projet le suit encore.

Avec *Annuler* (Ctrl+Z), vous annulez la dissociation.

### 6. Résoudre un écart

Une copie qui indique *diffère — à décider* diffère de l'élément de la bibliothèque de ressources. L'application ne décide pas qui a raison.

1. Cliquez sur le repère *diffère — à décider* sur la ressource. La fenêtre *Lier la bibliothèque de ressources* s'ouvre. Elle s'ouvre aussi d'elle-même quand vous ouvrez un fichier qui contient une telle copie.
2. Dans la section *Écarts*, choisissez ce que vous voulez pour l'élément, voir ci-dessous.
3. Cliquez sur *Décider plus tard* si vous ne voulez pas encore choisir. La fenêtre se ferme et le repère reste.

Pour un écart, vous avez deux choix :

- *Utiliser les valeurs de la bibliothèque* : la copie reçoit les données de la bibliothèque de ressources.
- *Reprendre les valeurs du fichier dans la bibliothèque* : la bibliothèque reçoit les données de votre copie. En dessous, il est écrit *Attention : ceci modifie la bibliothèque et s'applique à tous vos projets.* Les copies des autres projets ouverts suivent.

## Pièges et ce que fait l'application dans ce cas

**Les projets d'exemple ont leur propre bibliothèque.** Si vous ouvrez un des trois exemples de présentation (*Fichier › Exemples*, ou via un lien dans l'aide), l'application crée une fois la bibliothèque *Bibliothèque de ressources de démo* et lie le projet à celle-ci. Les ressources du projet qui portent le même nom qu'un élément de la bibliothèque sont liées tout de suite ; les calendriers ne le sont pas. Vos propres bibliothèques ne sont pas touchées. Si vous ouvrez deux exemples côte à côte, ils affichent ensemble des conflits dans [Utiliser la vue d'occupation](docs://howto-bezettingsoverzicht-gebruiken), par exemple pour l'équipe de maçonnerie (*Masonry crew*) entre *Refurbishment & Extension of a Family Home* et *6 New Terraced Houses, De Akkers*.

**Vous ne voyez pas le sélecteur.** Le projet n'est pas lié à une bibliothèque. Faites l'étape 1.

**Vous modifiez la bibliothèque par erreur.** Le panneau s'ouvre toujours sur *Projet* pour l'éviter. Les modifications dans la vue *Bibliothèque* s'appliquent à tous les projets et ne sont pas couvertes par *Annuler*.

**Vous supprimez une ressource de la bibliothèque.** L'application demande d'abord : *Supprimer « Bricklayer » de la bibliothèque ? Cela s'applique à tous les projets et est irréversible.* Les copies dans vos projets restent et continuent de fonctionner. Elles reçoivent le repère *n'est plus dans la bibliothèque* et sont entièrement modifiables. Avec *Retirer du projet*, vous retirez une copie du projet.

**Sous Bibliothèque de ressources, vous choisissez une autre bibliothèque ou *aucune (projet autonome)*.** Les marques d'origine de la bibliothèque précédente disparaissent. Les ressources restent dans le projet comme ressources ordinaires du projet. Avec une autre bibliothèque, l'application recherche à nouveau les ressources de même nom.

**Une ressource n'a aucune suggestion dans *Reconnaître*.** Elle indique *Aucune suggestion — choisissez manuellement*, mais cette fenêtre n'a pas de bouton pour cela. Cela ressemble à une lacune. Mettez une telle ressource dans la bibliothèque avec *Vers la bibliothèque* (étape 4).

## Voir aussi

- [La bibliothèque de ressources](docs://uitleg-resourcebibliotheek) : ce que décide la bibliothèque, ce que décide le projet, et comment les copies suivent.
- [Gérer et partager les bibliothèques de ressources](docs://howto-bibliotheken-beheren) : créer, exporter et importer des bibliothèques.
- [Utiliser la vue d'occupation](docs://howto-bezettingsoverzicht-gebruiken) : voir si deux projets demandent la même ressource en même temps.
- [Gérer les ressources](docs://howto-resources-beheren) : les ressources d'un seul projet.
