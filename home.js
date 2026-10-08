(function () {
  const root = document.documentElement;
  const toggle = document.getElementById("themeToggle");
  const storedTheme = localStorage.getItem("home-theme");

  function setTheme(theme) {
    const dark = theme === "dark";
    root.dataset.theme = theme;
    toggle.textContent = dark ? "☀︎" : "☾";
    toggle.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
    toggle.setAttribute("aria-pressed", String(dark));
  }

  setTheme(storedTheme === "dark" || storedTheme === "light" ? storedTheme : "dark");
  toggle.addEventListener("click", function () {
    const theme = root.dataset.theme === "dark" ? "light" : "dark";
    localStorage.setItem("home-theme", theme);
    setTheme(theme);
  });
})();
