import posthog from 'posthog-js'

let appVersion: string | undefined
let apiUrl: string | undefined
let telemetryEnabled = true

export function setTelemetryEnabled(v: boolean): void {
  telemetryEnabled = v
}

export function isTelemetryEnabled(): boolean {
  return telemetryEnabled
}

export function shouldEnableTelemetry(opts: { posthogKey?: string; telemetryEnabled?: boolean }): boolean {
  if (opts.telemetryEnabled === false) return false
  return !!opts.posthogKey
}

function appVersionProperties(): Record<string, string> {
  return appVersion ? { app_version: appVersion } : {}
}

export function configureAnalyticsContext(props: { appVersion?: string; apiUrl?: string }) {
  if (!telemetryEnabled) return
  appVersion = props.appVersion?.trim() || undefined
  apiUrl = props.apiUrl?.trim() || undefined

  // `platform` distinguishes desktop events from any other surface (e.g. the
  // web dashboard's autocapture) sharing the PostHog project.
  const eventProperties = { platform: 'desktop', ...appVersionProperties() }
  posthog.register(eventProperties)

  const personProperties = {
    ...(apiUrl ? { api_url: apiUrl } : {}),
    ...eventProperties,
  }
  posthog.people.set(personProperties)
}

export function identifyUser(userId: string, properties?: Record<string, unknown>) {
  if (!telemetryEnabled) return
  posthog.identify(userId, {
    ...properties,
    ...appVersionProperties(),
  })
}

export function resetAnalyticsIdentity() {
  if (!telemetryEnabled) return
  posthog.reset()
  configureAnalyticsContext({ appVersion, apiUrl })
}

export function chatSessionCreated(runId: string) {
  if (!telemetryEnabled) return
  posthog.capture('chat_session_created', { run_id: runId })
}

export function chatMessageSent(props: {
  voiceInput?: boolean
  voiceOutput?: string
  searchEnabled?: boolean
}) {
  if (!telemetryEnabled) return
  posthog.capture('chat_message_sent', {
    voice_input: props.voiceInput ?? false,
    voice_output: props.voiceOutput ?? false,
    search_enabled: props.searchEnabled ?? false,
  })
}

export function appOpened(folder: string) {
  if (!telemetryEnabled) return
  posthog.capture('app_opened', { folder })
}

export function oauthConnected(provider: string) {
  if (!telemetryEnabled) return
  posthog.capture('oauth_connected', { provider })
}

export function oauthDisconnected(provider: string) {
  if (!telemetryEnabled) return
  posthog.capture('oauth_disconnected', { provider })
}

export function voiceInputStarted() {
  if (!telemetryEnabled) return
  posthog.capture('voice_input_started')
}

export function callStarted(preset: 'voice' | 'video' | 'share' | 'practice') {
  if (!telemetryEnabled) return
  posthog.capture('call_started', { preset })
}

// Voice-to-voice latency breakdown for one call turn (all milliseconds):
// utterance accepted → message submitted → first TTS speak() → audio playing.
export function callTurnLatency(props: {
  endpointToSubmitMs: number
  submitToSpeakMs: number
  speakToAudioMs: number
  totalMs: number
}) {
  if (!telemetryEnabled) return
  posthog.capture('call_turn_latency', {
    endpoint_to_submit_ms: Math.round(props.endpointToSubmitMs),
    submit_to_speak_ms: Math.round(props.submitToSpeakMs),
    speak_to_audio_ms: Math.round(props.speakToAudioMs),
    total_ms: Math.round(props.totalMs),
  })
}

// Client auto-update funnel: staged (main: update_failed on error) → prompted
// (here, when the restart card is shown) → restarted (main, on quitAndInstall)
// → client_updated (main, first launch on the new version).
export function updatePrompted() {
  if (!telemetryEnabled) return
  posthog.capture('update_prompted')
}

export function searchExecuted(types: string[]) {
  if (!telemetryEnabled) return
  posthog.capture('search_executed', { types })
}

export function noteExported(format: string) {
  if (!telemetryEnabled) return
  posthog.capture('note_exported', { format })
}

// ---------------------------------------------------------------------------
// Feature usage instrumentation. One `view_opened` per navigation (the
// feature-importance funnel), plus per-feature action events. Everything below
// answers "how many people use X and what do they do inside it".
// ---------------------------------------------------------------------------

export type AppView =
  | 'chat'
  | 'file'
  | 'graph'
  | 'task'
  | 'suggested-topics'
  | 'meetings'
  | 'live-notes'
  | 'email'
  | 'workspace'
  | 'knowledge-view'
  | 'chat-history'
  | 'home'
  | 'code'
  | 'bg-tasks'
  | 'apps'
  | 'spaces'

// Views that count as "using a feature" — first visit sets a person property
// so PostHog cohorts can answer "how many people have ever used meetings".
const FIRST_USE_VIEWS: Partial<Record<AppView, string>> = {
  email: 'has_used_email',
  meetings: 'has_used_meetings',
  'live-notes': 'has_used_live_notes',
  'bg-tasks': 'has_used_bg_agents',
  apps: 'has_used_apps',
  code: 'has_used_code',
  spaces: 'has_used_spaces',
}

export function viewOpened(view: AppView) {
  if (!telemetryEnabled) return
  posthog.capture('view_opened', { view })
  const flag = FIRST_USE_VIEWS[view]
  if (flag) posthog.people.set_once({ [flag]: true })
}

// --- Email ---

export function emailThreadOpened() {
  if (!telemetryEnabled) return
  posthog.capture('email_thread_opened')
}

export function emailComposeOpened(mode: string) {
  if (!telemetryEnabled) return
  posthog.capture('email_compose_opened', { mode })
}

export function emailSent(props: { mode: string; hasAttachments: boolean; aiAssisted: boolean }) {
  if (!telemetryEnabled) return
  posthog.capture('email_sent', {
    mode: props.mode,
    has_attachments: props.hasAttachments,
    ai_assisted: props.aiAssisted,
  })
}

export function emailAiDraftGenerated(mode: 'generate' | 'rewrite') {
  if (!telemetryEnabled) return
  posthog.capture('email_ai_draft_generated', { mode })
}

export function emailArchived() {
  if (!telemetryEnabled) return
  posthog.capture('email_archived')
}

export function emailTrashed() {
  if (!telemetryEnabled) return
  posthog.capture('email_trashed')
}

export function emailMarkedUnread() {
  if (!telemetryEnabled) return
  posthog.capture('email_marked_unread')
}

export function emailImportanceChanged(importance: string) {
  if (!telemetryEnabled) return
  posthog.capture('email_importance_changed', { importance })
}

export function emailCategoryChanged(category: string) {
  if (!telemetryEnabled) return
  posthog.capture('email_category_changed', { category })
}

export function emailCategoryArchived(category: string) {
  if (!telemetryEnabled) return
  posthog.capture('email_category_archived', { category })
}

export function emailSearched() {
  if (!telemetryEnabled) return
  posthog.capture('email_searched')
}

export function emailInstructionsSaved() {
  if (!telemetryEnabled) return
  posthog.capture('email_instructions_saved')
}

export function emailSyncTriggered() {
  if (!telemetryEnabled) return
  posthog.capture('email_sync_triggered')
}

// --- Meetings ---

// --- Spaces ---------------------------------------------------------------

export function spacesServerCreated() {
  if (!telemetryEnabled) return
  posthog.capture('spaces_server_created')
}

export function spacesSpaceCreated() {
  if (!telemetryEnabled) return
  posthog.capture('spaces_space_created')
}

export function spacesInviteLinkCopied() {
  if (!telemetryEnabled) return
  posthog.capture('spaces_invite_link_copied')
}

// Counts successful join/connect actions; address and dev flows can reconnect
// existing members. The method identifies the UI flow, not the server's host.
export function spacesSpaceJoined(method: 'invite_link' | 'server_address' | 'dev_server') {
  if (!telemetryEnabled) return
  posthog.capture('spaces_space_joined', { method })
}

export function spacesRowboatInvokeFailed() {
  if (!telemetryEnabled) return
  posthog.capture('spaces_rowboat_invoke_failed')
}

export function spacesMessagePosted(props: { kind: 'general' | 'topic'; mentionsRowboat: boolean }) {
  if (!telemetryEnabled) return
  posthog.capture('spaces_message_posted', { kind: props.kind, mentions_rowboat: props.mentionsRowboat })
}

export function spacesReactionToggled(props: { action: 'add' | 'remove' }) {
  if (!telemetryEnabled) return
  posthog.capture('spaces_reaction_toggled', { action: props.action })
}

export function spacesMessageDeleted() {
  if (!telemetryEnabled) return
  posthog.capture('spaces_message_deleted')
}

export function spacesTopicStarted() {
  if (!telemetryEnabled) return
  posthog.capture('spaces_topic_started')
}

export function spacesFoldRequested() {
  if (!telemetryEnabled) return
  posthog.capture('spaces_fold_requested')
}

export function spacesTabViewed(tab: 'general' | 'topics' | 'files' | 'whiteboard') {
  if (!telemetryEnabled) return
  posthog.capture('spaces_tab_viewed', { tab })
}

export function meetingRecordingStarted(hasCalendarEvent: boolean) {
  if (!telemetryEnabled) return
  posthog.capture('meeting_recording_started', { has_calendar_event: hasCalendarEvent })
  posthog.people.set_once({ has_used_meetings: true })
}

export function meetingRecordingStopped(durationSeconds: number) {
  if (!telemetryEnabled) return
  posthog.capture('meeting_recording_stopped', { duration_seconds: Math.round(durationSeconds) })
}

// meeting_popup_action is captured in the main process (the popup window runs
// without PostHog) — see apps/main/src/ipc.ts 'meetingDetect:action'.

export function meetingNoteOpened() {
  if (!telemetryEnabled) return
  posthog.capture('meeting_note_opened')
}

// --- Calls ---

export function callEnded(durationSeconds: number) {
  if (!telemetryEnabled) return
  posthog.capture('call_ended', { duration_seconds: Math.round(durationSeconds) })
}

// --- Background agents ---

export function bgAgentCreated(props: { method: 'manual' | 'coding' | 'copilot'; hasTriggers: boolean }) {
  if (!telemetryEnabled) return
  posthog.capture('bg_agent_created', { method: props.method, has_triggers: props.hasTriggers })
  posthog.people.set_once({ has_created_bg_agent: true })
}

export function bgAgentUpdated() {
  if (!telemetryEnabled) return
  posthog.capture('bg_agent_updated')
}

export function bgAgentToggled(active: boolean) {
  if (!telemetryEnabled) return
  posthog.capture('bg_agent_toggled', { active })
}

export function bgAgentRunClicked() {
  if (!telemetryEnabled) return
  posthog.capture('bg_agent_run_clicked')
}

export function bgAgentStopped() {
  if (!telemetryEnabled) return
  posthog.capture('bg_agent_stopped')
}

export function bgAgentDeleted() {
  if (!telemetryEnabled) return
  posthog.capture('bg_agent_deleted')
}

// --- Live notes ---

export function liveNoteSaved() {
  if (!telemetryEnabled) return
  posthog.capture('live_note_saved')
}

export function liveNoteToggled(active: boolean) {
  if (!telemetryEnabled) return
  posthog.capture('live_note_toggled', { active })
}

export function liveNoteRunClicked() {
  if (!telemetryEnabled) return
  posthog.capture('live_note_run_clicked')
}

export function liveNoteStopped() {
  if (!telemetryEnabled) return
  posthog.capture('live_note_stopped')
}

export function liveNoteDeleted() {
  if (!telemetryEnabled) return
  posthog.capture('live_note_deleted')
}

export function liveNoteEditWithCopilotClicked() {
  if (!telemetryEnabled) return
  posthog.capture('live_note_edit_with_copilot_clicked')
}

// --- Search ---

export function searchOpened() {
  if (!telemetryEnabled) return
  posthog.capture('search_opened')
}

export function searchResultSelected(type: string) {
  if (!telemetryEnabled) return
  posthog.capture('search_result_selected', { type })
}

// Apps install/update/publish/star/delete events are captured in the main
// process (apps/main/src/ipc.ts) where the operations actually run.

// --- Billing ---

export function billingErrorShown(kind: string) {
  if (!telemetryEnabled) return
  posthog.capture('billing_error_shown', { kind })
}

export function billingUpgradeClicked(kind: string) {
  if (!telemetryEnabled) return
  posthog.capture('billing_upgrade_clicked', { kind })
}

// --- Failures ---

export function emailSendFailed() {
  if (!telemetryEnabled) return
  posthog.capture('email_send_failed')
}

export function meetingSummarizeFailed() {
  if (!telemetryEnabled) return
  posthog.capture('meeting_summarize_failed')
}

// --- Notes / settings / onboarding ---

export function noteCreated() {
  if (!telemetryEnabled) return
  posthog.capture('note_created')
}

// The autosave loop fires on every debounced keystroke burst, so dedupe to one
// event per note per app session — "was this note edited", not "how many saves".
const editedNotePaths = new Set<string>()
export function noteEdited(path: string) {
  if (!telemetryEnabled) return
  if (editedNotePaths.has(path)) return
  editedNotePaths.add(path)
  posthog.capture('note_edited')
}

export function settingsOpened(tab: string) {
  if (!telemetryEnabled) return
  posthog.capture('settings_opened', { tab })
}

export function settingsTabChanged(tab: string) {
  if (!telemetryEnabled) return
  posthog.capture('settings_tab_changed', { tab })
}

export function onboardingCompleted() {
  if (!telemetryEnabled) return
  posthog.capture('onboarding_completed')
}

// A provider connect seeded the assistant model (only happens when none was
// configured). `recommended` = the backend's flavor recommendation was in
// the provider's live list; false = first-listed fallback. Flavor only —
// never provider instance ids, keys, or endpoints.
export function llmInitialModelSelected(props: {
  flavor: string
  model: string
  recommended: boolean
  taskOverridesSeeded: number
  source: 'connect' | 'onboarding'
}) {
  if (!telemetryEnabled) return
  const { taskOverridesSeeded, ...rest } = props
  posthog.capture('llm_initial_model_selected', { ...rest, task_overrides_seeded: taskOverridesSeeded })
}
