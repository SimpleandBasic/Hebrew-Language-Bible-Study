(() => {
  const STORAGE_KEY = "hebrew-reader-theme";
  const choices = ["system", "light", "dark"];
  const buttons = [...document.querySelectorAll("[data-reader-theme-choice]")];
  const status = document.querySelector("#readerThemeStatus");
  const systemThemeQuery = window.matchMedia?.("(prefers-color-scheme: dark)");

  function readPreference() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return choices.includes(saved) ? saved : "system";
    } catch {
      return "system";
    }
  }

  function writePreference(preference) {
    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // Theme still works for this session if local storage is blocked.
    }
  }

  function resolveTheme(preference) {
    if (preference === "dark") return "dark";
    if (preference === "light") return "light";
    return systemThemeQuery?.matches ? "dark" : "light";
  }

  function labelForPreference(preference, actualTheme) {
    if (preference === "system") {
      return `Following device setting. Current reader theme: ${actualTheme === "dark" ? "Night Mode" : "Day Mode"}.`;
    }

    return preference === "dark" ? "Night Mode is on." : "Day Mode is on.";
  }

  function applyTheme(preference = readPreference()) {
    const actualTheme = resolveTheme(preference);
    document.documentElement.dataset.readerThemePreference = preference;
    document.documentElement.dataset.readerTheme = actualTheme;
    document.body.dataset.readerThemePreference = preference;
    document.body.dataset.readerTheme = actualTheme;

    buttons.forEach((button) => {
      const isPressed = button.dataset.readerThemeChoice === preference;
      button.setAttribute("aria-pressed", String(isPressed));
    });

    if (status) status.textContent = labelForPreference(preference, actualTheme);
  }

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const preference = button.dataset.readerThemeChoice;
      if (!choices.includes(preference)) return;
      writePreference(preference);
      applyTheme(preference);
    });
  });

  systemThemeQuery?.addEventListener?.("change", () => {
    if (readPreference() === "system") applyTheme("system");
  });

  applyTheme();
})();
