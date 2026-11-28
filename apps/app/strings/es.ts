// Every user-facing string in Spanish (spec 076), with the keys of en.ts. Keep them in step: a new
// string goes in every language in the same change.
import type { Strings } from './types';

/** "James", "James y Lou", "James, Lou y Mia". */
const andList = (names: readonly string[]) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names.at(-1)}` : (names[0] ?? ''));

export const es: Strings = {
  app: {
    name: 'Our Cocon',
  },
  // design/ui/TabBar.md
  tabBar: {
    label: 'Principal',
    home: 'Inicio',
    calendar: 'Calendario',
    recipes: 'Recetas',
    groceries: 'Compra',
    menu: 'Menú',
  },
  // design/ui/OC-Welcome.md (spec 003)
  welcome: {
    title: 'Te damos la bienvenida a Our Cocon',
    lead: 'Recetas y lista de la compra que comparte toda tu familia.',
    google: 'Continuar con Google',
    // Spec 045: iPhone only.
    apple: 'Continuar con Apple',
    or: 'o',
    emailLabel: 'Tu correo electrónico',
    emailHint: 'Te enviaremos un enlace para iniciar sesión. No necesitas contraseña.',
    sendLink: 'Enviarme un enlace',
    sending: 'Enviando…',
    invalidEmail: 'Revisa tu correo electrónico. Debería tener este aspecto: nombre@ejemplo.com.',
    sendFailed: 'No se pudo enviar el enlace. Revisa tu conexión e inténtalo de nuevo.',
    googleFailed: 'No se pudo abrir el inicio de sesión de Google. Revisa tu conexión e inténtalo de nuevo.',
    appleFailed: 'No se pudo iniciar sesión con Apple. Inténtalo de nuevo o usa tu correo electrónico.',
    rateLimited: 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.',
    checkTitle: 'Revisa tu correo',
    checkBody: (email: string) => `Hemos enviado un enlace a ${email}. Ábrelo en este dispositivo para iniciar sesión. Funciona durante 1 hora.`,
    sendAgain: 'Enviarlo de nuevo',
    sentAgain: 'Enviado de nuevo. Revisa tu correo.',
    differentEmail: 'Usar otro correo electrónico',
    signingIn: 'Iniciando sesión…',
    linkExpired: 'Este enlace de inicio de sesión ha caducado o ya se ha usado. Pide uno nuevo.',
    linkOtherBrowser: 'Abre el enlace en el mismo navegador en el que lo pediste, o pide uno nuevo.',
    backToSignIn: 'Volver a iniciar sesión',
    familyTitle: 'Crea tu familia',
    familyLead: 'Todas las personas que invites compartirán sus recetas y su lista de la compra.',
    yourName: 'Tu nombre',
    yourNameHint: 'Lo verá tu familia',
    yourNameMissing: 'Añade tu nombre para que tu familia sepa quién eres.',
    familyName: 'Nombre de la familia',
    familyNamePlaceholder: 'Los García',
    familyNameMissing: 'Ponle un nombre a tu familia.',
    createFamily: 'Crear familia',
    creating: 'Creando…',
    saveFailed: 'No se pudo guardar. Inténtalo de nuevo.',
  },
  // design/ui/OC-Welcome.md › Join (spec 003)
  join: {
    title: (family: string) => `Unirte a ${family}`,
    lead: (inviter: string) => `${inviter} te ha invitado a compartir recetas y la lista de la compra.`,
    join: (family: string) => `Unirme a ${family}`,
    joining: 'Uniéndote…',
    expired: 'Esta invitación ha caducado. Pide una nueva.',
    openApp: 'Ir a Our Cocon',
    hasMembers: 'Ya estás en una familia con otras personas. Pide a su propietario que te quite y vuelve a abrir este enlace.',
    replaceTitle: (own: string, family: string) => `¿Salir de “${own}” y unirte a “${family}”?`,
    replaceBody: (own: string) => `Tu familia “${own}” y todo lo que contiene se eliminarán. No se puede deshacer.`,
    keepMine: 'Quedarme en la mía',
    // Spec 033: a link made from a member's row ("Invite James") joins as that member.
    asMemberLead: (name: string) => `Te unirás como ${name}, con el mismo color y los mismos eventos.`,
    joinAs: (name: string) => `Unirme como ${name}`,
  },
  // design/ui/OC-Connect.md › Approve access (spec 023): an AI assistant asks to act as this member.
  oauthConsent: {
    title: (assistant: string) => `¿Dejar que ${assistant} use Our Cocon?`,
    /** The name an app gave itself, when its return address doesn't prove who it is. */
    titleUnverified: (name: string) => `¿Dejar que “${name}” use Our Cocon?`,
    notReally: (name: string, host: string) => `Esta app dice llamarse ${name}, pero te devolvería a ${host}. Permítelo solo si confías en ${host}.`,
    lead: 'Podrá ver y cambiar las cosas de tu familia en Our Cocon, como las recetas y la lista de la compra, en tu nombre. Puedes desconectarlo cuando quieras en Menú › Asistentes de IA.',
    sendsBackTo: (host: string) => `Después volverás a ${host}.`,
    allow: 'Permitir',
    allowing: 'Conectando…',
    deny: 'No permitir',
    allowed: (assistant: string) => `Listo. Ya puedes volver a ${assistant}.`,
    denied: (assistant: string) => `No se ha dado acceso a ${assistant}.`,
    signInTitle: 'Inicia sesión para conectar tu asistente de IA',
    signInLead: 'Después elegirás si puede usar Our Cocon.',
    expired: 'Esta solicitud ha caducado. Vuelve a tu asistente de IA y conéctalo de nuevo.',
    failed: 'No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.',
    unnamed: 'Tu asistente de IA',
  },
  // design/ui/OC-Connect.md (spec 025): Settings › AI assistants, with its Connect and Manage sheets.
  // Connection steps checked against each assistant's help pages on 2026-10-26 (spec 025 FR-005).
  aiConnections: {
    back: 'Volver al menú',
    title: 'Asistentes de IA',
    lead: 'Deja que tu IA guarde recetas, complete la lista de la compra y añada eventos por ti. Cada persona conecta el suyo.',
    connected: (timeAgo: string) => `Conectado · usado ${timeAgo}`,
    notConnected: 'No conectado',
    notAvailable: 'Aún no disponible',
    notAvailableNote: (assistant: string) => `${assistant} todavía no puede conectarse a apps como Our Cocon. Lo añadiremos aquí en cuanto pueda.`,
    manage: 'Gestionar',
    manageA11y: (assistant: string) => `Gestionar ${assistant}`,
    connect: 'Conectar',
    connectA11y: (assistant: string) => `Conectar ${assistant}`,
    /** An app that connected but isn't one of the three (named by itself, so in quotes). */
    otherName: (name: string | null) => (name ? `“${name}”` : 'Otra app de IA'),
    permissionsHeading: 'Qué puede hacer la IA',
    permissions: { recipes_edit: 'Crear y editar recetas', groceries: 'Cambiar la lista de la compra', events: 'Añadir y cambiar eventos', reminders: 'Añadir y cambiar recordatorios', recipes_delete: 'Eliminar recetas' },
    allowed: 'Permitido',
    notAllowed: 'No permitido',
    permissionLead: 'Para los asistentes de IA que conectes. Cada persona de tu familia elige para los suyos.',
    permissionFailed: 'No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.',
    trySaying: 'Prueba a decir',
    examples: ['“Guarda el pisto de mi madre en Our Cocon. Es para 4 personas.”', '“Añade a la compra lo que necesito para la quiche.”', '“Añade el pediatra de James el miércoles por la mañana.”'],
    loading: 'Cargando tus asistentes de IA',
    loadFailed: 'No se pudieron cargar tus asistentes de IA. Revisa tu conexión e inténtalo de nuevo.',
    retry: 'Reintentar',
    close: 'Cerrar',
    // Connect sheet.
    connectTitle: (assistant: string) => `Conectar ${assistant}`,
    addressLabel: 'Dirección de Our Cocon',
    copy: 'Copiar',
    copied: 'Copiado ✓',
    check: 'Ya lo he hecho: comprobar la conexión',
    checking: 'Comprobando…',
    connectedResult: '¡Conectado!',
    notYet: (step: number) => `Aún no está conectado. Revisa el paso ${step} e inténtalo de nuevo.`,
    /** The step the "Not connected yet" message points to: where the address is added. */
    checkStep: 2,
    // Menu and button names in **…** are highlighted, like amounts in recipe steps.
    steps: {
      claude: [
        'Copia abajo la dirección de Our Cocon.',
        'En Claude, abre **Customize › Connectors**, toca **+ Add** y luego **Add custom connector**. Llámalo **Our Cocon**, pega la dirección y toca **Continue** y **Add**.',
        'Cuando Claude te lo pida, inicia sesión en Our Cocon y toca **Permitir**.',
      ],
      chatgpt: [
        'Copia abajo la dirección de Our Cocon.',
        'En ChatGPT en la web, abre **Plugins**, toca **+** y elige añadir una app MCP. Llámala **Our Cocon**, pega la dirección en **Connection**, deja **OAuth**, marca **I understand** y créala. ¿No ves esa opción? Activa primero **Developer mode** en **Settings › Security and sign-in**.',
        'Cuando ChatGPT te lo pida, inicia sesión en Our Cocon y toca **Permitir**.',
      ],
      gemini: [
        'Copia abajo la dirección de Our Cocon.',
        'En gemini.google.com, abre **Settings › Connected Apps**. En **Custom apps**, elige **Add a custom app**, pega la dirección y toca **Next**.',
        'Cuando Gemini te lo pida, inicia sesión en Our Cocon y toca **Permitir**.',
      ],
    },
    notes: {
      chatgpt: 'A veces ChatGPT detiene una petición para hacer una comprobación de seguridad. Si pasa, vuelve a pedírselo.',
      gemini: 'Por ahora, Gemini solo ofrece esto en EE. UU., con una cuenta personal de Google.',
    } as Partial<Record<'claude' | 'chatgpt' | 'gemini', string>>,
    // Manage sheet.
    lastUsed: (timeAgo: string) => `Usado por última vez ${timeAgo}`,
    disconnect: 'Desconectar',
    disconnectTitle: (assistant: string) => `¿Desconectar ${assistant}?`,
    disconnectBody: 'Ya no podrá ver ni cambiar tus recetas, tu lista de la compra ni tu calendario.',
    cancel: 'Cancelar',
    disconnectFailed: 'No se pudo desconectar. Revisa tu conexión e inténtalo de nuevo.',
  },
  // design/ui/OC-Home.md (spec 028): brand row, greeting, latest-recipe hero and the two tiles.
  home: {
    brand: 'Our Cocon',
    /** FR-007: 5:00–11:59, 12:00–17:59, 18:00–4:59. */
    greeting: { morning: (name: string) => `Buenos días, ${name}`, day: (name: string) => `Hola, ${name}`, evening: (name: string) => `Buenas tardes, ${name}` },
    family: (names: string[]) => `Familia: ${names.join(', ')}`,
    moreMembers: (n: number) => `+${n}`,
    latestRecipe: 'Última receta',
    // In place of the latest recipe while something is cooking (spec 051), one card per cook.
    cookingNow: (step: number, total: number) => `Cocinando: paso ${step}/${total}`,
    cookingRegion: (n: number) => `${n} recetas en preparación`,
    showCook: (recipe: string) => `Ver ${recipe}`,
    serves: (n: number) => `Para ${n} ${n === 1 ? 'persona' : 'personas'}`,
    toBuyChip: (n: number) => `${n} por comprar`,
    toBuy: 'por comprar',
    familyRecipes: 'recetas familiares',
    noRecipes: {
      title: '¿Qué hay de cena?',
      body: 'Guarda tu primera receta familiar y aparecerá aquí.',
      action: 'Añadir tu primera receta',
      hint: 'O pide a tu asistente de IA que añada una por ti.',
    },
    invite: {
      title: 'Invita a tu familia',
      body: 'Comparte Our Cocon para que todos vean las mismas recetas, la misma lista y el mismo calendario.',
      action: 'Invitar',
    },
  },
  // design/ui/CalCard.md (spec 028): Home's calendar card.
  calCard: {
    label: 'Calendario familiar',
    show: 'Mostrar',
    today: 'Hoy',
    thisWeek: 'Esta semana',
    calendar: 'Calendario',
    addEvent: 'Añadir evento',
    /** A strip day picked (FR-008): "+" adds on it. */
    addEventOn: (weekday: string) => `Añadir evento el ${weekday}`,
    /** "Wednesday, Oct. 28", "Today, Sunday, Oct. 25". */
    dayTitle: (today: boolean, date: string) => (today ? `Hoy, ${date}` : date),
    dayEmpty: (weekday: string) => `No hay nada previsto el ${weekday}.`,
    wholeWeek: 'Toda la semana',
    /** "Eva’s birthday is on Tuesday", "… is tomorrow", "… is today". */
    birthday: (title: string, when: 'today' | 'tomorrow' | string) => (when === 'today' ? `${title} es hoy` : when === 'tomorrow' ? `${title} es mañana` : `${title} es el ${when}`),
    /** A reminder due today for tomorrow's event: "Tomorrow · 10:00". */
    tomorrow: (sub: string) => `Mañana · ${sub}`,
    reminder: 'Recordatorio',
    seeAll: (n: number) => `Ver todo (${n} más)`,
    empty: 'No hay eventos en los próximos 7 días. ¿Añadir uno?',
    emptyAdd: '+ Añadir evento',
    openCalendar: 'Abrir calendario',
    /** The week row after the title: "06:30 · Gabriel". */
    detail: (who: string, when: string) => (who ? `${when} · ${who}` : when),
    rowLabel: (parts: string[]) => parts.filter(Boolean).join(', '),
    /** A strip day for screen readers, like a month day (spec 030 FR-006): "Today, October 25: Brunch, Baby swim". */
    dayLabel: (today: boolean, date: string, titles: string[]) => `${today ? 'Hoy, ' : ''}${date}: ${titles.length ? titles.join(', ') : 'nada previsto'}`,
  },
  // design/ui/OC-Home.md › Latest activity and design/ui/OC-Activity.md (specs 026, 028): what the
  // family and their AI assistants changed, and Undo for an AI change.
  activity: {
    badge: 'IA',
    /** "Eva added Pumpkin soup", "Gabriel ticked 4 items". */
    title: {
      recipe_created: (who: string, recipe: string) => `${who} añadió ${recipe}`,
      recipe_edited: (who: string, recipe: string) => `${who} editó ${recipe}`,
      recipe_deleted: (who: string, recipe: string) => `${who} eliminó ${recipe}`,
      recipe_restored: (who: string, recipe: string) => `${who} restauró ${recipe}`,
      groceries_added: (who: string, n: number, name: string) => (n === 1 ? `${who} añadió ${name}` : `${who} añadió ${n} artículos`),
      groceries_ticked: (who: string, n: number, name: string) => (n === 1 ? `${who} marcó ${name}` : `${who} marcó ${n} artículos`),
      groceries_unticked: (who: string, n: number, name: string) => (n === 1 ? `${who} desmarcó ${name}` : `${who} desmarcó ${n} artículos`),
      groceries_removed: (who: string, n: number, name: string) => (n === 1 ? `${who} quitó ${name}` : `${who} quitó ${n} artículos`),
      groceries_cleared: (who: string, n: number) => (n === 1 ? `${who} borró 1 artículo comprado` : `${who} borró ${n} artículos comprados`),
      event_created: (who: string, event: string) => `${who} añadió ${event}`,
      event_edited: (who: string, event: string) => `${who} editó ${event}`,
      event_deleted: (who: string, event: string) => `${who} eliminó ${event}`,
      event_date_deleted: (who: string, event: string) => `${who} eliminó una fecha de ${event}`,
      // Spec 060 and 032-later L144: reminders.
      reminder_created: (who: string, reminder: string) => `${who} añadió ${reminder}`,
      reminder_edited: (who: string, reminder: string) => `${who} editó ${reminder}`,
      reminder_completed: (who: string, reminder: string) => `${who} completó ${reminder}`,
      reminder_snoozed: (who: string, reminder: string) => `${who} pospuso ${reminder}`,
      reminder_deleted: (who: string, reminder: string) => `${who} eliminó ${reminder}`,
      reminder_restored: (who: string, reminder: string) => `${who} restauró ${reminder}`,
      reminder_reopened: (who: string, reminder: string) => `${who} reabrió ${reminder}`,
      other: (who: string, n: number) => (n === 1 ? `${who} hizo 1 cambio` : `${who} hizo ${n} cambios`),
    },
    /** In a title when the reader may not see the event, or it's gone for good. */
    privateEvent: 'un evento privado',
    anEvent: 'un evento',
    aRecipe: 'una receta',
    aReminder: 'un recordatorio',
    module: { recipes: 'Recetas', groceries: 'Compra', calendar: 'Calendario', reminders: 'Recordatorios' },
    /** "from Leek & bacon quiche", in the sub-line of grocery items added from a recipe. */
    fromRecipe: (recipe: string) => `de ${recipe}`,
    via: (assistant: string) => `vía ${assistant}`,
    /** "Recipes · via ChatGPT · 1 h ago", "Calendar · Wed, 10:00 · via Claude · 3 h ago". */
    sub: (parts: string[]) => parts.filter(Boolean).join(' · '),
    undoneBy: (name: string) => `Deshecho por ${name}`,
    restoredBy: (name: string) => `Restaurado por ${name}`,
    undo: 'Deshacer',
    restore: 'Restaurar',
    undoA11y: (title: string) => `Deshacer: ${title}`,
    restoreA11y: (title: string) => `Restaurar: ${title}`,
    seeAll: 'Ver toda la actividad',
    latest: 'Actividad reciente',
    show: 'Mostrar',
    all: 'Todo',
    aiOnly: 'Solo IA',
    noAi: 'Aún no hay cambios de la IA.',
    undone: 'Deshecho',
    restored: 'Restaurado',
    // Something changed after the AI's change (spec 026 edge case): a Dialog before undoing the rest.
    conflictTitle: '¿Deshacer el resto?',
    conflict: {
      ticked: (name: string, n: number) => `${name} marcó ${n === 1 ? '1 de estos artículos' : `${n} de estos artículos`}.`,
      cleared: (name: string, n: number) => `${name} borró ${n === 1 ? '1 de estos artículos' : `${n} de estos artículos`}.`,
      edited: (name: string, n: number) => `${name} ha cambiado ${n === 1 ? '1 de estas cosas' : `${n} de estas cosas`} desde entonces.`,
      gone: (n: number) => (n === 1 ? '1 de estos ya no existe.' : `${n} de estos ya no existen.`),
    },
    conflictStays: 'Se quedarán como están.',
    undoRest: 'Deshacer el resto',
    cancel: 'Cancelar',
    nothingLeft: 'Todo esto ha cambiado desde entonces, así que no queda nada por deshacer.',
    expired: 'Esto ya no se puede deshacer.',
    undoFailed: 'No se pudo deshacer. Revisa tu conexión e inténtalo de nuevo.',
    restoreFailed: 'No se pudo restaurar. Revisa tu conexión e inténtalo de nuevo.',
    // design/ui/OC-Activity.md: the full list, from Home's "See all activity".
    screenTitle: 'Actividad',
    back: 'Volver a Inicio',
    people: 'Personas',
    assistants: 'Asistentes',
    otherAssistant: 'Otro',
    showMore: 'Ver más',
    loading: 'Cargando la actividad',
    loadFailed: 'No se pudo cargar la actividad. Revisa tu conexión e inténtalo de nuevo.',
    // Spec 053 FR-018, FR-021: "Show more" while the next 20 load, and when they couldn't.
    loadingMore: 'Cargando…',
    loadMoreFailed: 'No se pudo cargar más actividad. Revisa tu conexión e inténtalo de nuevo.',
    allEmptyTitle: 'Aún no hay actividad',
    allEmptyBody: 'Cuando alguien de la familia añada o cambie algo, aparecerá aquí.',
    emptyTitle: 'Aún no hay cambios de la IA',
    emptyBody: 'Cuando un asistente de IA cambie algo para tu familia, aparecerá aquí. Puedes deshacerlo durante 7 días.',
    noMatches: 'Nada coincide con estos filtros.',
  },
  // design/ui/OC-Settings.md (spec 003 sections; the rest come with 021, 025, 027, 018 and 029)
  // design/ui/OC-Menu.md (spec 029): the last tab. Apps, then the settings pages.
  menu: {
    title: 'Menú',
    apps: 'Apps',
    settings: 'Ajustes',
    calendar: 'Calendario',
    recipes: 'Recetas',
    groceries: 'Compra',
    timers: 'Temporizadores',
    reminders: 'Recordatorios',
    today: (n: number) => (n === 0 ? 'Nada hoy' : `${n} hoy`),
    recipeCount: (n: number) => (n === 0 ? 'Aún no hay recetas' : `${n} ${n === 1 ? 'receta' : 'recetas'}`),
    toBuy: (n: number) => (n === 0 ? 'Todo listo' : `${n} por comprar`),
    timersDetail: (running: number, paused: number) => (running > 0 ? `${running} en marcha` : paused > 0 ? `${paused} en pausa` : 'Ninguno en marcha'),
    /** What Home lists: late and due today. */
    toDo: (n: number) => (n === 0 ? 'Nada pendiente' : `${n} ${n === 1 ? 'pendiente' : 'pendientes'}`),
    family: 'Familia',
    familyDetail: (names: readonly string[]) => `${names.join(', ')} · tu cuenta`,
    aiAssistants: 'Asistentes de IA',
    connected: (n: number) => `${n} ${n === 1 ? 'conectado' : 'conectados'}`,
    notConnected: 'No conectado',
    // Spec 046 (OC-SettingsNotif.md › Menu row).
    notifications: 'Notificaciones',
    notificationsDetail: 'Temporizadores, avisos de eventos',
    notificationsOff: 'Desactivadas',
    // Spec 076: Menu › Language.
    language: 'Idioma',
    calendarDetail: 'Tu vista, momentos del día',
    recipesDetail: 'Ajustes de cocina, unidades',
    groceriesDetail: 'Dónde compras, formatos de tienda',
    recentlyDeleted: 'Eliminado recientemente',
    /** Recipes and events (spec 042). */
    items: (n: number) => (n === 0 ? 'Vacío' : `${n} ${n === 1 ? 'elemento' : 'elementos'}`),
  },
  settings: {
    // Spec 076: Menu › Language (not drawn). Each language is named in its own words.
    language: {
      back: 'Volver al menú',
      title: 'Idioma',
      lead: 'Solo para ti, en todos tus dispositivos.',
      automatic: (name: string) => `Automático (${name})`,
      automaticHint: 'Sigue el idioma de tu teléfono o navegador.',
      typedContent: 'Las recetas, listas y notas se quedan como se escribieron.',
      names: { en: 'English', fr: 'Français', es: 'Español' },
      saveFailed: 'No se pudo guardar. Inténtalo de nuevo.',
    },
    // Spec 046: Menu › Notifications (design/ui/OC-SettingsNotif.md).
    notifications: {
      back: 'Volver al menú',
      title: 'Notificaciones',
      lead: 'Solo para ti, en este iPhone.',
      web: 'Las notificaciones funcionan en la app del iPhone.',
      offTitle: 'Las notificaciones de Our Cocon están desactivadas',
      offBody: 'Los temporizadores no pueden sonar y los recordatorios no llegarán mientras la app esté cerrada.',
      openSettings: 'Abrir Ajustes del iPhone',
      // Not asked yet (not drawn; written for spec 046).
      askBody: 'Oye el aviso y ve tu temporizador en la pantalla bloqueada, y recibe avisos antes de los eventos familiares, incluso con Our Cocon cerrado.',
      turnOn: 'Activar notificaciones',
      timers: 'Temporizadores',
      timersLive: 'Temporizador en la pantalla bloqueada',
      timersLiveHint: 'Cuenta atrás en la pantalla bloqueada y en la Dynamic Island',
      timersAlert: 'Avisar cuando termine un temporizador',
      timersAlertHint: 'Sonido y notificación, incluso con la app cerrada',
      reminders: 'Avisos de eventos',
      remindersOn: 'Avisos de eventos',
      remindersOnHint: 'Antes de los eventos que tienen aviso',
      remindMe: 'Avisarme de',
      scopes: { mine: 'Eventos en los que estoy', all: 'Todos los eventos de la familia' },
      defaultReminder: 'Por defecto para eventos nuevos',
      defaultReminderHint: 'Al añadir un evento',
      reminderChoices: { none: 'Ninguno', minutes_15: '15 minutos antes', hour_before: '1 hora antes', morning_of: 'Esa misma mañana', day_before: '1 día antes' },
      // The family's members without the app (spec 033). No pronouns are stored, so "them".
      managedHint: (names: readonly string[]) =>
        `Los eventos de ${andList(names)} avisan a la persona que los acompaña, o a todos los que tienen la app si aún no se ha elegido a nadie.`,
      // Spec 059 FR-007: reminders (things to do) and each person's quiet hours.
      todo: 'Recordatorios',
      todoOn: 'Recordatorios',
      todoOnHint: 'Cosas por hacer, y avisos hasta que estén hechas',
      quietHours: 'Horas de silencio',
      quietValue: (from: string, to: string) => `${from}–${to}`,
      quietTitle: 'Horas de silencio',
      quietHint: 'Sin avisos en estas horas. Lo que venza entonces llegará cuando terminen.',
      quietFrom: 'Desde',
      quietTo: 'Hasta',
      quietSave: 'Guardar',
      close: 'Cerrar',
      saveFailed: 'No se pudo guardar. Inténtalo de nuevo.',
    },
    // Spec 021: where the family shops (the Groceries tab's "Grocery settings" sheet, and the
    // Groceries page, OC-SettingsGroceries, spec 029).
    groceries: {
      back: 'Volver al menú',
      title: 'Compra',
      lead: 'Para toda la familia. También puedes cambiarlo desde la pestaña Compra.',
      shopLabel: '¿Dónde compras?',
      shopHint: 'Para que la lista muestre formatos que de verdad puedes comprar',
      usStores: 'Tiendas de EE. UU.',
      euStores: 'Tiendas europeas',
      // The example is copy (OC-Settings), checked against the engine in GrocerySettings.test.tsx.
      exampleNeed: 'La receta necesita ',
      exampleAmount: '300 ml de nata',
      exampleBuy: { us: 'Comprar 1 pinta', eu: 'Comprar 2 × 20 cl' },
      roundLabel: 'Redondear a formatos de tienda',
      roundHint: 'Desactivado: la lista muestra solo lo que necesitan las recetas',
      saveFailed: 'No se pudo guardar. Inténtalo de nuevo.',
    },
    // Spec 027: the family's cooking defaults (design/ui/OC-SettingsRecipes.md).
    recipes: {
      back: 'Volver al menú',
      title: 'Recetas',
      lead: 'Tus unidades y los ajustes de cocina de toda la familia. Cada receta puede cambiarlos en Editar › Esta receta.',
      // Spec 051: units are each person's.
      forYou: 'Para ti',
      unitsHint: 'Solo para ti. El “…” de una receta puede cambiarlas durante una visita.',
      cookingDefaults: 'Ajustes de cocina',
      keepAwake: 'Mantener la pantalla encendida al cocinar',
      keepAwakeHint: 'Para que no se bloquee con las manos llenas de harina',
      kitchenScale: 'Tengo báscula de cocina',
      kitchenScaleHint: 'Desactivado: muestra tazas y cucharadas en lugar de gramos',
      thermometer: 'Tengo termómetro',
      thermometerHint: 'Desactivado: oculta las comprobaciones de temperatura en los pasos',
      units: 'Unidades',
      metric: 'Métrico · g, ml, °C',
      imperial: 'Imperial · oz, °F',
      saveFailed: 'No se pudo guardar. Inténtalo de nuevo.',
    },
    // design/ui/OC-CalSettings.md (spec 029). The slot and time zone sheets aren't drawn.
    calendar: {
      back: 'Volver al menú',
      title: 'Calendario',
      lead: 'Cómo ves el calendario familiar y los momentos del día de la familia.',
      forYou: 'Para ti',
      opensOn: 'Se abre en',
      views: { month: 'Mes', week: 'Semana', day: 'Día', agenda: 'Agenda' },
      weekStart: 'La semana empieza el',
      weekStartHint: 'Automático sigue la región de este teléfono',
      weekStarts: { automatic: 'Automático', sunday: 'Domingo', monday: 'Lunes' },
      timeFormat: 'Formato de hora',
      timeFormatHint: 'Automático sigue los ajustes de este teléfono',
      timeFormats: { automatic: 'Automático', '24h': '24 horas', '12h': '12 horas' },
      birthdays: 'Mostrar cumpleaños',
      birthdaysHint: 'También en Inicio, con 3 días de antelación',
      fadePast: 'Atenuar los días pasados',
      fadePastHint: 'Para que hoy y lo que viene destaquen',
      timesOfDay: 'Momentos del día',
      timesOfDayLead: (owner: string) => `Los usa toda la familia al elegir un momento del día. Solo ${owner}, propietario de la familia, puede cambiarlos.`,
      hours: (start: string, end: string) => `${start}–${end}`,
      slotLabel: (slot: string, hours: string) => `${slot}, ${hours}`,
      family: 'Familia',
      homeTimeZone: 'Zona horaria de la familia',
      // Spec 071: only while the member keeps their own times on another zone.
      myTimeZone: 'Mi zona horaria',
      aiAssistants: 'Asistentes de IA',
      aiAssistantsSub: 'Deja que Claude, ChatGPT o Gemini añadan eventos',
      // The slot sheet (not drawn): Starts and Ends like Add event's custom times.
      starts: 'Empieza',
      ends: 'Termina',
      badTime: 'Usa una hora como 18:30.',
      endBeforeStart: 'Elige una hora de fin posterior al inicio.',
      /** The neighbour that moves with an edge: "Afternoon will end at 18:30." */
      movesWith: (slot: string, edge: 'start' | 'end', time: string) => `${slot} ${edge === 'start' ? 'empezará' : 'terminará'} a las ${time}.`,
      overlap: (slot: string, previous: string) => `Los horarios no pueden solaparse. ${slot} tiene que empezar cuando termine ${previous}.`,
      cancel: 'Cancelar',
      save: 'Guardar',
      saving: 'Guardando…',
      // The time zone sheet (not drawn). Spec 071: any member moves the family; times stay as entered.
      timeZoneLead: 'Todas las fechas del calendario familiar usan esta zona horaria. Si la cambias, cada evento y recordatorio se queda a la hora en que se introdujo.',
      usePhoneZone: (zone: string) => `Usar la zona horaria de este teléfono (${zone})`,
      sameZone: 'Ya es la zona horaria de la familia.',
      // Spec 071: the My time zone sheet (not drawn).
      myTimeZoneLead: (family: string) => `Tus horas siguen en esta zona horaria; el resto de la familia está en la hora de ${family}. Volverán solas cuando tu teléfono vuelva a estar en la hora de ${family}.`,
      useFamilyZone: (family: string) => `Usar la zona horaria de la familia (${family})`,
      notSet: 'Aún sin definir',
      close: 'Cerrar',
      saveFailed: 'No se pudo guardar. Inténtalo de nuevo.',
    },
    family: {
      back: 'Volver al menú',
      title: 'Familia',
      lead: 'Quién está en la familia, y tu propia cuenta.',
      heading: 'Miembros',
      owner: 'Propietario',
      editor: 'Puede editar',
      invite: 'Invitar a alguien',
      inviting: 'Creando enlace…',
      inviteMessage: (family: string, url: string) => `Únete a ${family} en Our Cocon: ${url}`,
      inviteCopied: 'Enlace de invitación copiado. Envíaselo por mensaje.',
      inviteFailed: 'No se pudo crear la invitación. Inténtalo de nuevo.',
      inviteRateLimited: 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.',
      memberLabel: (name: string, sub: string, role: string) => `${name}, ${sub}, ${role}`,
      // Spec 033 (OC-SettingsFamily › Members): members without the app.
      hasApp: 'Tiene la app',
      addedBy: (name: string) => `Añadido por ${name}`,
      addedByFormer: 'Añadido por un antiguo miembro',
      noAccount: 'Sin cuenta',
      addWithoutApp: 'Añadir sin app',
      withoutAppHint: 'Añade a los niños o a cualquiera que no vaya a usar la app. Tendrán un color en el calendario y tú eliges quién los acompaña a cada cosa.',
      addTitle: 'Añadir un miembro de la familia',
      addLead: 'Para niños o cualquiera que no vaya a usar la app.',
      nameLabel: 'Nombre',
      colorLabel: 'Color',
      add: 'Añadir',
      adding: 'Añadiendo…',
      nameMissing: 'Ponle un nombre.',
      rename: 'Cambiar nombre',
      save: 'Guardar',
      saving: 'Guardando…',
      cancel: 'Cancelar',
      changeColor: 'Cambiar color',
      inviteManaged: (name: string) => `Invitar a ${name}`,
      inviteMessageAs: (family: string, name: string, url: string) => `Únete a ${family} en Our Cocon como ${name}: ${url}`,
      removeManaged: 'Quitar',
      removeManagedTitle: (name: string) => `¿Quitar a ${name}?`,
      removeManagedBody: 'Su nombre y su color desaparecen de la lista de la familia.',
      // Spec 035 (032-later L78): when they have upcoming events.
      removeManagedMoveTitle: (name: string, n: number) => `¿Pasar ${n === 1 ? 'el próximo evento' : `los ${n} próximos eventos`} de ${name} a Todos?`,
      removeManagedMoveBody: 'Sus eventos pasados se quedan en el calendario. Su nombre y su color desaparecen de la lista de la familia.',
      colorTaken: 'Alguien acaba de elegir ese color. Elige otro.',
      // My color (moved here from OC-CalSettings, spec 033 US3).
      myColor: 'Mi color',
      myColorLead: 'Tus eventos se ven en este color para todos. Los colores ocupados muestran quién los tiene.',
      colorNames: {
        honey: 'Miel',
        rose: 'Rosa',
        sky: 'Cielo',
        mint: 'Menta',
        lilac: 'Lila',
        peach: 'Melocotón',
        pistachio: 'Pistacho',
        clay: 'Arcilla',
      },
      swatchMine: (color: string) => `${color}, tu color`,
      swatchPicked: (color: string) => `${color}, elegido`,
      swatchTaken: (color: string) => `${color}, ocupado`,
      swatchFree: (color: string) => `${color}, libre`,
      makeOwner: 'Hacer propietario',
      remove: 'Quitar de la familia',
      close: 'Cerrar',
      removeTitle: (name: string) => `¿Quitar a ${name} de la familia?`,
      removeBody: 'Perderá el acceso a las recetas y la lista de la compra de la familia al momento. Puedes volver a invitarle más tarde.',
      removeConfirm: 'Quitar',
      removeCancel: (name: string) => `Mantener a ${name}`,
      ownerTitle: (name: string) => `¿Hacer propietario a ${name}?`,
      ownerBody: 'Seguirás en la familia y podrás seguir editando. Solo el propietario gestiona los miembros.',
      ownerConfirm: 'Hacer propietario',
      ownerCancel: 'Cancelar',
      actionFailed: 'No se pudo guardar. Inténtalo de nuevo.',
    },
    account: {
      heading: 'Tu cuenta',
      yourName: 'Tu nombre',
      nameSave: 'Guardar',
      nameSaving: 'Guardando…',
      nameCancel: 'Cancelar',
      signOut: 'Cerrar sesión',
      deleteFamily: 'Eliminar familia',
      deleteFamilyTitle: (family: string) => `¿Eliminar “${family}”?`,
      deleteFamilyBody: (n: number) =>
        `Se eliminará la familia y todo lo que contiene para ${n === 1 ? 'su único miembro' : `sus ${n} miembros`}. No se puede deshacer.`,
      deleteFamilyConfirm: 'Eliminar familia',
      deleteAccount: 'Eliminar mi cuenta',
      deleteAccountTitle: '¿Eliminar tu cuenta?',
      deleteAccountBody: 'Tus recetas y eventos se quedan en la familia. Se cerrará tu sesión en todos los dispositivos.',
      deleteAccountConfirm: 'Eliminar mi cuenta',
      keep: 'Mantenerla',
      failed: 'No se pudo guardar. Inténtalo de nuevo.',
    },
  },
  // design/ui/OC-Recipes.md (spec 006; the filter logic comes with 007)
  recipes: {
    title: 'Recetas',
    new: 'Nueva',
    searchLabel: 'Buscar recetas',
    searchPlaceholder: 'Buscar recetas o ingredientes',
    filters: (active: number) => (active === 0 ? 'Filtros' : `Filtros · ${active}`),
    inSeason: 'De temporada',
    under30: 'Menos de 30 min',
    allGroup: (n: number) => `Todas las recetas · ${n}`,
    // Spec 051 FR-003: recipes being cooked, above the list.
    inProgress: (n: number) => `En curso · ${n}`,
    /** "Step 3 of 6 · Gabriel · since 18:40", or "… · started yesterday" after 24 hours untouched. */
    cookLine: (step: number, total: number, member: string, since: string | null) => `Paso ${step} de ${total} · ${member} · ${since ? `desde las ${since}` : 'empezada ayer'}`,
    resumeA11y: (recipe: string, step: number, total: number) => `Continuar ${recipe}, paso ${step} de ${total}`,
    cancelA11y: (recipe: string) => `Dejar de cocinar ${recipe}`,
    doneA11y: (recipe: string) => `Terminar de cocinar ${recipe}`,
    emptyTitle: 'Aquí vivirán las recetas de tu familia.',
    emptyBody: 'Añade una tú, o pide a tu asistente de IA que guarde una.',
    emptyNew: 'Nueva receta',
    emptyAiLabel: 'IA',
    emptyAiHint: 'Prueba: “Guarda el pisto de mi madre en Our Cocon”',
    noMatchTitle: (query: string) => `Ninguna receta coincide con “${query}”.`,
    /** Said after a search settles (spec 030): "3 recipes", "1 recipe". */
    resultCount: (n: number) => (n === 1 ? '1 receta' : `${n} recetas`),
    noMatchBody: 'Prueba con otra palabra, o añádela como receta nueva.',
    clearSearch: 'Borrar búsqueda',
    noFilterMatchTitle: 'Ninguna receta coincide con estos filtros.',
    noFilterMatchBody: 'Prueba a quitar un filtro.',
    clearFilters: 'Borrar filtros',
    loading: 'Cargando recetas',
    loadFailed: 'No se pudieron cargar tus recetas. Revisa tu conexión e inténtalo de nuevo.',
    retry: 'Reintentar',
    // Spec 018: after "Delete recipe" (OC-Delete › After deleting).
    deleted: 'Receta eliminada',
    undo: 'Deshacer',
    undoFailed: 'No se pudo restaurar. Inténtalo de nuevo.',
  },
  // design/ui/OC-Filters.md (spec 007)
  filters: {
    title: 'Filtros',
    clearAll: 'Borrar todo',
    close: 'Cerrar',
    months: 'Mejores meses',
    monthsHint: 'Muestra las recetas ideales para esta época del año.',
    time: 'Tiempo total',
    under30: 'Menos de 30 min',
    from30to60: '30–60 min',
    over60: 'Más de 1 hora',
    cuisine: 'Cocina',
    showMore: (n: number) => `Ver ${n} más`,
    other: 'Otra',
    addedBy: 'Añadida por',
    show: (n: number) => (n === 1 ? 'Ver 1 receta' : `Ver ${n} recetas`),
    noMatch: 'Ninguna receta coincide',
    noMatchHint: 'Prueba a quitar un filtro',
  },
  // design/ui/OC-Recipe.md (spec 008; the "…" panel is 013, the Steps tab 009)
  recipePage: {
    back: 'Volver a las recetas',
    share: 'Compartir receta',
    /** The pencil in the top bar (spec 051 FR-012). */
    edit: 'Editar receta',
    /** The Source chip's spoken name (FR-015): "Source: La Cuisine de Mamie · p. 48". */
    sourceA11y: (source: string) => `Fuente: ${source}`,
    /** FR-005: from the family's done sessions. */
    cookedOnce: (when: string) => `Cocinada una vez · ${when}`,
    cookedTimes: (n: number, member: string, when: string) => `Cocinada ${n} veces · la última por ${member}, ${when}`,
    // The "In progress" card under the chips (FR-004).
    cookingNow: (step: number, total: number) => `Cocinando · paso ${step} de ${total}`,
    /** "Gabriel started at 18:40 · Classic, serves 6". */
    cookStarted: (member: string, at: string | null, variant: string | null, serves: number) =>
      `${member} ${at ? `empezó a las ${at}` : 'empezó ayer'} · ${variant ? `${variant}, para ${serves} ${serves === 1 ? 'persona' : 'personas'}` : `Para ${serves} ${serves === 1 ? 'persona' : 'personas'}`}`,
    cancel: 'Cancelar',
    done: 'Hecho',
    resume: 'Continuar',
    cancelled: 'Cancelado',
    cookFailed: 'No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.',
    // Starting while someone's cooking it (spec 051 › Warnings and errors).
    alreadyCooking: (member: string, step: number) => `${member} está cocinando esta receta (paso ${step})`,
    alreadyCookingYou: (step: number) => `Estás cocinando esta receta (paso ${step})`,
    alreadyCookingLead: 'Sigue por donde va, o vuelve a empezar desde el paso 1.',
    resumeTheirs: (member: string) => `Continuar la de ${member}`,
    resumeYours: 'Continuar',
    startOver: 'Empezar de nuevo',
    bestMonths: (from: string, to: string) => `Temporada: ${from} – ${to}`,
    bestMonth: (month: string) => `Temporada: ${month}`,
    /** Several separate runs of months: "Best Jan, May – Jun". */
    bestRuns: (runs: string[]) => `Temporada: ${runs.join(', ')}`,
    monthRun: (from: string, to: string) => `${from} – ${to}`,
    version: 'Versión',
    classic: 'Clásica',
    servings: 'Raciones',
    fewerServings: 'Menos raciones',
    moreServings: 'Más raciones',
    /** Said after −/+ (spec 030 FR-002): "5 servings", "7½ servings", "1 serving". */
    servingsAnnouncement: (n: string) => `${n} ${n === '1' ? 'ración' : 'raciones'}`,
    moreOptions: 'Más opciones',
    tabsLabel: 'Vista de la receta',
    ingredientsTab: (n: number) => `Ingredientes · ${n}`,
    stepsTab: (n: number) => `Pasos · ${n}`,
    ingredientsLabel: 'Ingredientes',
    variantTag: 'Variante',
    // The action bar (spec 051 FR-014): the cart (its label shows from 430 wide) and the main button.
    addToGroceries: 'Añadir a la compra',
    startRecipe: 'Empezar receta',
    resumeAt: (step: number) => `Continuar · paso ${step}`,
    /** On a cook's last step (FR-005). */
    doneCooking: 'Terminar de cocinar',
    stepsLabel: 'Pasos',
    /** A row in the Steps tab opens cooking mode there. */
    /** A step row's screen-reader name (spec 030): "Step 3: Bake, 35:00 timer. Opens in cooking mode". */
    // Spec 067: the timer's length ("12 min timer") and the Variant tag are said too.
    openStep: (n: number, title: string, duration?: string, variant?: boolean) =>
      `Paso ${n}: ${title}${variant ? ', variante' : ''}${duration ? `, temporizador de ${duration}` : ''}. Se abre en modo cocina`,
    // Spec 067 (OC-LargeScreens § Recipe): above the step cards, and the options link beside the columns.
    stepsHint: 'Toca un paso para abrirlo en modo cocina',
    moreOptionsLink: 'Más opciones · escala, unidades',
    closeOptions: 'Cerrar opciones',
    // The Steps tab (spec 009, OC-RecipeSteps).
    steps: {
      tempLabel: 'Comprobar la temperatura:',
      tipLabel: 'Consejo del chef',
      startTimer: 'Iniciar temporizador',
      pause: 'Pausar',
      resume: 'Reanudar',
      done: '¡Listo!',
      minus: '−1',
      plus: '+1',
      minusA11y: 'Un minuto menos',
      plusA11y: 'Un minuto más',
      footnote: '−1 / +1 cambia un temporizador en un minuto, incluso mientras está en marcha.',
      /** A token whose ingredient is gone and whose name isn't known either. */
      missingIngredient: 'un ingrediente',
    },
    // What an option variant changes (FR-002): "Adds 3 ingredients and 1 step".
    effect: {
      adds: (what: string) => `Añade ${what}`,
      removes: (what: string) => `Quita ${what}`,
      changes: (what: string) => `Cambia ${what}`,
      ingredients: (n: number) => (n === 1 ? '1 ingrediente' : `${n} ingredientes`),
      steps: (n: number) => (n === 1 ? '1 paso' : `${n} pasos`),
      and: ' y ',
      /** Between "Adds …", "Removes …" and "Changes …". */
      list: '. ',
    },
    // The "…" panel under Servings (spec 013, OC-Recipe).
    more: {
      kitchenScale: 'Estoy usando una báscula de cocina',
      scaleOnHint: 'Se muestran pesos exactos, como 100 g',
      scaleOffHint: 'Se muestran tazas y cucharadas, como unos ¾ de taza',
      scaleByIngredient: 'Escalar según un ingrediente',
      converter: 'Conversor de unidades',
      units: 'Unidades',
      metric: 'Métrico',
      imperial: 'Imperial',
      /** The chip under Servings after "Apply to recipe": "Scaled by lardons · Reset". */
      scaledBy: (ingredient: string) => `Escalada según ${ingredient}`,
      reset: 'Restablecer',
      resetA11y: (ingredient: string) => `Restablecer la escala según ${ingredient}`,
    },
    /** The header photo, for screen readers (spec 030). */
    photo: (recipe: string) => `Foto de ${recipe}`,
    stepPhoto: (n: number) => `Foto del paso ${n}`,
    deleted: (name: string) => `${name} ha eliminado esta receta.`,
    loading: 'Cargando la receta',
    loadFailedTitle: 'No hemos podido abrir esta receta.',
    loadFailedBody: 'Puede que se haya eliminado o que no tengas conexión.',
    retry: 'Reintentar',
  },
  // design/ui/OC-Share.md (spec 019): the share sheet.
  share: {
    title: 'Compartir esta receta',
    close: 'Cerrar',
    /** Family names read "The Smiths" (OC-Welcome), so a leading "The" isn't said twice. */
    fromFamily: (family: string) => `De la familia ${family.replace(/^(the|los|las)\s+/i, '')}`,
    photo: 'Foto de la receta',
    viewOnly: 'Solo lectura. Cualquiera con el enlace puede leerla y cocinarla, pero no puede cambiarla ni ver tus otras recetas.',
    linkLabel: 'Enlace',
    creating: 'Creando enlace…',
    notShared: 'No compartida',
    copy: 'Copiar enlace',
    copied: 'Copiado ✓',
    copiedBanner: 'Enlace copiado',
    createNew: 'Crear un enlace nuevo',
    message: 'Mensaje',
    email: 'Correo',
    more: 'Más',
    /** What Message, Email and More send: "{recipe name} — {link}". */
    shareText: (name: string, url: string) => `${name} — ${url}`,
    includeVariants: 'Incluir variantes',
    includeTips: 'Incluir consejos del chef',
    stop: 'Dejar de compartir este enlace',
    stopTitle: '¿Dejar de compartir?',
    stopBody: 'El enlace dejará de funcionar para todos los que lo tengan.',
    stopConfirm: 'Dejar de compartir',
    stopKeep: 'Seguir compartiendo',
    // Not drawn (written for spec 019, added to OC-Share.md).
    failed: 'No se pudo crear el enlace. Revisa tu conexión e inténtalo de nuevo.',
    retry: 'Reintentar',
    changeFailed: 'No se pudo cambiar. Inténtalo de nuevo.',
  },
  // design/ui/OC-SharedView.md (spec 019): the public shared recipe page.
  sharedView: {
    brand: 'Our Cocon',
    viewOnly: 'Solo lectura',
    photo: (recipe: string) => `Foto de ${recipe}`,
    sharedBy: (name: string) => `Compartida por ${name}`,
    /** When whoever made the link has left the family. */
    sharedByNobody: 'Compartida desde Our Cocon',
    servings: 'Raciones',
    units: 'Unidades',
    ingredients: 'Ingredientes',
    showMore: (n: number) => `Ver ${n} más`,
    steps: 'Pasos',
    promoTitle: 'Reúne las recetas de tu familia',
    promoBody: (recipe: string) => `Guarda ${recipe} en tu propio Our Cocon y cocínala con temporizadores y raciones que se adaptan.`,
    save: 'Guardar en mi Our Cocon',
    stoppedTitle: 'Esta receta ya no se comparte.',
    stoppedBody: 'Pide un enlace nuevo a quien te la envió.',
    loading: 'Cargando la receta',
    // Not drawn (written for spec 019, added to OC-SharedView.md).
    loadFailedTitle: 'No hemos podido abrir esta receta.',
    loadFailedBody: 'Revisa tu conexión e inténtalo de nuevo.',
    retry: 'Reintentar',
    saving: 'Guardando…',
    saveFailed: 'No se pudo guardar esta receta. Inténtalo de nuevo.',
    /** The copy's Source field, crediting who shared it (FR-004). */
    source: (name: string) => `Compartida por ${name}`,
  },
  // design/ui/OC-ShareGroceries.md (spec 072): share the grocery list by link.
  groceryShare: {
    title: 'Compartir la lista de la compra',
    close: 'Cerrar',
    info: (canEdit: boolean) =>
      canEdit
        ? 'Cualquiera con el enlace puede ver la lista a medida que cambia, sin cuenta. Puede añadir, marcar y quitar artículos.'
        : 'Cualquiera con el enlace puede ver la lista a medida que cambia, sin cuenta.',
    howLong: 'Durante cuánto tiempo',
    durations: { '1h': '1 hora', today: 'Hoy', week: 'Esta semana', none: 'Hasta que lo detenga' },
    canEdit: 'Permitir que la editen',
    linkLabel: 'Enlace',
    notShared: 'No compartida',
    creating: 'Creando enlace…',
    create: 'Crear enlace',
    copy: 'Copiar enlace',
    copied: 'Copiado ✓',
    copiedBanner: 'Enlace copiado',
    /** Under the link: when it ends, in the device's time. */
    endsToday: (time: string) => `Termina hoy a las ${time}`,
    endsOn: (day: string, time: string) => `Termina el ${day} a las ${time}`,
    untilStopped: 'Hasta que dejes de compartirla',
    message: 'Mensaje',
    email: 'Correo',
    more: 'Más',
    /** What Message, Email and More send. */
    shareText: (url: string) => `Nuestra lista de la compra — ${url}`,
    copyText: 'Copiar como texto',
    textCopied: 'Lista copiada',
    nothingToCopy: 'No hay nada por comprar en la lista.',
    /** The first line of the copied text. */
    textTitle: 'Lista de la compra',
    stop: 'Dejar de compartir este enlace',
    stopTitle: '¿Dejar de compartir?',
    stopBody: 'El enlace dejará de funcionar para todos los que lo tengan.',
    stopConfirm: 'Dejar de compartir',
    stopKeep: 'Seguir compartiendo',
    failed: 'No se pudo crear el enlace. Revisa tu conexión e inténtalo de nuevo.',
    retry: 'Reintentar',
    changeFailed: 'No se pudo cambiar. Inténtalo de nuevo.',
  },
  // design/ui/OC-SharedGroceries.md (spec 072): the public shared grocery list.
  sharedGroceries: {
    brand: 'Our Cocon',
    tag: 'Lista compartida',
    viewOnly: 'Solo lectura',
    title: 'Lista de la compra',
    /** "From the Demanges family · ends today at 23:59". */
    sub: (family: string, ends: string | null) => `De la familia ${family.replace(/^(the|los|las)\s+/i, '')}${ends ? ` · ${ends}` : ''}`,
    endsToday: (time: string) => `termina hoy a las ${time}`,
    endsOn: (day: string, time: string) => `termina el ${day} a las ${time}`,
    loading: 'Cargando la lista',
    stoppedTitle: 'Esta lista ya no se comparte.',
    stoppedBody: 'Pide un enlace nuevo a quien te la envió.',
    loadFailedTitle: 'No hemos podido abrir esta lista.',
    loadFailedBody: 'Revisa tu conexión e inténtalo de nuevo.',
    retry: 'Reintentar',
    emptyTitle: 'La lista está vacía.',
    emptyBody: 'Añade arriba lo que necesites.',
    /** A row's ✕, for screen readers. */
    removeItem: (name: string) => `Quitar ${name}`,
    readOnly: 'Ahora la lista es de solo lectura.',
    tooMany: 'Demasiados cambios por ahora. Inténtalo más tarde.',
    promoTitle: 'Organiza tu casa desde un solo lugar',
    promoBody: 'Our Cocon reúne las recetas, la lista de la compra y el calendario de tu familia.',
  },
  // design/ui/OC-ScaleIng.md (spec 013)
  scaleSheet: {
    title: 'Escalar según un ingrediente',
    lead: '¿Solo tienes cierta cantidad de algo? Elígelo e indica cuánto tienes. Todo lo demás se ajusta.',
    which: '1. ¿Qué ingrediente?',
    showAll: (n: number) => `Ver los ${n} ingredientes`,
    howMuch: '2. ¿Cuánto tienes?',
    unit: 'Unidad',
    enterAmount: 'Indica cuánto tienes',
    result: (factor: string, servings: string) => `Receta × ${factor} → unas ${servings} raciones`,
    bigChange: 'Es un cambio grande. Revisa los tiempos de cocción.',
    rounded: (names: string) => `${names} se redondean a números enteros. Los tiempos de cocción no cambian.`,
    timesSame: 'Los tiempos de cocción no cambian.',
    and: ' y ',
    cancel: 'Cancelar',
    apply: 'Aplicar a la receta',
    close: 'Cerrar',
  },
  // design/ui/OC-Units.md (spec 013)
  convertSheet: {
    title: 'Conversor de unidades',
    close: 'Cerrar',
    tabsLabel: 'Qué convertir',
    weight: 'Peso',
    volume: 'Volumen',
    oven: 'Temp. del horno',
    convert: 'Convertir',
    unit: 'Unidad',
    forRecipe: 'Para esta receta',
    weighs: (amount: string, ingredient: string, weight: string) => `${amount} de ${ingredient} pesa aproximadamente ${weight}. Útil si prefieres pesarlo en la báscula.`,
    fills: (amount: string, ingredient: string, cups: string) => `${amount} de ${ingredient} equivale aproximadamente a ${cups}. Útil si prefieres usar tazas.`,
    footnote: 'Las tazas y cucharadas usan medidas de EE. UU. Puedes cambiarlo en Ajustes.',
  },
  // Unit names in the unit pickers (spec 013): short, as recipes print them.
  // design/ui/OC-EditBasics.md (spec 014): the recipe form's chrome and its Details section.
  recipeForm: {
    cancel: 'Cancelar',
    newTitle: 'Nueva receta',
    editTitle: 'Editar receta',
    save: 'Guardar',
    saving: 'Guardando…',
    saveRecipe: 'Guardar receta',
    sections: { details: 'Detalles', ingredients: 'Ingredientes', steps: 'Pasos', variants: 'Variantes' },
    next: (section: string) => `Siguiente: ${section}`,
    saveFailed: 'No se pudo guardar. Inténtalo de nuevo.',
    loadFailedTitle: 'No pudimos abrir esta receta.',
    loadFailedBody: 'Puede que se haya eliminado o que no tengas conexión.',
    retry: 'Reintentar',
    aiBadge: 'IA',
    aiHint: 'Más rápido: dile a tu asistente de IA “Guarda la quiche de la abuela en Our Cocon” y lo rellenará por ti.',
    addPhoto: 'Añadir una foto (opcional)',
    changePhoto: 'Cambiar foto',
    removePhoto: 'Quitar',
    photoLabel: 'Foto de la receta',
    uploadingPhoto: 'Subiendo foto…',
    photoFailed: 'La foto no se subió. Inténtalo de nuevo.',
    photoDenied: 'Our Cocon no puede ver tus fotos. Permite el acceso en Ajustes.',
    crop: {
      title: 'Ajusta tu foto',
      hint: 'Arrastra para elegir qué se ve en la cabecera.',
      zoomIn: 'Acercar',
      zoomOut: 'Alejar',
      use: 'Usar foto',
      cancel: 'Cancelar',
    },
    name: 'Nombre de la receta',
    description: 'Descripción breve',
    descriptionHint: 'Una frase que abra el apetito.',
    counter: (n: number) => `${n} / 140`,
    serves: 'Personas',
    totalTime: 'Tiempo total',
    bestMonths: 'Mejores meses para hacerla',
    bestMonthsHint: 'Déjalo vacío si está buena todo el año.',
    advanced: 'Modo avanzado',
    advancedHint: 'Muestra todos los campos: tiempo de preparación, tipo de cocina, fuente',
    prepTime: 'Tiempo de preparación',
    cuisine: 'Tipo de cocina',
    cuisinePlaceholder: 'Elige uno',
    cuisineOther: 'Otro',
    close: 'Cerrar',
    source: 'Fuente',
    optional: '(opcional)',
    sourcePlaceholder: 'Un libro y página, una web o “la abuela”',
    // Spec 051 FR-015: what Source is for, and that assistants fill it in.
    sourceHint: 'Libro y página, una web o una persona. Los asistentes lo rellenan, o ponen su propio nombre si no hay nada más.',
    // Spec 051 FR-013: the recipe's own settings and Delete, at the end of Details when editing.
    thisRecipe: 'Esta receta',
    thisRecipeLead: 'Solo para esta receta. Los ajustes de la familia están en Menú › Recetas.',
    nameMissing: 'Ponle un nombre a tu receta',
    servesInvalid: 'Escribe un número del 1 al 50',
    timeInvalid: 'Prueba “1 h 10” o “70 min”',
    discardTitle: '¿Descartar los cambios?',
    discardBody: 'Los cambios en esta receta no se guardarán.',
    discard: 'Descartar',
    keepEditing: 'Seguir editando',
    // Spec 015 (OC-EditIngredients).
    ingredients: {
      title: 'Ingredientes',
      servings: (n: number) => (n === 1 ? 'Para 1 persona' : `Para ${n} personas`),
      lead: 'Para lo que se cuenta (huevos, puerros), añade también el peso de uno. El detalle es cómo se prepara; aparece bajo el nombre y en la lista de la compra.',
      add: '+ Añadir ingrediente',
      paste: 'Pegar una lista',
      tip: 'Consejo: pega “200 g de lardones, 100 g de gruyère, rallado…” y lo separaremos en filas. Lo que va después de una coma pasa a Detalle.',
      name: 'Nombre del ingrediente',
      namePlaceholder: 'Ingrediente, como puerros',
      quantity: 'Cantidad',
      quantityPlaceholder: 'Cantidad',
      weightPlaceholder: '?',
      unit: 'Unidad',
      unitMissingButton: '¿Unidad?',
      noUnit: 'Sin unidad',
      each: 'c/u ≈',
      grams: 'g',
      weight: 'Peso de uno (g)',
      // Spec 051 FR-011: how it's prepared, saved as its prep note.
      detail: 'Detalle (opcional)',
      detailPlaceholder: 'Detalle (opcional) · en rodajas, a temperatura ambiente…',
      remove: (name: string) => `Quitar ${name || 'ingrediente'}`,
      handle: 'Arrastra para reordenar',
      moveUp: 'Subir',
      moveDown: 'Bajar',
      suggestions: 'Sugerencias',
      newIngredient: 'Ingrediente nuevo. Elige su pasillo:',
      /** Eggs, cloves, bay leaves: a fraction typed is saved whole (spec 005 FR-003). */
      wholeOnly: (noun: string, to: string) => `Solo se admiten ${noun} sin fracciones: se guarda como ${to}.`,
      pickAisle: 'Elige un pasillo',
      aisle: 'Pasillo',
      warnings: {
        unitMissing: 'Elige una unidad para poder convertirla y ajustarla.',
        quantityInvalid: 'Escribe una cantidad como 2, 1½ o 1/2.',
        amountMissing: 'Añade una cantidad o elige “Sin unidad”.',
        weightInvalid: 'Escribe el peso de uno en gramos, como 150.',
        nameMissing: 'Ponle un nombre a este ingrediente.',
      },
      removeTitle: (name: string) => `¿Quitar ${name}?`,
      removeBody: (steps: number[]) =>
        steps.length === 1
          ? `Se usa en el paso ${steps[0]}. También lo quitaremos de ese paso.`
          : `Se usa en los pasos ${steps.slice(0, -1).join(', ')} y ${steps.at(-1)}. También lo quitaremos de esos pasos.`,
      removeConfirm: 'Quitar',
      removeCancel: 'Cancelar',
      pasted: (n: number) => (n === 1 ? 'Se añadió 1 ingrediente. Revisa las cantidades.' : `Se añadieron ${n} ingredientes. Revisa las cantidades.`),
      pastedNothing: 'No encontramos ningún ingrediente ahí.',
      pasteTitle: 'Pegar una lista',
      pasteField: 'Tus ingredientes',
      pasteHint: 'Uno por línea o separados por comas.',
      pasteAdd: 'Añadir ingredientes',
      sizes: { small: 'pequeño', medium: 'mediano', large: 'grande' },
    },
    // design/ui/OC-EditSteps.md (spec 016): the Steps section.
    steps: {
      title: 'Pasos',
      stepName: 'Nombre del paso',
      instructions: 'Instrucciones',
      instructionsHint: 'Escribe @ o toca abajo para insertar un ingrediente. Su cantidad se rellena y se ajusta sola.',
      insert: (name: string) => `+ ${name}`,
      insertA11y: (name: string) => `Insertar ${name}`,
      suggestions: 'Sugerencias de ingredientes',
      missingChip: 'Ingrediente que falta',
      missingBody: 'Este ingrediente se eliminó. Borra la etiqueta o vuelve a añadirlo.',
      temperatureKindLabel: '¿Es el horno o una lectura del termómetro?',
      oven: 'Horno',
      thermometer: 'Termómetro',
      preview: 'Vista previa',
      addTo: 'Añadir a este paso',
      timer: 'Temporizador',
      temperature: 'Control de temperatura',
      tip: 'Consejo del chef',
      photo: 'Foto',
      on: (label: string) => `${label} ✓`,
      timerField: 'Temporizador',
      timerPlaceholder: '8 min',
      timerLabel: 'Nombre del temporizador',
      tempValue: 'Temperatura',
      tempHint: 'Para una lectura del termómetro. Las temperaturas del horno van en las instrucciones.',
      celsius: '°C',
      fahrenheit: '°F',
      tempText: 'Qué comprobar',
      tempTextPlaceholder: 'el centro alcanza',
      tempTextHint: 'Escribe {temp} donde va la lectura; si no, irá al final.',
      tempPreview: 'Control de temperatura:',
      tipField: 'Consejo del chef',
      tipPlaceholder: 'Algo que te habría gustado saber la primera vez',
      tipCounter: (n: number) => `${n} / 200`,
      photoLabel: (n: number) => `Foto del paso ${n}`,
      addStep: '+ Añadir un paso',
      removeStep: 'Quitar paso',
      removeTitle: '¿Quitar este paso?',
      removeBody: 'Sus instrucciones y extras se van con él.',
      removeConfirm: 'Quitar',
      removeCancel: 'Mantenerlo',
      tipBadge: 'Consejo',
      tempBadge: 'Temp.',
      photoBadge: 'Foto',
      open: (n: number, name: string) => (name ? `Paso ${n}, ${name}. Toca para editar.` : `Paso ${n}. Toca para editar.`),
      handle: 'Arrastra para reordenar',
      moveUp: 'Subir',
      moveDown: 'Bajar',
      warnings: {
        bodyMissing: 'Añade instrucciones o quita este paso',
        bodyTooLong: 'Este paso es demasiado largo. Divídelo en dos pasos.',
        timerInvalid: 'Escribe los minutos, como 8 o 1 h 30',
        tempInvalid: 'Escribe una temperatura, como 71',
      },
    },
    // The Variants section (spec 017, OC-EditVariants).
    variants: {
      title: 'Variantes',
      optional: '(opcional)',
      lead: 'Una variante cambia algunas cosas de la receta. Se elige con un toque en la página de la receta.',
      changeCount: (n: number) => (n === 1 ? '1 cambio' : `${n} cambios`),
      open: (name: string, count: string) => `${name || 'Variante sin nombre'}, ${count}. Toca para editar.`,
      name: 'Nombre de la variante',
      namePlaceholder: 'Por ejemplo, Vegetariana',
      shownAs: 'Se muestra como',
      version: 'Una versión (elegir una)',
      option: 'Una opción (sí/no)',
      whatChanges: 'Qué cambia',
      addChange: 'Añadir un cambio',
      add: {
        swap_ingredient: 'Cambiar ingrediente',
        add_ingredient: 'Añadir ingrediente',
        remove_ingredient: 'Quitar ingrediente',
        add_step: 'Añadir un paso',
        change_step: 'Cambiar un paso',
        remove_step: 'Quitar un paso',
      },
      tag: {
        swap_ingredient: 'Sustituir ingrediente',
        add_ingredient: 'Añadir ingrediente',
        remove_ingredient: 'Quitar ingrediente',
        add_step: (place: 'before' | 'after', n: number) => `Añadir paso · ${place === 'before' ? 'antes del' : 'después del'} paso ${n}`,
        change_step: (n: number) => `Cambiar el paso ${n}`,
        remove_step: (n: number) => `Quitar el paso ${n}`,
        /** A change whose step is gone: no number to give. */
        stepGone: 'Paso eliminado',
      },
      /** The add-step summary's timer: "Make the dough · 30 min timer". */
      timer: (time: string) => `Temporizador de ${time}`,
      noTimer: 'Sin temporizador',
      tempCheck: (text: string) => `Control de temperatura ${text}`,
      noTempCheck: 'Sin control de temperatura',
      newText: (text: string) => `“${text}”`,
      unnamedStep: (n: number) => `Paso ${n}`,
      nothingYet: 'Aún no hay cambios',
      editChange: (tag: string) => `${tag}. Toca para editar.`,
      pickIngredient: '¿Qué ingrediente?',
      pickStep: '¿Qué paso?',
      where: 'Dónde',
      before: 'Antes',
      after: 'Después',
      stepChoice: (n: number, title: string) => (title ? `Paso ${n} · ${title}` : `Paso ${n}`),
      noIngredients: 'Primero añade ingredientes a la receta.',
      noSteps: 'Primero añade pasos a la receta.',
      replaceWith: 'Sustituir por',
      addAnother: '+ Añadir otro ingrediente',
      newIngredient: 'Ingrediente nuevo',
      newStep: 'Paso nuevo',
      changedStep: 'El paso con esta variante',
      done: 'Hecho',
      removeChange: 'Quitar cambio',
      conflict: (name: string) => `También lo cambia “${name}”`,
      broken: 'Este cambio apunta a algo que se eliminó.',
      newVariant: '+ Nueva variante',
      deleteVariant: 'Eliminar esta variante',
      deleteTitle: '¿Eliminar esta variante?',
      deleteBody: 'Sus cambios se van con ella. No se guarda nada hasta que toques Guardar.',
      deleteConfirm: 'Eliminar',
      deleteCancel: 'Mantenerla',
      warnings: {
        nameMissing: 'Ponle un nombre a esta variante',
        noChanges: 'Añade al menos un cambio o elimina esta variante',
      },
      changeWarnings: {
        pickIngredient: 'Elige el ingrediente que cambia',
        pickStep: 'Elige el paso que cambia',
        swapEmpty: 'Añade lo que va en su lugar',
        addEmpty: 'Escribe el nombre del ingrediente que se añade',
        stepEmpty: 'Escribe el paso o quita este cambio',
        stepUnchanged: 'Cambia algo en el paso o quita este cambio',
        rows: 'Revisa los ingredientes de abajo',
        steps: 'Revisa el paso de abajo',
      },
    },
  },
  // design/ui/OC-Delete.md (spec 018): the danger link at the end of the edit form, and its Dialog.
  deleteRecipe: {
    link: 'Eliminar receta',
    failed: 'No se pudo eliminar. Inténtalo de nuevo.',
  },
  // design/flows.md › Recently deleted (spec 018; not drawn, copy in design/ui/OC-Settings.md).
  recentlyDeleted: {
    back: 'Volver al menú',
    title: 'Eliminado recientemente',
    /** "Deleted by Gabriel · 3 days ago · 27 days left" ("Former member" once that person left). */
    sub: (by: string, daysAgo: number, daysLeft: number) => {
      const ago = daysAgo === 0 ? 'hoy' : `hace ${daysAgo} ${daysAgo === 1 ? 'día' : 'días'}`;
      return `Eliminado por ${by} · ${ago} · ${daysLeft <= 1 ? 'Último día' : `Quedan ${daysLeft} días`}`;
    },
    restore: 'Restaurar',
    restoreA11y: (name: string) => `Restaurar ${name}`,
    deleteNow: 'Eliminar ya',
    deleteNowTitle: (name: string) => `¿Eliminar “${name}” para siempre?`,
    deleteNowBody: 'Sus fotos y variantes se van con ella. No se puede deshacer.',
    keep: 'Mantener',
    restored: (name: string) => `“${name}” vuelve a estar en tus recetas.`,
    // Spec 042: deleted events are listed too.
    eventRestored: (title: string) => `“${title}” vuelve a estar en tu calendario.`,
    eventDeleteNowBody: 'No se puede deshacer.',
    // Spec 057: deleted reminders are listed too.
    reminderRestored: (title: string) => `“${title}” vuelve a estar en tus recordatorios.`,
    emptyTitle: 'No hay nada aquí.',
    emptyBody: 'Las recetas, los eventos y los recordatorios que eliminas se quedan aquí 30 días.',
    loading: 'Cargando los elementos eliminados recientemente',
    loadFailed: 'No se pudo cargar. Inténtalo de nuevo.',
    retry: 'Reintentar',
    restoreFailed: 'No se pudo restaurar. Inténtalo de nuevo.',
    deleteFailed: 'No se pudo eliminar. Inténtalo de nuevo.',
  },
  // design/ui/OC-RecipeSettings.md (specs 017 and 027; the switches come with 027)
  recipeSettings: {
    title: 'Ajustes de la receta',
    lead: 'Solo cambian esta receta. Los ajustes de tu familia están en Menú › Recetas.',
    editRecipe: 'Editar receta',
    // Spec 027: this recipe's own settings; each follows the family's default until changed.
    keepAwake: 'Mantener la pantalla encendida',
    kitchenScale: 'Usaré una báscula de cocina',
    kitchenScaleHint: 'Muestra “100 g” en lugar de “1 taza aprox.”',
    thermometer: 'Controles con termómetro',
    units: 'Unidades',
    unitsDefault: 'Predeterminadas',
    metric: 'Métricas',
    imperial: 'Imperiales',
    sameAsDefault: 'Igual que el predeterminado',
    changed: 'Cambiado para esta receta',
    reset: 'Restablecer',
    saveFailed: 'No se pudo guardar. Inténtalo de nuevo.',
    variants: 'Variantes',
    edit: 'Editar',
    editA11y: 'Editar variantes',
    variantsLead: 'Las variantes son versiones de esta receta. Cambian ingredientes o añaden pasos sin hacer una copia.',
    addVariant: 'Añadir una variante',
    variantA11y: (name: string, summary: string) => `${name}. ${summary}. Toca para editar.`,
    loading: 'Cargando los ajustes de la receta',
    loadFailedTitle: 'No pudimos abrir esta receta.',
    loadFailedBody: 'Puede que se haya eliminado o que no tengas conexión.',
    retry: 'Reintentar',
    back: 'Volver a la receta',
    backTo: (recipe: string) => `Volver a ${recipe}`,
    // A variant's one line (OC-RecipeSettings › Layout 6), its changes joined by " · ".
    summary: {
      replaces: (old: string, with_: string) => `sustituye ${old} por ${with_}`,
      ingredients: (n: number) => (n === 1 ? '1 ingrediente' : `${n} ingredientes`),
      adds: (what: string) => `añade ${what}`,
      removes: (what: string) => `quita ${what}`,
      addsStep: (name: string) => (name ? `añade el paso “${name}”` : 'añade un paso'),
      changesStep: (n: number) => `cambia el paso ${n}`,
      removesStep: (n: number) => `quita el paso ${n}`,
      changesGone: 'cambia un paso eliminado',
      join: ' · ',
      nothing: 'Aún no hay cambios',
    },
  },
  // design/ui/OC-Groceries.md (spec 020; the store row and Buy lines come with 021)
  groceries: {
    title: 'Compra',
    loading: 'Cargando la lista',
    loadFailed: 'No se pudo cargar la lista. Comprueba tu conexión e inténtalo de nuevo.',
    retry: 'Reintentar',
    toBuy: (n: number) => `${n === 1 ? '1 producto' : `${n} productos`} por comprar · compartida con la familia`,
    shopping: (name: string) => `${name} está comprando`,
    addLabel: 'Añadir un producto',
    addPlaceholder: 'Añade un producto, p. ej., 2 limones',
    addButton: 'Añadir producto',
    addFailed: 'No se pudo añadir este producto. Inténtalo de nuevo.',
    merged: (total: string) => `Ya está en la lista. Actualizado a ${total}.`,
    mergedNoAmount: 'Ya está en la lista.',
    // A row's source line (spec 051 FR-009): how its recipes prepare it.
    inRecipe: (detail: string) => `En la receta: ${detail}`,
    inRecipes: (details: string) => `En las recetas: ${details}`,
    fromDeletedRecipe: 'De una receta eliminada',
    // A row more than one person typed in (spec 022).
    addedManually: 'Añadido a mano',
    // A row added to by several: "In recipes: for the pan · cold, cubed · Added by Gabriel".
    sourcePartsJoin: ' · ',
    // A recipe card (spec 052 FR-006): its body opens the recipe, its "…" the menu.
    onTheList: (items: number) => `${items === 1 ? '1 producto' : `${items} productos`} en la lista`,
    /** A recipe's items on their way to the list (spec 022), on its card. */
    addingRecipe: (items: number) => (items === 1 ? 'Añadiendo 1 producto…' : `Añadiendo ${items} productos…`),
    recipeMeta: (items: number, serves: number) => `${items === 1 ? '1 producto' : `${items} productos`} en la lista · para ${serves} ${serves === 1 ? 'persona' : 'personas'}`,
    openRecipe: (recipe: string) => `Abrir ${recipe}`,
    moreForRecipe: (recipe: string) => `Más opciones de ${recipe}`,
    // The recipe card's menu (spec 052 FR-008, OC-GroceryRecipeMenu).
    servings: 'Raciones',
    fewerServings: 'Menos raciones',
    moreServings: 'Más raciones',
    onTheListFor: (n: number) => `En la lista para ${n}`,
    wasServings: (n: number) => `Antes: ${n}`,
    servingsHint: 'Cambia los productos de esta receta que faltan por comprar. Los marcados se quedan como están.',
    saveServings: (n: number) => `Guardar para ${n}`,
    removeRecipeItems: 'Quitar sus productos',
    removedRecipe: (items: number, recipe: string) => (items === 1 ? `Se quitó 1 producto de ${recipe}.` : `Se quitaron ${items} productos de ${recipe}.`),
    addedBy: (name: string) => `Añadido por ${name}`,
    // Spec 072: a row a guest added through the shared link.
    addedViaLink: 'Añadido desde el enlace compartido',
    // Spec 021: what to buy, beside the name: "Heavy cream: 1 pint carton (need 300 ml)".
    needNote: (amount: string) => `(necesitas ${amount})`,
    // A count, as read by @cocon/quantity: "1 piece", "2 pieces", "½ piece", "1½ pieces".
    pieces: (amount: string) => (amount === '1' || amount === '½' || amount === '¼' || amount === '¾' ? `${amount} unidad` : `${amount} unidades`),
    packCount: (count: number, label: string) => `${count} × ${label}`,
    onePack: (label: string) => `1 ${label}`,
    packsJoin: ' + ',
    loose: (amount: string) => `${amount} a granel`,
    // The list's settings sheet (the button beside "Add item").
    settingsButton: 'Ajustes de la compra',
    shareButton: 'Compartir la lista de la compra',
    settingsTitle: 'Ajustes de la compra',
    editItem: (name: string) => `Editar ${name}`,
    // "Clear all" (screen reader "Clear all items") and its Dialog.
    clearAllButton: 'Borrar todo',
    clearAll: 'Borrar todos los productos',
    clearAllTitle: (n: number) => (n === 1 ? '¿Borrar el único producto de la lista?' : `¿Borrar los ${n} productos de la lista?`),
    clearAllBody: 'Esto quita todos los productos, marcados o no, para toda la familia. Puedes deshacerlo justo después.',
    clearAllConfirm: 'Borrar todos los productos',
    clearAllCancel: 'Mantener la lista',
    // FR-004: the family's own pack size, from Edit (not drawn; OC-Groceries › Row menu).
    storeSize: 'Tamaño en tienda',
    storeSizeLead: (name: string) => `En qué formato se vende ${name} donde compras. Se guarda para tu familia.`,
    storeSizeLabel: 'Tamaño del paquete',
    storeSizeHint: 'Un paquete, p. ej., 250 g, 20 cl o 6',
    storeSizeInvalid: 'Escribe una sola cantidad, como 250 g o 1 l.',
    storeSizeReset: 'Usar los tamaños habituales',
    storeSizePieces: (n: string) => `paquete de ${n}`,
    emptyTitle: 'Tu lista está vacía.',
    emptyBody: 'Añade productos arriba o desde cualquier receta con “Añadir a la compra”.',
    clearDoneButton: 'Quitar comprados',
    clearDone: 'Quitar los productos comprados',
    cleared: (n: number) => (n === 1 ? '1 producto quitado' : `${n} productos quitados`),
    removed: (name: string) => `Se quitó ${name}.`,
    undo: 'Deshacer',
    syncFailed: 'No se pudo actualizar. Inténtalo de nuevo.',
    // Row actions (long-press, swipe left, or the screen reader's actions).
    edit: 'Editar',
    moveTo: 'Mover a…',
    remove: 'Quitar',
    close: 'Cerrar',
    moveLead: (name: string) => `${name} irá aquí a partir de ahora, para tu familia.`,
    editTitle: 'Editar producto',
    editLabel: 'Producto',
    editHint: 'Una cantidad y un nombre, p. ej., 2 limones o 100 g de gruyère',
    save: 'Guardar',
    cancel: 'Cancelar',
  },
  // OC-AddGroceries (spec 022): pick a recipe's ingredients for the list.
  addGroceries: {
    title: 'Añadir a la compra',
    lead: (recipe: string, serves: string) => `${recipe} · para ${serves} pers. Desmarca lo que ya tengas en casa.`,
    group: 'De esta receta',
    groupNote: 'Todo marcado al empezar',
    // Not drawn: the header's link, for when most of it is already at home.
    untickAll: 'Desmarcar todo',
    tickAll: 'Marcar todo',
    alreadyOnList: (existing: string, total: string) => `Ya en la lista (${existing}) → quedará en ${total}`,
    cancel: 'Cancelar',
    add: (n: number) => (n === 1 ? 'Añadir 1 producto' : `Añadir ${n} productos`),
    nothingSelected: 'No hay nada seleccionado',
    adding: 'Añadiendo…',
    // The toast once added, with Undo and "See the list".
    added: (n: number) => (n === 1 ? 'Se añadió 1 producto a la compra' : `Se añadieron ${n} productos a la compra`),
    seeList: 'Ver la lista',
    close: 'Cerrar',
    // Not drawn (OC-AddGroceries › States).
    addFailed: 'No se pudieron añadir estos productos. Comprueba tu conexión e inténtalo de nuevo.',
    undoFailed: 'No se pudo deshacer. Inténtalo de nuevo.',
  },
  // Grocery aisles (spec 031), in store order, named as in OC-Groceries › Aisles.
  aisles: {
    produce: 'Frutas y verduras',
    bakery: 'Panadería',
    dairy_eggs: 'Lácteos y huevos',
    meat_fish: 'Carne y pescado',
    dry_goods: 'Despensa',
    spices_baking: 'Especias y repostería',
    frozen: 'Congelados',
    drinks: 'Bebidas',
    household: 'Hogar',
    other: 'Otros',
  },
  unitShort: {
    g: 'g',
    kg: 'kg',
    oz: 'oz',
    lb: 'lb',
    ml: 'ml',
    l: 'L',
    tsp: 'cdta',
    tbsp: 'cda',
    cup: 'taza',
    fl_oz: 'fl oz',
    c: '°C',
    f: '°F',
    gas_mark: 'marca de gas',
    piece: 'unidades',
    pinch: 'pizca',
  },
  // Units under the converter's numbers (OC-Units): "1¼" over "cups".
  unitLong: {
    g: () => 'g',
    kg: () => 'kg',
    oz: () => 'oz',
    lb: () => 'lb',
    ml: () => 'ml',
    l: () => 'L',
    tsp: (n: number) => (n <= 1 ? 'cucharadita' : 'cucharaditas'),
    tbsp: (n: number) => (n <= 1 ? 'cucharada' : 'cucharadas'),
    cup: (n: number) => (n <= 1 ? 'taza' : 'tazas'),
    fl_oz: () => 'fl oz (EE. UU.)',
    c: () => '°C',
    f: () => '°F',
    gas_mark: () => 'marca de gas',
    fan_c: () => '°C horno con ventilador',
    fan_f: () => '°F horno con ventilador',
  },
  cupsOf: (n: number, ingredient: string) => `${n <= 1 ? 'taza' : 'tazas'} de ${ingredient}`,
  // A recipe's facts, wherever it is shown (specs 006, 008, 028).
  recipe: {
    serves: (n: number) => (n === 1 ? 'Para 1 persona' : `Para ${n} personas`),
    variants: (n: number) => (n === 1 ? '1 variante' : `${n} variantes`),
    /** Spec 051: a recipe an assistant we don't know by name made, with no other source. */
    anAssistant: 'Un asistente de IA',
    /** The author left the family or deleted their account. */
    formerMember: 'Antiguo miembro',
  },
  // Timers (spec 010; the Timers screen and pill are 011, OC-Timers).
  timers: {
    kitchenTimer: 'Temporizador de cocina',
    /** The StatusBanner when a timer ends, on any screen (OC-Timers › States). */
    done: (name: string) => `${name} ha terminado`,
    /** Announced once, politely, when any timer gets to 1 minute (spec 030 FR-002, OC-RecipeSteps › Accessibility labels). */
    oneMinuteLeft: (name: string) => `Queda 1 minuto: ${name}`,
    openTimers: 'Abrir temporizadores',
  },
  // design/ui/TabBar.md › Timers running, TimerPill README (spec 011)
  timerPill: {
    label: (count: number) => `${count} ${count === 1 ? 'temporizador en marcha' : 'temporizadores en marcha'}. Abrir temporizadores`,
    more: (others: number) => `+${others}`,
    hide: 'Ocultar el indicador de temporizadores. Siguen en marcha',
    // The side rail's pill shows only the time, so its label names the timer too (OC-NavResponsive, spec 064).
    railLabel: (count: number, name: string, time: string) => `${count} ${count === 1 ? 'temporizador en marcha' : 'temporizadores en marcha'}. ${name} ${time}. Abrir temporizadores`,
  },
  // design/ui/OC-Timers.md (spec 011)
  timersScreen: {
    back: 'Atrás',
    title: 'Temporizadores',
    summary: (running: number, total: number) => `${running} en marcha · ${total} en total`,
    sub: (recipe: string, state: string) => `${recipe} · ${state}`,
    noRecipe: 'Sin receta',
    running: 'En marcha',
    paused: 'En pausa',
    done: '¡Listo!',
    preset: (minutes: number) => `${minutes} min`,
    minus: '−1',
    plus: '+1',
    minusA11y: 'Un minuto menos',
    plusA11y: 'Un minuto más',
    pause: 'Pausar',
    resume: 'Reanudar',
    addMinute: 'Añadir 1 minuto más',
    stop: 'Detener',
    dismiss: 'Descartar',
    empty: 'No hay temporizadores en marcha. Inicia uno desde cualquier paso de una receta.',
    quick: 'Temporizador de cocina rápido',
    quickA11y: (minutes: number) => `Iniciar un temporizador de cocina de ${minutes} min`,
    footnote: 'Los temporizadores siguen en marcha cuando sales de la receta. Oirás un aviso cuando termine uno.',
    /** A step timer's card opens cooking mode at its step (032-later L19). */
    goToStep: 'Ir al paso',
    /** Screen reader, so several cards' links tell apart: "Go to step: Blind bake". */
    goToStepA11y: (timer: string) => `Ir al paso: ${timer}`,
    /** Screen reader, so several cards' buttons tell apart: "Pause: Blind bake" (spec 030). */
    forTimer: (action: string, timer: string) => `${action}: ${timer}`,
  },
  // design/ui/OC-Cook.md (spec 012)
  cook: {
    /** The ✕ in the header (spec 050): leaving keeps the cook in progress (spec 051 FR-002). */
    exitA11y: 'Salir del modo cocina; sigue en curso',
    /** The settings button in the header, and the sheet it opens. */
    options: 'Opciones de cocina',
    closeOptions: 'Cerrar opciones de cocina',
    // Spec 062: the round timer button left of "Cooking options", and its sheet.
    timers: 'Temporizadores',
    closeTimers: 'Cerrar temporizadores',
    /** The options sheet's sections: servings and scale by an ingredient, then the rest. */
    scaling: 'Cantidades',
    servings: 'Raciones',
    optionsSection: 'Más',
    /** The options sheet's row to the recipe form at the current step. */
    editStep: (n: number) => `Editar el paso ${n}`,
    stepOf: (n: number, total: number) => `Paso ${n} de ${total}`,
    /** Said after Next, Back or a segment (spec 030): "Step 3 of 7: Bake". */
    stepAnnouncement: (n: number, total: number, name: string | null) => (name ? `Paso ${n} de ${total}: ${name}` : `Paso ${n} de ${total}`),
    hint: (serves: string) => `Para ${serves} pers. · desliza hacia arriba para seguir`,
    timerLabel: (label: string) => `Temporizador: ${label}`,
    segment: (n: number, name: string | null) => (name ? `Ir al paso ${n}: ${name}` : `Ir al paso ${n}`),
    startTimer: 'Iniciar temporizador',
    pause: 'Pausar',
    resume: 'Reanudar',
    done: 'Hecho',
    back: 'Atrás',
    next: 'Siguiente paso',
    /** The last step's button: logs the cook (spec 051 FR-005). */
    doneCooking: 'Terminar de cocinar',
    bonAppetit: '¡Buen provecho! Toca “Terminar de cocinar” para registrarlo.',
    loading: 'Cargando la receta',
    // Spec 066 (OC-CookResponsive): from 600 the header names the recipe; from 960 a step list.
    /** Under the recipe name: "Serves 6 · Classic" ("Serves 6" when the recipe has no versions). */
    servesLine: (serves: string, version: string | null) => (version ? `Para ${serves} pers. · ${version}` : `Para ${serves} pers.`),
    allSteps: 'Todos los pasos',
    /** After "All steps" in the step list's heading (uppercased): "All steps · 3 of 6". */
    stepPosition: (n: number, total: number) => `${n} de ${total}`,
    /** A step list row's name when the step has none. */
    unnamedStep: (n: number) => `Paso ${n}`,
    /** A step list row for screen readers: "Go to step 3: Bake, timer 12:30". */
    stepRow: (n: number, name: string | null, time: string | null) => {
      const step = name ? `Ir al paso ${n}: ${name}` : `Ir al paso ${n}`;
      return time ? `${step}, temporizador ${time}` : step;
    },
    /** The timers panel's quick presets (the Timers screen's own label is "Quick kitchen timer"). */
    quickTimer: 'Temporizador rápido',
    /** A step's photo thumbnail, and the full-screen photo it opens. */
    stepPhoto: (name: string | null, n: number) => (name ? `Ver la foto de ${name} en grande` : `Ver la foto del paso ${n} en grande`),
    photoOf: (name: string | null, n: number) => (name ? `Foto de ${name}` : `Foto del paso ${n}`),
    closePhoto: 'Cerrar foto',
  },
  // design/ui/OC-CookDone.md (spec 051 FR-005): after "Done".
  cookDone: {
    /** The Done toast (spec 051 FR-005): "Leek & bacon quiche is done! That’s 5 times now." */
    toast: (recipe: string, times: number) => `¡Ya está: ${recipe}! ${times === 1 ? 'Es la primera vez.' : `Ya van ${times} veces.`}`,
    close: 'Cerrar',
  },
  // Total time (spec 006 FR-002): "40 min", "2 h", "1 h 05".
  time: {
    minutes: (m: number) => `${m} min`,
    hours: (h: number) => `${h} h`,
    hoursMinutes: (h: number, mm: string) => `${h} h ${mm}`,
    /** Spec 051: when a recipe was last cooked, by calendar day ("today", "3 weeks ago"). */
    daysAgo: (days: number) =>
      days <= 0
        ? 'hoy'
        : days === 1
          ? 'ayer'
          : days < 7
            ? `hace ${days} días`
            : days < 30
              ? `hace ${Math.floor(days / 7) === 1 ? '1 semana' : `${Math.floor(days / 7)} semanas`}`
              : days < 365
                ? `hace ${Math.floor(days / 30) === 1 ? '1 mes' : `${Math.floor(days / 30)} meses`}`
                : 'hace más de un año',
    /** "used 2 h ago" (OC-Connect), "· 4 h ago" (AI activity). */
    ago: (minutes: number) =>
      minutes < 1 ? 'ahora mismo' : minutes < 60 ? `hace ${minutes} min` : minutes < 24 * 60 ? `hace ${Math.floor(minutes / 60)} h` : `hace ${Math.floor(minutes / 1440)} ${Math.floor(minutes / 1440) === 1 ? 'día' : 'días'}`,
  },
  monthsShort: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'],
  months: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
  // Spec 006 FR-003: one label per key of Cuisine (packages/schemas/recipes.ts).
  cuisines: {
    american: 'Estadounidense',
    british: 'Británica',
    caribbean: 'Caribeña',
    chinese: 'China',
    french: 'Francesa',
    german: 'Alemana',
    greek: 'Griega',
    indian: 'India',
    italian: 'Italiana',
    japanese: 'Japonesa',
    korean: 'Coreana',
    latin_american: 'Latinoamericana',
    mexican: 'Mexicana',
    middle_eastern: 'De Oriente Medio',
    moroccan: 'Marroquí',
    portuguese: 'Portuguesa',
    scandinavian: 'Escandinava',
    spanish: 'Española',
    thai: 'Tailandesa',
    turkish: 'Turca',
    vietnamese: 'Vietnamita',
    west_african: 'De África Occidental',
  },
  // Assistant names for "via …", by write source (packages/schemas/sources.ts).
  assistants: {
    claude: 'Claude',
    chatgpt: 'ChatGPT',
    gemini: 'Gemini',
    /** An MCP client we don't know by name. */
    other: 'un asistente de IA',
  },
  // Spec 004: shared by every screen that shows family data (design/system/Patterns.md › Offline).
  // design/ui/note-formatting-ui.md (spec 073): event and reminder notes with their formatting.
  notes: {
    /** What screen readers call the notes, under their hairline. */
    label: 'Notas',
    linkFailed: 'No se pudo abrir ese enlace',
    // Spec 074: the notes field's toolbar (OC-NoteEditor) and its "Add a link" sheet.
    toolbar: { toolbar: 'Formato', bold: 'Negrita', link: 'Enlace', bullet: 'Lista con viñetas', number: 'Lista numerada', check: 'Lista de verificación', hideKeyboard: 'Ocultar teclado' },
    tooLong: 'Las notas pueden tener hasta 5.000 caracteres.',
    linkSheet: {
      title: 'Añadir un enlace',
      text: 'Texto',
      link: 'Enlace',
      placeholder: 'https://',
      invalid: 'Escribe una dirección web o de correo',
      cancel: 'Cancelar',
      add: 'Añadir enlace',
      close: 'Cerrar',
    },
  },
  sync: {
    offline: 'No tienes conexión. Puedes leer, pero para hacer cambios necesitas conexión.',
    recipeChanged: (name: string) => `${name} acaba de cambiar esta receta`,
    reload: 'Recargar',
  },
  // design/system/components/Toast: the one toast, on every screen.
  // Spec 046: the ask sheet (design/ui/OC-Notifications.md › Ask sheet) and reminders shown in the app.
  // design/ui/OC-TravelTimeZone.md (spec 071): the drawer when the phone moves to another time zone.
  travel: {
    title: (city: string) => `Estás en la hora de ${city}`,
    lead: (city: string, home: string, gap: string) => `Tu teléfono ha pasado a la hora de ${city}, ${gap} ${home}. ¿Quieres que tus planes mantengan las horas que pusiste?`,
    gap: (minutes: number) => {
      const h = Math.floor(Math.abs(minutes) / 60);
      const m = Math.abs(minutes) % 60;
      const amount = [h ? `${h} ${h === 1 ? 'hora' : 'horas'}` : '', m ? `${m} minutos` : ''].filter(Boolean).join(' y ');
      return `${amount} ${minutes < 0 ? 'por detrás de' : 'por delante de'}`;
    },
    exampleAt: (time: string) => `Por ejemplo, un evento que añadiste para las ${time}:`,
    keep: 'Mantener mis horas',
    keepTitle: 'Mantener mis horas (solo viajo yo)',
    keepSub: (time: string, city: string, home: string) => `Sigue a las ${time}, hora de ${city}, para ti. El resto de la familia sigue en la hora de ${home}.`,
    keepFamily: 'Mantener la hora de todos',
    keepFamilyTitle: 'Mantener la hora de todos (viajamos todos)',
    keepFamilySub: (time: string, city: string) => `La familia pasa a la hora de ${city}: los planes de todos siguen a las ${time}, hora de ${city}, y no se pregunta a nadie más.`,
    stay: (home: string) => `Seguir en la hora de ${home}`,
    staySub: (time: string, here: string, home: string, city: string) => `Es a las ${time}, hora de ${home}, que son las ${here} en ${city}.`,
    note: (home: string) => `Si solo tú mantienes tus horas, vuelven solas cuando tu teléfono vuelva a la hora de ${home}.`,
    failed: 'No se pudieron cambiar tus horas. Comprueba tu conexión e inténtalo de nuevo.',
    close: 'Cerrar',
  },
  notifications: {
    askTitle: { timer: 'Saber cuándo está listo', reminder: 'Recibir un aviso antes de los eventos', todo: 'Recibir los recordatorios a tiempo' },
    askBody: {
      timer: 'Activa las notificaciones para oír el aviso y ver tu temporizador en la pantalla de bloqueo, incluso con el teléfono bloqueado. También recibirás avisos antes de los eventos familiares.',
      reminder: 'Activa las notificaciones para que los avisos lleguen a tu teléfono, incluso con Our Cocon cerrado.',
      todo: 'Activa las notificaciones para que tus recordatorios lleguen a tu teléfono a su hora, incluso con Our Cocon cerrado.',
    },
    turnOn: 'Activar notificaciones',
    notNow: 'Ahora no',
    note: 'Puedes cambiarlo cuando quieras en Menú › Notificaciones.',
    close: 'Cerrar',
    // The StatusBanner for a reminder that arrives while the app is open (not drawn).
    inApp: (title: string, body: string) => (body ? `${title} · ${body}` : title),
    open: 'Abrir',
    // Spec 047: a timer that ends while the app is closed (OC-NotifLockDone). Plain text, no emoji.
    timerDone: {
      title: (label: string) => `Terminado: ${label}`,
      stepBody: (recipe: string, step: number) => `${recipe} · paso ${step}`,
      quickBody: (minutes: number) => `Temporizador de cocina de ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`,
      followUpTitle: (label: string) => `Sigue esperando: ${label}`,
      followUpBody: (minutes: number) => `Terminó hace ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}.`,
      addMinute: '+1 min',
      stop: 'Parar',
    },
    // Spec 059 FR-004: a reminder's actions on the Lock Screen (OC-NotifLockTodo).
    todo: {
      done: 'Hecho',
      hour: 'En 1 hora',
      tomorrow: 'Mañana',
    },
  },
  // Spec 048: the Live Activity. On the Lock Screen it's the Timers screen's card (OC-Timers, its
  // words from timersScreen); these are its "2 running" pill and the Dynamic Island (OC-NotifIsland).
  // The phone draws the time itself; every word comes from here.
  liveTimer: {
    running: (count: number) => `${count} en marcha`,
    // Not drawn: the pill when every timer is paused.
    paused: (count: number) => `${count} en pausa`,
    pausedSub: 'En pausa',
    // "Leek & bacon quiche · +1 more" in the island.
    more: (text: string, others: number) => `${text} · +${others} más`,
    removeMinute: '−1 min',
    addMinute: '+1 min',
  },
  toast: {
    undo: 'Deshacer',
    // Spec 053 FR-013: the round buttons' names.
    tryAgain: 'Intentar de nuevo',
    dismiss: 'Descartar',
    // When an Undo fails (032-later L99), unless the screen says it its own way.
    undoFailed: 'No se pudo deshacer. Comprueba tu conexión e inténtalo de nuevo.',
  },
  // design/ui/CalHeader.md (spec 036): the header shared by the four calendar views.
  calendar: {
    /** Who an event is for, in its screen-reader label (spec 030 FR-006): "Gabriel", "Gabriel and Eva", "Gabriel, Eva and James". */
    who: (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names.at(-1)}` : (names[0] ?? '')),
    header: {
      today: 'Hoy',
      viewsLabel: 'Vista del calendario',
      views: { month: 'Mes', week: 'Semana', day: 'Día', agenda: 'Agenda' },
      viewButton: (view: string) => `Vista: ${view}`,
      agendaTitle: 'Próximamente',
      previous: { month: 'Mes anterior', week: 'Semana anterior', day: 'Día anterior' },
      next: { month: 'Mes siguiente', week: 'Semana siguiente', day: 'Día siguiente' },
      filterLabel: 'Mostrar eventos de',
      everyone: 'Todos',
      everyoneInitial: 'Todos',
      others: 'Otros',
      peopleAll: 'Todos',
      peopleCount: (shown: number, total: number) => `${shown} de ${total}`,
      /** The people button's name: who is shown, or everyone. */
      peopleButton: (shownNames: string[] | null) => `Mostrar eventos de: ${shownNames ? shownNames.join(', ') : 'todos'}`,
      showAll: 'Mostrar todos',
      /** The menu's button while everyone shows (Show all once someone is hidden). */
      showNone: 'Ocultar todos',
      close: 'Cerrar',
      /** From 600 (spec 070, OC-LargeScreens › Copy "+ New", as Recipes): a plus icon, then "New"; read "Add event". */
      addEvent: 'Nuevo',
      addEventLabel: 'Añadir evento',
    },
    // design/ui/OC-CalMonth.md (spec 037).
    month: {
      /** From Sunday; rotated when the week starts on Monday. */
      weekdays: ['D', 'L', 'M', 'X', 'J', 'V', 'S'],
      hint: 'Toca un día para ver los detalles. Cada color es un miembro de la familia.',
      gotIt: 'Entendido',
      addEvent: 'Añadir evento',
      more: (n: number) => `+${n}`,
      cont: (title: string) => `${title} (cont.)`,
      /** The 1st of a month: "Nov 1". */
      firstOfMonth: (shortMonth: string) => `1 ${shortMonth.replace('.', '')}`,
      dayLabel: (date: string, titles: string[]) => `${date}: ${titles.length ? titles.join(', ') : 'nada planeado'}`,
      /** An event in a day's label, with its people: "Baby swim (James)". */
      withPeople: (title: string, names: string[]) => (names.length ? `${title} (${names.join(', ')})` : title),
      /** "Lyon trip, Everyone, October 30 to November 1". */
      barLabel: (title: string, who: string, from: string, to: string) => [title, who, `del ${from} al ${to}`].filter(Boolean).join(', '),
      // OC-CalMonth.md › Day sheet (spec 037 FR-009).
      sheet: {
        title: (weekday: string, date: string) => `${weekday}, ${date}`,
        count: (n: number) => (n === 0 ? 'Nada planeado' : n === 1 ? '1 evento' : `${n} eventos`),
        empty: 'Todavía no hay nada planeado.',
        addLabel: (day: string) => `Añadir evento el ${day}`,
        close: 'Cerrar',
      },
      /** From 600 (spec 070): the selected day's panel; its title, count and rows are the sheet's. "+ Add on Sun 25". */
      panel: {
        addOn: (day: string) => `+ Añadir el ${day}`,
      },
    },
    week: {
      allDay: 'Todo el día',
      /** A day's letter and date, as OC-CalWeek reads it: "Sunday October 25". */
      dayLabel: (weekday: string, date: string) => `${weekday} ${date}`,
      /** "Poker night, Gabriel, Sunday October 25, Evening" or "Baby swim, James, Sunday October 25, 14:30 to 16:30" (spec 030 FR-006). */
      blockLabel: (title: string, who: string, day: string, when: string) => [title, who, day, when].filter(Boolean).join(', '),
      timeRange: (start: string, end: string) => `de ${start} a ${end}`,
      /** An empty day column, for screen readers: "Add event, Sunday October 25". */
      addAt: (day: string) => `Añadir evento, ${day}`,
    },
    // design/ui/OC-CalDay.md (spec 039).
    day: {
      busyLabel: 'Quién está ocupado este día',
      count: (name: string, n: number) => `${name} ${n}`,
      allDay: 'Todo el día',
      birthday: 'Cumpleaños',
      dayOf: (n: number, total: number) => `Día ${n} de ${total}`,
      hours: (start: string, end: string) => `${start}–${end}`,
      /** The time line: "Lunch · Grandma’s house", "14:30 · Aquatic Center". */
      at: (when: string, place: string) => `${when} · ${place}`,
      takes: (driver: string, names: string[]) => `${driver} lleva a ${names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names.at(-1)}` : (names[0] ?? '')}`,
      now: 'Ahora',
      /** An empty band's row: "+ Add in the morning", "+ Add in the lunch slot". */
      addIn: (band: string) => `+ Añadir ${band}`,
      bands: { early_morning: 'a primera hora', morning: 'por la mañana', lunch: 'a mediodía', afternoon: 'por la tarde', evening: 'por la noche' },
      /** For screen readers: "Add event in the morning, Sunday October 25". */
      addInLabel: (band: string, day: string) => `Añadir evento ${band}, ${day}`,
      /** "Baby swim class, 14:30 · Aquatic Center, Gabriel takes James, happening now". */
      rowLabel: (parts: string[], now: boolean) => [...parts.filter(Boolean), ...(now ? ['en curso'] : [])].join(', '),
      /** "Lyon trip, Everyone, all day, Day 2 of 3". */
      allDayLabel: (title: string, who: string, tag: string | null) => [title, who, 'todo el día', ...(tag ? [tag] : [])].filter(Boolean).join(', '),
      /** From 960 (spec 070 FR-007): the mini month and the next three days beside the bands. */
      aside: {
        comingUp: 'Próximamente',
        nothingPlanned: 'Nada planeado',
        /** A mini month day, for screen readers: "October 25", "October 26, has events". */
        dayLabel: (date: string, hasEvents: boolean) => (hasEvents ? `${date}, tiene eventos` : date),
        /** A "Coming up" row, for screen readers: "Monday October 26: Run · Baby yoga". */
        rowLabel: (day: string, text: string) => `${day}: ${text}`,
      },
    },
    /** OC-CalAgenda (spec 040). Rows reuse `day`'s time line, "Now", "Birthday" and "Day N of M". */
    agenda: {
      /** Day headings: "Today · Sun, Oct 25", "Tomorrow · Mon, Oct 26", then "Tue, Oct 27". */
      today: (date: string) => `Hoy · ${date}`,
      tomorrow: (date: string) => `Mañana · ${date}`,
      surprise: 'Sorpresa',
      empty: 'Todavía no hay nada planeado. Toca + para añadir algo.',
      /** "Baby swim class, 14:30 · Gabriel takes James, Now". */
      /** "Poker night, Gabriel, Evening · Café Lou, Now" (spec 030 FR-006). */
      rowLabel: (title: string, who: string, sub: string, tag: string | null) => [title, who, sub, ...(tag ? [tag] : [])].filter(Boolean).join(', '),
    },
    /** design/ui/OC-Reminders.md › Agenda rows (spec 058): reminders among the events in Agenda and Day. */
    reminders: {
      toggle: 'Recordatorios',
      /** "15:00 · Gabriel", "Any time · Eva". */
      sub: (when: string, name: string) => `${when} · ${name}`,
      /** A late one, on today: "Gabriel · was due Mon". */
      lateSub: (name: string, wasDue: string) => `${name} · ${wasDue}`,
      wasDueYesterday: 'era para ayer',
      /** A later repeat's box, pressed before its day. */
      notYet: (date: string) => `Todavía no: es para el ${date}.`,
      /** Day view: today's done reminders, after the bands. */
      doneHeading: 'Hechos',
      /** A later repeat's box, for screen readers (it can't be ticked before its day). */
      notYetLabel: (title: string) => `Todavía no: ${title}`,
      /** "Water the plants, reminder, Gabriel · was due Mon, 2d late". */
      rowLabel: (title: string, sub: string, late: string | null) => [title, 'recordatorio', sub, ...(late ? [late] : [])].join(', '),
      /** "1 reminder", "3 reminders": Month and Week's day labels, and the day sheet's count. */
      count: (n: number) => (n === 1 ? '1 recordatorio' : `${n} recordatorios`),
      /** A day's screen-reader label, then its reminders: "Sunday October 25, 2 reminders". */
      withCount: (label: string, n: number) => (n ? `${label}, ${n === 1 ? '1 recordatorio' : `${n} recordatorios`}` : label),
      /** The day sheet's lead: "2 events · 1 reminder", "1 reminder". */
      sheetCount: (events: string | null, reminders: string) => (events ? `${events} · ${reminders}` : reminders),
    },
    /** design/ui/OC-CalAdd.md (spec 041): the add and edit sheet. */
    add: {
      titleNew: 'Nuevo evento',
      titleEdit: 'Editar evento',
      /** The new-event sheet's switch to a new reminder (its segments are the two sheets' titles). */
      newKind: 'Qué añadir',
      /** The edit sheet's switch: an event can become a reminder and back (Gabriel, 2026-11-25). */
      editKind: 'Evento o recordatorio',
      /** What an event has that a reminder can't hold, said before it's saved as one. */
      losesAsReminder: (parts: string[]) => `Como recordatorio, no conservará ${parts.length > 1 ? `${parts.slice(0, -1).join(', ')} ni ${parts.at(-1)}` : parts[0]}.`,
      lostParts: { people: 'varias personas', place: 'el lugar', type: 'el tipo', who_takes: 'quién los lleva', checklist: 'la lista' },
      /** A reminder's "If it's not done", which an event doesn't have. */
      losesAsEvent: 'Como evento, no conservará “Si no se hace”.',
      movedToReminders: 'Movido a Recordatorios.',
      movedToCalendar: 'Movido al calendario.',
      cancel: 'Cancelar',
      what: '¿Qué hay planeado?',
      whatPlaceholder: 'p. ej., Noche de póker',
      noTitle: 'Ponle un nombre a tu evento.',
      when: 'Cuándo',
      today: 'Hoy',
      tomorrow: 'Mañana',
      otherDay: 'Otro día',
      pickDate: 'Elegir una fecha',
      /** A day tile's date: "Sun 25". */
      tileDate: (weekdayShort: string, day: number) => `${weekdayShort} ${day}`,
      timeOfDay: 'Momento del día',
      timeHint: 'Elige un momento del día, sin necesidad de horas exactas.',
      allDay: 'Todo el día',
      wholeDay: 'Todo el día',
      /** A slot chip's hours, each already the hour alone: "18–22", "6 PM–10 PM". */
      slotHours: (start: string, end: string) => `${start}–${end}`,
      starts: 'Empieza',
      ends: 'Termina',
      badTime: 'Usa una hora como 18:30.',
      endBeforeStart: 'Elige una hora de fin posterior a la de inicio.',
      who: 'Quién',
      noOne: 'Elige al menos a una persona.',
      everyone: 'Todos',
      everyoneInitial: 'Todos',
      others: 'Otros',
      /** "You already have Movie night this evening." / "Eva already has …" */
      conflict: (name: string | null, title: string, slot: string) => `${name === null ? 'Ya tienes' : `${name} ya tiene`} ${title} ${slot}.`,
      addAnyway: '¿Añadir de todos modos?',
      /** The conflict line's slot words. */
      slotWords: { early_morning: 'esta mañana temprano', morning: 'esta mañana', lunch: 'este mediodía', afternoon: 'esta tarde', evening: 'esta noche' },
      more: 'Más opciones',
      moreHint: 'Lugar, repetición, aviso…',
      hide: 'Ocultar',
      type: 'Tipo',
      types: { sport: 'Deporte', school: 'Colegio', work: 'Trabajo', health: 'Salud', social: 'Social', travel: 'Viaje', home: 'Casa', birthday: 'Cumpleaños', other: 'Otro' },
      where: 'Dónde',
      wherePlaceholder: 'Añadir un lugar',
      /** "Who takes James?", "Who takes James and Lou?" */
      whoTakes: (names: string[]) => `¿Quién lleva a ${andList(names)}?`,
      whoTakesHint: (names: string[]) => `La familia añadió a ${andList(names)}, así que se encarga alguien con la app.`,
      notDecided: 'Sin decidir',
      repeat: 'Repetir',
      repeats: { never: 'Nunca', daily: 'Cada día', weekly: 'Cada semana', biweekly: 'Cada 2 semanas', monthly: 'Cada mes', yearly: 'Cada año' },
      on: 'Días',
      /** From Sunday, as the weekday picker reads them. */
      weekdayLetters: ['D', 'L', 'M', 'X', 'J', 'V', 'S'],
      weekdayNames: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
      endsLabel: 'Termina',
      endsNever: 'Nunca',
      endsOn: 'En una fecha',
      endsAfter: 'Tras un número de veces',
      lastDay: 'Último día',
      times: 'Veces',
      timesHint: 'Incluye esta.',
      timesProblem: 'Usa un número del 1 al 1000.',
      reminder: 'Aviso',
      reminders: { none: 'Ninguno', minutes_15: '15 minutos antes', hour_before: '1 hora antes', morning_of: 'Esa misma mañana', day_before: '1 día antes' },
      /** Spec 049 FR-001: who the reminder reaches. */
      reminderHint: (names: string[]) => `Avisa a ${andList(names)} en sus teléfonos.`,
      reminderHintYou: 'Te avisa en tu teléfono.',
      notes: 'Notas',
      notesPlaceholder: 'Algo que recordar',
      addToChecklist: '+ Añadir a la lista',
      checklistItem: 'Elemento de la lista',
      removeItem: (label: string) => `Quitar ${label}`,
      save: 'Guardar',
      saving: 'Guardando…',
      saveFailed: 'No se pudo guardar. Comprueba tu conexión e inténtalo de nuevo.',
      close: 'Cerrar',
      previousMonth: 'Mes anterior',
      nextMonth: 'Mes siguiente',
      /** The date sheet's title, for "Other day" and "Ends: On a date". */
      pickDateTitle: 'Elegir una fecha',
      // Spec 053 FR-001: the past titles under "What's happening?".
      suggestions: 'Sugerencias',
      // Spec 053 FR-009: an event over several days.
      endsDay: 'Termina',
      sameDay: 'El mismo día',
      pickLastDay: 'Elegir el último día',
      lastDayTitle: 'Último día',
      backToSameDay: 'Volver al mismo día',
      endsOnTitle: 'Termina el',
      /** The toast: "Poker night added for tonight, 18:00–22:00."; all day: "… added for Sat, Oct 31." */
      added: (title: string, when: string, range: string | null) => `Se añadió ${title} para ${when}${range ? `, ${range}` : ''}.`,
      tonight: 'esta noche',
      todayWord: 'hoy',
      tomorrowWord: 'mañana',
      undo: 'Deshacer',
      /** The edit's scope question (OC-CalEvent.md › Edit a repeating event). */
      scopeTitle: 'Este evento se repite',
      scopeBody: (date: string, every: string) => `¿Cambiar solo el del ${date} o ${every} a partir de ahora?`,
      /** "every Saturday", "every day", "every other Saturday", "every month", "every year". */
      every: { daily: () => 'cada día', weekly: (day: string) => `cada ${day}`, biweekly: (day: string) => `cada dos semanas, el ${day}`, monthly: () => 'cada mes', yearly: () => 'cada año' },
      thisOnly: 'Solo este evento',
      allFuture: 'Todos los eventos futuros',
      loadFailedTitle: 'No pudimos abrir este evento.',
      loadFailedBody: 'Puede que se haya eliminado o que no tengas conexión.',
      // Not drawn (032-later L99, added to OC-CalAdd.md): when a toast's Undo fails.
      undoFailed: 'No se pudo deshacer. Comprueba tu conexión e inténtalo de nuevo.',
      /** design/ui/OC-CalSurprise.md (spec 043): "Who can see it?" and the surprise card. */
      whoCanSee: '¿Quién puede verlo?',
      whoCanSeeLabel: 'Quién puede verlo',
      visibilities: { family: 'Familia', private: 'Privado', surprise: 'Sorpresa' },
      visibilityHints: {
        family: 'Todos en la familia ven todos los detalles.',
        private: 'Los demás ven “Ocupado” a esta hora y nada más.',
        surprise: 'Ocúltalo a alguien: solo verá lo que elijas abajo.',
      },
      /** "What Eva sees"; with nobody picked yet, "What they see" (not drawn). */
      coverTitle: (names: string[]) => (names.length ? `Lo que ${names.length > 1 ? 'ven' : 've'} ${andList(names)}` : 'Lo que ven'),
      coverNote: (names: string[]) => `Nota para ${names.length ? andList(names) : 'ellos'}`,
      surpriseSummary: (names: string[]) =>
        `${names.length ? andList(names) : 'Ellos'} solo ${names.length === 1 ? 've' : 'ven'} este título, la hora, el lugar y esta nota. Todos los demás lo ven todo.`,
      noCover: (names: string[]) => (names.length ? `Añade lo que ${names.length > 1 ? 'verán' : 'verá'} ${andList(names)}.` : 'Añade lo que verán.'),
      // Not drawn (spec 043, added to OC-CalSurprise.md). The surprise is kept from the people in Who.
      noSecretFrom: 'Elige en Quién para quién es la sorpresa: alguien con la app que no seas tú.',
      /** Adding someone to a surprise's Who where it can't be kept from them: one date, or not its creator. */
      surpriseRevealed: (names: string[]) => `${andList(names)} ${names.length > 1 ? 'verían' : 'vería'} esta sorpresa. Solo quien la creó puede ${names.length > 1 ? 'añadirlos' : 'añadir a alguien'}, y en todo el evento.`,
    },
    /** OC-CalBusy (spec 043): someone else's private event, as a sheet over the calendar. */
    busy: {
      title: (name: string) => `${name} no está disponible`,
      /** "Thursday, Oct 22 · Afternoon". */
      when: (date: string, time: string) => `${date} · ${time}`,
      body: (name: string) => `${name} mantiene en privado los detalles de este evento.`,
      // Not drawn (spec 043): the creator has left the family.
      someone: 'Alguien',
      bodySomeone: 'Los detalles de este evento son privados.',
      ok: 'OK',
    },
    /** design/ui/OC-CalEvent.md (spec 042): the event page, its dialogs, the share sheet and the shared page. */
    event: {
      back: 'Volver al calendario',
      /** "Morning · about 09:00–12:00"; a custom time shows its hours: "14:30–15:30". */
      slotTime: (slot: string, range: string) => `${slot} · aprox. ${range}`,
      /** Spec 050 FR-006, after the date on one line: "Sat, Oct 31 · Morning, about 09:00–12:00". */
      slotTimeInline: (slot: string, range: string) => `${slot}, aprox. ${range}`,
      allDay: 'Todo el día',
      /** A multi-day event's dates: "Sat, Oct 31 – Mon, Nov 2". */
      span: (from: string, to: string) => `${from} – ${to}`,
      /** "Every Saturday", "Every Tuesday and Thursday", "Every other Saturday", "Every day". */
      every: {
        daily: () => 'Cada día',
        weekly: (days: string[]) => `Cada ${andList(days)}`,
        biweekly: (days: string[]) => `Cada dos semanas, el ${andList(days)}`,
        monthly: () => 'Cada mes',
        yearly: () => 'Cada año',
      },
      /** The who row: "James", "James and Mia", then " · Gabriel takes James". */
      who: (names: string[]) => andList(names),
      /** The place row's directions and copy buttons (icons only), read as these. */
      openInMapsA11y: (place: string) => `Abrir ${place} en Google Maps`,
      copyPlaceA11y: (place: string) => `Copiar ${place}`,
      placeCopied: 'Dirección copiada',
      copyPlaceFailed: 'No se pudo copiar la dirección.',
      drives: (name: string) => `Lleva ${name}`,
      /** Spec 049 FR-006, after the reminder on its line (spec 050): "1 hour before · reminds Gabriel · 13:30". */
      reminds: (names: string[], when: string) => `avisa a ${andList(names)} · ${when}`,
      dayBefore: (time: string) => `el día anterior a las ${time}`,
      bring: 'Llevar',
      /** The Bring card's header: "1 of 3" ticked. */
      bringCount: (done: number, total: number) => `${done} de ${total}`,
      /** Ends the "Added by" line when there is a checklist (spec 050). */
      anyoneCanTick: 'cualquiera puede marcar la lista',
      tickFailed: 'No se pudo cambiar. Inténtalo de nuevo.',
      addedBy: (name: string, ago: string) => `Añadido por ${name} · ${ago}`,
      addedVia: (assistant: string, ago: string) => `Añadido con ${assistant} · ${ago}`,
      // The top bar (spec 050 FR-006): ✎ and ⋯, whose menu holds Duplicate, Share and Delete.
      edit: 'Editar evento',
      more: 'Más acciones',
      duplicate: 'Duplicar',
      share: 'Compartir un enlace de solo lectura',
      delete: 'Eliminar evento',
      deleteTitle: (title: string) => `¿Eliminar “${title}”?`,
      /** Put before the body for someone else's event. */
      addedThis: (name: string) => `Lo añadió ${name}.`,
      deleteRepeatBody: '¿Eliminar solo este o este y todos los siguientes? Se elimina para toda la familia.',
      onlyThis: 'Solo este',
      thisAndFuture: 'Este y todos los siguientes',
      keep: 'Conservarlo',
      deleted: 'Evento eliminado',
      /** "Copied to Sat, Nov 7". */
      copied: (day: string) => `Copiado al ${day}`,
      // Not drawn (written for spec 042, added to OC-CalEvent.md).
      deleteFailed: 'No se pudo eliminar. Comprueba tu conexión e inténtalo de nuevo.',
      duplicateFailed: 'No se pudo copiar. Comprueba tu conexión e inténtalo de nuevo.',
      shareTitle: 'Compartir este evento',
      shareLead: 'Quien tenga el enlace verá el título, el día, la hora y el lugar. Sin notas ni lista.',
      /** The shared page (`/e/[token]`): who it's for, first names only. */
      with: (names: string[]) => `Con ${andList(names)}`,
      withEveryone: 'toda la familia',
      withOthers: 'otros',
      noLongerTitle: 'Este evento ya no se comparte.',
      noLongerBody: 'Pide un enlace nuevo a la persona que te lo envió.',
      sharedLoadFailedTitle: 'No pudimos abrir este evento.',
      sharedLoadFailedBody: 'Comprueba tu conexión e inténtalo de nuevo.',
      retry: 'Intentar de nuevo',
      /** OC-CalSurprise (spec 043): the cover's note, as the hidden person sees it. */
      noteFrom: (name: string) => `Nota de ${name}`,
      /** For those in on it: the sage tag, and "hidden from Eva" in agenda and day rows. */
      surprise: 'Sorpresa',
      hiddenFrom: (names: string[]) => `oculto para ${andList(names)}`,
      loading: 'Cargando el evento',
    },
  },
  // design/ui/OC-Reminders.md (spec 057): Home's card, the Reminders screen, the drawer and the sheet.
  reminders: {
    title: 'Recordatorios',
    back: 'Atrás',
    newReminder: 'Nuevo recordatorio',
    /** Beside the rail, the title's olive "+ New" (as Recipes'), read "New reminder". */
    new: 'Nuevo',
    seeAll: 'Ver todos los recordatorios',
    /** The Home card footer's right side; each part drops when zero. */
    moreToday: (n: number) => `${n} más hoy`,
    snoozedCount: (n: number) => `${n} ${n === 1 ? 'pospuesto' : 'pospuestos'}`,
    joinParts: (parts: string[]) => parts.join(' · '),
    // Rows
    markDone: (title: string) => `Marcar como hecho: ${title}`,
    markNotDone: (title: string) => `Marcar como no hecho: ${title}`,
    open: (title: string) => `Abrir ${title}`,
    repeats: 'Se repite',
    hasNotes: 'Tiene notas',
    everyone: 'Todos',
    everyoneInitial: 'Todos',
    /** The late badge: "2d late", "3h late". */
    lateDays: (n: number) => `${n} d de retraso`,
    lateHours: (n: number) => `${n} h de retraso`,
    doneJustNow: 'Hecho ahora mismo',
    /** Spec 058: one done earlier today, at the bottom of Today until midnight. */
    doneAt: (time: string) => `Hecho a las ${time}`,
    // A row's detail line.
    wasDueYesterday: 'Era para ayer',
    /** "Was due Mon" (this past week), "Was due Mon, Nov 2" (before). */
    wasDue: (day: string) => `Era para el ${day}`,
    nudgesHourly: (time: string) => `${time} · avisa cada hora`,
    today: 'Hoy',
    tomorrow: 'Mañana',
    anyTime: 'A cualquier hora',
    /** "Sat, Nov 14 · 15:00". */
    dayAt: (day: string, time: string) => `${day} · ${time}`,
    backTomorrow: (date: string) => `Vuelve mañana, ${date}`,
    backOn: (date: string) => `Vuelve el ${date}`,
    /** Spec 058: a snoozed one back later today. */
    backAt: (time: string) => `Vuelve a las ${time}`,
    /** Spec 058: the pill where "2d late" goes, on a snoozed one listed on the day it's back. */
    snoozedPill: 'Pospuesto',
    // The drawer's snooze and actions
    snoozeUntil: 'Posponer hasta',
    snooze: { hour: 'En 1 hora', tomorrow: 'Mañana', week: 'La próxima semana', month: 'El próximo mes', date: 'Elegir una fecha' },
    edit: 'Editar',
    delete: 'Eliminar recordatorio',
    close: 'Cerrar',
    // The Reminders screen
    show: 'Mostrar',
    mine: 'Míos',
    everyones: 'De todos',
    overdue: 'Atrasados',
    /** "Today · Wed, Nov 11". */
    todayOn: (date: string) => `Hoy · ${date}`,
    tomorrowOn: (date: string) => `Mañana · ${date}`,
    later: 'Más adelante',
    showMore: 'Mostrar más',
    snoozed: 'Pospuestos',
    hiddenUntilLater: (n: number, more: boolean) => `${n}${more ? '+' : ''} ${n === 1 && !more ? 'oculto' : 'ocultos'} hasta más tarde`,
    hide: 'Ocultar',
    emptyTitle: 'Nada que recordar. Genial.',
    loading: 'Cargando recordatorios',
    loadFailed: 'No se pudieron cargar tus recordatorios. Inténtalo de nuevo.',
    // The drawer
    /** The when line: "Every Monday · was due Mon, Nov 9", "Today at 15:00 · nudges every hour until done". */
    whenParts: (parts: string[]) => parts.join(' · '),
    wasDueLower: (date: string) => `era para el ${date}`,
    wasDueOn: (date: string) => `Era para el ${date}`,
    todayAt: (time: string) => `Hoy a las ${time}`,
    todayAnyTime: 'Hoy, a cualquier hora',
    tomorrowAt: (time: string) => `Mañana a las ${time}`,
    tomorrowAnyTime: 'Mañana, a cualquier hora',
    at: (day: string, time: string) => `${day} a las ${time}`,
    nudgesEveryHour: 'avisa cada hora hasta que esté hecho',
    daysLate: (n: number) => `${n} ${n === 1 ? 'día' : 'días'} de retraso.`,
    hoursLate: (n: number) => `${n} ${n === 1 ? 'hora' : 'horas'} de retraso.`,
    lastWeekMissed: (date: string) => ` El de la semana pasada (${date}) tampoco se hizo.`,
    oneMissed: (date: string) => ` El del ${date} tampoco se hizo.`,
    missedSince: (n: number, date: string) => ` Sin hacer ${n} veces desde el ${date}.`,
    notes: 'Notas',
    addNote: '+ Añadir una nota',
    calendar: 'Calendario',
    markAsDone: 'Marcar como hecho',
    doneTitle: 'Hecho. ¡Bien!',
    nextOne: (date: string) => `El siguiente: ${date}. Las semanas sin hacer quedan en su historial.`,
    nextOnSchedule: 'El siguiente sigue en su fecha.',
    snoozedUntil: (date: string) => `Pospuesto hasta el ${date}`,
    snoozedBody: 'Queda oculto hasta entonces y vuelve sin la marca de retraso.',
    undo: 'Deshacer',
    deleteAllTitle: '¿Eliminar todos los recordatorios futuros?',
    deleteAllBody: (title: string) => `Se eliminan todas las fechas de “${title}”. Puedes recuperarlo desde Eliminado recientemente durante 30 días.`,
    deleteConfirm: 'Eliminar recordatorio',
    keep: 'Conservarlo',
    deleted: 'Recordatorio eliminado',
    saveFailed: 'No se pudo guardar. Inténtalo de nuevo.',
    gone: 'Este recordatorio se eliminó.',
    // The sheet (OC-ReminderEdit)
    /** Saved from the add sheet (with Undo, as a new event). */
    createdToast: (title: string) => `Se añadió ${title} a Recordatorios.`,
    sheetNew: 'Nuevo recordatorio',
    sheetEdit: 'Editar recordatorio',
    cancel: 'Cancelar',
    what: 'Recuérdanos…',
    whatPlaceholder: 'p. ej., Pagar la guardería',
    noTitle: 'Ponle un nombre a tu recordatorio.',
    due: 'Fecha',
    otherDay: 'Otro día',
    pickDate: 'Elegir una fecha',
    setTime: 'Poner una hora',
    time: 'Hora',
    badTime: 'Usa una hora como 15:00.',
    ifNotDone: 'Si no se hace',
    rollovers: { hour: 'Cada hora', day: 'Al día siguiente', week: 'A la semana siguiente', none: 'Dejarlo' },
    rolloverHints: {
      hour: 'Se queda en Inicio y avisa cada hora hasta que alguien lo marque.',
      day: 'Pasa al día siguiente y muestra cuánto retraso lleva. La fecha no cambia.',
      week: 'Pasa al mismo día de la semana siguiente, con una marca de retraso.',
      none: 'Se queda en su día en el calendario. Sin más avisos.',
    },
    repeat: 'Repetir',
    repeatChoices: { never: 'Nunca', daily: 'Cada día', weekly: 'Cada semana', monthly: 'Cada mes', custom: 'Personalizado' },
    for: 'Para',
    notesLabel: 'Notas',
    optional: '· opcional',
    notesPlaceholder: 'Detalles, un número de teléfono, qué preguntar…',
    /** The notification summary (spec 059's times, in the recipient's quiet hours and clock). */
    notifyTimedHourly: (who: string, before: string, at: string, quietFrom: string, quietTo: string) =>
      `Avisa a ${who} a las ${before} y a las ${at}, y luego cada hora hasta que esté hecho. Sin avisos de ${quietFrom} a ${quietTo}.`,
    notifyTimedDaily: (who: string, before: string, at: string) => `Avisa a ${who} a las ${before} y a las ${at}, y luego cada mañana mientras siga pendiente.`,
    notifyTimedWeekly: (who: string, before: string, at: string) => `Avisa a ${who} a las ${before} y a las ${at}, y luego una vez por semana mientras siga pendiente.`,
    notifyTimed: (who: string, before: string, at: string) => `Avisa a ${who} a las ${before} y a las ${at}.`,
    notifyDay: (who: string, at: string) => `Avisa a ${who} a las ${at} ese día, y luego cada mañana mientras siga pendiente.`,
    notifyDayWeekly: (who: string, at: string) => `Avisa a ${who} a las ${at} ese día, y luego una vez por semana mientras siga pendiente.`,
    notifyDayOnly: (who: string, at: string) => `Avisa a ${who} a las ${at} ese día.`,
    everyoneLower: 'todos',
    save: 'Guardar',
    saving: 'Guardando…',
    previousMonth: 'Mes anterior',
    nextMonth: 'Mes siguiente',
  },
  debug: {
    build: (commit: string) => `Compilación ${commit}`,
  },
};
