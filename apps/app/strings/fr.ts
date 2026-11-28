// Every user-facing string in French (spec 076), with the keys of en.ts. Keep them in step: a new
// string goes in every language in the same change.
import type { Strings } from './types';

/** "James", "James et Lou", "James, Lou et Mia". */
const andList = (names: readonly string[]) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} et ${names.at(-1)}` : (names[0] ?? ''));

export const fr: Strings = {
  app: {
    name: 'Our Cocon',
  },
  // design/ui/TabBar.md
  tabBar: {
    label: 'Principal',
    home: 'Accueil',
    calendar: 'Calendrier',
    recipes: 'Recettes',
    groceries: 'Courses',
    menu: 'Menu',
  },
  // design/ui/OC-Welcome.md (spec 003)
  welcome: {
    title: 'Bienvenue sur Our Cocon',
    lead: 'Des recettes et des courses partagées par toute la famille.',
    google: 'Continuer avec Google',
    // Spec 045: iPhone only.
    apple: 'Continuer avec Apple',
    or: 'ou',
    emailLabel: 'Votre e-mail',
    emailHint: 'Nous vous enverrons un lien pour vous connecter. Pas besoin de mot de passe.',
    sendLink: 'M’envoyer un lien',
    sending: 'Envoi…',
    invalidEmail: 'Vérifiez votre adresse e-mail. Elle doit ressembler à nom@exemple.com.',
    sendFailed: 'Impossible d’envoyer le lien. Vérifiez votre connexion et réessayez.',
    googleFailed: 'Impossible d’ouvrir la connexion Google. Vérifiez votre connexion et réessayez.',
    appleFailed: 'Impossible de se connecter avec Apple. Réessayez, ou utilisez votre e-mail.',
    rateLimited: 'Trop de tentatives. Attendez une minute, puis réessayez.',
    checkTitle: 'Consultez vos e-mails',
    checkBody: (email: string) => `Nous avons envoyé un lien à ${email}. Ouvrez-le sur cet appareil pour vous connecter. Il est valable 1 heure.`,
    sendAgain: 'Renvoyer le lien',
    sentAgain: 'Lien renvoyé. Consultez vos e-mails.',
    differentEmail: 'Utiliser une autre adresse',
    signingIn: 'Connexion en cours…',
    linkExpired: 'Ce lien de connexion a expiré ou a déjà été utilisé. Demandez-en un nouveau.',
    linkOtherBrowser: 'Ouvrez le lien dans le navigateur où vous l’avez demandé, ou demandez-en un nouveau.',
    backToSignIn: 'Retour à la connexion',
    familyTitle: 'Créez votre famille',
    familyLead: 'Toutes les personnes que vous invitez partageront ses recettes et ses courses.',
    yourName: 'Votre prénom',
    yourNameHint: 'Visible par votre famille',
    yourNameMissing: 'Ajoutez votre prénom pour que votre famille sache qui vous êtes.',
    familyName: 'Nom de la famille',
    familyNamePlaceholder: 'Les Martin',
    familyNameMissing: 'Donnez un nom à votre famille.',
    createFamily: 'Créer la famille',
    creating: 'Création…',
    saveFailed: 'Impossible d’enregistrer. Réessayez.',
  },
  // design/ui/OC-Welcome.md › Join (spec 003)
  join: {
    title: (family: string) => `Rejoindre ${family}`,
    lead: (inviter: string) => `${inviter} vous invite à partager vos recettes et vos courses.`,
    join: (family: string) => `Rejoindre ${family}`,
    joining: 'Connexion à la famille…',
    expired: 'Cette invitation a expiré. Demandez-en une nouvelle.',
    openApp: 'Aller sur Our Cocon',
    hasMembers: 'Vous faites déjà partie d’une famille avec d’autres personnes. Demandez à son propriétaire de vous retirer, puis rouvrez ce lien.',
    replaceTitle: (own: string, family: string) => `Quitter « ${own} » et rejoindre « ${family} » ?`,
    replaceBody: (own: string) => `Votre famille « ${own} » et tout son contenu seront supprimés. Cette action est irréversible.`,
    keepMine: 'Garder la mienne',
    // Spec 033: a link made from a member's row ("Invite James") joins as that member.
    asMemberLead: (name: string) => `Vous rejoindrez la famille en tant que ${name}, avec la même couleur et les mêmes événements.`,
    joinAs: (name: string) => `Rejoindre en tant que ${name}`,
  },
  // design/ui/OC-Connect.md › Approve access (spec 023): an AI assistant asks to act as this member.
  oauthConsent: {
    title: (assistant: string) => `Autoriser ${assistant} à utiliser Our Cocon ?`,
    /** The name an app gave itself, when its return address doesn't prove who it is. */
    titleUnverified: (name: string) => `Autoriser « ${name} » à utiliser Our Cocon ?`,
    notReally: (name: string, host: string) => `Cette app se présente comme ${name}, mais elle vous renverrait vers ${host}. Ne l’autorisez que si vous faites confiance à ${host}.`,
    lead: 'Elle pourra voir et modifier les éléments de votre famille dans Our Cocon, comme les recettes et la liste de courses, en votre nom. Vous pouvez la déconnecter à tout moment dans Menu › Assistants IA.',
    sendsBackTo: (host: string) => `Vous reviendrez ensuite sur ${host}.`,
    allow: 'Autoriser',
    allowing: 'Connexion…',
    deny: 'Ne pas autoriser',
    allowed: (assistant: string) => `C’est fait. Vous pouvez revenir sur ${assistant}.`,
    denied: (assistant: string) => `${assistant} n’a pas reçu l’accès.`,
    signInTitle: 'Connectez-vous pour relier votre assistant IA',
    signInLead: 'Vous choisirez ensuite s’il peut utiliser Our Cocon.',
    expired: 'Cette demande a expiré. Revenez à votre assistant IA et reconnectez-le.',
    failed: 'Connexion impossible. Vérifiez votre connexion et réessayez.',
    unnamed: 'Votre assistant IA',
  },
  // design/ui/OC-Connect.md (spec 025): Settings › AI assistants, with its Connect and Manage sheets.
  // Connection steps checked against each assistant's help pages on 2026-10-26 (spec 025 FR-005).
  aiConnections: {
    back: 'Retour au menu',
    title: 'Assistants IA',
    lead: 'Laissez votre IA enregistrer des recettes, remplir la liste de courses et ajouter des événements pour vous. Chaque personne connecte le sien.',
    connected: (timeAgo: string) => `Connecté · utilisé ${timeAgo}`,
    notConnected: 'Non connecté',
    notAvailable: 'Pas encore disponible',
    notAvailableNote: (assistant: string) => `${assistant} ne peut pas encore se connecter à des apps comme Our Cocon. Nous l’ajouterons ici dès que possible.`,
    manage: 'Gérer',
    manageA11y: (assistant: string) => `Gérer ${assistant}`,
    connect: 'Connecter',
    connectA11y: (assistant: string) => `Connecter ${assistant}`,
    /** An app that connected but isn't one of the three (named by itself, so in quotes). */
    otherName: (name: string | null) => (name ? `« ${name} »` : 'Une autre app d’IA'),
    permissionsHeading: 'Ce que l’IA peut faire',
    permissions: { recipes_edit: 'Créer et modifier des recettes', groceries: 'Modifier la liste de courses', events: 'Ajouter et modifier des événements', reminders: 'Ajouter et modifier des rappels', recipes_delete: 'Supprimer des recettes' },
    allowed: 'Autorisé',
    notAllowed: 'Non autorisé',
    permissionLead: 'Pour les assistants IA que vous connectez. Chaque membre de la famille choisit pour les siens.',
    permissionFailed: 'Impossible d’enregistrer. Vérifiez votre connexion et réessayez.',
    trySaying: 'Essayez de dire',
    examples: ['« Enregistre la ratatouille de ma mère dans Our Cocon. Pour 4 personnes. »', '« Ajoute à nos courses ce qu’il me faut pour la quiche. »', '« Ajoute le pédiatre de James mercredi matin. »'],
    loading: 'Chargement de vos assistants IA',
    loadFailed: 'Impossible de charger vos assistants IA. Vérifiez votre connexion et réessayez.',
    retry: 'Réessayer',
    close: 'Fermer',
    // Connect sheet.
    connectTitle: (assistant: string) => `Connecter ${assistant}`,
    addressLabel: 'Adresse d’Our Cocon',
    copy: 'Copier',
    copied: 'Copié ✓',
    check: 'C’est fait — vérifier la connexion',
    checking: 'Vérification…',
    connectedResult: 'Connecté !',
    notYet: (step: number) => `Pas encore connecté. Vérifiez l’étape ${step} et réessayez.`,
    /** The step the "Not connected yet" message points to: where the address is added. */
    checkStep: 2,
    // Menu and button names in **…** are highlighted, like amounts in recipe steps.
    steps: {
      claude: [
        'Copiez l’adresse d’Our Cocon ci-dessous.',
        'Dans Claude, ouvrez **Customize › Connectors**, touchez **+ Add**, puis **Add custom connector**. Nommez-le **Our Cocon**, collez l’adresse, puis touchez **Continue** et **Add**.',
        'Quand Claude vous le demande, connectez-vous à Our Cocon et touchez **Autoriser**.',
      ],
      chatgpt: [
        'Copiez l’adresse d’Our Cocon ci-dessous.',
        'Dans ChatGPT sur le web, ouvrez **Plugins**, touchez **+** et choisissez d’ajouter une app MCP. Nommez-la **Our Cocon**, collez l’adresse sous **Connection**, gardez **OAuth**, cochez **I understand** et créez-la. Vous ne voyez pas cette option ? Activez d’abord **Developer mode** dans **Settings › Security and sign-in**.',
        'Quand ChatGPT vous le demande, connectez-vous à Our Cocon et touchez **Autoriser**.',
      ],
      gemini: [
        'Copiez l’adresse d’Our Cocon ci-dessous.',
        'Sur gemini.google.com, ouvrez **Settings › Connected Apps**. Sous **Custom apps**, choisissez **Add a custom app**, collez l’adresse et touchez **Next**.',
        'Quand Gemini vous le demande, connectez-vous à Our Cocon et touchez **Autoriser**.',
      ],
    },
    notes: {
      chatgpt: 'ChatGPT interrompt parfois une demande pour un contrôle de sécurité. Si cela arrive, redemandez simplement.',
      gemini: 'Pour l’instant, Gemini ne le propose qu’aux États-Unis, avec un compte Google personnel.',
    } as Partial<Record<'claude' | 'chatgpt' | 'gemini', string>>,
    // Manage sheet.
    lastUsed: (timeAgo: string) => `Dernière utilisation ${timeAgo}`,
    disconnect: 'Déconnecter',
    disconnectTitle: (assistant: string) => `Déconnecter ${assistant} ?`,
    disconnectBody: 'Il ne pourra plus voir ni modifier vos recettes, vos courses et votre calendrier.',
    cancel: 'Annuler',
    disconnectFailed: 'Impossible de déconnecter. Vérifiez votre connexion et réessayez.',
  },
  // design/ui/OC-Home.md (spec 028): brand row, greeting, latest-recipe hero and the two tiles.
  home: {
    brand: 'Our Cocon',
    /** FR-007: 5:00–11:59, 12:00–17:59, 18:00–4:59. */
    greeting: { morning: (name: string) => `Bonjour ${name}`, day: (name: string) => `Salut ${name}`, evening: (name: string) => `Bonsoir ${name}` },
    family: (names: string[]) => `Famille : ${names.join(', ')}`,
    moreMembers: (n: number) => `+${n}`,
    latestRecipe: 'Dernière recette',
    // In place of the latest recipe while something is cooking (spec 051), one card per cook.
    cookingNow: (step: number, total: number) => `En cuisine : étape ${step}/${total}`,
    cookingRegion: (n: number) => (n < 2 ? `${n} recette en cuisine` : `${n} recettes en cuisine`),
    showCook: (recipe: string) => `Afficher ${recipe}`,
    serves: (n: number) => (n < 2 ? `Pour ${n} personne` : `Pour ${n} personnes`),
    toBuyChip: (n: number) => `${n} à acheter`,
    toBuy: 'à acheter',
    familyRecipes: 'recettes de famille',
    noRecipes: {
      title: 'Qu’est-ce qu’on mange ce soir ?',
      body: 'Enregistrez votre première recette de famille et elle apparaîtra ici.',
      action: 'Ajouter votre première recette',
      hint: 'Ou demandez à votre assistant IA de l’ajouter pour vous.',
    },
    invite: {
      title: 'Invitez votre famille',
      body: 'Partagez Our Cocon pour que tout le monde voie les mêmes recettes, la même liste et le même calendrier.',
      action: 'Inviter',
    },
  },
  // design/ui/CalCard.md (spec 028): Home's calendar card.
  calCard: {
    label: 'Calendrier familial',
    show: 'Afficher',
    today: 'Aujourd’hui',
    thisWeek: 'Cette semaine',
    calendar: 'Calendrier',
    addEvent: 'Ajouter un événement',
    /** A strip day picked (FR-008): "+" adds on it. */
    addEventOn: (weekday: string) => `Ajouter un événement ${weekday}`,
    /** "Wednesday, Oct. 28", "Today, Sunday, Oct. 25". */
    dayTitle: (today: boolean, date: string) => (today ? `Aujourd’hui, ${date}` : date),
    dayEmpty: (weekday: string) => `Rien de prévu ${weekday}.`,
    wholeWeek: 'Toute la semaine',
    /** "Eva’s birthday is on Tuesday", "… is tomorrow", "… is today". */
    birthday: (title: string, when: 'today' | 'tomorrow' | string) => (when === 'today' ? `${title} aujourd’hui` : when === 'tomorrow' ? `${title} demain` : `${title} ${when}`),
    /** A reminder due today for tomorrow's event: "Tomorrow · 10:00". */
    tomorrow: (sub: string) => `Demain · ${sub}`,
    reminder: 'Rappel',
    seeAll: (n: number) => `Tout voir (${n} de plus)`,
    empty: 'Aucun événement dans les 7 prochains jours. En ajouter un ?',
    emptyAdd: '+ Ajouter un événement',
    openCalendar: 'Ouvrir le calendrier',
    /** The week row after the title: "06:30 · Gabriel". */
    detail: (who: string, when: string) => (who ? `${when} · ${who}` : when),
    rowLabel: (parts: string[]) => parts.filter(Boolean).join(', '),
    /** A strip day for screen readers, like a month day (spec 030 FR-006): "Today, October 25: Brunch, Baby swim". */
    dayLabel: (today: boolean, date: string, titles: string[]) => `${today ? 'Aujourd’hui, ' : ''}${date} : ${titles.length ? titles.join(', ') : 'rien de prévu'}`,
  },
  // design/ui/OC-Home.md › Latest activity and design/ui/OC-Activity.md (specs 026, 028): what the
  // family and their AI assistants changed, and Undo for an AI change.
  activity: {
    badge: 'IA',
    /** "Eva added Pumpkin soup", "Gabriel ticked 4 items". */
    title: {
      recipe_created: (who: string, recipe: string) => `${who} a ajouté ${recipe}`,
      recipe_edited: (who: string, recipe: string) => `${who} a modifié ${recipe}`,
      recipe_deleted: (who: string, recipe: string) => `${who} a supprimé ${recipe}`,
      recipe_restored: (who: string, recipe: string) => `${who} a restauré ${recipe}`,
      groceries_added: (who: string, n: number, name: string) => (n === 1 ? `${who} a ajouté ${name}` : `${who} a ajouté ${n} articles`),
      groceries_ticked: (who: string, n: number, name: string) => (n === 1 ? `${who} a coché ${name}` : `${who} a coché ${n} articles`),
      groceries_unticked: (who: string, n: number, name: string) => (n === 1 ? `${who} a décoché ${name}` : `${who} a décoché ${n} articles`),
      groceries_removed: (who: string, n: number, name: string) => (n === 1 ? `${who} a retiré ${name}` : `${who} a retiré ${n} articles`),
      groceries_cleared: (who: string, n: number) => (n < 2 ? `${who} a effacé ${n} article coché` : `${who} a effacé ${n} articles cochés`),
      event_created: (who: string, event: string) => `${who} a ajouté ${event}`,
      event_edited: (who: string, event: string) => `${who} a modifié ${event}`,
      event_deleted: (who: string, event: string) => `${who} a supprimé ${event}`,
      event_date_deleted: (who: string, event: string) => `${who} a supprimé une date de ${event}`,
      // Spec 060 and 032-later L144: reminders.
      reminder_created: (who: string, reminder: string) => `${who} a ajouté ${reminder}`,
      reminder_edited: (who: string, reminder: string) => `${who} a modifié ${reminder}`,
      reminder_completed: (who: string, reminder: string) => `${who} a coché ${reminder}`,
      reminder_snoozed: (who: string, reminder: string) => `${who} a reporté ${reminder}`,
      reminder_deleted: (who: string, reminder: string) => `${who} a supprimé ${reminder}`,
      reminder_restored: (who: string, reminder: string) => `${who} a restauré ${reminder}`,
      reminder_reopened: (who: string, reminder: string) => `${who} a rouvert ${reminder}`,
      other: (who: string, n: number) => (n < 2 ? `${who} a fait ${n} modification` : `${who} a fait ${n} modifications`),
    },
    /** In a title when the reader may not see the event, or it's gone for good. */
    privateEvent: 'un événement privé',
    anEvent: 'un événement',
    aRecipe: 'une recette',
    aReminder: 'un rappel',
    module: { recipes: 'Recettes', groceries: 'Courses', calendar: 'Calendrier', reminders: 'Rappels' },
    /** "from Leek & bacon quiche", in the sub-line of grocery items added from a recipe. */
    fromRecipe: (recipe: string) => `de ${recipe}`,
    via: (assistant: string) => `via ${assistant}`,
    /** "Recipes · via ChatGPT · 1 h ago", "Calendar · Wed, 10:00 · via Claude · 3 h ago". */
    sub: (parts: string[]) => parts.filter(Boolean).join(' · '),
    undoneBy: (name: string) => `Annulé par ${name}`,
    restoredBy: (name: string) => `Restauré par ${name}`,
    undo: 'Annuler',
    restore: 'Restaurer',
    undoA11y: (title: string) => `Annuler : ${title}`,
    restoreA11y: (title: string) => `Restaurer : ${title}`,
    seeAll: 'Voir toute l’activité',
    latest: 'Activité récente',
    show: 'Afficher',
    all: 'Tout',
    aiOnly: 'IA uniquement',
    noAi: 'Aucune modification par l’IA pour l’instant.',
    undone: 'Annulé',
    restored: 'Restauré',
    // Something changed after the AI's change (spec 026 edge case): a Dialog before undoing the rest.
    conflictTitle: 'Annuler le reste ?',
    conflict: {
      ticked: (name: string, n: number) => `${name} a coché ${n === 1 ? '1 de ces articles' : `${n} de ces articles`}.`,
      cleared: (name: string, n: number) => `${name} a effacé ${n === 1 ? '1 de ces articles' : `${n} de ces articles`}.`,
      edited: (name: string, n: number) => `${name} a modifié ${n === 1 ? '1 de ces éléments' : `${n} de ces éléments`} depuis.`,
      gone: (n: number) => (n < 2 ? `${n} de ces éléments a été supprimé définitivement.` : `${n} de ces éléments ont été supprimés définitivement.`),
    },
    conflictStays: 'Ils resteront tels quels.',
    undoRest: 'Annuler le reste',
    cancel: 'Annuler',
    nothingLeft: 'Tout cela a changé depuis, il n’y a donc plus rien à annuler.',
    expired: 'Il n’est plus possible d’annuler cette modification.',
    undoFailed: 'Impossible d’annuler. Vérifiez votre connexion et réessayez.',
    restoreFailed: 'Impossible de restaurer. Vérifiez votre connexion et réessayez.',
    // design/ui/OC-Activity.md: the full list, from Home's "See all activity".
    screenTitle: 'Activité',
    back: 'Retour à l’accueil',
    people: 'Personnes',
    assistants: 'Assistants',
    otherAssistant: 'Autre',
    showMore: 'Afficher plus',
    loading: 'Chargement de l’activité',
    loadFailed: 'Impossible de charger l’activité. Vérifiez votre connexion et réessayez.',
    // Spec 053 FR-018, FR-021: "Show more" while the next 20 load, and when they couldn't.
    loadingMore: 'Chargement…',
    loadMoreFailed: 'Impossible de charger plus d’activité. Vérifiez votre connexion et réessayez.',
    allEmptyTitle: 'Aucune activité pour l’instant',
    allEmptyBody: 'Quand quelqu’un de la famille ajoute ou modifie quelque chose, cela apparaît ici.',
    emptyTitle: 'Aucune modification par l’IA pour l’instant',
    emptyBody: 'Quand un assistant IA modifie quelque chose pour votre famille, cela apparaît ici. Vous pouvez l’annuler pendant 7 jours.',
    noMatches: 'Rien ne correspond à ces filtres.',
  },
  // design/ui/OC-Settings.md (spec 003 sections; the rest come with 021, 025, 027, 018 and 029)
  // design/ui/OC-Menu.md (spec 029): the last tab. Apps, then the settings pages.
  menu: {
    title: 'Menu',
    apps: 'Apps',
    settings: 'Réglages',
    calendar: 'Calendrier',
    recipes: 'Recettes',
    groceries: 'Courses',
    timers: 'Minuteurs',
    reminders: 'Rappels',
    today: (n: number) => (n === 0 ? 'Rien aujourd’hui' : `${n} aujourd’hui`),
    recipeCount: (n: number) => (n === 0 ? 'Aucune recette' : `${n} ${n === 1 ? 'recette' : 'recettes'}`),
    toBuy: (n: number) => (n === 0 ? 'Tout est acheté' : `${n} à acheter`),
    timersDetail: (running: number, paused: number) => (running > 0 ? `${running} en cours` : paused > 0 ? `${paused} en pause` : 'Aucun en cours'),
    /** What Home lists: late and due today. */
    toDo: (n: number) => (n === 0 ? 'Rien à faire' : `${n} à faire`),
    family: 'Famille',
    familyDetail: (names: readonly string[]) => `${names.join(', ')} · votre compte`,
    aiAssistants: 'Assistants IA',
    connected: (n: number) => (n < 2 ? `${n} connecté` : `${n} connectés`),
    notConnected: 'Non connecté',
    // Spec 046 (OC-SettingsNotif.md › Menu row).
    notifications: 'Notifications',
    notificationsDetail: 'Minuteurs, rappels d’événements',
    notificationsOff: 'Désactivées',
    // Spec 076: Menu › Language.
    language: 'Langue',
    calendarDetail: 'Votre affichage, moments de la journée',
    recipesDetail: 'Réglages de cuisine, unités',
    groceriesDetail: 'Où vous faites vos courses, formats en magasin',
    recentlyDeleted: 'Supprimés récemment',
    /** Recipes and events (spec 042). */
    items: (n: number) => (n === 0 ? 'Vide' : `${n} ${n === 1 ? 'élément' : 'éléments'}`),
  },
  settings: {
    // Spec 076: Menu › Language (not drawn). Each language is named in its own words.
    language: {
      back: 'Retour au menu',
      title: 'Langue',
      lead: 'Rien que pour vous, sur tous vos appareils.',
      automatic: (name: string) => `Automatique (${name})`,
      automaticHint: 'Suit la langue de votre téléphone ou de votre navigateur.',
      typedContent: 'Les recettes, listes et notes restent telles qu’elles ont été écrites.',
      names: { en: 'English', fr: 'Français', es: 'Español' },
      saveFailed: 'Impossible d’enregistrer. Réessayez.',
    },
    // Spec 046: Menu › Notifications (design/ui/OC-SettingsNotif.md).
    notifications: {
      back: 'Retour au menu',
      title: 'Notifications',
      lead: 'Rien que pour vous, sur cet iPhone.',
      web: 'Les notifications fonctionnent dans l’app iPhone.',
      offTitle: 'Les notifications sont désactivées pour Our Cocon',
      offBody: 'Les minuteurs ne peuvent pas sonner et les rappels n’arrivent pas quand l’app est fermée.',
      openSettings: 'Ouvrir les Réglages de l’iPhone',
      // Not asked yet (not drawn; written for spec 046).
      askBody: 'Entendez la sonnerie et voyez votre minuteur sur l’écran verrouillé, et recevez des rappels avant les événements familiaux, même quand Our Cocon est fermé.',
      turnOn: 'Activer les notifications',
      timers: 'Minuteurs',
      timersLive: 'Minuteur sur l’écran verrouillé',
      timersLiveHint: 'Compte à rebours sur l’écran verrouillé et dans la Dynamic Island',
      timersAlert: 'Alerte à la fin d’un minuteur',
      timersAlertHint: 'Sonnerie et notification, même quand l’app est fermée',
      reminders: 'Rappels d’événements',
      remindersOn: 'Rappels d’événements',
      remindersOnHint: 'Avant les événements qui ont un rappel',
      remindMe: 'Me rappeler',
      scopes: { mine: 'Les événements où je suis', all: 'Tous les événements de la famille' },
      defaultReminder: 'Par défaut pour les nouveaux événements',
      defaultReminderHint: 'Quand vous ajoutez un événement',
      reminderChoices: { none: 'Aucun', minutes_15: '15 minutes avant', hour_before: '1 heure avant', morning_of: 'Le matin même', day_before: '1 jour avant' },
      // The family's members without the app (spec 033). No pronouns are stored, so "them".
      managedHint: (names: readonly string[]) =>
        `Les événements de ${andList(names)} sont rappelés à la personne qui les accompagne, ou à tous ceux qui ont l’app si personne n’a encore été choisi.`,
      // Spec 059 FR-007: reminders (things to do) and each person's quiet hours.
      todo: 'Rappels',
      todoOn: 'Rappels',
      todoOnHint: 'Les choses à faire, et des relances jusqu’à ce qu’elles soient faites',
      quietHours: 'Heures calmes',
      quietValue: (from: string, to: string) => `${from}–${to}`,
      quietTitle: 'Heures calmes',
      quietHint: 'Pas de relances pendant ces heures. Ce qui est prévu à ce moment-là arrive à la fin.',
      quietFrom: 'De',
      quietTo: 'À',
      quietSave: 'Enregistrer',
      close: 'Fermer',
      saveFailed: 'Impossible d’enregistrer. Réessayez.',
    },
    // Spec 021: where the family shops (the Groceries tab's "Grocery settings" sheet, and the
    // Groceries page, OC-SettingsGroceries, spec 029).
    groceries: {
      back: 'Retour au menu',
      title: 'Courses',
      lead: 'Pour toute la famille. Vous pouvez aussi les modifier depuis l’onglet Courses.',
      shopLabel: 'Où faites-vous vos courses ?',
      shopHint: 'Pour que la liste affiche des formats que vous pouvez vraiment acheter',
      usStores: 'Magasins américains',
      euStores: 'Magasins européens',
      // The example is copy (OC-Settings), checked against the engine in GrocerySettings.test.tsx.
      exampleNeed: 'La recette demande ',
      exampleAmount: '300 ml de crème',
      exampleBuy: { us: 'Acheter 1 pinte', eu: 'Acheter 2 × 20 cl' },
      roundLabel: 'Arrondir aux formats du magasin',
      roundHint: 'Désactivé : la liste n’affiche que ce que demandent les recettes',
      saveFailed: 'Impossible d’enregistrer. Réessayez.',
    },
    // Spec 027: the family's cooking defaults (design/ui/OC-SettingsRecipes.md).
    recipes: {
      back: 'Retour au menu',
      title: 'Recettes',
      lead: 'Vos unités, et les réglages de cuisine de toute la famille. Chaque recette peut les modifier dans Modifier › Cette recette.',
      // Spec 051: units are each person's.
      forYou: 'Pour vous',
      unitsHint: 'Rien que pour vous. Le « … » d’une recette permet de les changer le temps d’une consultation.',
      cookingDefaults: 'Réglages de cuisine',
      keepAwake: 'Garder l’écran allumé en cuisinant',
      keepAwakeHint: 'Pour qu’il ne se verrouille pas quand vous avez les mains pleines de farine',
      kitchenScale: 'J’ai une balance de cuisine',
      kitchenScaleHint: 'Désactivé : affiche des tasses et des cuillères au lieu des grammes',
      thermometer: 'J’ai un thermomètre',
      thermometerHint: 'Désactivé : masque les contrôles de température dans les étapes',
      units: 'Unités',
      metric: 'Métrique · g, ml, °C',
      imperial: 'Impérial · oz, °F',
      saveFailed: 'Impossible d’enregistrer. Réessayez.',
    },
    // design/ui/OC-CalSettings.md (spec 029). The slot and time zone sheets aren't drawn.
    calendar: {
      back: 'Retour au menu',
      title: 'Calendrier',
      lead: 'L’affichage du calendrier familial pour vous, et les moments de la journée de la famille.',
      forYou: 'Pour vous',
      opensOn: 'S’ouvre sur',
      views: { month: 'Mois', week: 'Semaine', day: 'Jour', agenda: 'Agenda' },
      weekStart: 'La semaine commence le',
      weekStartHint: 'Automatique suit la région de ce téléphone',
      weekStarts: { automatic: 'Automatique', sunday: 'Dimanche', monday: 'Lundi' },
      timeFormat: 'Format de l’heure',
      timeFormatHint: 'Automatique suit les réglages de ce téléphone',
      timeFormats: { automatic: 'Automatique', '24h': '24 heures', '12h': '12 heures' },
      birthdays: 'Afficher les anniversaires',
      birthdaysHint: 'Aussi sur l’accueil, 3 jours avant',
      fadePast: 'Estomper les jours passés',
      fadePastHint: 'Pour qu’aujourd’hui et la suite ressortent',
      timesOfDay: 'Moments de la journée',
      timesOfDayLead: (owner: string) => `Utilisés par toute la famille quand vous choisissez un moment de la journée. Seul ${owner}, propriétaire de la famille, peut les modifier.`,
      hours: (start: string, end: string) => `${start}–${end}`,
      slotLabel: (slot: string, hours: string) => `${slot}, ${hours}`,
      family: 'Famille',
      homeTimeZone: 'Fuseau horaire de la famille',
      // Spec 071: only while the member keeps their own times on another zone.
      myTimeZone: 'Mon fuseau horaire',
      aiAssistants: 'Assistants IA',
      aiAssistantsSub: 'Laisser Claude, ChatGPT ou Gemini ajouter des événements',
      // The slot sheet (not drawn): Starts and Ends like Add event's custom times.
      starts: 'Début',
      ends: 'Fin',
      badTime: 'Indiquez une heure comme 18:30.',
      endBeforeStart: 'Choisissez une heure de fin après le début.',
      /** The neighbour that moves with an edge: "Afternoon will end at 18:30." */
      movesWith: (slot: string, edge: 'start' | 'end', time: string) => `${slot} ${edge === 'start' ? 'commencera' : 'finira'} à ${time}.`,
      overlap: (slot: string, previous: string) => `Les horaires ne peuvent pas se chevaucher. ${slot} doit commencer quand ${previous} se termine.`,
      cancel: 'Annuler',
      save: 'Enregistrer',
      saving: 'Enregistrement…',
      // The time zone sheet (not drawn). Spec 071: any member moves the family; times stay as entered.
      timeZoneLead: 'Toutes les dates du calendrier familial utilisent ce fuseau horaire. Le changer garde chaque événement et chaque rappel à l’heure saisie.',
      usePhoneZone: (zone: string) => `Utiliser le fuseau horaire de ce téléphone (${zone})`,
      sameZone: 'C’est déjà le fuseau horaire de la famille.',
      // Spec 071: the My time zone sheet (not drawn).
      myTimeZoneLead: (family: string) => `Vos horaires restent sur ce fuseau horaire ; le reste de la famille est à l’heure de ${family}. Ils reviennent d’eux-mêmes quand votre téléphone repasse à l’heure de ${family}.`,
      useFamilyZone: (family: string) => `Utiliser le fuseau horaire de la famille (${family})`,
      notSet: 'Pas encore défini',
      close: 'Fermer',
      saveFailed: 'Impossible d’enregistrer. Réessayez.',
    },
    family: {
      back: 'Retour au menu',
      title: 'Famille',
      lead: 'Qui fait partie de la famille, et votre propre compte.',
      heading: 'Membres',
      owner: 'Propriétaire',
      editor: 'Peut modifier',
      invite: 'Inviter quelqu’un',
      inviting: 'Création du lien…',
      inviteMessage: (family: string, url: string) => `Rejoignez ${family} sur Our Cocon : ${url}`,
      inviteCopied: 'Lien d’invitation copié. Envoyez-le par message.',
      inviteFailed: 'Impossible de créer une invitation. Réessayez.',
      inviteRateLimited: 'Trop de tentatives. Attendez une minute, puis réessayez.',
      memberLabel: (name: string, sub: string, role: string) => `${name}, ${sub}, ${role}`,
      // Spec 033 (OC-SettingsFamily › Members): members without the app.
      hasApp: 'A l’app',
      addedBy: (name: string) => `Ajouté par ${name}`,
      addedByFormer: 'Ajouté par un ancien membre',
      noAccount: 'Pas de compte',
      addWithoutApp: 'Ajouter sans l’app',
      withoutAppHint: 'Ajoutez les enfants ou toute personne qui n’utilisera pas l’app. Ils ont une couleur dans le calendrier, et vous choisissez qui les accompagne.',
      addTitle: 'Ajouter un membre de la famille',
      addLead: 'Pour les enfants ou toute personne qui n’utilisera pas l’app.',
      nameLabel: 'Prénom',
      colorLabel: 'Couleur',
      add: 'Ajouter',
      adding: 'Ajout…',
      nameMissing: 'Donnez-lui un prénom.',
      rename: 'Renommer',
      save: 'Enregistrer',
      saving: 'Enregistrement…',
      cancel: 'Annuler',
      changeColor: 'Changer de couleur',
      inviteManaged: (name: string) => `Inviter ${name}`,
      inviteMessageAs: (family: string, name: string, url: string) => `Rejoignez ${family} sur Our Cocon en tant que ${name} : ${url}`,
      removeManaged: 'Retirer',
      removeManagedTitle: (name: string) => `Retirer ${name} ?`,
      removeManagedBody: 'Son prénom et sa couleur sont retirés de la liste de la famille.',
      // Spec 035 (032-later L78): when they have upcoming events.
      removeManagedMoveTitle: (name: string, n: number) => `Passer ${n < 2 ? `le prochain événement de ${name}` : `les ${n} prochains événements de ${name}`} à Tout le monde ?`,
      removeManagedMoveBody: 'Ses événements passés restent dans le calendrier. Son prénom et sa couleur sont retirés de la liste de la famille.',
      colorTaken: 'Quelqu’un vient de prendre cette couleur. Choisissez-en une autre.',
      // My color (moved here from OC-CalSettings, spec 033 US3).
      myColor: 'Ma couleur',
      myColorLead: 'Vos événements s’affichent dans cette couleur pour tout le monde. Les couleurs prises indiquent qui les a.',
      colorNames: {
        honey: 'Miel',
        rose: 'Rose',
        sky: 'Ciel',
        mint: 'Menthe',
        lilac: 'Lilas',
        peach: 'Pêche',
        pistachio: 'Pistache',
        clay: 'Argile',
      },
      swatchMine: (color: string) => `${color}, votre couleur`,
      swatchPicked: (color: string) => `${color}, sélectionnée`,
      swatchTaken: (color: string) => `${color}, déjà prise`,
      swatchFree: (color: string) => `${color}, disponible`,
      makeOwner: 'Nommer propriétaire',
      remove: 'Retirer de la famille',
      close: 'Fermer',
      removeTitle: (name: string) => `Retirer ${name} de la famille ?`,
      removeBody: 'Cette personne perdra immédiatement l’accès aux recettes et aux courses de la famille. Vous pourrez l’inviter à nouveau plus tard.',
      removeConfirm: 'Retirer',
      removeCancel: (name: string) => `Garder ${name}`,
      ownerTitle: (name: string) => `Nommer ${name} propriétaire ?`,
      ownerBody: 'Vous restez dans la famille et pouvez toujours modifier. Seul le propriétaire gère les membres.',
      ownerConfirm: 'Nommer propriétaire',
      ownerCancel: 'Annuler',
      actionFailed: 'Impossible d’enregistrer. Réessayez.',
    },
    account: {
      heading: 'Votre compte',
      yourName: 'Votre prénom',
      nameSave: 'Enregistrer',
      nameSaving: 'Enregistrement…',
      nameCancel: 'Annuler',
      signOut: 'Se déconnecter',
      deleteFamily: 'Supprimer la famille',
      deleteFamilyTitle: (family: string) => `Supprimer « ${family} » ?`,
      deleteFamilyBody: (n: number) =>
        `La famille et tout son contenu seront supprimés pour ${n < 2 ? 'son unique membre' : `ses ${n} membres`}. Cette action est irréversible.`,
      deleteFamilyConfirm: 'Supprimer la famille',
      deleteAccount: 'Supprimer mon compte',
      deleteAccountTitle: 'Supprimer votre compte ?',
      deleteAccountBody: 'Vos recettes et vos événements restent dans la famille. Vous serez déconnecté sur tous vos appareils.',
      deleteAccountConfirm: 'Supprimer mon compte',
      keep: 'Le garder',
      failed: 'Impossible d’enregistrer. Réessayez.',
    },
  },
  // design/ui/OC-Recipes.md (spec 006; the filter logic comes with 007)
  recipes: {
    title: 'Recettes',
    new: 'Nouvelle',
    searchLabel: 'Rechercher des recettes',
    searchPlaceholder: 'Rechercher une recette ou un ingrédient',
    filters: (active: number) => (active === 0 ? 'Filtres' : `Filtres · ${active}`),
    inSeason: 'De saison',
    under30: 'Moins de 30 min',
    allGroup: (n: number) => `Toutes les recettes · ${n}`,
    // Spec 051 FR-003: recipes being cooked, above the list.
    inProgress: (n: number) => `En cours · ${n}`,
    /** "Step 3 of 6 · Gabriel · since 18:40", or "… · started yesterday" after 24 hours untouched. */
    cookLine: (step: number, total: number, member: string, since: string | null) => `Étape ${step} sur ${total} · ${member} · ${since ? `depuis ${since}` : 'commencé hier'}`,
    resumeA11y: (recipe: string, step: number, total: number) => `Reprendre ${recipe}, étape ${step} sur ${total}`,
    cancelA11y: (recipe: string) => `Arrêter de cuisiner ${recipe}`,
    doneA11y: (recipe: string) => `Terminer ${recipe}`,
    emptyTitle: 'Les recettes de votre famille seront ici.',
    emptyBody: 'Ajoutez-en une vous-même, ou demandez à votre assistant IA d’en enregistrer une.',
    emptyNew: 'Nouvelle recette',
    emptyAiLabel: 'IA',
    emptyAiHint: 'Essayez : « Enregistre la ratatouille de ma mère dans Our Cocon »',
    noMatchTitle: (query: string) => `Aucune recette ne correspond à « ${query} ».`,
    /** Said after a search settles (spec 030): "3 recipes", "1 recipe". */
    resultCount: (n: number) => (n < 2 ? `${n} recette` : `${n} recettes`),
    noMatchBody: 'Essayez un autre mot, ou ajoutez-la comme nouvelle recette.',
    clearSearch: 'Effacer la recherche',
    noFilterMatchTitle: 'Aucune recette ne correspond à ces filtres.',
    noFilterMatchBody: 'Essayez de retirer un filtre.',
    clearFilters: 'Effacer les filtres',
    loading: 'Chargement des recettes',
    loadFailed: 'Impossible de charger vos recettes. Vérifiez votre connexion et réessayez.',
    retry: 'Réessayer',
    // Spec 018: after "Delete recipe" (OC-Delete › After deleting).
    deleted: 'Recette supprimée',
    undo: 'Annuler',
    undoFailed: 'Impossible de restaurer. Réessayez.',
  },
  // design/ui/OC-Filters.md (spec 007)
  filters: {
    title: 'Filtres',
    clearAll: 'Tout effacer',
    close: 'Fermer',
    months: 'Meilleurs mois',
    monthsHint: 'Affiche les recettes idéales à cette période de l’année.',
    time: 'Temps total',
    under30: 'Moins de 30 min',
    from30to60: '30–60 min',
    over60: 'Plus d’1 heure',
    cuisine: 'Cuisine',
    showMore: (n: number) => `Afficher ${n} de plus`,
    other: 'Autre',
    addedBy: 'Ajoutée par',
    show: (n: number) => (n < 2 ? `Afficher ${n} recette` : `Afficher ${n} recettes`),
    noMatch: 'Aucune recette ne correspond',
    noMatchHint: 'Essayez de retirer un filtre',
  },
  // design/ui/OC-Recipe.md (spec 008; the "…" panel is 013, the Steps tab 009)
  recipePage: {
    back: 'Retour aux recettes',
    share: 'Partager la recette',
    /** The pencil in the top bar (spec 051 FR-012). */
    edit: 'Modifier la recette',
    /** The Source chip's spoken name (FR-015): "Source: La Cuisine de Mamie · p. 48". */
    sourceA11y: (source: string) => `Source : ${source}`,
    /** FR-005: from the family's done sessions. */
    cookedOnce: (when: string) => `Cuisinée une fois · ${when}`,
    cookedTimes: (n: number, member: string, when: string) => `Cuisinée ${n} fois · dernière fois par ${member}, ${when}`,
    // The "In progress" card under the chips (FR-004).
    cookingNow: (step: number, total: number) => `En cuisine · étape ${step} sur ${total}`,
    /** "Gabriel started at 18:40 · Classic, serves 6". */
    cookStarted: (member: string, at: string | null, variant: string | null, serves: number) =>
      `${member} ${at ? `a commencé à ${at}` : 'a commencé hier'} · ${variant ? `${variant}, pour ${serves} pers.` : `Pour ${serves} pers.`}`,
    cancel: 'Annuler',
    done: 'Terminé',
    resume: 'Reprendre',
    cancelled: 'Annulé',
    cookFailed: 'Impossible d’enregistrer. Vérifiez votre connexion et réessayez.',
    // Starting while someone's cooking it (spec 051 › Warnings and errors).
    alreadyCooking: (member: string, step: number) => `${member} cuisine cette recette (étape ${step})`,
    alreadyCookingYou: (step: number) => `Vous cuisinez cette recette (étape ${step})`,
    alreadyCookingLead: 'Reprenez là où elle en est, ou recommencez à l’étape 1.',
    resumeTheirs: (member: string) => `Reprendre là où en est ${member}`,
    resumeYours: 'Reprendre',
    startOver: 'Recommencer',
    bestMonths: (from: string, to: string) => `Idéal : ${from} – ${to}`,
    bestMonth: (month: string) => `Idéal : ${month}`,
    /** Several separate runs of months: "Best Jan, May – Jun". */
    bestRuns: (runs: string[]) => `Idéal : ${runs.join(', ')}`,
    monthRun: (from: string, to: string) => `${from} – ${to}`,
    version: 'Version',
    classic: 'Classique',
    servings: 'Personnes',
    fewerServings: 'Moins de personnes',
    moreServings: 'Plus de personnes',
    /** Said after −/+ (spec 030 FR-002): "5 servings", "7½ servings", "1 serving". */
    servingsAnnouncement: (n: string) => `${n} ${/^(0|1)?[¼½¾]?$/.test(n) ? 'personne' : 'personnes'}`,
    moreOptions: 'Plus d’options',
    tabsLabel: 'Affichage de la recette',
    ingredientsTab: (n: number) => `Ingrédients · ${n}`,
    stepsTab: (n: number) => `Étapes · ${n}`,
    ingredientsLabel: 'Ingrédients',
    variantTag: 'Variante',
    // The action bar (spec 051 FR-014): the cart (its label shows from 430 wide) and the main button.
    addToGroceries: 'Ajouter aux courses',
    startRecipe: 'Commencer la recette',
    resumeAt: (step: number) => `Reprendre · étape ${step}`,
    /** On a cook's last step (FR-005). */
    doneCooking: 'Terminer la recette',
    stepsLabel: 'Étapes',
    /** A row in the Steps tab opens cooking mode there. */
    /** A step row's screen-reader name (spec 030): "Step 3: Bake, 35:00 timer. Opens in cooking mode". */
    // Spec 067: the timer's length ("12 min timer") and the Variant tag are said too.
    openStep: (n: number, title: string, duration?: string, variant?: boolean) =>
      `Étape ${n} : ${title}${variant ? ', variante' : ''}${duration ? `, minuteur de ${duration}` : ''}. S’ouvre en mode cuisine`,
    // Spec 067 (OC-LargeScreens § Recipe): above the step cards, and the options link beside the columns.
    stepsHint: 'Touchez une étape pour l’ouvrir en mode cuisine',
    moreOptionsLink: 'Plus d’options · quantités, unités',
    closeOptions: 'Fermer les options',
    // The Steps tab (spec 009, OC-RecipeSteps).
    steps: {
      tempLabel: 'Contrôle de température :',
      tipLabel: 'Astuce du chef',
      startTimer: 'Lancer le minuteur',
      pause: 'Pause',
      resume: 'Reprendre',
      done: 'Terminé !',
      minus: '−1',
      plus: '+1',
      minusA11y: 'Une minute de moins',
      plusA11y: 'Une minute de plus',
      footnote: '−1 / +1 modifie un minuteur d’une minute, même pendant qu’il tourne.',
      /** A token whose ingredient is gone and whose name isn't known either. */
      missingIngredient: 'un ingrédient',
    },
    // What an option variant changes (FR-002): "Adds 3 ingredients and 1 step".
    effect: {
      adds: (what: string) => `Ajoute ${what}`,
      removes: (what: string) => `Retire ${what}`,
      changes: (what: string) => `Modifie ${what}`,
      ingredients: (n: number) => (n < 2 ? `${n} ingrédient` : `${n} ingrédients`),
      steps: (n: number) => (n < 2 ? `${n} étape` : `${n} étapes`),
      and: ' et ',
      /** Between "Adds …", "Removes …" and "Changes …". */
      list: '. ',
    },
    // The "…" panel under Servings (spec 013, OC-Recipe).
    more: {
      kitchenScale: 'J’utilise une balance de cuisine',
      scaleOnHint: 'Affiche les poids exacts, comme 100 g',
      scaleOffHint: 'Affiche des tasses et des cuillères, comme environ ¾ de tasse',
      scaleByIngredient: 'Adapter selon un ingrédient',
      converter: 'Convertisseur d’unités',
      units: 'Unités',
      metric: 'Métrique',
      imperial: 'Impérial',
      /** The chip under Servings after "Apply to recipe": "Scaled by lardons · Reset". */
      scaledBy: (ingredient: string) => `Adapté selon ${ingredient}`,
      reset: 'Réinitialiser',
      resetA11y: (ingredient: string) => `Annuler l’adaptation selon ${ingredient}`,
    },
    /** The header photo, for screen readers (spec 030). */
    photo: (recipe: string) => `Photo de ${recipe}`,
    stepPhoto: (n: number) => `Photo de l’étape ${n}`,
    deleted: (name: string) => `Cette recette a été supprimée par ${name}.`,
    loading: 'Chargement de la recette',
    loadFailedTitle: 'Impossible d’ouvrir cette recette.',
    loadFailedBody: 'Elle a peut-être été supprimée, ou vous êtes hors ligne.',
    retry: 'Réessayer',
  },
  // design/ui/OC-Share.md (spec 019): the share sheet.
  share: {
    title: 'Partager cette recette',
    close: 'Fermer',
    /** Family names read "The Smiths" (OC-Welcome), so a leading "The" isn't said twice. */
    fromFamily: (family: string) => `De la famille ${family.replace(/^(the|les)\s+/i, '')}`,
    photo: 'Photo de la recette',
    viewOnly: 'Lecture seule. Toute personne qui a le lien peut la lire et la cuisiner, mais pas la modifier ni voir vos autres recettes.',
    linkLabel: 'Lien',
    creating: 'Création du lien…',
    notShared: 'Non partagée',
    copy: 'Copier le lien',
    copied: 'Copié ✓',
    copiedBanner: 'Lien copié',
    createNew: 'Créer un nouveau lien',
    message: 'Message',
    email: 'E-mail',
    more: 'Plus',
    /** What Message, Email and More send: "{recipe name} — {link}". */
    shareText: (name: string, url: string) => `${name} — ${url}`,
    includeVariants: 'Inclure les variantes',
    includeTips: 'Inclure les astuces du chef',
    stop: 'Arrêter de partager ce lien',
    stopTitle: 'Arrêter le partage ?',
    stopBody: 'Le lien ne fonctionnera plus pour toutes les personnes qui l’ont.',
    stopConfirm: 'Arrêter le partage',
    stopKeep: 'Continuer le partage',
    // Not drawn (written for spec 019, added to OC-Share.md).
    failed: 'Impossible de créer le lien. Vérifiez votre connexion et réessayez.',
    retry: 'Réessayer',
    changeFailed: 'Impossible de modifier ce réglage. Réessayez.',
  },
  // design/ui/OC-SharedView.md (spec 019): the public shared recipe page.
  sharedView: {
    brand: 'Our Cocon',
    viewOnly: 'Lecture seule',
    photo: (recipe: string) => `Photo de ${recipe}`,
    sharedBy: (name: string) => `Partagée par ${name}`,
    /** When whoever made the link has left the family. */
    sharedByNobody: 'Partagée depuis Our Cocon',
    servings: 'Personnes',
    units: 'Unités',
    ingredients: 'Ingrédients',
    showMore: (n: number) => `Afficher ${n} de plus`,
    steps: 'Étapes',
    promoTitle: 'Gardez les recettes de votre famille au même endroit',
    promoBody: (recipe: string) => `Enregistrez ${recipe} dans votre propre Our Cocon et cuisinez avec des minuteurs et des quantités qui s’adaptent.`,
    save: 'Enregistrer dans mon Our Cocon',
    stoppedTitle: 'Cette recette n’est plus partagée.',
    stoppedBody: 'Demandez un nouveau lien à la personne qui vous l’a envoyée.',
    loading: 'Chargement de la recette',
    // Not drawn (written for spec 019, added to OC-SharedView.md).
    loadFailedTitle: 'Impossible d’ouvrir cette recette.',
    loadFailedBody: 'Vérifiez votre connexion et réessayez.',
    retry: 'Réessayer',
    saving: 'Enregistrement…',
    saveFailed: 'Impossible d’enregistrer cette recette. Réessayez.',
    /** The copy's Source field, crediting who shared it (FR-004). */
    source: (name: string) => `Partagée par ${name}`,
  },
  // design/ui/OC-ShareGroceries.md (spec 072): share the grocery list by link.
  groceryShare: {
    title: 'Partager la liste de courses',
    close: 'Fermer',
    info: (canEdit: boolean) =>
      canEdit
        ? 'Toute personne qui a le lien peut voir la liste en direct, sans compte. Elle peut ajouter, cocher et retirer des articles.'
        : 'Toute personne qui a le lien peut voir la liste en direct, sans compte.',
    howLong: 'Durée',
    durations: { '1h': '1 heure', today: 'Aujourd’hui', week: 'Cette semaine', none: 'Jusqu’à ce que j’arrête' },
    canEdit: 'Autoriser les modifications',
    linkLabel: 'Lien',
    notShared: 'Non partagée',
    creating: 'Création du lien…',
    create: 'Créer un lien',
    copy: 'Copier le lien',
    copied: 'Copié ✓',
    copiedBanner: 'Lien copié',
    /** Under the link: when it ends, in the device's time. */
    endsToday: (time: string) => `Se termine aujourd’hui à ${time}`,
    endsOn: (day: string, time: string) => `Se termine ${day} à ${time}`,
    untilStopped: 'Jusqu’à ce que vous arrêtiez le partage',
    message: 'Message',
    email: 'E-mail',
    more: 'Plus',
    /** What Message, Email and More send. */
    shareText: (url: string) => `Notre liste de courses — ${url}`,
    copyText: 'Copier en texte',
    textCopied: 'Liste copiée',
    nothingToCopy: 'Rien à acheter sur la liste.',
    /** The first line of the copied text. */
    textTitle: 'Courses',
    stop: 'Arrêter de partager ce lien',
    stopTitle: 'Arrêter le partage ?',
    stopBody: 'Le lien ne fonctionnera plus pour toutes les personnes qui l’ont.',
    stopConfirm: 'Arrêter le partage',
    stopKeep: 'Continuer le partage',
    failed: 'Impossible de créer le lien. Vérifiez votre connexion et réessayez.',
    retry: 'Réessayer',
    changeFailed: 'Impossible de modifier ce réglage. Réessayez.',
  },
  // design/ui/OC-SharedGroceries.md (spec 072): the public shared grocery list.
  sharedGroceries: {
    brand: 'Our Cocon',
    tag: 'Liste partagée',
    viewOnly: 'Lecture seule',
    title: 'Courses',
    /** "From the Demanges family · ends today at 23:59". */
    sub: (family: string, ends: string | null) => `De la famille ${family.replace(/^(the|les)\s+/i, '')}${ends ? ` · ${ends}` : ''}`,
    endsToday: (time: string) => `se termine aujourd’hui à ${time}`,
    endsOn: (day: string, time: string) => `se termine ${day} à ${time}`,
    loading: 'Chargement de la liste',
    stoppedTitle: 'Cette liste n’est plus partagée.',
    stoppedBody: 'Demandez un nouveau lien à la personne qui vous l’a envoyée.',
    loadFailedTitle: 'Impossible d’ouvrir cette liste.',
    loadFailedBody: 'Vérifiez votre connexion et réessayez.',
    retry: 'Réessayer',
    emptyTitle: 'La liste est vide.',
    emptyBody: 'Ajoutez ce qu’il vous faut ci-dessus.',
    /** A row's ✕, for screen readers. */
    removeItem: (name: string) => `Retirer ${name}`,
    readOnly: 'La liste est maintenant en lecture seule.',
    tooMany: 'Trop de modifications pour le moment. Réessayez plus tard.',
    promoTitle: 'Gérez votre foyer depuis un seul endroit',
    promoBody: 'Our Cocon réunit les recettes, les courses et le calendrier de votre famille.',
  },
  // design/ui/OC-ScaleIng.md (spec 013)
  scaleSheet: {
    title: 'Adapter selon un ingrédient',
    lead: 'Vous n’avez qu’une certaine quantité d’un ingrédient ? Choisissez-le et indiquez ce que vous avez. Tout le reste s’adapte.',
    which: '1. Quel ingrédient ?',
    showAll: (n: number) => `Afficher les ${n} ingrédients`,
    howMuch: '2. Combien en avez-vous ?',
    unit: 'Unité',
    enterAmount: 'Indiquez la quantité que vous avez',
    result: (factor: string, servings: string) => `Recette × ${factor} → environ ${servings} personnes`,
    bigChange: 'C’est un grand changement. Vérifiez les temps de cuisson.',
    rounded: (names: string) => `Arrondi à l’unité : ${names}. Les temps de cuisson ne changent pas.`,
    timesSame: 'Les temps de cuisson ne changent pas.',
    and: ' et ',
    cancel: 'Annuler',
    apply: 'Appliquer à la recette',
    close: 'Fermer',
  },
  // design/ui/OC-Units.md (spec 013)
  convertSheet: {
    title: 'Convertisseur d’unités',
    close: 'Fermer',
    tabsLabel: 'Que convertir',
    weight: 'Poids',
    volume: 'Volume',
    oven: 'Four',
    convert: 'Convertir',
    unit: 'Unité',
    forRecipe: 'Pour cette recette',
    weighs: (amount: string, ingredient: string, weight: string) => `${amount} ${/^[aeiouyhéèêàâîôûœ]/i.test(ingredient) ? 'd’' : 'de '}${ingredient} pèse environ ${weight}. Pratique si vous préférez peser sur votre balance.`,
    fills: (amount: string, ingredient: string, cups: string) => `${amount} ${/^[aeiouyhéèêàâîôûœ]/i.test(ingredient) ? 'd’' : 'de '}${ingredient} correspond à environ ${cups}. Pratique si vous préférez utiliser des tasses.`,
    footnote: 'Les tasses et les cuillères suivent les mesures américaines. Vous pouvez changer cela dans les réglages.',
  },
  // Unit names in the unit pickers (spec 013): short, as recipes print them.
  // design/ui/OC-EditBasics.md (spec 014): the recipe form's chrome and its Details section.
  recipeForm: {
    cancel: 'Annuler',
    newTitle: 'Nouvelle recette',
    editTitle: 'Modifier la recette',
    save: 'Enregistrer',
    saving: 'Enregistrement…',
    saveRecipe: 'Enregistrer la recette',
    sections: { details: 'Détails', ingredients: 'Ingrédients', steps: 'Étapes', variants: 'Variantes' },
    next: (section: string) => `Suivant : ${section}`,
    saveFailed: 'Impossible d’enregistrer. Réessayez.',
    loadFailedTitle: 'Impossible d’ouvrir cette recette.',
    loadFailedBody: 'Elle a peut-être été supprimée, ou vous êtes hors ligne.',
    retry: 'Réessayer',
    aiBadge: 'IA',
    aiHint: 'Plus rapide : dites à votre assistant IA « Enregistre la quiche de mamie dans Our Cocon » et il remplit tout pour vous.',
    addPhoto: 'Ajouter une photo (facultatif)',
    changePhoto: 'Changer la photo',
    removePhoto: 'Retirer',
    photoLabel: 'Photo de la recette',
    uploadingPhoto: 'Envoi de la photo…',
    photoFailed: 'La photo n’a pas pu être envoyée. Réessayez.',
    photoDenied: 'Our Cocon n’a pas accès à vos photos. Autorisez l’accès dans Réglages.',
    crop: {
      title: 'Cadrer votre photo',
      hint: 'Faites glisser pour choisir ce qui s’affiche en haut de la recette.',
      zoomIn: 'Zoom avant',
      zoomOut: 'Zoom arrière',
      use: 'Utiliser la photo',
      cancel: 'Annuler',
    },
    name: 'Nom de la recette',
    description: 'Courte description',
    descriptionHint: 'Une phrase qui donne faim.',
    counter: (n: number) => `${n} / 140`,
    serves: 'Nombre de personnes',
    totalTime: 'Temps total',
    bestMonths: 'Meilleurs mois pour la faire',
    bestMonthsHint: 'Laissez vide si elle est bonne toute l’année.',
    advanced: 'Mode avancé',
    advancedHint: 'Afficher tous les champs : temps de préparation, cuisine, source',
    prepTime: 'Temps de préparation',
    cuisine: 'Cuisine',
    cuisinePlaceholder: 'Choisir',
    cuisineOther: 'Autre',
    close: 'Fermer',
    source: 'Source',
    optional: '(facultatif)',
    sourcePlaceholder: 'Un livre et une page, un site web ou « Mamie »',
    // Spec 051 FR-015: what Source is for, and that assistants fill it in.
    sourceHint: 'Livre et page, site web ou personne. Les assistants la remplissent, ou mettent leur propre nom s’il n’y a rien d’autre.',
    // Spec 051 FR-013: the recipe's own settings and Delete, at the end of Details when editing.
    thisRecipe: 'Cette recette',
    thisRecipeLead: 'Seulement pour cette recette. Les réglages par défaut de la famille sont dans Menu › Recettes.',
    nameMissing: 'Donnez un nom à votre recette',
    servesInvalid: 'Saisissez un nombre de 1 à 50',
    timeInvalid: 'Essayez « 1 h 10 » ou « 70 min »',
    discardTitle: 'Abandonner vos modifications ?',
    discardBody: 'Vos modifications de cette recette ne seront pas enregistrées.',
    discard: 'Abandonner',
    keepEditing: 'Continuer à modifier',
    // Spec 015 (OC-EditIngredients).
    ingredients: {
      title: 'Ingrédients',
      servings: (n: number) => (n < 2 ? `Pour ${n} personne` : `Pour ${n} personnes`),
      lead: 'Pour ce qui se compte (œufs, poireaux), ajoutez aussi le poids d’une pièce. Le détail, c’est la préparation ; il s’affiche sous le nom et dans la liste de courses.',
      add: '+ Ajouter un ingrédient',
      paste: 'Coller une liste',
      tip: 'Astuce : collez « 200 g de lardons, 100 g de gruyère, râpé… » et nous le découperons en lignes. Ce qui suit une virgule va dans Détail.',
      name: 'Nom de l’ingrédient',
      namePlaceholder: 'Ingrédient, par ex. poireaux',
      quantity: 'Quantité',
      quantityPlaceholder: 'Quantité',
      weightPlaceholder: '?',
      unit: 'Unité',
      unitMissingButton: 'Unité ?',
      noUnit: 'Sans unité',
      each: 'l’unité ≈',
      grams: 'g',
      weight: 'Poids d’une pièce (g)',
      // Spec 051 FR-011: how it's prepared, saved as its prep note.
      detail: 'Détail (facultatif)',
      detailPlaceholder: 'Détail (facultatif) · émincé, à température ambiante…',
      remove: (name: string) => `Retirer ${name || 'l’ingrédient'}`,
      handle: 'Faire glisser pour réordonner',
      moveUp: 'Monter',
      moveDown: 'Descendre',
      suggestions: 'Suggestions',
      newIngredient: 'Nouvel ingrédient. Choisissez son rayon :',
      /** Eggs, cloves, bay leaves: a fraction typed is saved whole (spec 005 FR-003). */
      wholeOnly: (noun: string, to: string) => `Pas de fraction pour les ${noun} : enregistré comme ${to}.`,
      pickAisle: 'Choisir un rayon',
      aisle: 'Rayon',
      warnings: {
        unitMissing: 'Choisissez une unité pour pouvoir convertir et ajuster la quantité.',
        quantityInvalid: 'Saisissez une quantité comme 2, 1½ ou 1/2.',
        amountMissing: 'Ajoutez une quantité, ou choisissez « Sans unité ».',
        weightInvalid: 'Saisissez le poids d’une pièce en grammes, par ex. 150.',
        nameMissing: 'Donnez un nom à cet ingrédient.',
      },
      removeTitle: (name: string) => `Retirer ${name} ?`,
      removeBody: (steps: number[]) =>
        steps.length === 1
          ? `Il est utilisé à l’étape ${steps[0]}. Nous le retirerons aussi de cette étape.`
          : `Il est utilisé aux étapes ${steps.slice(0, -1).join(', ')} et ${steps.at(-1)}. Nous le retirerons aussi de ces étapes.`,
      removeConfirm: 'Retirer',
      removeCancel: 'Annuler',
      pasted: (n: number) => (n < 2 ? `${n} ingrédient ajouté. Vérifiez les quantités.` : `${n} ingrédients ajoutés. Vérifiez les quantités.`),
      pastedNothing: 'Nous n’avons trouvé aucun ingrédient dans ce texte.',
      pasteTitle: 'Coller une liste',
      pasteField: 'Vos ingrédients',
      pasteHint: 'Un par ligne, ou séparés par des virgules.',
      pasteAdd: 'Ajouter les ingrédients',
      sizes: { small: 'petit', medium: 'moyen', large: 'gros' },
    },
    // design/ui/OC-EditSteps.md (spec 016): the Steps section.
    steps: {
      title: 'Étapes',
      stepName: 'Nom de l’étape',
      instructions: 'Instructions',
      instructionsHint: 'Tapez @ ou touchez ci-dessous pour insérer un ingrédient. Sa quantité s’ajoute et s’adapte toute seule.',
      insert: (name: string) => `+ ${name}`,
      insertA11y: (name: string) => `Insérer ${name}`,
      suggestions: 'Suggestions d’ingrédients',
      missingChip: 'Ingrédient manquant',
      missingBody: 'Cet ingrédient a été retiré. Supprimez l’étiquette ou ajoutez-le à nouveau.',
      temperatureKindLabel: 'S’agit-il du four ou d’une mesure au thermomètre ?',
      oven: 'Four',
      thermometer: 'Thermomètre',
      preview: 'Aperçu',
      addTo: 'Ajouter à cette étape',
      timer: 'Minuteur',
      temperature: 'Contrôle de température',
      tip: 'Astuce du chef',
      photo: 'Photo',
      on: (label: string) => `${label} ✓`,
      timerField: 'Minuteur',
      timerPlaceholder: '8 min',
      timerLabel: 'Nom du minuteur',
      tempValue: 'Température',
      tempHint: 'Pour une mesure au thermomètre. La température du four va dans les instructions.',
      celsius: '°C',
      fahrenheit: '°F',
      tempText: 'Ce qu’il faut vérifier',
      tempTextPlaceholder: 'le cœur atteint',
      tempTextHint: 'Tapez {temp} là où va la mesure, sinon elle se place à la fin.',
      tempPreview: 'Contrôle de température :',
      tipField: 'Astuce du chef',
      tipPlaceholder: 'Ce que vous auriez aimé savoir la première fois',
      tipCounter: (n: number) => `${n} / 200`,
      photoLabel: (n: number) => `Photo de l’étape ${n}`,
      addStep: '+ Ajouter une étape',
      removeStep: 'Retirer l’étape',
      removeTitle: 'Retirer cette étape ?',
      removeBody: 'Ses instructions et ses ajouts disparaissent avec elle.',
      removeConfirm: 'Retirer',
      removeCancel: 'La garder',
      tipBadge: 'Astuce',
      tempBadge: 'Temp.',
      photoBadge: 'Photo',
      open: (n: number, name: string) => (name ? `Étape ${n}, ${name}. Touchez pour modifier.` : `Étape ${n}. Touchez pour modifier.`),
      handle: 'Faire glisser pour réordonner',
      moveUp: 'Monter',
      moveDown: 'Descendre',
      warnings: {
        bodyMissing: 'Ajoutez des instructions ou retirez cette étape',
        bodyTooLong: 'Cette étape est trop longue. Divisez-la en deux étapes.',
        timerInvalid: 'Saisissez des minutes, comme 8 ou 1 h 30',
        tempInvalid: 'Saisissez une température, comme 71',
      },
    },
    // The Variants section (spec 017, OC-EditVariants).
    variants: {
      title: 'Variantes',
      optional: '(facultatif)',
      lead: 'Une variante change quelques éléments de la recette. On la choisit d’un simple geste sur la page de la recette.',
      changeCount: (n: number) => (n < 2 ? `${n} modification` : `${n} modifications`),
      open: (name: string, count: string) => `${name || 'Variante sans nom'}, ${count}. Touchez pour modifier.`,
      name: 'Nom de la variante',
      namePlaceholder: 'Par ex. Végétarienne',
      shownAs: 'Affichée comme',
      version: 'Une version (au choix)',
      option: 'Une option (activée/désactivée)',
      whatChanges: 'Ce qui change',
      addChange: 'Ajouter une modification',
      add: {
        swap_ingredient: 'Remplacer un ingrédient',
        add_ingredient: 'Ajouter un ingrédient',
        remove_ingredient: 'Retirer un ingrédient',
        add_step: 'Ajouter une étape',
        change_step: 'Modifier une étape',
        remove_step: 'Retirer une étape',
      },
      tag: {
        swap_ingredient: 'Remplacer l’ingrédient',
        add_ingredient: 'Ajouter l’ingrédient',
        remove_ingredient: 'Retirer l’ingrédient',
        add_step: (place: 'before' | 'after', n: number) => `Ajouter une étape · ${place === 'before' ? 'avant' : 'après'} l’étape ${n}`,
        change_step: (n: number) => `Modifier l’étape ${n}`,
        remove_step: (n: number) => `Retirer l’étape ${n}`,
        /** A change whose step is gone: no number to give. */
        stepGone: 'Étape retirée',
      },
      /** The add-step summary's timer: "Make the dough · 30 min timer". */
      timer: (time: string) => `Minuteur ${time}`,
      noTimer: 'Sans minuteur',
      tempCheck: (text: string) => `Contrôle de température : ${text}`,
      noTempCheck: 'Sans contrôle de température',
      newText: (text: string) => `« ${text} »`,
      unnamedStep: (n: number) => `Étape ${n}`,
      nothingYet: 'Aucune modification pour l’instant',
      editChange: (tag: string) => `${tag}. Touchez pour modifier.`,
      pickIngredient: 'Quel ingrédient ?',
      pickStep: 'Quelle étape ?',
      where: 'Où',
      before: 'Avant',
      after: 'Après',
      stepChoice: (n: number, title: string) => (title ? `Étape ${n} · ${title}` : `Étape ${n}`),
      noIngredients: 'Ajoutez d’abord des ingrédients à la recette.',
      noSteps: 'Ajoutez d’abord des étapes à la recette.',
      replaceWith: 'Remplacer par',
      addAnother: '+ Ajouter un autre ingrédient',
      newIngredient: 'Nouvel ingrédient',
      newStep: 'Nouvelle étape',
      changedStep: 'L’étape avec cette variante',
      done: 'Terminé',
      removeChange: 'Retirer la modification',
      conflict: (name: string) => `Aussi modifié par « ${name} »`,
      broken: 'Cette modification renvoie à un élément qui a été retiré.',
      newVariant: '+ Nouvelle variante',
      deleteVariant: 'Supprimer cette variante',
      deleteTitle: 'Supprimer cette variante ?',
      deleteBody: 'Ses modifications disparaissent avec elle. Rien n’est enregistré tant que vous n’avez pas touché Enregistrer.',
      deleteConfirm: 'Supprimer',
      deleteCancel: 'La garder',
      warnings: {
        nameMissing: 'Donnez un nom à cette variante',
        noChanges: 'Ajoutez au moins une modification, ou supprimez cette variante',
      },
      changeWarnings: {
        pickIngredient: 'Choisissez l’ingrédient concerné',
        pickStep: 'Choisissez l’étape concernée',
        swapEmpty: 'Ajoutez ce qui le remplace',
        addEmpty: 'Nommez l’ingrédient à ajouter',
        stepEmpty: 'Rédigez l’étape, ou retirez cette modification',
        stepUnchanged: 'Changez quelque chose dans l’étape, ou retirez cette modification',
        rows: 'Vérifiez les ingrédients ci-dessous',
        steps: 'Vérifiez l’étape ci-dessous',
      },
    },
  },
  // design/ui/OC-Delete.md (spec 018): the danger link at the end of the edit form, and its Dialog.
  deleteRecipe: {
    link: 'Supprimer la recette',
    failed: 'Impossible de supprimer. Réessayez.',
  },
  // design/flows.md › Recently deleted (spec 018; not drawn, copy in design/ui/OC-Settings.md).
  recentlyDeleted: {
    back: 'Retour au menu',
    title: 'Supprimés récemment',
    /** "Deleted by Gabriel · 3 days ago · 27 days left" ("Former member" once that person left). */
    sub: (by: string, daysAgo: number, daysLeft: number) => {
      const ago = daysAgo === 0 ? 'aujourd’hui' : `il y a ${daysAgo} ${daysAgo === 1 ? 'jour' : 'jours'}`;
      return `Supprimé par ${by} · ${ago} · ${daysLeft <= 1 ? 'Dernier jour' : `encore ${daysLeft} jours`}`;
    },
    restore: 'Restaurer',
    restoreA11y: (name: string) => `Restaurer ${name}`,
    deleteNow: 'Supprimer maintenant',
    deleteNowTitle: (name: string) => `Supprimer « ${name} » définitivement ?`,
    deleteNowBody: 'Ses photos et ses variantes seront supprimées aussi. Cette action est irréversible.',
    keep: 'Garder',
    restored: (name: string) => `« ${name} » est de retour dans vos recettes.`,
    // Spec 042: deleted events are listed too.
    eventRestored: (title: string) => `« ${title} » est de retour dans votre calendrier.`,
    eventDeleteNowBody: 'Cette action est irréversible.',
    // Spec 057: deleted reminders are listed too.
    reminderRestored: (title: string) => `« ${title} » est de retour dans vos rappels.`,
    emptyTitle: 'Rien ici.',
    emptyBody: 'Les recettes, événements et rappels que vous supprimez restent ici pendant 30 jours.',
    loading: 'Chargement des éléments supprimés récemment',
    loadFailed: 'Chargement impossible. Réessayez.',
    retry: 'Réessayer',
    restoreFailed: 'Impossible de restaurer. Réessayez.',
    deleteFailed: 'Impossible de supprimer. Réessayez.',
  },
  // design/ui/OC-RecipeSettings.md (specs 017 and 027; the switches come with 027)
  recipeSettings: {
    title: 'Réglages de la recette',
    lead: 'Ces réglages ne changent que cette recette. Les réglages par défaut de votre famille sont dans Menu › Recettes.',
    editRecipe: 'Modifier la recette',
    // Spec 027: this recipe's own settings; each follows the family's default until changed.
    keepAwake: 'Garder l’écran allumé',
    kitchenScale: 'J’utilise une balance de cuisine',
    kitchenScaleHint: 'Affiche « 100 g » au lieu de « environ 1 tasse »',
    thermometer: 'Contrôles au thermomètre',
    units: 'Unités',
    unitsDefault: 'Par défaut',
    metric: 'Métrique',
    imperial: 'Impérial',
    sameAsDefault: 'Comme par défaut',
    changed: 'Modifié pour cette recette',
    reset: 'Réinitialiser',
    saveFailed: 'Impossible d’enregistrer. Réessayez.',
    variants: 'Variantes',
    edit: 'Modifier',
    editA11y: 'Modifier les variantes',
    variantsLead: 'Les variantes sont des versions de cette recette. Elles remplacent des ingrédients ou ajoutent des étapes sans faire de copie.',
    addVariant: 'Ajouter une variante',
    variantA11y: (name: string, summary: string) => `${name}. ${summary}. Touchez pour modifier.`,
    loading: 'Chargement des réglages de la recette',
    loadFailedTitle: 'Impossible d’ouvrir cette recette.',
    loadFailedBody: 'Elle a peut-être été supprimée, ou vous êtes hors ligne.',
    retry: 'Réessayer',
    back: 'Retour à la recette',
    backTo: (recipe: string) => `Retour à ${recipe}`,
    // A variant's one line (OC-RecipeSettings › Layout 6), its changes joined by " · ".
    summary: {
      replaces: (old: string, with_: string) => `remplace ${old} par ${with_}`,
      ingredients: (n: number) => (n < 2 ? `${n} ingrédient` : `${n} ingrédients`),
      adds: (what: string) => `ajoute ${what}`,
      removes: (what: string) => `retire ${what}`,
      addsStep: (name: string) => (name ? `ajoute l’étape « ${name} »` : 'ajoute une étape'),
      changesStep: (n: number) => `modifie l’étape ${n}`,
      removesStep: (n: number) => `retire l’étape ${n}`,
      changesGone: 'modifie une étape retirée',
      join: ' · ',
      nothing: 'Aucune modification pour l’instant',
    },
  },
  // design/ui/OC-Groceries.md (spec 020; the store row and Buy lines come with 021)
  groceries: {
    title: 'Courses',
    loading: 'Chargement de la liste',
    loadFailed: 'Impossible de charger la liste. Vérifiez votre connexion et réessayez.',
    retry: 'Réessayer',
    toBuy: (n: number) => `${n < 2 ? `${n} article` : `${n} articles`} à acheter · partagée avec la famille`,
    shopping: (name: string) => `${name} fait les courses`,
    addLabel: 'Ajouter un article',
    addPlaceholder: 'Ajouter un article, par ex. 2 citrons',
    addButton: 'Ajouter l’article',
    addFailed: 'Impossible d’ajouter cet article. Réessayez.',
    merged: (total: string) => `Déjà sur la liste. Quantité mise à jour : ${total}.`,
    mergedNoAmount: 'Déjà sur la liste.',
    // A row's source line (spec 051 FR-009): how its recipes prepare it.
    inRecipe: (detail: string) => `Dans la recette : ${detail}`,
    inRecipes: (details: string) => `Dans les recettes : ${details}`,
    fromDeletedRecipe: 'D’une recette supprimée',
    // A row more than one person typed in (spec 022).
    addedManually: 'Ajouté à la main',
    // A row added to by several: "In recipes: for the pan · cold, cubed · Added by Gabriel".
    sourcePartsJoin: ' · ',
    // A recipe card (spec 052 FR-006): its body opens the recipe, its "…" the menu.
    onTheList: (items: number) => `${items < 2 ? `${items} article` : `${items} articles`} sur la liste`,
    /** A recipe's items on their way to the list (spec 022), on its card. */
    addingRecipe: (items: number) => (items === 1 ? 'Ajout d’un article…' : `Ajout de ${items} articles…`),
    recipeMeta: (items: number, serves: number) => `${items < 2 ? `${items} article` : `${items} articles`} sur la liste · pour ${serves} pers.`,
    openRecipe: (recipe: string) => `Ouvrir ${recipe}`,
    moreForRecipe: (recipe: string) => `Plus d’options pour ${recipe}`,
    // The recipe card's menu (spec 052 FR-008, OC-GroceryRecipeMenu).
    servings: 'Nombre de personnes',
    fewerServings: 'Moins de personnes',
    moreServings: 'Plus de personnes',
    onTheListFor: (n: number) => (n < 2 ? `Sur la liste pour ${n} personne` : `Sur la liste pour ${n} personnes`),
    wasServings: (n: number) => `Avant : ${n}`,
    servingsHint: 'Modifie les articles de cette recette encore à acheter. Les articles cochés restent tels quels.',
    saveServings: (n: number) => `Enregistrer pour ${n}`,
    removeRecipeItems: 'Retirer ses articles',
    removedRecipe: (items: number, recipe: string) => `${items < 2 ? `${items} article retiré` : `${items} articles retirés`} pour ${recipe}.`,
    addedBy: (name: string) => `Ajouté par ${name}`,
    // Spec 072: a row a guest added through the shared link.
    addedViaLink: 'Ajouté via le lien partagé',
    // Spec 021: what to buy, beside the name: "Heavy cream: 1 pint carton (need 300 ml)".
    needNote: (amount: string) => `(il faut ${amount})`,
    // A count, as read by @cocon/quantity: "1 piece", "2 pieces", "½ piece", "1½ pieces".
    pieces: (amount: string) => (amount === '1' || amount === '½' || amount === '¼' || amount === '¾' ? `${amount} pièce` : `${amount} pièces`),
    packCount: (count: number, label: string) => `${count} × ${label}`,
    onePack: (label: string) => `1 ${label}`,
    packsJoin: ' + ',
    loose: (amount: string) => `${amount} en vrac`,
    // The list's settings sheet (the button beside "Add item").
    settingsButton: 'Réglages des courses',
    shareButton: 'Partager la liste de courses',
    settingsTitle: 'Réglages des courses',
    editItem: (name: string) => `Modifier ${name}`,
    // "Clear all" (screen reader "Clear all items") and its Dialog.
    clearAllButton: 'Tout effacer',
    clearAll: 'Effacer tous les articles',
    clearAllTitle: (n: number) => (n === 1 ? 'Effacer l’article de la liste ?' : `Effacer les ${n} articles de la liste ?`),
    clearAllBody: 'Tous les articles seront retirés, cochés ou non, pour toute la famille. Vous pourrez annuler juste après.',
    clearAllConfirm: 'Effacer tous les articles',
    clearAllCancel: 'Garder la liste',
    // FR-004: the family's own pack size, from Edit (not drawn; OC-Groceries › Row menu).
    storeSize: 'Format en magasin',
    storeSizeLead: (name: string) => `Le format vendu pour ${name} là où vous faites vos courses. Enregistré pour votre famille.`,
    storeSizeLabel: 'Taille du paquet',
    storeSizeHint: 'Un paquet, par ex. 250 g, 20 cl ou 6',
    storeSizeInvalid: 'Saisissez une seule quantité, comme 250 g ou 1 l.',
    storeSizeReset: 'Utiliser les formats habituels',
    storeSizePieces: (n: string) => `paquet de ${n}`,
    emptyTitle: 'Votre liste est vide.',
    emptyBody: 'Ajoutez des articles ci-dessus, ou depuis une recette avec « Ajouter aux courses ».',
    clearDoneButton: 'Effacer les cochés',
    clearDone: 'Effacer les articles cochés',
    cleared: (n: number) => (n < 2 ? `${n} article effacé` : `${n} articles effacés`),
    removed: (name: string) => `Retiré : ${name}.`,
    undo: 'Annuler',
    syncFailed: 'Mise à jour impossible. Réessayez.',
    // Row actions (long-press, swipe left, or the screen reader's actions).
    edit: 'Modifier',
    moveTo: 'Déplacer vers…',
    remove: 'Retirer',
    close: 'Fermer',
    moveLead: (name: string) => `${name} ira désormais ici, pour votre famille.`,
    editTitle: 'Modifier l’article',
    editLabel: 'Article',
    editHint: 'Une quantité et un nom, par ex. 2 citrons ou 100 g de gruyère',
    save: 'Enregistrer',
    cancel: 'Annuler',
  },
  // OC-AddGroceries (spec 022): pick a recipe's ingredients for the list.
  addGroceries: {
    title: 'Ajouter aux courses',
    lead: (recipe: string, serves: string) => `${recipe} · pour ${serves} pers. Décochez ce que vous avez déjà à la maison.`,
    group: 'De cette recette',
    groupNote: 'Tout est coché au départ',
    // Not drawn: the header's link, for when most of it is already at home.
    untickAll: 'Tout décocher',
    tickAll: 'Tout cocher',
    alreadyOnList: (existing: string, total: string) => `Déjà sur la liste (${existing}) → passera à ${total}`,
    cancel: 'Annuler',
    add: (n: number) => (n === 1 ? 'Ajouter 1 article' : `Ajouter ${n} articles`),
    nothingSelected: 'Rien de sélectionné',
    adding: 'Ajout…',
    // The toast once added, with Undo and "See the list".
    added: (n: number) => (n < 2 ? `${n} article ajouté aux courses` : `${n} articles ajoutés aux courses`),
    seeList: 'Voir la liste',
    close: 'Fermer',
    // Not drawn (OC-AddGroceries › States).
    addFailed: 'Impossible d’ajouter ces articles. Vérifiez votre connexion et réessayez.',
    undoFailed: 'Impossible d’annuler. Réessayez.',
  },
  // Grocery aisles (spec 031), in store order, named as in OC-Groceries › Aisles.
  aisles: {
    produce: 'Fruits et légumes',
    bakery: 'Boulangerie',
    dairy_eggs: 'Produits laitiers et œufs',
    meat_fish: 'Viande et poisson',
    dry_goods: 'Épicerie',
    spices_baking: 'Épices et pâtisserie',
    frozen: 'Surgelés',
    drinks: 'Boissons',
    household: 'Entretien et maison',
    other: 'Autre',
  },
  unitShort: {
    g: 'g',
    kg: 'kg',
    oz: 'oz',
    lb: 'lb',
    ml: 'ml',
    l: 'L',
    tsp: 'c. à c.',
    tbsp: 'c. à s.',
    cup: 'tasse',
    fl_oz: 'fl oz',
    c: '°C',
    f: '°F',
    gas_mark: 'thermostat',
    piece: 'pièces',
    pinch: 'pincée',
  },
  // Units under the converter's numbers (OC-Units): "1¼" over "cups".
  unitLong: {
    g: () => 'g',
    kg: () => 'kg',
    oz: () => 'oz',
    lb: () => 'lb',
    ml: () => 'ml',
    l: () => 'L',
    tsp: (n: number) => (n <= 1 ? 'cuillère à café' : 'cuillères à café'),
    tbsp: (n: number) => (n <= 1 ? 'cuillère à soupe' : 'cuillères à soupe'),
    cup: (n: number) => (n <= 1 ? 'tasse' : 'tasses'),
    fl_oz: () => 'fl oz (US)',
    c: () => '°C',
    f: () => '°F',
    gas_mark: () => 'thermostat',
    fan_c: () => '°C chaleur tournante',
    fan_f: () => '°F chaleur tournante',
  },
  cupsOf: (n: number, ingredient: string) => `${n <= 1 ? 'tasse' : 'tasses'} de ${ingredient}`,
  // A recipe's facts, wherever it is shown (specs 006, 008, 028).
  recipe: {
    serves: (n: number) => (n < 2 ? `Pour ${n} personne` : `Pour ${n} personnes`),
    variants: (n: number) => (n < 2 ? `${n} variante` : `${n} variantes`),
    /** Spec 051: a recipe an assistant we don't know by name made, with no other source. */
    anAssistant: 'Un assistant IA',
    /** The author left the family or deleted their account. */
    formerMember: 'Ancien membre',
  },
  // Timers (spec 010; the Timers screen and pill are 011, OC-Timers).
  timers: {
    kitchenTimer: 'Minuteur de cuisine',
    /** The StatusBanner when a timer ends, on any screen (OC-Timers › States). */
    done: (name: string) => `${name} : terminé`,
    /** Announced once, politely, when any timer gets to 1 minute (spec 030 FR-002, OC-RecipeSteps › Accessibility labels). */
    oneMinuteLeft: (name: string) => `Plus qu’une minute pour ${name}`,
    openTimers: 'Ouvrir les minuteurs',
  },
  // design/ui/TabBar.md › Timers running, TimerPill README (spec 011)
  timerPill: {
    label: (count: number) => `${count} ${count < 2 ? 'minuteur' : 'minuteurs'} en cours. Ouvrir les minuteurs`,
    more: (others: number) => `+${others}`,
    hide: 'Masquer la pastille des minuteurs. Les minuteurs continuent de tourner',
    // The side rail's pill shows only the time, so its label names the timer too (OC-NavResponsive, spec 064).
    railLabel: (count: number, name: string, time: string) => `${count} ${count < 2 ? 'minuteur' : 'minuteurs'} en cours. ${name} ${time}. Ouvrir les minuteurs`,
  },
  // design/ui/OC-Timers.md (spec 011)
  timersScreen: {
    back: 'Retour',
    title: 'Minuteurs',
    summary: (running: number, total: number) => `${running} en cours · ${total} au total`,
    sub: (recipe: string, state: string) => `${recipe} · ${state}`,
    noRecipe: 'Sans recette',
    running: 'En cours',
    paused: 'En pause',
    done: 'Terminé !',
    preset: (minutes: number) => `${minutes} min`,
    minus: '−1',
    plus: '+1',
    minusA11y: 'Une minute de moins',
    plusA11y: 'Une minute de plus',
    pause: 'Pause',
    resume: 'Reprendre',
    addMinute: 'Ajouter encore 1 minute',
    stop: 'Arrêter',
    dismiss: 'Fermer',
    empty: 'Aucun minuteur en cours. Lancez-en un depuis une étape de recette.',
    quick: 'Minuteur de cuisine rapide',
    quickA11y: (minutes: number) => `Lancer un minuteur de cuisine de ${minutes} min`,
    footnote: 'Les minuteurs continuent quand vous quittez la recette. Un carillon sonne quand l’un d’eux se termine.',
    /** A step timer's card opens cooking mode at its step (032-later L19). */
    goToStep: 'Aller à l’étape',
    /** Screen reader, so several cards' links tell apart: "Go to step: Blind bake". */
    goToStepA11y: (timer: string) => `Aller à l’étape : ${timer}`,
    /** Screen reader, so several cards' buttons tell apart: "Pause: Blind bake" (spec 030). */
    forTimer: (action: string, timer: string) => `${action} : ${timer}`,
  },
  // design/ui/OC-Cook.md (spec 012)
  cook: {
    /** The ✕ in the header (spec 050): leaving keeps the cook in progress (spec 051 FR-002). */
    exitA11y: 'Quitter le mode cuisine, la recette reste en cours',
    /** The settings button in the header, and the sheet it opens. */
    options: 'Options de cuisine',
    closeOptions: 'Fermer les options de cuisine',
    // Spec 062: the round timer button left of "Cooking options", and its sheet.
    timers: 'Minuteurs',
    closeTimers: 'Fermer les minuteurs',
    /** The options sheet's sections: servings and scale by an ingredient, then the rest. */
    scaling: 'Proportions',
    servings: 'Nombre de personnes',
    optionsSection: 'Plus',
    /** The options sheet's row to the recipe form at the current step. */
    editStep: (n: number) => `Modifier l’étape ${n}`,
    stepOf: (n: number, total: number) => `Étape ${n} sur ${total}`,
    /** Said after Next, Back or a segment (spec 030): "Step 3 of 7: Bake". */
    stepAnnouncement: (n: number, total: number, name: string | null) => (name ? `Étape ${n} sur ${total} : ${name}` : `Étape ${n} sur ${total}`),
    hint: (serves: string) => `Pour ${serves} pers. · balayez vers le haut pour la suite`,
    timerLabel: (label: string) => `Minuteur ${label}`,
    segment: (n: number, name: string | null) => (name ? `Aller à l’étape ${n} : ${name}` : `Aller à l’étape ${n}`),
    startTimer: 'Lancer le minuteur',
    pause: 'Pause',
    resume: 'Reprendre',
    done: 'Terminé',
    back: 'Retour',
    next: 'Étape suivante',
    /** The last step's button: logs the cook (spec 051 FR-005). */
    doneCooking: 'Terminer la recette',
    bonAppetit: 'Bon appétit ! Touchez Terminer la recette pour la noter comme cuisinée.',
    loading: 'Chargement de la recette',
    // Spec 066 (OC-CookResponsive): from 600 the header names the recipe; from 960 a step list.
    /** Under the recipe name: "Serves 6 · Classic" ("Serves 6" when the recipe has no versions). */
    servesLine: (serves: string, version: string | null) => (version ? `Pour ${serves} pers. · ${version}` : `Pour ${serves} pers.`),
    allSteps: 'Toutes les étapes',
    /** After "All steps" in the step list's heading (uppercased): "All steps · 3 of 6". */
    stepPosition: (n: number, total: number) => `${n} sur ${total}`,
    /** A step list row's name when the step has none. */
    unnamedStep: (n: number) => `Étape ${n}`,
    /** A step list row for screen readers: "Go to step 3: Bake, timer 12:30". */
    stepRow: (n: number, name: string | null, time: string | null) => {
      const step = name ? `Aller à l’étape ${n} : ${name}` : `Aller à l’étape ${n}`;
      return time ? `${step}, minuteur ${time}` : step;
    },
    /** The timers panel's quick presets (the Timers screen's own label is "Quick kitchen timer"). */
    quickTimer: 'Minuteur rapide',
    /** A step's photo thumbnail, and the full-screen photo it opens. */
    stepPhoto: (name: string | null, n: number) => (name ? `Agrandir la photo de ${name}` : `Agrandir la photo de l’étape ${n}`),
    photoOf: (name: string | null, n: number) => (name ? `Photo de ${name}` : `Photo de l’étape ${n}`),
    closePhoto: 'Fermer la photo',
  },
  // design/ui/OC-CookDone.md (spec 051 FR-005): after "Done".
  cookDone: {
    /** The Done toast (spec 051 FR-005): "Leek & bacon quiche is done! That’s 5 times now." */
    toast: (recipe: string, times: number) => `${recipe} : c’est prêt ! ${times === 1 ? 'C’est la première fois.' : `Déjà ${times} fois.`}`,
    close: 'Fermer',
  },
  // Total time (spec 006 FR-002): "40 min", "2 h", "1 h 05".
  time: {
    minutes: (m: number) => `${m} min`,
    hours: (h: number) => `${h} h`,
    hoursMinutes: (h: number, mm: string) => `${h} h ${mm}`,
    /** Spec 051: when a recipe was last cooked, by calendar day ("today", "3 weeks ago"). */
    daysAgo: (days: number) =>
      days <= 0
        ? 'aujourd’hui'
        : days === 1
          ? 'hier'
          : days < 7
            ? `il y a ${days} jours`
            : days < 30
              ? `il y a ${Math.floor(days / 7) === 1 ? '1 semaine' : `${Math.floor(days / 7)} semaines`}`
              : days < 365
                ? `il y a ${Math.floor(days / 30)} mois`
                : 'il y a plus d’un an',
    /** "used 2 h ago" (OC-Connect), "· 4 h ago" (AI activity). */
    ago: (minutes: number) =>
      minutes < 1 ? 'à l’instant' : minutes < 60 ? `il y a ${minutes} min` : minutes < 24 * 60 ? `il y a ${Math.floor(minutes / 60)} h` : `il y a ${Math.floor(minutes / 1440)} ${Math.floor(minutes / 1440) === 1 ? 'jour' : 'jours'}`,
  },
  monthsShort: ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'],
  months: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
  // Spec 006 FR-003: one label per key of Cuisine (packages/schemas/recipes.ts).
  cuisines: {
    american: 'Américaine',
    british: 'Britannique',
    caribbean: 'Caribéenne',
    chinese: 'Chinoise',
    french: 'Française',
    german: 'Allemande',
    greek: 'Grecque',
    indian: 'Indienne',
    italian: 'Italienne',
    japanese: 'Japonaise',
    korean: 'Coréenne',
    latin_american: 'Latino-américaine',
    mexican: 'Mexicaine',
    middle_eastern: 'Moyen-orientale',
    moroccan: 'Marocaine',
    portuguese: 'Portugaise',
    scandinavian: 'Scandinave',
    spanish: 'Espagnole',
    thai: 'Thaïlandaise',
    turkish: 'Turque',
    vietnamese: 'Vietnamienne',
    west_african: 'Ouest-africaine',
  },
  // Assistant names for "via …", by write source (packages/schemas/sources.ts).
  assistants: {
    claude: 'Claude',
    chatgpt: 'ChatGPT',
    gemini: 'Gemini',
    /** An MCP client we don't know by name. */
    other: 'un assistant IA',
  },
  // Spec 004: shared by every screen that shows family data (design/system/Patterns.md › Offline).
  // design/ui/note-formatting-ui.md (spec 073): event and reminder notes with their formatting.
  notes: {
    /** What screen readers call the notes, under their hairline. */
    label: 'Notes',
    linkFailed: 'Impossible d’ouvrir ce lien',
    // Spec 074: the notes field's toolbar (OC-NoteEditor) and its "Add a link" sheet.
    toolbar: { toolbar: 'Mise en forme', bold: 'Gras', link: 'Lien', bullet: 'Liste à puces', number: 'Liste numérotée', check: 'Liste à cocher', hideKeyboard: 'Masquer le clavier' },
    tooLong: 'Les notes peuvent contenir jusqu’à 5 000 caractères.',
    linkSheet: {
      title: 'Ajouter un lien',
      text: 'Texte',
      link: 'Lien',
      placeholder: 'https://',
      invalid: 'Saisissez une adresse web ou e-mail',
      cancel: 'Annuler',
      add: 'Ajouter le lien',
      close: 'Fermer',
    },
  },
  sync: {
    offline: 'Vous êtes hors ligne. Vous pouvez consulter, mais les modifications nécessitent une connexion.',
    recipeChanged: (name: string) => `${name} vient de modifier cette recette`,
    reload: 'Recharger',
  },
  // design/system/components/Toast: the one toast, on every screen.
  // Spec 046: the ask sheet (design/ui/OC-Notifications.md › Ask sheet) and reminders shown in the app.
  // design/ui/OC-TravelTimeZone.md (spec 071): the drawer when the phone moves to another time zone.
  travel: {
    title: (city: string) => `Vous êtes à l’heure de ${city}`,
    lead: (city: string, home: string, gap: string) => `Votre téléphone est passé à l’heure de ${city} (${gap} ${home}). Vos projets doivent-ils garder les heures que vous avez saisies ?`,
    gap: (minutes: number) => {
      const h = Math.floor(Math.abs(minutes) / 60);
      const m = Math.abs(minutes) % 60;
      const amount = [h ? `${h} heure${h < 2 ? '' : 's'}` : '', m ? `${m} minutes` : ''].filter(Boolean).join(' ');
      return `${amount} ${minutes < 0 ? 'de retard sur' : 'd’avance sur'}`;
    },
    exampleAt: (time: string) => `Par exemple, un événement que vous avez ajouté à ${time} :`,
    keep: 'Garder mes heures',
    keepTitle: 'Garder mes heures (je suis seul·e à voyager)',
    keepSub: (time: string, city: string, home: string) => `Reste à ${time}, heure de ${city}, pour vous. Le reste de la famille reste à l’heure de ${home}.`,
    keepFamily: 'Garder les heures de tous',
    keepFamilyTitle: 'Garder les heures de tous (tout le monde voyage)',
    keepFamilySub: (time: string, city: string) => `La famille passe à l’heure de ${city} : les projets de chacun restent à ${time}, heure de ${city}, et on ne demande rien aux autres.`,
    stay: (home: string) => `Rester à l’heure de ${home}`,
    staySub: (time: string, here: string, home: string, city: string) => `A lieu à ${time}, heure de ${home}, soit ${here} à ${city}.`,
    note: (home: string) => `Si vous êtes seul·e à garder vos heures, elles reviennent d’elles-mêmes quand votre téléphone repasse à l’heure de ${home}.`,
    failed: 'Impossible de modifier vos heures. Vérifiez votre connexion et réessayez.',
    close: 'Fermer',
  },
  notifications: {
    askTitle: { timer: 'Savoir quand c’est prêt', reminder: 'Être prévenu avant les événements', todo: 'Recevoir vos rappels à l’heure' },
    askBody: {
      timer: 'Activez les notifications pour entendre la sonnerie et voir votre minuteur sur l’écran verrouillé, même quand votre téléphone est verrouillé. Vous recevrez aussi des rappels avant les événements de la famille.',
      reminder: 'Activez les notifications pour recevoir les rappels sur votre téléphone, même quand Our Cocon est fermé.',
      todo: 'Activez les notifications pour recevoir vos rappels sur votre téléphone à l’heure prévue, même quand Our Cocon est fermé.',
    },
    turnOn: 'Activer les notifications',
    notNow: 'Plus tard',
    note: 'Vous pouvez changer cela à tout moment dans Menu › Notifications.',
    close: 'Fermer',
    // The StatusBanner for a reminder that arrives while the app is open (not drawn).
    inApp: (title: string, body: string) => (body ? `${title} · ${body}` : title),
    open: 'Ouvrir',
    // Spec 047: a timer that ends while the app is closed (OC-NotifLockDone). Plain text, no emoji.
    timerDone: {
      title: (label: string) => `${label} : terminé`,
      stepBody: (recipe: string, step: number) => `${recipe} · étape ${step}`,
      quickBody: (minutes: number) => `Minuteur de cuisine de ${minutes} min`,
      followUpTitle: (label: string) => `Toujours en attente : ${label}`,
      followUpBody: (minutes: number) => `Terminé il y a ${minutes} ${minutes < 2 ? 'minute' : 'minutes'}.`,
      addMinute: '+1 min',
      stop: 'Arrêter',
    },
    // Spec 059 FR-004: a reminder's actions on the Lock Screen (OC-NotifLockTodo).
    todo: {
      done: 'Fait',
      hour: 'Dans 1 heure',
      tomorrow: 'Demain',
    },
  },
  // Spec 048: the Live Activity. On the Lock Screen it's the Timers screen's card (OC-Timers, its
  // words from timersScreen); these are its "2 running" pill and the Dynamic Island (OC-NotifIsland).
  // The phone draws the time itself; every word comes from here.
  liveTimer: {
    running: (count: number) => `${count} en cours`,
    // Not drawn: the pill when every timer is paused.
    paused: (count: number) => `${count} en pause`,
    pausedSub: 'En pause',
    // "Leek & bacon quiche · +1 more" in the island.
    more: (text: string, others: number) => `${text} · +${others} ${others < 2 ? 'autre' : 'autres'}`,
    removeMinute: '−1 min',
    addMinute: '+1 min',
  },
  toast: {
    undo: 'Annuler',
    // Spec 053 FR-013: the round buttons' names.
    tryAgain: 'Réessayer',
    dismiss: 'Fermer',
    // When an Undo fails (032-later L99), unless the screen says it its own way.
    undoFailed: 'Impossible d’annuler. Vérifiez votre connexion et réessayez.',
  },
  // design/ui/CalHeader.md (spec 036): the header shared by the four calendar views.
  calendar: {
    /** Who an event is for, in its screen-reader label (spec 030 FR-006): "Gabriel", "Gabriel and Eva", "Gabriel, Eva and James". */
    who: (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} et ${names.at(-1)}` : (names[0] ?? '')),
    header: {
      today: 'Aujourd’hui',
      viewsLabel: 'Vue du calendrier',
      views: { month: 'Mois', week: 'Semaine', day: 'Jour', agenda: 'Agenda' },
      viewButton: (view: string) => `Vue : ${view}`,
      agendaTitle: 'À venir',
      previous: { month: 'Mois précédent', week: 'Semaine précédente', day: 'Jour précédent' },
      next: { month: 'Mois suivant', week: 'Semaine suivante', day: 'Jour suivant' },
      filterLabel: 'Afficher les événements de',
      everyone: 'Tout le monde',
      everyoneInitial: 'Tous',
      others: 'Autres',
      peopleAll: 'Tous',
      peopleCount: (shown: number, total: number) => `${shown} sur ${total}`,
      /** The people button's name: who is shown, or everyone. */
      peopleButton: (shownNames: string[] | null) => `Afficher les événements de : ${shownNames ? shownNames.join(', ') : 'tout le monde'}`,
      showAll: 'Tout afficher',
      /** The menu's button while everyone shows (Show all once someone is hidden). */
      showNone: 'Tout masquer',
      close: 'Fermer',
      /** From 600 (spec 070, OC-LargeScreens › Copy "+ New", as Recipes): a plus icon, then "New"; read "Add event". */
      addEvent: 'Nouveau',
      addEventLabel: 'Ajouter un événement',
    },
    // design/ui/OC-CalMonth.md (spec 037).
    month: {
      /** From Sunday; rotated when the week starts on Monday. */
      weekdays: ['D', 'L', 'M', 'M', 'J', 'V', 'S'],
      hint: 'Touchez un jour pour voir le détail. Chaque couleur correspond à un membre de la famille.',
      gotIt: 'J’ai compris',
      addEvent: 'Ajouter un événement',
      more: (n: number) => `+${n}`,
      cont: (title: string) => `${title} (suite)`,
      /** The 1st of a month: "Nov 1". */
      firstOfMonth: (shortMonth: string) => `1er ${shortMonth}`,
      dayLabel: (date: string, titles: string[]) => `${date} : ${titles.length ? titles.join(', ') : 'rien de prévu'}`,
      /** An event in a day's label, with its people: "Baby swim (James)". */
      withPeople: (title: string, names: string[]) => (names.length ? `${title} (${names.join(', ')})` : title),
      /** "Lyon trip, Everyone, October 30 to November 1". */
      barLabel: (title: string, who: string, from: string, to: string) => [title, who, `du ${from} au ${to}`].filter(Boolean).join(', '),
      // OC-CalMonth.md › Day sheet (spec 037 FR-009).
      sheet: {
        title: (weekday: string, date: string) => `${weekday} ${date}`,
        count: (n: number) => (n === 0 ? 'Rien de prévu' : n === 1 ? '1 événement' : `${n} événements`),
        empty: 'Rien de prévu pour l’instant.',
        addLabel: (day: string) => `Ajouter un événement le ${day}`,
        close: 'Fermer',
      },
      /** From 600 (spec 070): the selected day's panel; its title, count and rows are the sheet's. "+ Add on Sun 25". */
      panel: {
        addOn: (day: string) => `+ Ajouter le ${day}`,
      },
    },
    week: {
      allDay: 'Toute la journée',
      /** A day's letter and date, as OC-CalWeek reads it: "Sunday October 25". */
      dayLabel: (weekday: string, date: string) => `${weekday} ${date}`,
      /** "Poker night, Gabriel, Sunday October 25, Evening" or "Baby swim, James, Sunday October 25, 14:30 to 16:30" (spec 030 FR-006). */
      blockLabel: (title: string, who: string, day: string, when: string) => [title, who, day, when].filter(Boolean).join(', '),
      timeRange: (start: string, end: string) => `de ${start} à ${end}`,
      /** An empty day column, for screen readers: "Add event, Sunday October 25". */
      addAt: (day: string) => `Ajouter un événement, ${day}`,
    },
    // design/ui/OC-CalDay.md (spec 039).
    day: {
      busyLabel: 'Qui est occupé ce jour-là',
      count: (name: string, n: number) => `${name} ${n}`,
      allDay: 'Toute la journée',
      birthday: 'Anniversaire',
      dayOf: (n: number, total: number) => `Jour ${n} sur ${total}`,
      hours: (start: string, end: string) => `${start}–${end}`,
      /** The time line: "Lunch · Grandma’s house", "14:30 · Aquatic Center". */
      at: (when: string, place: string) => `${when} · ${place}`,
      takes: (driver: string, names: string[]) => `${driver} emmène ${names.length > 1 ? `${names.slice(0, -1).join(', ')} et ${names.at(-1)}` : (names[0] ?? '')}`,
      now: 'Maintenant',
      /** An empty band's row: "+ Add in the morning", "+ Add in the lunch slot". */
      addIn: (band: string) => `+ Ajouter ${band}`,
      bands: { early_morning: 'tôt le matin', morning: 'le matin', lunch: 'le midi', afternoon: 'l’après-midi', evening: 'le soir' },
      /** For screen readers: "Add event in the morning, Sunday October 25". */
      addInLabel: (band: string, day: string) => `Ajouter un événement ${band}, ${day}`,
      /** "Baby swim class, 14:30 · Aquatic Center, Gabriel takes James, happening now". */
      rowLabel: (parts: string[], now: boolean) => [...parts.filter(Boolean), ...(now ? ['en cours'] : [])].join(', '),
      /** "Lyon trip, Everyone, all day, Day 2 of 3". */
      allDayLabel: (title: string, who: string, tag: string | null) => [title, who, 'toute la journée', ...(tag ? [tag] : [])].filter(Boolean).join(', '),
      /** From 960 (spec 070 FR-007): the mini month and the next three days beside the bands. */
      aside: {
        comingUp: 'À venir',
        nothingPlanned: 'Rien de prévu',
        /** A mini month day, for screen readers: "October 25", "October 26, has events". */
        dayLabel: (date: string, hasEvents: boolean) => (hasEvents ? `${date}, avec des événements` : date),
        /** A "Coming up" row, for screen readers: "Monday October 26: Run · Baby yoga". */
        rowLabel: (day: string, text: string) => `${day} : ${text}`,
      },
    },
    /** OC-CalAgenda (spec 040). Rows reuse `day`'s time line, "Now", "Birthday" and "Day N of M". */
    agenda: {
      /** Day headings: "Today · Sun, Oct 25", "Tomorrow · Mon, Oct 26", then "Tue, Oct 27". */
      today: (date: string) => `Aujourd’hui · ${date}`,
      tomorrow: (date: string) => `Demain · ${date}`,
      surprise: 'Surprise',
      empty: 'Rien de prévu pour l’instant. Touchez + pour ajouter quelque chose.',
      /** "Baby swim class, 14:30 · Gabriel takes James, Now". */
      /** "Poker night, Gabriel, Evening · Café Lou, Now" (spec 030 FR-006). */
      rowLabel: (title: string, who: string, sub: string, tag: string | null) => [title, who, sub, ...(tag ? [tag] : [])].filter(Boolean).join(', '),
    },
    /** design/ui/OC-Reminders.md › Agenda rows (spec 058): reminders among the events in Agenda and Day. */
    reminders: {
      toggle: 'Rappels',
      /** "15:00 · Gabriel", "Any time · Eva". */
      sub: (when: string, name: string) => `${when} · ${name}`,
      /** A late one, on today: "Gabriel · was due Mon". */
      lateSub: (name: string, wasDue: string) => `${name} · ${wasDue}`,
      wasDueYesterday: 'prévu hier',
      /** A later repeat's box, pressed before its day. */
      notYet: (date: string) => `Pas encore : il est prévu le ${date}.`,
      /** Day view: today's done reminders, after the bands. */
      doneHeading: 'Faits',
      /** A later repeat's box, for screen readers (it can't be ticked before its day). */
      notYetLabel: (title: string) => `Pas encore : ${title}`,
      /** "Water the plants, reminder, Gabriel · was due Mon, 2d late". */
      rowLabel: (title: string, sub: string, late: string | null) => [title, 'rappel', sub, ...(late ? [late] : [])].join(', '),
      /** "1 reminder", "3 reminders": Month and Week's day labels, and the day sheet's count. */
      count: (n: number) => (n < 2 ? `${n} rappel` : `${n} rappels`),
      /** A day's screen-reader label, then its reminders: "Sunday October 25, 2 reminders". */
      withCount: (label: string, n: number) => (n ? `${label}, ${n < 2 ? `${n} rappel` : `${n} rappels`}` : label),
      /** The day sheet's lead: "2 events · 1 reminder", "1 reminder". */
      sheetCount: (events: string | null, reminders: string) => (events ? `${events} · ${reminders}` : reminders),
    },
    /** design/ui/OC-CalAdd.md (spec 041): the add and edit sheet. */
    add: {
      titleNew: 'Nouvel événement',
      titleEdit: 'Modifier l’événement',
      /** The new-event sheet's switch to a new reminder (its segments are the two sheets' titles). */
      newKind: 'Que voulez-vous ajouter',
      /** The edit sheet's switch: an event can become a reminder and back (Gabriel, 2026-11-25). */
      editKind: 'Événement ou rappel',
      /** What an event has that a reminder can't hold, said before it's saved as one. */
      losesAsReminder: (parts: string[]) => `En rappel, il ne gardera pas ${parts.length > 1 ? `${parts.slice(0, -1).join(', ')} ni ${parts.at(-1)}` : parts[0]}.`,
      lostParts: { people: 'plusieurs personnes', place: 'le lieu', type: 'le type', who_takes: 'qui les emmène', checklist: 'la liste' },
      /** A reminder's "If it's not done", which an event doesn't have. */
      losesAsEvent: 'En événement, il ne gardera pas « Si ce n’est pas fait ».',
      movedToReminders: 'Déplacé dans les rappels.',
      movedToCalendar: 'Déplacé dans le calendrier.',
      cancel: 'Annuler',
      what: 'Que se passe-t-il ?',
      whatPlaceholder: 'ex. Soirée poker',
      noTitle: 'Donnez un nom à votre événement.',
      when: 'Quand',
      today: 'Aujourd’hui',
      tomorrow: 'Demain',
      otherDay: 'Autre jour',
      pickDate: 'Choisir une date',
      /** A day tile's date: "Sun 25". */
      tileDate: (weekdayShort: string, day: number) => `${weekdayShort} ${day}`,
      timeOfDay: 'Moment de la journée',
      timeHint: 'Choisissez un moment de la journée, pas besoin d’heure précise.',
      allDay: 'Toute la journée',
      wholeDay: 'Journée entière',
      /** A slot chip's hours, each already the hour alone: "18–22", "6 PM–10 PM". */
      slotHours: (start: string, end: string) => `${start}–${end}`,
      starts: 'Début',
      ends: 'Fin',
      badTime: 'Saisissez une heure comme 18:30.',
      endBeforeStart: 'Choisissez une heure de fin après le début.',
      who: 'Qui',
      noOne: 'Choisissez au moins une personne.',
      everyone: 'Tout le monde',
      everyoneInitial: 'Tous',
      others: 'Autres',
      /** "You already have Movie night this evening." / "Eva already has …" */
      conflict: (name: string | null, title: string, slot: string) => `${name === null ? 'Vous avez déjà' : `${name} a déjà`} « ${title} » ${slot}.`,
      addAnyway: 'Ajouter quand même ?',
      /** The conflict line's slot words. */
      slotWords: { early_morning: 'tôt le matin', morning: 'le matin', lunch: 'le midi', afternoon: 'l’après-midi', evening: 'le soir' },
      more: 'Plus d’options',
      moreHint: 'Lieu, répétition, rappel…',
      hide: 'Masquer',
      type: 'Type',
      types: { sport: 'Sport', school: 'École', work: 'Travail', health: 'Santé', social: 'Sorties', travel: 'Voyage', home: 'Maison', birthday: 'Anniversaire', other: 'Autre' },
      where: 'Où',
      wherePlaceholder: 'Ajouter un lieu',
      /** "Who takes James?", "Who takes James and Lou?" */
      whoTakes: (names: string[]) => `Qui emmène ${andList(names)} ?`,
      whoTakesHint: (names: string[]) => `${andList(names)} ${names.length > 1 ? 'ont été ajoutés' : 'a été ajouté'} par la famille, donc quelqu’un qui a l’app s’en occupe.`,
      notDecided: 'Pas encore décidé',
      repeat: 'Répéter',
      repeats: { never: 'Jamais', daily: 'Tous les jours', weekly: 'Toutes les semaines', biweekly: 'Toutes les 2 semaines', monthly: 'Tous les mois', yearly: 'Tous les ans' },
      on: 'Le',
      /** From Sunday, as the weekday picker reads them. */
      weekdayLetters: ['D', 'L', 'M', 'M', 'J', 'V', 'S'],
      weekdayNames: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'],
      endsLabel: 'Fin',
      endsNever: 'Jamais',
      endsOn: 'À une date',
      endsAfter: 'Après un nombre de fois',
      lastDay: 'Dernier jour',
      times: 'Nombre de fois',
      timesHint: 'Celle-ci compte aussi.',
      timesProblem: 'Saisissez un nombre entre 1 et 1000.',
      reminder: 'Rappel',
      reminders: { none: 'Aucun', minutes_15: '15 minutes avant', hour_before: '1 heure avant', morning_of: 'Le matin même', day_before: '1 jour avant' },
      /** Spec 049 FR-001: who the reminder reaches. */
      reminderHint: (names: string[]) => `Prévient ${andList(names)} sur ${names.length > 1 ? 'leur téléphone' : 'son téléphone'}.`,
      reminderHintYou: 'Vous prévient sur votre téléphone.',
      notes: 'Notes',
      notesPlaceholder: 'Quelque chose à retenir',
      addToChecklist: '+ Ajouter à la liste',
      checklistItem: 'Élément de la liste',
      removeItem: (label: string) => `Retirer ${label}`,
      save: 'Enregistrer',
      saving: 'Enregistrement…',
      saveFailed: 'Impossible d’enregistrer. Vérifiez votre connexion et réessayez.',
      close: 'Fermer',
      previousMonth: 'Mois précédent',
      nextMonth: 'Mois suivant',
      /** The date sheet's title, for "Other day" and "Ends: On a date". */
      pickDateTitle: 'Choisir une date',
      // Spec 053 FR-001: the past titles under "What's happening?".
      suggestions: 'Suggestions',
      // Spec 053 FR-009: an event over several days.
      endsDay: 'Fin',
      sameDay: 'Même jour',
      pickLastDay: 'Choisir un dernier jour',
      lastDayTitle: 'Dernier jour',
      backToSameDay: 'Revenir au même jour',
      endsOnTitle: 'Se termine le',
      /** The toast: "Poker night added for tonight, 18:00–22:00."; all day: "… added for Sat, Oct 31." */
      added: (title: string, when: string, range: string | null) => `« ${title} » ajouté pour ${when}${range ? `, ${range}` : ''}.`,
      tonight: 'ce soir',
      todayWord: 'aujourd’hui',
      tomorrowWord: 'demain',
      undo: 'Annuler',
      /** The edit's scope question (OC-CalEvent.md › Edit a repeating event). */
      scopeTitle: 'Cet événement se répète',
      scopeBody: (date: string, every: string) => `Modifier seulement celui du ${date}, ou ${every} à partir de maintenant ?`,
      /** "every Saturday", "every day", "every other Saturday", "every month", "every year". */
      every: { daily: () => 'tous les jours', weekly: (day: string) => `chaque ${day}`, biweekly: (day: string) => `un ${day} sur deux`, monthly: () => 'tous les mois', yearly: () => 'tous les ans' },
      thisOnly: 'Cet événement uniquement',
      allFuture: 'Tous les événements à venir',
      loadFailedTitle: 'Impossible d’ouvrir cet événement.',
      loadFailedBody: 'Il a peut-être été supprimé, ou vous êtes hors ligne.',
      // Not drawn (032-later L99, added to OC-CalAdd.md): when a toast's Undo fails.
      undoFailed: 'Impossible d’annuler. Vérifiez votre connexion et réessayez.',
      /** design/ui/OC-CalSurprise.md (spec 043): "Who can see it?" and the surprise card. */
      whoCanSee: 'Qui peut le voir ?',
      whoCanSeeLabel: 'Qui peut le voir',
      visibilities: { family: 'Famille', private: 'Privé', surprise: 'Surprise' },
      visibilityHints: {
        family: 'Toute la famille voit tous les détails.',
        private: 'Les autres voient « Occupé » à ce moment-là, et rien d’autre.',
        surprise: 'Cachez-le à quelqu’un : cette personne ne voit que ce que vous choisissez ci-dessous.',
      },
      /** "What Eva sees"; with nobody picked yet, "What they see" (not drawn). */
      coverTitle: (names: string[]) => (names.length ? `Ce que ${andList(names)} ${names.length > 1 ? 'voient' : 'voit'}` : 'Ce que ces personnes voient'),
      coverNote: (names: string[]) => `Note pour ${names.length ? andList(names) : 'ces personnes'}`,
      surpriseSummary: (names: string[]) =>
        `${names.length ? andList(names) : 'Ces personnes'} ne ${names.length === 1 ? 'voit' : 'voient'} que ce titre, l’heure, le lieu et cette note. Tous les autres voient tout.`,
      noCover: (names: string[]) => `Ajoutez ce que ${names.length ? andList(names) : 'ces personnes'} ${names.length === 1 ? 'verra' : 'verront'}.`,
      // Not drawn (spec 043, added to OC-CalSurprise.md). The surprise is kept from the people in Who.
      noSecretFrom: 'Dans Qui, choisissez la personne à qui la surprise est destinée : quelqu’un qui a l’app, autre que vous.',
      /** Adding someone to a surprise's Who where it can't be kept from them: one date, or not its creator. */
      surpriseRevealed: (names: string[]) => `${andList(names)} ${names.length > 1 ? 'verraient' : 'verrait'} cette surprise. Seule la personne qui l’a créée peut ${names.length > 1 ? 'les y ajouter' : 'y ajouter quelqu’un'}, sur tout l’événement.`,
    },
    /** OC-CalBusy (spec 043): someone else's private event, as a sheet over the calendar. */
    busy: {
      title: (name: string) => `${name} n’est pas disponible`,
      /** "Thursday, Oct 22 · Afternoon". */
      when: (date: string, time: string) => `${date} · ${time}`,
      body: (name: string) => `${name} garde les détails de cet événement privés.`,
      // Not drawn (spec 043): the creator has left the family.
      someone: 'Quelqu’un',
      bodySomeone: 'Cette personne garde les détails de cet événement privés.',
      ok: 'OK',
    },
    /** design/ui/OC-CalEvent.md (spec 042): the event page, its dialogs, the share sheet and the shared page. */
    event: {
      back: 'Retour au calendrier',
      /** "Morning · about 09:00–12:00"; a custom time shows its hours: "14:30–15:30". */
      slotTime: (slot: string, range: string) => `${slot} · environ ${range}`,
      /** Spec 050 FR-006, after the date on one line: "Sat, Oct 31 · Morning, about 09:00–12:00". */
      slotTimeInline: (slot: string, range: string) => `${slot}, environ ${range}`,
      allDay: 'Toute la journée',
      /** A multi-day event's dates: "Sat, Oct 31 – Mon, Nov 2". */
      span: (from: string, to: string) => `${from} – ${to}`,
      /** "Every Saturday", "Every Tuesday and Thursday", "Every other Saturday", "Every day". */
      every: {
        daily: () => 'Tous les jours',
        weekly: (days: string[]) => `Chaque ${andList(days)}`,
        biweekly: (days: string[]) => `Un ${andList(days)} sur deux`,
        monthly: () => 'Tous les mois',
        yearly: () => 'Tous les ans',
      },
      /** The who row: "James", "James and Mia", then " · Gabriel takes James". */
      who: (names: string[]) => andList(names),
      /** The place row's directions and copy buttons (icons only), read as these. */
      openInMapsA11y: (place: string) => `Ouvrir ${place} dans Google Maps`,
      copyPlaceA11y: (place: string) => `Copier ${place}`,
      placeCopied: 'Adresse copiée',
      copyPlaceFailed: 'Impossible de copier l’adresse.',
      drives: (name: string) => `${name} conduit`,
      /** Spec 049 FR-006, after the reminder on its line (spec 050): "1 hour before · reminds Gabriel · 13:30". */
      reminds: (names: string[], when: string) => `prévient ${andList(names)} · ${when}`,
      dayBefore: (time: string) => `la veille à ${time}`,
      bring: 'À apporter',
      /** The Bring card's header: "1 of 3" ticked. */
      bringCount: (done: number, total: number) => `${done} sur ${total}`,
      /** Ends the "Added by" line when there is a checklist (spec 050). */
      anyoneCanTick: 'tout le monde peut cocher la liste',
      tickFailed: 'Impossible de modifier. Réessayez.',
      addedBy: (name: string, ago: string) => `Ajouté par ${name} · ${ago}`,
      addedVia: (assistant: string, ago: string) => `Ajouté via ${assistant} · ${ago}`,
      // The top bar (spec 050 FR-006): ✎ and ⋯, whose menu holds Duplicate, Share and Delete.
      edit: 'Modifier l’événement',
      more: 'Plus d’actions',
      duplicate: 'Dupliquer',
      share: 'Partager un lien en lecture seule',
      delete: 'Supprimer l’événement',
      deleteTitle: (title: string) => `Supprimer « ${title} » ?`,
      /** Put before the body for someone else's event. */
      addedThis: (name: string) => `${name} a ajouté cet événement.`,
      deleteRepeatBody: 'Supprimer seulement celui-ci, ou celui-ci et tous les suivants ? Il sera supprimé pour toute la famille.',
      onlyThis: 'Seulement celui-ci',
      thisAndFuture: 'Celui-ci et tous les suivants',
      keep: 'Le garder',
      deleted: 'Événement supprimé',
      /** "Copied to Sat, Nov 7". */
      copied: (day: string) => `Copié au ${day}`,
      // Not drawn (written for spec 042, added to OC-CalEvent.md).
      deleteFailed: 'Impossible de supprimer. Vérifiez votre connexion et réessayez.',
      duplicateFailed: 'Impossible de copier. Vérifiez votre connexion et réessayez.',
      shareTitle: 'Partager cet événement',
      shareLead: 'Les personnes qui ont le lien voient le titre, le jour, l’heure et le lieu. Pas les notes ni la liste.',
      /** The shared page (`/e/[token]`): who it's for, first names only. */
      with: (names: string[]) => `Avec ${andList(names)}`,
      withEveryone: 'toute la famille',
      withOthers: 'd’autres personnes',
      noLongerTitle: 'Cet événement n’est plus partagé.',
      noLongerBody: 'Demandez un nouveau lien à la personne qui vous l’a envoyé.',
      sharedLoadFailedTitle: 'Impossible d’ouvrir cet événement.',
      sharedLoadFailedBody: 'Vérifiez votre connexion et réessayez.',
      retry: 'Réessayer',
      /** OC-CalSurprise (spec 043): the cover's note, as the hidden person sees it. */
      noteFrom: (name: string) => `Note de ${name}`,
      /** For those in on it: the sage tag, and "hidden from Eva" in agenda and day rows. */
      surprise: 'Surprise',
      hiddenFrom: (names: string[]) => `caché à ${andList(names)}`,
      loading: 'Chargement de l’événement',
    },
  },
  // design/ui/OC-Reminders.md (spec 057): Home's card, the Reminders screen, the drawer and the sheet.
  reminders: {
    title: 'Rappels',
    back: 'Retour',
    newReminder: 'Nouveau rappel',
    /** Beside the rail, the title's olive "+ New" (as Recipes'), read "New reminder". */
    new: 'Nouveau',
    seeAll: 'Voir tous les rappels',
    /** The Home card footer's right side; each part drops when zero. */
    moreToday: (n: number) => `${n} ${n < 2 ? 'autre' : 'autres'} aujourd’hui`,
    snoozedCount: (n: number) => `${n} ${n < 2 ? 'reporté' : 'reportés'}`,
    joinParts: (parts: string[]) => parts.join(' · '),
    // Rows
    markDone: (title: string) => `Marquer comme fait : ${title}`,
    markNotDone: (title: string) => `Marquer comme non fait : ${title}`,
    open: (title: string) => `Ouvrir ${title}`,
    repeats: 'Se répète',
    hasNotes: 'Contient des notes',
    everyone: 'Tout le monde',
    everyoneInitial: 'Tous',
    /** The late badge: "2d late", "3h late". */
    lateDays: (n: number) => `${n} j de retard`,
    lateHours: (n: number) => `${n} h de retard`,
    doneJustNow: 'Fait à l’instant',
    /** Spec 058: one done earlier today, at the bottom of Today until midnight. */
    doneAt: (time: string) => `Fait à ${time}`,
    // A row's detail line.
    wasDueYesterday: 'Prévu hier',
    /** "Was due Mon" (this past week), "Was due Mon, Nov 2" (before). */
    wasDue: (day: string) => `Prévu ${day}`,
    nudgesHourly: (time: string) => `${time} · relance toutes les heures`,
    today: 'Aujourd’hui',
    tomorrow: 'Demain',
    anyTime: 'N’importe quand',
    /** "Sat, Nov 14 · 15:00". */
    dayAt: (day: string, time: string) => `${day} · ${time}`,
    backTomorrow: (date: string) => `De retour demain, ${date}`,
    backOn: (date: string) => `De retour ${date}`,
    /** Spec 058: a snoozed one back later today. */
    backAt: (time: string) => `De retour à ${time}`,
    /** Spec 058: the pill where "2d late" goes, on a snoozed one listed on the day it's back. */
    snoozedPill: 'Reporté',
    // The drawer's snooze and actions
    snoozeUntil: 'Reporter à',
    snooze: { hour: 'Dans 1 heure', tomorrow: 'Demain', week: 'La semaine prochaine', month: 'Le mois prochain', date: 'Choisir une date' },
    edit: 'Modifier',
    delete: 'Supprimer le rappel',
    close: 'Fermer',
    // The Reminders screen
    show: 'Afficher',
    mine: 'Les miens',
    everyones: 'Ceux de tous',
    overdue: 'En retard',
    /** "Today · Wed, Nov 11". */
    todayOn: (date: string) => `Aujourd’hui · ${date}`,
    tomorrowOn: (date: string) => `Demain · ${date}`,
    later: 'Plus tard',
    showMore: 'Afficher plus',
    snoozed: 'Reportés',
    hiddenUntilLater: (n: number, more: boolean) => `${n}${more ? '+' : ''} ${n < 2 && !more ? 'masqué' : 'masqués'} pour l’instant`,
    hide: 'Masquer',
    emptyTitle: 'Rien à retenir. Tranquille.',
    loading: 'Chargement des rappels',
    loadFailed: 'Impossible de charger vos rappels. Réessayez.',
    // The drawer
    /** The when line: "Every Monday · was due Mon, Nov 9", "Today at 15:00 · nudges every hour until done". */
    whenParts: (parts: string[]) => parts.join(' · '),
    wasDueLower: (date: string) => `prévu ${date}`,
    wasDueOn: (date: string) => `Prévu ${date}`,
    todayAt: (time: string) => `Aujourd’hui à ${time}`,
    todayAnyTime: 'Aujourd’hui, n’importe quand',
    tomorrowAt: (time: string) => `Demain à ${time}`,
    tomorrowAnyTime: 'Demain, n’importe quand',
    at: (day: string, time: string) => `${day} à ${time}`,
    nudgesEveryHour: 'relance toutes les heures jusqu’à ce que ce soit fait',
    daysLate: (n: number) => `${n} ${n < 2 ? 'jour' : 'jours'} de retard.`,
    hoursLate: (n: number) => `${n} ${n < 2 ? 'heure' : 'heures'} de retard.`,
    lastWeekMissed: (date: string) => ` Celui de la semaine dernière (${date}) a aussi été manqué.`,
    oneMissed: (date: string) => ` Celui du ${date} a aussi été manqué.`,
    missedSince: (n: number, date: string) => ` Manqué ${n} fois depuis le ${date}.`,
    notes: 'Notes',
    addNote: '+ Ajouter une note',
    calendar: 'Calendrier',
    markAsDone: 'Marquer comme fait',
    doneTitle: 'Fait. Bravo !',
    nextOne: (date: string) => `Prochain : ${date}. Les semaines manquées restent dans son historique.`,
    nextOnSchedule: 'Le prochain reste à la date prévue.',
    snoozedUntil: (date: string) => `Reporté au ${date}`,
    snoozedBody: 'Il est masqué jusque-là et revient sans badge de retard.',
    undo: 'Annuler',
    deleteAllTitle: 'Supprimer tous les rappels à venir ?',
    deleteAllBody: (title: string) => `Toutes les dates de « ${title} » seront supprimées. Vous pouvez le récupérer dans Supprimés récemment pendant 30 jours.`,
    deleteConfirm: 'Supprimer le rappel',
    keep: 'Le garder',
    deleted: 'Rappel supprimé',
    saveFailed: 'Impossible d’enregistrer. Réessayez.',
    gone: 'Ce rappel a été supprimé.',
    // The sheet (OC-ReminderEdit)
    /** Saved from the add sheet (with Undo, as a new event). */
    createdToast: (title: string) => `« ${title} » ajouté aux rappels.`,
    sheetNew: 'Nouveau rappel',
    sheetEdit: 'Modifier le rappel',
    cancel: 'Annuler',
    what: 'Nous rappeler de…',
    whatPlaceholder: 'ex. Payer la crèche',
    noTitle: 'Donnez un nom à votre rappel.',
    due: 'Échéance',
    otherDay: 'Autre jour',
    pickDate: 'Choisir une date',
    setTime: 'Choisir une heure',
    time: 'Heure',
    badTime: 'Saisissez une heure comme 15:00.',
    ifNotDone: 'Si ce n’est pas fait',
    rollovers: { hour: 'Toutes les heures', day: 'Jour suivant', week: 'Semaine suivante', none: 'Laisser tel quel' },
    rolloverHints: {
      hour: 'Reste sur l’accueil et relance toutes les heures jusqu’à ce que quelqu’un le coche.',
      day: 'Passe au jour suivant et indique son retard. L’échéance ne change pas.',
      week: 'Passe au même jour la semaine suivante, avec un badge de retard.',
      none: 'Reste à son jour d’échéance dans le calendrier. Plus de relances.',
    },
    repeat: 'Répéter',
    repeatChoices: { never: 'Jamais', daily: 'Tous les jours', weekly: 'Toutes les semaines', monthly: 'Tous les mois', custom: 'Personnalisé' },
    for: 'Pour',
    notesLabel: 'Notes',
    optional: '· facultatif',
    notesPlaceholder: 'Détails, numéro de téléphone, ce qu’il faut demander…',
    /** The notification summary (spec 059's times, in the recipient's quiet hours and clock). */
    notifyTimedHourly: (who: string, before: string, at: string, quietFrom: string, quietTo: string) =>
      `Prévient ${who} à ${before} et à ${at}, puis toutes les heures jusqu’à ce que ce soit fait. Silence de ${quietFrom} à ${quietTo}.`,
    notifyTimedDaily: (who: string, before: string, at: string) => `Prévient ${who} à ${before} et à ${at}, puis chaque matin tant qu’il est en retard.`,
    notifyTimedWeekly: (who: string, before: string, at: string) => `Prévient ${who} à ${before} et à ${at}, puis une fois par semaine tant qu’il est en retard.`,
    notifyTimed: (who: string, before: string, at: string) => `Prévient ${who} à ${before} et à ${at}.`,
    notifyDay: (who: string, at: string) => `Prévient ${who} à ${at} le jour même, puis chaque matin tant qu’il est en retard.`,
    notifyDayWeekly: (who: string, at: string) => `Prévient ${who} à ${at} le jour même, puis une fois par semaine tant qu’il est en retard.`,
    notifyDayOnly: (who: string, at: string) => `Prévient ${who} à ${at} le jour même.`,
    everyoneLower: 'tout le monde',
    save: 'Enregistrer',
    saving: 'Enregistrement…',
    previousMonth: 'Mois précédent',
    nextMonth: 'Mois suivant',
  },
  debug: {
    build: (commit: string) => `Build ${commit}`,
  },
};
