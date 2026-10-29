# Gérer et partager des bibliothèques de ressources

Objectif : créer et supprimer des bibliothèques de ressources, y placer des calendriers, et exporter ou importer une bibliothèque, comme sauvegarde ou pour l'utiliser sur un autre ordinateur.

## Quand en avez-vous besoin

La bibliothèque ne se trouve pas dans vos fichiers de projet, mais dans l'application : dans l'application de bureau, dans un fichier sur cet ordinateur ; dans le navigateur, dans le stockage de ce navigateur. Elle n'est pas synchronisée. Si vous effacez les données du site dans le navigateur, la bibliothèque disparaît ; exportez-la donc comme sauvegarde. Si un collègue veut travailler avec les mêmes équipes et les mêmes tarifs, vous lui transmettez aussi la bibliothèque sous forme de fichier. Si votre organisation compte plusieurs sociétés d'exploitation avec leurs propres équipes, vous créez une bibliothèque distincte pour chacune. Pour un nouveau projet, vous choisissez la bibliothèque qu'il utilise.

Ce qu'est une bibliothèque, vous le lisez dans [La bibliothèque de ressources](docs://uitleg-resourcebibliotheek). Vous ne modifiez pas les ressources elles-mêmes ici, mais dans le panneau des ressources, voir [Utiliser la bibliothèque de ressources](docs://howto-resourcebibliotheek-gebruiken).

## Étapes

### Ouvrir l'écran de gestion

Choisissez *Fichier › Bibliothèque*. À gauche se trouve la liste *Bibliothèques de ressources*. À droite se trouvent les détails de la bibliothèque sur laquelle vous cliquez : le nom, les boutons et la liste *Calendriers*. En haut, l'application indique que vous gérez les ressources dans l'onglet *Ressources*.

### Créer, renommer et choisir une bibliothèque par défaut

1. Cliquez sur le signe plus au-dessus de la liste (*Ajouter une bibliothèque de ressources*). Une bibliothèque *Nouvelle bibliothèque de ressources* est ajoutée, et elle est sélectionnée immédiatement.
2. Tapez le nouveau nom dans le champ du nom, en haut de la partie droite, puis appuyez sur Entrée, ou cliquez en dehors du champ. L'application n'accepte pas un nom vide.
3. Cliquez sur *Définir par défaut* pour que cette bibliothèque soit présélectionnée pour les nouveaux projets à partir de maintenant. La bibliothèque par défaut porte une étoile dans la liste.

### Placer un calendrier dans la bibliothèque

1. Sous *Calendriers*, cliquez sur *Depuis le projet*. Une liste s'ouvre avec les calendriers de votre projet actif.
2. Cliquez sur la petite flèche après le calendrier que vous voulez reprendre. Au-dessus de la liste, l'application affiche *Ajouté.* Un calendrier déjà lié à cette bibliothèque porte *déjà lié* après son nom.
3. Le calendrier se trouve maintenant dans la liste *Calendriers* de la bibliothèque. Avec le crayon (*Modifier*), vous changez le nom et vous enregistrez avec la coche. La corbeille supprime le calendrier immédiatement, sans demander de confirmation. Les copies dans les projets restent.

Après *Calendriers*, un numéro de version s'affiche, par exemple *v2*. Il augmente à chaque modification de la bibliothèque. Un calendrier de bibliothèque est copié dans un projet lorsque vous affectez une ressource qui l'utilise. Vous l'associez à une ressource dans *Ressources*, vue *Bibliothèque*, dans la colonne *Calendrier*.

### Exporter une bibliothèque

1. Choisissez la bibliothèque dans la liste.
2. Cliquez sur *Exporter*.
3. Dans l'application de bureau, ainsi que dans Chrome et Edge, vous choisissez où le fichier est enregistré. Dans les autres navigateurs, il va directement dans votre dossier de téléchargements, et l'application vous l'indique. Le fichier s'appelle `bibliotheek-` suivi du nom de la bibliothèque, avec l'extension `.ifc`.

Sous les boutons, l'application affiche *L'exportation sert aussi de sauvegarde : conservez le fichier en lieu sûr.*

### Importer une bibliothèque

1. Cliquez sur *Importer*. La fenêtre *Importer une bibliothèque* s'ouvre pour la bibliothèque que vous aviez sélectionnée dans la liste.
2. Cliquez sur *Choisir un fichier…* et sélectionnez le fichier `.ifc` d'une exportation. Si le fichier ne contient pas de bibliothèque, l'application affiche *Ce fichier IFC ne contient pas de bibliothèque de ressources.*
3. L'application affiche ce que contient le fichier, par exemple *2 calendriers, 5 ressources (version 3).*
4. Choisissez ce que vous voulez faire, voir ci-dessous.
5. Cliquez sur *Ajouter* ou *Remplacer*, ou sur *Annuler* pour arrêter.

Vous avez deux choix :

- *Ajouter comme nouvelle bibliothèque de ressources* : le fichier devient une bibliothèque distincte, à côté de vos bibliothèques existantes. En dessous, l'application indique sous quel nom, par exemple *Sera ajoutée sous le nom « Mijn resourcebibliotheek (2) ».* Rien n'est perdu et votre projet actif reste lié à sa propre bibliothèque.
- *Remplacer une bibliothèque de ressources existante* : le contenu entier de la bibliothèque choisie est remplacé par celui du fichier. L'application le signale aussi : *L'importation remplace la TOTALITÉ du pool de la bibliothèque de ressources choisie.* Si vous avez deux bibliothèques ou plus, vous choisissez laquelle sous *Importer dans la bibliothèque de ressources*. Si votre bibliothèque est plus récente que le fichier, l'application vous avertit : *Votre bibliothèque locale est plus récente — l'importer peut écraser vos modifications.*

L'application propose elle-même un choix. Pour un fichier qui contenait la bibliothèque par défaut, *Ajouter comme nouvelle bibliothèque de ressources* est présélectionné. Si la bibliothèque du fichier existe déjà sur votre ordinateur et n'est pas la bibliothèque par défaut, *Remplacer une bibliothèque de ressources existante* est présélectionné, avec exactement cette bibliothèque choisie. En cas de doute, choisissez ajouter : cela n'écrase rien.

### Supprimer une bibliothèque

1. Choisissez la bibliothèque dans la liste et cliquez sur *Supprimer la bibliothèque de ressources*. Le bouton est gris pour la dernière bibliothèque, car il en reste toujours une.
2. Confirmez avec *Supprimer*. La question est *Supprimer cette bibliothèque de ressources ?* Si des projets ouverts y sont liés, l'application affiche *Cette bibliothèque de ressources est liée à 1 projet ouvert. La supprimer déliera ce projet. Continuer ?* Pour plusieurs projets, elle affiche la même chose avec le nombre, par exemple *liée à 2 projets ouverts*.

La bibliothèque disparaît alors, avec toutes les ressources et tous les calendriers qu'elle contient. Les projets ouverts qui l'utilisaient ne sont plus liés à elle : leurs ressources restent des ressources ordinaires du projet. Exportez d'abord si vous voulez conserver le contenu.

### Transmettre un projet avec sa bibliothèque

Un fichier de projet contient ses propres copies des ressources. Si vous voulez aussi transmettre la bibliothèque complète, procédez comme suit. L'exportation elle-même est aussi décrite dans [Exportation](docs://howto-exporteren).

1. Ouvrez un projet lié à une bibliothèque et choisissez *Fichier › Exporter*.
2. Cochez *Enregistrer aussi le fichier de bibliothèque*. La case n'apparaît que pour un projet lié.
3. Choisissez la carte *IFC* et enregistrez le fichier. L'application demande alors aussi un second fichier. Il porte le nom du projet suivi de `-bibliotheek`, et contient la bibliothèque.

La case ne fonctionne que pour l'exportation IFC, pas pour les autres formats d'exportation. Votre collègue importe le second fichier comme décrit ci-dessus.

## Pièges et ce que fait l'application dans ce cas

**Deux planificateurs, deux bibliothèques.** L'application ne synchronise pas les bibliothèques entre les ordinateurs. La fenêtre d'importation affiche toujours un avertissement à ce sujet : *Remarque : les bibliothèques ne sont pas synchronisées entre les machines. Si deux planificateurs travaillent avec la même bibliothèque de ressources, les bibliothèques peuvent diverger. Si votre organisation partage des équipes entre plusieurs sociétés d'exploitation, choisissez délibérément une bibliothèque de ressources partagée.*

**Remplacer écrase tout.** Tout ce que vous aviez dans la bibliothèque choisie est perdu, et une modification de bibliothèque ne peut pas être annulée avec *Annuler*. Exportez d'abord si vous avez un doute. Vos projets gardent leurs copies. L'application met à jour les copies qui existent encore dans le nouveau fichier. Les copies qui n'y figurent plus reçoivent la mention *n'est plus dans la bibliothèque* et continuent de fonctionner. Si une copie diffère, la fenêtre *Lier la bibliothèque de ressources* s'ouvre (voir [Utiliser la bibliothèque de ressources](docs://howto-resourcebibliotheek-gebruiken)).

**Supprimer un calendrier de la liste se fait immédiatement.** L'application ne demande pas de confirmation, alors que supprimer une ressource en demande une. Cela ressemble à un défaut. Les modifications de bibliothèque ne peuvent pas être annulées avec *Annuler*.

## Voir aussi

- [La bibliothèque de ressources](docs://uitleg-resourcebibliotheek) : comment la bibliothèque et le projet sont liés.
- [Utiliser la bibliothèque de ressources](docs://howto-resourcebibliotheek-gebruiken) : lier des ressources, les affecter et résoudre les écarts.
- [Exportation](docs://howto-exporteren) : les formats d'exportation, dont IFC avec un fichier de bibliothèque.
