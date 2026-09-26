# Bibliothèques de ressources

Si vous travaillez sur plusieurs projets avec les mêmes équipes, les mêmes sous-traitants et les mêmes calendriers, vous ne voulez pas maintenir leur tarif, leur calendrier et leur type séparément dans chaque projet — les ressaisir à chaque fois et traquer chaque copie dès qu'un changement survient. C'est à cela que sert une bibliothèque de ressources : une source partagée de ressources et de calendriers qui appartient à votre organisation, vit en dehors des projets individuels, et dans laquelle plusieurs projets peuvent puiser. Ce guide explique comment la bibliothèque se rapporte à un projet, ce qui l'accompagne exactement et ce qui reste propre à chaque projet, et comment vous basculez entre les deux.

## Ce que vous allez apprendre ici

- La distinction entre la bibliothèque (partagée, à l'échelle de l'organisation) et le projet (ce que ce projet met réellement en œuvre).
- Lier un projet à une bibliothèque, ou le laisser délibérément autonome.
- Les deux vues de l'onglet Ressources : **Bibliothèque** et **Projet**.
- Les trois types de lignes que vous rencontrerez dans la vue projet : provenant de la bibliothèque, propre au projet, et orpheline.
- Ce qu'une ressource de bibliothèque apporte exactement au projet, et ce que vous réglez librement par projet.
- Les trois actions qui relient la bibliothèque et le projet.
- Comment l'application actualise les copies, et ce que vous avez à décider quand une copie a dévié.
- Le partage, la sauvegarde, et leurs limites.

Suivez [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) et [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc) : l'ouverture de l'une ou l'autre de ces vitrines la lie automatiquement à une même bibliothèque de ressources de démonstration partagée, et les équipes **Timmerlieden**, **Installateurs**, **Stukadoors** et **Schilders** réapparaissent sous exactement le même nom dans les deux — la preuve directe qu'une seule bibliothèque alimente plusieurs projets.

## Bibliothèque et projet : deux mondes

La **bibliothèque de ressources** est la source partagée : elle appartient à votre organisation, pas à un projet unique, et survit à chaque projet individuel. Le **projet** détermine ce que ce projet en particulier met effectivement en œuvre — avec sa propre capacité, sa propre disponibilité et son propre choix de calendrier. Un projet est lié à exactement une bibliothèque, ou reste entièrement autonome : dans ce dernier cas, tout fonctionne simplement comme d'habitude, seulement sans source partagée dans laquelle puiser ou vers laquelle réécrire.

## Lier un projet à une bibliothèque

Vous choisissez la bibliothèque à deux endroits, qui affichent le même panneau :

- L'**assistant de nouveau projet** (« Nouveau projet »), avec un sélecteur de bibliothèque.
- **Info projet** pour un projet existant — à la fois la boîte de dialogue et **Fichier → Info projet**.

Ce même sélecteur propose aussi **+ Nouvelle bibliothèque de ressources…**, qui permet d'en créer une sur-le-champ sans devoir d'abord passer par Fichier → Bibliothèque. **Aucune (projet autonome)** est un choix explicite dans la même liste — dissocier votre projet n'est donc jamais un effet secondaire accidentel, c'est toujours quelque chose que vous choisissez délibérément.

## L'onglet Ressources : deux vues

Dès qu'un projet est lié à une bibliothèque, l'onglet Ressources gagne un sélecteur en haut à droite avec deux vues :

- **Bibliothèque** — gérer la source elle-même. Tout y est directement modifiable, une modification s'applique immédiatement à **tous** les projets qui puisent dans cette bibliothèque, et échappe à l'annulation (Ctrl+Z) — ce n'est pas une modification de projet.
- **Projet** — ce que ce projet utilise réellement : le tableau de projet habituel, avec des marqueurs par ligne pour la provenance et les éventuels écarts.

Si vous travaillez avec plusieurs projets ouverts qui puisent tous dans la même bibliothèque, il existe aussi une troisième vue : **Occupation**. Elle montre, par ressource de bibliothèque, où celle-ci est réservée à travers *tous* les documents ouverts, et signale les jours où la somme de ces réservations dépasse la capacité de l'entreprise — la double réservation entre projets, qu'aucun projet ne peut voir à lui seul. Lisez le guide [Aperçu de l'occupation](docs://gids-bezettingsoverzicht).

## Trois types de lignes dans la vue projet

Dans la vue projet, vous rencontrerez trois types de lignes :

1. **Provenant de la bibliothèque** — reconnaissable au badge **Provient de la bibliothèque**. Le nom, le type, le tarif/heure et l'unité sont hérités de la bibliothèque et affichés ici en texte brut : vous ne les modifiez pas ici, mais dans la vue **Bibliothèque**. Les unités max., la capacité échelonnée dans le temps et le choix du calendrier sont, eux, librement modifiables — c'est exactement l'engagement propre à ce projet.
2. **Propre au projet** — aucun badge, entièrement modifiable. Même un projet lié peut avoir de telles lignes : utile pour des éléments ponctuels qui n'ont pas leur place dans la bibliothèque partagée, comme une grue louée ou un sous-traitant engagé pour ce seul chantier.
3. **Orpheline** — l'original de la bibliothèque a disparu ; la ligne est marquée **n'est plus dans la bibliothèque**. La copie elle-même continue de fonctionner normalement — vous pouvez la dissocier ou la supprimer.

## Ce qui suit la bibliothèque — et ce qui ne la suit pas

Voici la partie à retenir : certains champs relèvent d'un accord à l'échelle de l'entreprise et suivent la bibliothèque, d'autres relèvent de l'engagement propre à ce projet et vous les réglez librement, sans que cela compte jamais comme un écart.

**Suit la bibliothèque :**
- Nom
- Type
- Description
- Tarif/heure
- Unité
- Le **contenu** d'un calendrier qui a voyagé avec une ressource (jours ouvrés, heures, jours fériés)

**Vous décidez par projet, sans que cela compte comme un écart :**
- Unités max.
- La capacité échelonnée dans le temps
- Le **choix** du calendrier attaché à la ressource

Affectez une ressource de bibliothèque, et son calendrier voyage avec elle sous forme de copie liée qui continue elle-même de suivre la bibliothèque — c'est pourquoi le *contenu* de ce calendrier figure ci-dessus sous **Suit la bibliothèque**. Mais le *choix* du calendrier attaché à une ressource figure sous **Vous décidez par projet** : la même équipe peut très bien tourner sur un calendrier différent pour un chantier urgent que d'habitude, sans que cela constitue un écart par rapport à la bibliothèque. Cette distinction est subtile mais importante : modifiez le tarif ou le nom d'une ressource de bibliothèque, et la copie dévie de la bibliothèque ; modifiez son choix de calendrier ou ses unités max., et vous faites exactement ce pour quoi ce champ est prévu.

## Trois actions qui relient les deux mondes

- **Affecter au projet** — de la bibliothèque vers le projet : crée une copie modifiable avec provenance.
- **Vers la bibliothèque** — d'une ligne propre au projet vers la bibliothèque partagée : lie immédiatement. S'il existe déjà un élément portant le même nom dans la bibliothèque, l'application le lie à celui-ci plutôt que de dupliquer.
- **Dissocier de la bibliothèque** — la provenance disparaît, tout redevient entièrement modifiable. Un calendrier qui avait voyagé se dissocie avec elle, sauf si une autre ressource encore liée utilise ce même calendrier.

## Actualisation et écarts

L'application vérifie à quatre moments fixes si vos copies correspondent encore à la bibliothèque : à l'**ouverture** d'un fichier, lors du **changement** de document, après une **modification dans la bibliothèque**, et après une **restauration après incident**.

- Si une copie a simplement pris du retard (vous ne l'avez pas modifiée vous-même, mais la bibliothèque a évolué depuis), elle est **actualisée silencieusement** — vous voyez juste une brève notification, aucune question.
- Si une copie a été modifiée localement (ou par quelqu'un d'autre), le marqueur **diffère — à décider** apparaît, et l'application demande, pour chaque élément, ce qu'il faut faire : **Utiliser les valeurs de la bibliothèque**, **Reprendre les valeurs du fichier dans la bibliothèque**, ou **Décider plus tard**.

Ces choix ne peuvent pas être annulés avec Ctrl+Z — la deuxième option modifie en effet la bibliothèque elle-même, qui échappe entièrement à l'historique d'annulation du projet.

## Partage et sauvegarde

Un fichier de projet est toujours autonome et complet : donnez-le à quelqu'un sans votre bibliothèque, et tout continue de fonctionner, simplement sans source partagée. Vous exportez et importez une bibliothèque via **Fichier → Bibliothèque** — c'est aussi votre sauvegarde.

Lors de l'importation, vous choisissez entre deux options :

- **Ajouter comme nouvelle bibliothèque de ressources** — la bibliothèque du fichier s'ajoute simplement, comme bibliothèque supplémentaire à côté de vos bibliothèques existantes, et n'écrase jamais rien qui vous appartienne. Si l'expéditeur avait déjà séparé de son côté une seconde bibliothèque (par exemple pour un sous-traitant distinct), cette bibliothèque porte avec elle sa propre identité : un projet envoyé avec elle reconnaît immédiatement les équipes et calendriers qu'il utilisait déjà comme éléments de bibliothèque, sans que vous ayez rien à trier. Si l'expéditeur n'avait qu'une seule bibliothèque, jamais scindée — le cas le plus courant pour la plupart des gens — cette reconnaissance automatique ne se déclenche pas : vous liez alors vous-même le projet envoyé à la nouvelle bibliothèque, une seule fois, après quoi la correspondance par nom prend le relais. Si vous possédez déjà exactement cette bibliothèque, elle s'ajoute plutôt comme une copie distincte à côté.
- **Remplacer une bibliothèque de ressources existante** — l'intégralité du contenu de la bibliothèque que vous choisissez est écrasée par ce qui se trouve dans le fichier. Si votre propre version est plus récente que celle que vous importez, l'application vous en avertit au préalable.

L'option présélectionnée dépend du fichier : si l'application ne reconnaît pas encore la bibliothèque, « Ajouter comme nouvelle bibliothèque de ressources » est sélectionné ; si elle la reconnaît (la même bibliothèque, une version différente), « Remplacer une bibliothèque de ressources existante » est sélectionné, avec cette bibliothèque déjà choisie.

Les bibliothèques ne se synchronisent pas d'elles-mêmes entre machines : si deux planificateurs travaillent avec la même bibliothèque sur des ordinateurs différents, les bibliothèques peuvent diverger.

## Bibliothèque de ressources de démonstration dans les exemples

Ouvrez l'un des exemples vitrines (**Fichier → Exemples**, ou depuis ce panneau d'aide), et l'application crée une fois pour toutes une **Demo-resourcebibliotheek** et y lie l'exemple ouvert. [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) et [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc) partagent les mêmes équipes issues de cette bibliothèque, afin que vous voyiez immédiatement comment une seule bibliothèque alimente plusieurs projets. Vos propres bibliothèques de ressources existantes restent, elles, totalement intactes.

## Pour aller plus loin

- Affecter des ressources, lire l'histogramme et niveler concernent tous le versant projet des ressources — lisez le guide [Ressources, histogramme & nivellement](docs://gids-resources-histogram).
- Le calendrier lié à une ressource utilise les mêmes briques que n'importe quel autre calendrier — lisez le guide [Calendriers & planification horaire](docs://gids-kalenders-uren).
- Constatez par vous-même le partage d'équipes entre projets dans [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) et [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc).
