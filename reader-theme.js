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

  function installLateThemeOverrides() {
    if (document.querySelector("#readerThemeLateOverrides")) return;

    const style = document.createElement("style");
    style.id = "readerThemeLateOverrides";
    style.textContent = `
      body.chapter-reader-app-style[data-reader-theme="light"] {
        background: #fffdfa !important;
        color: #191815 !important;
      }

      body.chapter-reader-app-style[data-reader-theme="light"] .unified-main,
      body.chapter-reader-app-style[data-reader-theme="light"] .reader-focus-topbar,
      body.chapter-reader-app-style[data-reader-theme="light"] .chapter-reader-toolbar {
        background: #fffdfa !important;
      }

      body.chapter-reader-app-style[data-reader-theme="light"] .reader-focus-topbar h1,
      body.chapter-reader-app-style[data-reader-theme="light"] .chapter-interlinear-line,
      body.chapter-reader-app-style[data-reader-theme="light"] .chapter-word-hebrew,
      body.chapter-reader-app-style[data-reader-theme="light"] .chapter-reader-tab {
        color: #191815 !important;
      }

      body.chapter-reader-app-style[data-reader-theme="light"] .reader-focus-topbar .eyebrow,
      body.chapter-reader-app-style[data-reader-theme="light"] .chapter-reader-note,
      body.chapter-reader-app-style[data-reader-theme="light"] .chapter-reader-tools,
      body.chapter-reader-app-style[data-reader-theme="light"] .chapter-word-transliteration,
      body.chapter-reader-app-style[data-reader-theme="light"] .chapter-verse-summary,
      body.chapter-reader-app-style[data-reader-theme="light"] .chapter-verse-number {
        color: #69645c !important;
      }

      body.chapter-reader-app-style[data-reader-theme="light"] .chapter-word-gloss {
        color: #4b4640 !important;
      }

      body.chapter-reader-app-style[data-reader-theme="light"] .reader-menu-button,
      body.chapter-reader-app-style[data-reader-theme="light"] .chapter-reader-tabs {
        background: #f6f3ee !important;
        border-color: #d9d1c4 !important;
        color: #191815 !important;
      }

      body.chapter-reader-app-style[data-reader-theme="light"] .chapter-reader-tab + .chapter-reader-tab {
        border-inline-start-color: #d9d1c4 !important;
      }

      body.chapter-reader-app-style[data-reader-theme="light"] .chapter-word-token:hover,
      body.chapter-reader-app-style[data-reader-theme="light"] .chapter-word-token:focus-visible,
      body.chapter-reader-app-style[data-reader-theme="light"] .chapter-word-token.active {
        background: rgba(47, 118, 109, 0.1) !important;
      }

      body.chapter-reader-app-style[data-reader-theme="light"] .chapter-word-token.active {
        border-bottom-color: #2f766d !important;
      }

      body.chapter-reader-app-style[data-reader-theme="dark"] .word-study-panel {
        background: #171411 !important;
        color: #f8efe2 !important;
        border-color: #4a4035 !important;
      }

      body.chapter-reader-app-style[data-reader-theme="dark"] .word-study-panel dd,
      body.chapter-reader-app-style[data-reader-theme="dark"] .word-study-panel .detail-heading h2,
      body.chapter-reader-app-style[data-reader-theme="dark"] .word-study-panel .detail-section p,
      body.chapter-reader-app-style[data-reader-theme="dark"] .word-study-panel .helper-note {
        color: #f8efe2 !important;
      }

      body.chapter-reader-app-style[data-reader-theme="dark"] .word-study-panel dt {
        color: #c9bdad !important;
      }

      body.chapter-reader-app-style[data-reader-theme="dark"] .word-study-panel .selected-word,
      body.chapter-reader-app-style[data-reader-theme="dark"] .word-study-panel .selected-speaker,
      body.chapter-reader-app-style[data-reader-theme="dark"] .word-study-panel .icon-button {
        background: #241f1a !important;
        color: #f6efe2 !important;
        border-color: #4a4035 !important;
      }

      body.chapter-reader-app-style[data-reader-theme="dark"] .word-study-panel .transliteration {
        color: #f0a896 !important;
      }
    `;
    document.head.append(style);
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
    window.setTimeout(installLateThemeOverrides, 0);
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
