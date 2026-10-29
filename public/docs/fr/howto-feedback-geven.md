# Donner son avis

Objectif : signaler une erreur ou transmettre une idée, éventuellement avec une capture d'écran, directement depuis l'application.

## Quand en avez-vous besoin

Le planning calcule quelque chose que vous ne comprenez pas, un bouton ne fait pas ce qu'il doit faire, ou il vous manque quelque chose dans l'application. Un bon signalement aide les développeurs à trouver le problème. C'est pourquoi l'application ajoute elle-même la version, le système d'exploitation et la langue à votre signalement. Ce que vous décrivez vous-même décide s'ils peuvent en faire quelque chose : ce que vous avez fait, ce que vous attendiez et ce qui s'est passé.

## Étapes

1. Cliquez sur le bouton *Donner mon avis* en haut de la fenêtre. Ce bouton se trouve toujours dans la barre de titre. Son texte change toutes les dix minutes : *Donner mon avis*, *Signaler un bug* et *Proposer une nouvelle fonctionnalité*. C'est toujours le même bouton. La fenêtre *Envoyer un commentaire* s'ouvre.
2. Choisissez le type de signalement. *Quelque chose ne fonctionne pas* sert pour une erreur : quelque chose ne fait pas ce qu'il devrait faire. *Idée* sert pour ce qui vous manque ou ce que vous voudriez autrement. *Question ou remarque* sert pour le reste. *Quelque chose ne fonctionne pas* est sélectionné par défaut.
3. Remplissez le champ *Titre*, puis la *Description*. Les champs vides montrent un exemple : pour le titre, *Ex. : Le chemin critique change après l'enregistrement*, et pour la description la question *Que faisiez-vous, qu'attendiez-vous et que s'est-il passé ?* Tant que le bouton *Envoyer* est gris, une ligne grise à côté indique la raison, par exemple *Saisissez un titre.* ou que vous devez écrire au moins 10 caractères au total dans le titre et la description.
4. Si vous voulez une réponse, remplissez votre *Adresse e-mail*. Ce champ est facultatif. L'application retient l'adresse après un signalement réussi, donc elle est déjà là la prochaine fois.
5. Si vous voulez montrer quelque chose, activez *Joindre une capture d'écran*. L'application fait alors une image de l'application, sans cette fenêtre. Un instant plus tard, vous voyez un petit aperçu accompagné de trois boutons : *Annoter*, *Refaire* et *Retirer*.
6. *Annoter* ouvre un éditeur. Vous y placez des flèches, des rectangles, des traits à main levée et du texte sur l'image. Avec *Couvrir*, vous dessinez une zone noire sur ce qui ne doit pas être visible, comme un nom ou un montant. Cette partie disparaît alors réellement de l'image que l'application envoie. Vous choisissez la couleur, annulez votre dernière action avec *Annuler* ou recommencez avec *Tout effacer*. Cliquez sur *Terminé* pour garder vos modifications, ou sur *Annuler* (ou Échap) pour les jeter.
7. *Refaire* fait une nouvelle capture d'écran et efface vos annotations. *Retirer* supprime la capture d'écran et désactive la case à cocher.
8. Regardez la ligne grise *Envoyé avec* sous le formulaire. Elle montre ce que l'application envoie elle-même : la version, le système d'exploitation et la langue, par exemple *Envoyé avec : v2026.10.1 · Windows · English*.
9. Cliquez sur *Envoyer*. Pendant l'envoi, le bouton affiche *Envoi en cours…*.
10. Vous voyez *Merci, votre signalement a été envoyé.* Si une issue a été créée sur GitHub pour votre signalement, le bouton *Voir sur GitHub* est aussi là. Cliquez sur *Fermer*.

## Où va votre signalement

L'application envoie votre signalement à Open Feedback Studio, d'OpenAEC. Vous n'avez pas besoin de compte pour cela, pas même sur GitHub. Les développeurs voient votre signalement dans leur vue d'ensemble. Si cette vue est liée à GitHub, Open Feedback Studio en fait aussi une issue publique sur GitHub. Avec *Quelque chose ne fonctionne pas*, l'issue reçoit l'étiquette *bug* ; avec *Idée*, elle reçoit l'étiquette *enhancement*. Sous votre description, une ligne indique alors la version d'Open Planner Studio, votre système d'exploitation et la langue de l'application.

## Pièges et ce que fait alors l'application

**Votre signalement peut devenir public.** Ne mettez rien dedans que vous ne voulez pas partager. Cela vaut aussi pour la capture d'écran : l'image montre tout ce qui est visible dans l'application à ce moment, par exemple les noms de tâches et les ressources de votre projet. L'application fait la capture d'écran au moment où vous activez *Joindre une capture d'écran*. Si l'écran n'est pas encore correct, fermez la fenêtre, réglez correctement l'écran, rouvrez la fenêtre et cliquez sur *Refaire*. Utilisez *Couvrir* pour masquer ce que vous ne voulez pas montrer.

**La capture d'écran est trop grande.** L'application réduit la capture d'écran avant l'envoi. Si elle est encore trop grande après cela, votre signalement part sans image. L'écran de remerciement affiche alors *La capture d'écran était trop grande et n'a pas été envoyée.*

**L'envoi ne fonctionne pas.** Un message apparaît dans la fenêtre et votre texte reste. Il existe quatre cas :

- *Le signalement n'a pas été accepté.* Vérifiez le texte et l'adresse e-mail. Un signalement composé surtout de liens est refusé.
- *Vous avez envoyé beaucoup de signalements en peu de temps.* Réessayez dans une heure.
- *L'envoi a échoué.* Il n'y a pas de connexion ou le serveur ne répond pas. Réessayez, ou cliquez sur *Ouvrir sur GitHub*. Ce bouton n'est pas là si une tentative précédente était incertaine (voir ci-dessous).
- *Nous ne savons pas avec certitude si votre signalement est bien arrivé. Attendez une minute, puis envoyez-le à nouveau ; s'il est déjà là, nous le verrons automatiquement.* La connexion a été coupée après que l'application a envoyé votre signalement. Votre texte reste. Il n'y a pas de bouton *Ouvrir sur GitHub*, parce que votre signalement peut encore arriver. Cela reste ainsi jusqu'à ce que votre signalement soit envoyé ou déjà reçu, même si vous fermez la fenêtre entre-temps et la rouvrez.

**Votre signalement a déjà été reçu.** Si vous envoyez un signalement qui est déjà là, le formulaire reste avec ceci au-dessus : *Ce signalement est déjà reçu. Voulez-vous ajouter quelque chose ? Modifiez alors le texte et envoyez-le à nouveau.* Votre texte reste et votre adresse e-mail est retenue. Cliquez sur *Fermer* si vous ne voulez rien ajouter ; le formulaire est vide la prochaine fois. Si vous tapez encore quelque chose, le message disparaît et vous pouvez envoyer à nouveau ; le bouton s'appelle alors de nouveau *Enregistrer et fermer* et votre texte est conservé.

**Ouvrir sur GitHub.** C'est la voie sans Open Feedback Studio. Pour cela, vous avez besoin d'un compte GitHub. Sans capture d'écran, la page GitHub où vous créez une nouvelle issue s'ouvre tout de suite dans votre navigateur, avec votre titre et votre description déjà remplis. Avec une capture d'écran, vous voyez d'abord *Presque terminé — votre capture d'écran est dans le presse-papiers.* avec quatre étapes. Cliquez sur *OK, aller sur GitHub*, cliquez dans la grande zone de texte de la page de l'issue et appuyez sur Ctrl+V (Cmd+V sur Mac). Cliquez ensuite sur *Soumettre une nouvelle issue* en bas. Ce n'est qu'alors que votre signalement est envoyé.

**Le collage ne fonctionne pas.** Sur la voie GitHub, la capture d'écran est aussi enregistrée comme fichier sur votre ordinateur. Dans l'application de bureau, la fenêtre mentionne le chemin : *Impossible de coller ? Nous avons aussi enregistré la capture d'écran dans* ce chemin *— faites glisser ce fichier dans la zone de texte.* Dans le navigateur, l'application télécharge l'image sous le nom `feedback-` suivi d'un numéro et de l'extension `.png`. Vous la trouvez dans votre dossier de téléchargements et vous la faites glisser dans la zone de texte.

**La capture d'écran échoue.** L'application affiche : *La capture d'écran a échoué. Vous pouvez toujours envoyer un commentaire sans capture d'écran.* La case se désactive et vous pouvez envoyer votre signalement sans image.

**Vous fermez la fenêtre avant d'envoyer.** S'il y a quelque chose dans le formulaire, le bouton en bas s'appelle *Enregistrer et fermer* ; avec un formulaire vide, il s'appelle *Fermer*. *Enregistrer et fermer*, la croix et Échap ferment la fenêtre, et votre signalement est conservé comme brouillon jusqu'à ce que vous l'envoyiez ou cliquiez sur *Effacer*. Quand vous rouvrez la fenêtre, le type, votre texte, l'adresse e-mail et la capture d'écran avec annotations sont toujours là. Le brouillon est conservé tant que l'application est ouverte ; après que vous avez quitté l'application, il n'existe plus. Après un signalement réussi, le formulaire est de nouveau vide. Si vous voulez recommencer vous-même, cliquez sur *Effacer* en bas à gauche. Un clic à côté de la fenêtre ne la ferme pas. Pendant l'envoi, Échap ne ferme pas la fenêtre.

## Voir aussi

- [Mettre à jour l'application](docs://howto-app-bijwerken) : avant un signalement, vérifiez que vous avez la dernière version.
