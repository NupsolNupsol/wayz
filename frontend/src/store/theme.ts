export function applyThemeMode(mode: 'light' | 'dark') {
  document.documentElement.setAttribute('data-theme', mode)
}
