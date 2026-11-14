window.SGP_CONFIG = Object.freeze({
  // Retail con índice usa el endpoint aislado; paused detiene esa ruta sin fallback.
  optRetailMode: "candidate",
  // Solo configuración pública del cliente web LAB.
  // La protección de datos permanece en RLS/RPC de Supabase.
  supabaseUrl: "https://ocvxbwzqxbrfndkvjmfx.supabase.co",
  supabasePublishableKey: "sb_publishable_DD7RmnEZdIV8zKh6E3lMpw_ROWqs3rt",
  // Existing public anon JWT, only for Edge's platform gateway. Not a user/session or service key.
  lpPowerBiGatewayJwt: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jdnhid3pxeGJyZm5ka3ZqbWZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0MDU5MDYsImV4cCI6MjEwNjk4MTkwNn0.wWWBtNWdQ_yas3dc2fxatsTLv5cNXcv7_DEAYyZN5vo"
});
