# Connecter un assistant IA (MCP)

Open Planner Studio peut s'ouvrir à un assistant IA. Activez le mode IA, et l'application elle-même devient un **serveur MCP** : un assistant tel que Claude se connecte à la fenêtre que vous avez ouverte à ce moment précis, lit votre planning et peut le modifier. Vous assistez en direct à ce qui se passe — chaque tâche qu'il ajoute apparaît immédiatement dans le Gantt — et tout ce que l'assistant fait, vous le défaites avec un simple Ctrl+Z.

C'est un modèle fondamentalement différent d'un export de fichier, modifié ailleurs, puis réimporté. Il n'y a pas de copie, pas de format intermédiaire, et aucun moment où vous et l'assistant regardez des choses différentes. Ce guide explique comment l'activer, comment connecter un assistant, ce qu'il peut faire et ne peut pas faire, et que tenter lorsque cela ne fonctionne pas.

## Ce que vous allez apprendre ici

- Activer le mode IA et trouver l'onglet IA.
- Démarrer le pont, et le laisser démarrer automatiquement avec l'application.
- Connecter un assistant — avec une invite toute prête ou un extrait de configuration.
- Ce qu'un assistant peut faire à votre planning.
- Les garde-fous : pause, lecture seule, sauvegarde automatique et le journal d'activité.
- Que faire quand la connexion échoue.

Le pont fonctionne **uniquement dans l'application de bureau**. L'onglet IA est visible dans la version navigateur, mais le serveur lui-même tourne dans la coque de bureau et ne peut pas y démarrer.

## L'activer

Le mode IA est désactivé par défaut. Vous l'activez dans **Paramètres → Application → Activer le mode IA** — via l'icône d'engrenage, l'onglet du ruban Paramètres ou Fichier → Paramètres ; les trois affichent le même interrupteur.

Une fois activé, un onglet supplémentaire **IA** apparaît dans le ruban. Désactivez à nouveau le mode IA, et l'onglet disparaît tandis qu'un pont en cours d'exécution est arrêté immédiatement — un serveur ne reste donc jamais à l'écoute sans que l'onglet ne soit là.

En dessous se trouve **Démarrer la passerelle automatiquement**. Cet interrupteur activé, le serveur passe en direct dès que vous ouvrez l'application, afin qu'un assistant puisse se connecter sans que vous ayez d'abord besoin d'ouvrir l'onglet IA. Il est désactivé par défaut : ouvrir un port à l'écoute sur votre propre machine doit rester un choix délibéré.

## L'onglet IA

L'onglet comporte quatre groupes.

**Serveur** — le bouton **Démarrer le pont** (ou **Arrêter le pont**) avec, à côté, le statut : *Désactivé*, *Actif sur le port 3877*, *Port … occupé* ou *Erreur*. Le même statut apparaît sous forme de point coloré en bas à droite de la barre d'état, afin que vous puissiez voir si le pont est vivant depuis n'importe quel autre onglet.

**Connexion** — le numéro de port (modifiable uniquement lorsque le serveur est arrêté ; un serveur en cours d'exécution conserve son port), le jeton, et le bouton **Se connecter**. Le jeton est masqué par défaut ; le bouton en forme d'œil le révèle, le bouton de copie le récupère, et **Nouveau jeton** en génère un tout frais. Notez que cette dernière action rompt *toutes* les connexions existantes, puisqu'elles portent toutes l'ancien jeton — c'est pourquoi l'application demande d'abord une confirmation.

**Sécurité** — **Mettre en pause**, **Lecture seule**, l'interrupteur **Sauvegarde automatique**, et les boutons **Sauvegarder maintenant** et **Ouvrir le dossier de sauvegarde**. Ce qu'ils font exactement est décrit plus loin, dans *Les garde-fous*.

**Activité** — le bouton **Panneau d'activité** ouvre une liste de chaque appel effectué par l'assistant : horodatage, nom de l'outil, durée, et succès ou échec. Développez n'importe quelle ligne pour voir les arguments et la réponse. C'est votre journal : vous n'avez pas à croire l'assistant sur parole quant à ce qu'il a fait.

## Connecter un assistant

Cliquez sur **Se connecter**. La fenêtre qui s'ouvre contient quatre blocs que vous copiez un par un :

1. **Point de terminaison** — l'adresse sur laquelle le pont écoute, `http://localhost:3877/mcp` par défaut. Le transport est HTTP streamable.
2. **Authentification** — l'en-tête HTTP qui doit accompagner chaque requête, sous la forme `Authorization: Bearer …`.
3. **Extrait de configuration** — un bloc JSON tout prêt à coller dans la configuration MCP de votre client.
4. **Invite de connexion** — un texte que vous collez directement dans votre assistant ; il se connecte lui-même puis vérifie sa propre liste d'outils.

Cette dernière option est la voie la plus courte et fonctionne avec n'importe quel assistant capable d'ajouter des serveurs MCP. L'invite est délibérément neutre vis-à-vis du fournisseur : elle ne nomme que l'adresse, le jeton et ce que l'assistant doit vérifier ensuite, si bien qu'elle fonctionne aussi bien avec un fournisseur qu'avec un autre.

La connexion est établie dès que l'assistant peut lister ses outils. Il devrait en voir près d'une quarantaine, tous commençant par `planner_`. S'il n'en voit aucun, le pont n'est pas démarré ou le jeton est incorrect.

Le jeton donne accès au plan que vous avez actuellement ouvert. Traitez-le comme un mot de passe : pas dans un document partagé, pas dans une conversation avec d'autres personnes.

## Ce qu'un assistant peut faire

Les outils couvrent à peu près tout ce que vous faites vous-même dans l'application :

- **Lire** — vue d'ensemble du projet, liste des tâches, une tâche en détail, le chemin critique, les ressources et leur histogramme, les calendriers, les baselines, et la comparaison avec une baseline.
- **Planifier** — créer des tâches (une WBS entière avec phases et sous-tâches en une seule fois), les modifier, les déplacer et les supprimer ; ajouter, changer et retirer des relations ; enregistrer l'avancement.
- **Configurer** — créer et affecter des ressources, gérer les calendriers et les jours non ouvrés, enregistrer et activer des baselines, niveler.
- **Gérer** — créer, dupliquer et changer de document, importer des fichiers de planning, et exporter vers IFC.

Deux points comptent plus que la liste elle-même.

**Un assistant peut travailler en un seul scénario.** Au lieu d'appeler un outil après l'autre, il peut soumettre une séquence d'étapes comme un tout. Ce n'est pas seulement plus rapide : le scénario entier devient une seule étape dans votre historique. S'il construit d'un coup un planning de quarante tâches avec toutes leurs relations, un seul Ctrl+Z le retire à nouveau. Si quelque chose échoue structurellement à mi-chemin, tout le scénario est annulé au lieu de vous laisser avec un planning à moitié terminé.

**Le planning est recalculé après chaque modification.** L'assistant n'a pas à le demander séparément et ne peut donc pas continuer à travailler par inadvertance sur des dates obsolètes.

## Ce qu'un assistant ne peut pas faire

Le pont est délibérément plus étroit que l'application. Quelques actions, un assistant ne peut tout simplement pas les accomplir, même si vous le lui demandez — il reçoit alors un refus qui explique la voie qui fonctionne réellement. Ce n'est pas une sécurité enfant : chaque cas concerne quelque chose qui va au-delà du projet que vous regardez à ce moment-là.

**La bibliothèque de ressources elle-même.** Un assistant ne peut ni créer, ni modifier, ni supprimer une ressource ou un calendrier de bibliothèque. Une bibliothèque est une donnée à l'échelle de l'application, partagée par tous vos projets, et les modifications qui y sont apportées échappent à l'historique d'annulation habituel. Un seul changement de tarif se répercuterait donc dans des projets qui ne sont même pas ouverts, sans possibilité de revenir en arrière. Vous faites cela vous-même, dans Backstage → Bibliothèque.

**Les champs figés d'une ressource héritée.** Si une ressource provient d'une bibliothèque, c'est cette bibliothèque qui détermine ce qu'*est* la ressource : nom, type, description, tarif horaire et unité. Ces champs apparaissent en texte brut dans l'onglet Ressources pour une bonne raison — vous ne pouvez pas non plus les modifier là — et l'assistant n'y a pas plus accès que vous. Ce que le *projet* détermine reste, lui, à sa disposition : unités max., la capacité échelonnée dans le temps, le calendrier et l'appartenance à une équipe. Demandez malgré tout un tarif horaire différent, et le refus nomme les deux véritables voies : le modifier dans la bibliothèque (ce qui s'applique alors à chaque projet), ou dissocier d'abord la ressource de la bibliothèque — elle devient alors propre au projet et entièrement modifiable, et cette dissociation elle-même se défait avec Ctrl+Z.

**Quel calendrier est le calendrier du projet.** Il peut modifier le contenu de ce calendrier, mais changer lequel le projet utilise est quelque chose que vous faites vous-même dans la bibliothèque de calendriers. Il en va de même pour des options de planification comme le réglage des chemins critiques multiples.

**L'application elle-même.** Il n'existe aucun outil pour les paramètres, le thème, la langue, les extensions ou le programme de mise à jour. Un assistant ne change rien à la façon dont votre programme est configuré.

**Les fichiers — oui, mais avec des limites.** Importer signifie qu'il peut lire un fichier de planning sur votre disque, et exporter qu'il peut écrire un IFC. L'écriture est confinée à votre dossier personnel, et un fichier existant n'est jamais écrasé sauf demande explicite. Un export n'est pas non plus un « enregistrement » : votre document reste marqué comme non enregistré dans l'application, il ne peut donc pas remplacer votre fichier de projet à votre insu.

Lorsqu'il demande la liste des ressources, un assistant voit immédiatement lesquelles proviennent d'une bibliothèque, à quelle bibliothèque elles appartiennent, et quels champs sont figés. Il n'a pas besoin de se heurter d'abord au mur pour le découvrir.

## Les garde-fous

**Mettre en pause** maintient le pont actif mais refuse toute modification ; la lecture reste autorisée. Utile quand vous voulez faire quelque chose vous-même sans couper la connexion.

**Lecture seule** fait la même chose, mais comme posture plutôt que comme pause : laissez un assistant analyser, rapporter sur ou comparer votre planning, sans qu'il puisse rien y changer.

**Sauvegarde automatique** crée automatiquement une copie IFC avant la première modification d'un document. Cela se produit une fois par document et par session, afin que vous n'accumuliez pas une pile de fichiers à chaque appel. **Sauvegarder maintenant** le fait immédiatement — pratique juste avant de laisser un assistant faire quelque chose de radical. **Ouvrir le dossier de sauvegarde** vous emmène là où elles se trouvent ; l'application conserve les dix dernières par document.

À cela s'ajoute l'historique d'annulation habituel, que l'assistant partage avec vous. Tout ce qu'il fait, vous pouvez le défaire — et l'assistant le peut également, puisque annuler et rétablir figurent aussi dans sa boîte à outils.

## Quand ça ne fonctionne pas

**« Port … occupé. »** Quelque chose écoute déjà sur ce port. C'est généralement une seconde fenêtre de cette application : le pont ne peut en desservir qu'une à la fois. Fermez l'autre fenêtre, ou choisissez un autre numéro de port pendant que le serveur est arrêté.

**L'assistant ne reçoit aucune réponse, ou reste bloqué.** Cela se produit quand la fenêtre derrière le serveur a disparu ou a été rechargée. Arrêtez le pont puis redémarrez-le ; si cela ne suffit pas, redémarrez l'application. Si vous doutez qu'il soit encore vivant, vérifiez le point de statut dans la barre d'état.

**L'assistant ne voit aucun outil, ou signale une erreur d'accès.** Alors le jeton est incorrect. Cela arrive surtout après avoir cliqué sur **Nouveau jeton** alors qu'une connexion était déjà établie : l'assistant porte encore l'ancien. Copiez le nouveau depuis la fenêtre **Se connecter** et mettez à jour la configuration de votre client.

**Rien ne se passe alors que l'assistant affirme que ça a fonctionné.** Consultez le panneau d'activité pour voir ce qu'il a réellement appelé et ce qui est revenu. En cas de refus, celui-ci nomme presque toujours à la fois le champ qui posait problème et l'alternative.

## Faire planifier correctement votre assistant IA

Un assistant qui connaît les outils peut malgré tout produire un planning dont aucun planificateur ne pourra rien faire : des tâches sans liens, une date fixe sur chaque tâche, ou un découpage bien trop fin pour être tenu à jour. Les principes qui évitent cela figurent dans le guide [Bien planifier](docs://gids-goed-plannen) — faites-le lire à votre assistant avant qu'il ne commence, ou renvoyez-y dans vos instructions. Le code source d'Open Planner Studio contient en outre une courte compétence d'agent sous `.claude/skills/goed-plannen/`, qui renvoie au même guide pour le fond et n'ajoute que ce qui est propre à l'agent : l'ordre d'utilisation des outils `planner_` et ce qu'il doit vous rapporter.

## Pour aller plus loin

- [Baselines & avancement](docs://gids-baselines-voortgang) — ce que la date de statut fait à votre planning. Bon à savoir avant de laisser un assistant la définir : ce n'est pas seulement une date de référence, elle avance aussi le travail pas encore démarré.
- [Import & export](docs://gids-import-export) — comment IFC, CSV, MS Project et P6 se rapportent les uns aux autres.
- [Paramètres](docs://ref-instellingen) — tous les paramètres réunis, y compris les deux interrupteurs IA.
