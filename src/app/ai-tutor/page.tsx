// Re-export the root page so EduNext's /ai-tutor redirect works correctly.
// The root page already handles access_token, refresh_token, edunext_api, and user_id params.
export { default } from '../page'
