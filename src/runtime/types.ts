/** Where the app runs: inside a messenger's mini app, or as a plain website. */
export type MiniAppClient = 'telegram' | 'max' | 'web'

export type MessengerClient = Exclude<MiniAppClient, 'web'>

export type ColorScheme = 'light' | 'dark'

/** The user as the messenger signs it into init data (field names as sent). */
export interface MiniAppUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  photo_url?: string
  is_premium?: boolean
  allows_write_to_pm?: boolean
}

export interface MiniAppChat {
  id: number
  type: string
  title?: string
  username?: string
  photo_url?: string
}

/** Parsed init data. The same shape on the client and on the server. */
export interface MiniAppInitData {
  /** Seconds since the epoch; null when the field is missing or not a number. */
  authDate: number | null
  hash: string | null
  queryId?: string
  startParam?: string
  user?: MiniAppUser
  receiver?: MiniAppUser
  chat?: MiniAppChat
  chatType?: string
  chatInstance?: string
  /** Every field as signed, values decoded. */
  fields: Readonly<Record<string, string>>
}

export type ShareStatus = 'shared' | 'cancelled' | 'unsupported'
export type DownloadStatus = 'downloading' | 'cancelled' | 'unsupported'

export type HapticImpactStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'
export type HapticNotificationType = 'error' | 'success' | 'warning'

export interface MiniAppHaptics {
  /** Whether calls reach the device. On the website and in old clients they do nothing. */
  readonly supported: boolean
  impact(style: HapticImpactStyle): void
  notification(type: HapticNotificationType): void
  selection(): void
}

/**
 * A popup button, by Telegram's rule: `default` and `destructive` need a text,
 * `ok`, `close` and `cancel` get the client's own.
 */
export type MiniAppPopupButton = { id?: string } & (
  | { type: 'default' | 'destructive', text: string }
  | { type: 'ok' | 'close' | 'cancel', text?: string }
)

export interface MiniAppPopupParams {
  title?: string
  message: string
  buttons?: MiniAppPopupButton[]
}

/** A message the bot prepared for forwarding in MAX. */
export interface MaxPreparedMessage {
  mid: string
  chatType: 'DIALOG' | 'CHAT'
}

/**
 * What every client can do. A method the client lacks does nothing, or returns
 * `null` / `'unsupported'` where the caller has to show something else.
 */
interface MiniAppSdkBase {
  /** As the client reports it: `ios`, `android`, `tdesktop`, `desktop`, `web`…; `unknown` without one. */
  readonly platform: string
  readonly colorScheme: ColorScheme
  /** Called on every change of the color scheme; returns the unsubscribe. */
  onColorSchemeChange(callback: (scheme: ColorScheme) => void): () => void

  /** Tells the messenger the app is drawn: it hides its loader. */
  ready(): void
  close(): void
  /** Full height (Telegram). */
  expand(): void
  /** Swipe down to close the app. Off when the page has its own vertical gestures. */
  setVerticalSwipes(enabled: boolean): void
  setClosingConfirmation(enabled: boolean): void

  /** In the external browser from a mini app, in a new tab on the website. */
  openLink(url: string): void
  /** A link of the messenger itself (t.me, max.ru) opens inside it; any other — like `openLink`. */
  openInternalLink(url: string): void

  readonly haptics: MiniAppHaptics

  /**
   * Adds a layer to the back button: shows it with this handler on top.
   * Returns the release; the button hides when no layers are left.
   */
  pushBackButton(handler: () => void): () => void

  /** Native popup; `null` when the client has none — show your own. Resolves to the pressed button id. */
  showPopup(params: MiniAppPopupParams): Promise<string> | null
  /** Native confirm; `null` like `showPopup`. */
  showConfirm(message: string): Promise<boolean> | null

  downloadFile(url: string, fileName: string): Promise<DownloadStatus>
  canSharePreparedMessage(): boolean
  /** Asks the user to let the bot write first (Telegram only). */
  canRequestWriteAccess(): boolean
  requestWriteAccess(): Promise<boolean>
}

export interface TelegramMiniAppSdk extends MiniAppSdkBase {
  readonly client: 'telegram'
  readonly raw: TelegramWebApp
  /** Forwards a message prepared with `savePreparedInlineMessage`. */
  sharePreparedMessage(messageId: string): Promise<ShareStatus>
}

export interface MaxMiniAppSdk extends MiniAppSdkBase {
  readonly client: 'max'
  readonly raw: MaxWebApp
  sharePreparedMessage(message: MaxPreparedMessage): Promise<ShareStatus>
}

export interface WebMiniAppSdk extends MiniAppSdkBase {
  readonly client: 'web'
  readonly raw: null
}

/** Narrow by `client` to reach the raw SDK and the client's own methods. */
export type MiniAppSdk = TelegramMiniAppSdk | MaxMiniAppSdk | WebMiniAppSdk

/* ------------------------------------------------------------------------ */
/* The SDKs. Only what this module calls, every member optional where an old */
/* client may lack it: the module checks at runtime, not by these types.     */
/* ------------------------------------------------------------------------ */

interface BackButtonLike {
  show?(): void
  hide?(): void
  onClick?(callback: () => void): void
  offClick?(callback: () => void): void
}

interface HapticFeedbackLike {
  impactOccurred?(style: HapticImpactStyle): unknown
  notificationOccurred?(type: HapticNotificationType): unknown
  selectionChanged?(): unknown
}

interface ThemeParams {
  bg_color?: string
  text_color?: string
  hint_color?: string
  link_color?: string
  button_color?: string
  button_text_color?: string
  secondary_bg_color?: string
  [key: string]: string | undefined
}

interface MainButtonLike {
  show?(): void
  hide?(): void
  setParams?(params: { text?: string, color?: string, text_color?: string, is_visible?: boolean, is_active?: boolean }): void
  onClick?(callback: () => void): void
  offClick?(callback: () => void): void
}

/**
 * `window.Telegram.WebApp` from telegram-web-app.js: what this module uses and
 * the window chrome apps commonly set through `sdk.raw`. For the whole API,
 * cast to the types of `@types/telegram-web-app`.
 */
export interface TelegramWebApp {
  initData: string
  initDataUnsafe?: { start_param?: string }
  platform?: string
  version?: string
  colorScheme?: ColorScheme
  themeParams?: ThemeParams
  ready?(): void
  close?(): void
  expand?(): void
  enableVerticalSwipes?(): void
  disableVerticalSwipes?(): void
  enableClosingConfirmation?(): void
  disableClosingConfirmation?(): void
  openLink?(url: string): void
  openTelegramLink?(url: string): void
  onEvent?(event: string, callback: () => void): void
  offEvent?(event: string, callback: () => void): void
  showPopup?(params: MiniAppPopupParams, callback?: (buttonId: string) => void): void
  showConfirm?(message: string, callback?: (confirmed: boolean) => void): void
  downloadFile?(params: { url: string, file_name: string }, callback?: (accepted: boolean) => void): void
  shareMessage?(messageId: string, callback?: (sent: boolean) => void): void
  requestWriteAccess?(callback?: (granted: boolean) => void): void
  /** `bg_color`, `secondary_bg_color` or `#rrggbb`. */
  setHeaderColor?(color: string): void
  setBackgroundColor?(color: string): void
  setBottomBarColor?(color: string): void
  BackButton?: BackButtonLike
  MainButton?: MainButtonLike
  HapticFeedback?: HapticFeedbackLike
  [key: string]: unknown
}

/**
 * `window.WebApp` from MAX's max-web-app.js. Its methods answer with promises
 * that reject with `{ error: { code } }` where the client lacks them. It has no
 * theme: no `colorScheme`, no `themeParams`, no theme event (checked 27.10.2026).
 */
export interface MaxWebApp {
  initData: string
  initDataUnsafe?: { start_param?: string }
  platform?: 'ios' | 'android' | 'desktop' | 'web' | null
  version?: string | null
  ready?(): void
  close?(): void
  enableVerticalSwipes?(): Promise<unknown>
  disableVerticalSwipes?(): Promise<unknown>
  enableClosingConfirmation?(): void
  disableClosingConfirmation?(): void
  openLink?(url: string): void
  openMaxLink?(url: string): void
  onEvent?(event: string, callback: () => void): unknown
  offEvent?(event: string, callback: () => void): void
  downloadFile?(url: string, fileName: string): Promise<{ status?: string } | undefined>
  shareMaxContent?(params: MaxPreparedMessage | { text?: string, link?: string }): Promise<{ status?: string } | undefined>
  BackButton?: BackButtonLike
  HapticFeedback?: HapticFeedbackLike
  [key: string]: unknown
}
