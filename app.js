(function () {
  const D = window.DASHBOARD_DATA || {};
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => Number(n || 0).toLocaleString("en-US");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const members = D.members || [];
  const fellows = D.fellows || [];
  const events = D.events || [];
  const gds = D.gdsIndex || [];
  const dashboardView = $("dashboardView");
  const membersView = $("membersView");
  const memberGrid = $("memberGrid");
  const memberSearch = $("memberSearch");
  const memberCategory = $("memberCategory");
  const memberResults = $("memberResults");
  const fellowGrid = $("fellowGrid");
  const fellowSearch = $("fellowSearch");
  const fellowStatus = $("fellowStatus");
  const fellowResults = $("fellowResults");
  const eventsList = $("eventsList");
  const eventsSummary = $("eventsSummary");
  const eventsView = $("eventsView");
  const gdsView = $("gdsView");
  let chart;
  let detailChart;

  const root = document.documentElement;
  $("themeToggle").addEventListener("click", (event) => {
    root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
    const dark = root.dataset.theme === "dark";
    event.currentTarget.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
    event.currentTarget.setAttribute("aria-pressed", String(!dark));
    drawChart();
  });

  const aboutParagraphs = D.about?.paragraphs || [];
  $("aboutText").innerHTML = aboutParagraphs.map((paragraph) => `<span>${esc(paragraph)}</span>`).join("") + (D.about?.contactEmail ? `<span>Want to learn more? Contact us at <a href="mailto:${esc(D.about.contactEmail)}">${esc(D.about.contactEmail)}</a>.</span>` : "");
  $("statGds").textContent = gds.length ? gds[gds.length - 1].score : 0;
  $("statMembers").textContent = fmt(members.length);
  $("statCarbon").textContent = fmt(events.reduce((sum, e) => sum + Number(e.kgCO2e || 0), 0));
  $("statFellows").textContent = fmt(fellows.length);

  const categories = [...new Set(members.map((member) => member.category).filter(Boolean))].sort();
  memberCategory.insertAdjacentHTML("beforeend", categories.map((category) => `<option value="${esc(category)}">${esc(category)}</option>`).join(""));

  function renderMembers() {
    const query = memberSearch.value.trim().toLowerCase();
    const category = memberCategory.value;
    const filtered = members.filter((member) => {
      const matchesQuery = !query || `${member.name} ${member.category}`.toLowerCase().includes(query);
      const matchesCategory = category === "all" || member.category === category;
      return matchesQuery && matchesCategory;
    });
    memberResults.textContent = `${filtered.length} member${filtered.length === 1 ? "" : "s"} shown`;
    memberGrid.innerHTML = filtered.length ? filtered.map((member) => `<article class="member-card"><h2>${esc(member.name)}</h2><p>${esc(member.category)}</p>${member.website ? `<a href="${esc(member.website)}" target="_blank" rel="noopener" aria-label="Visit ${esc(member.name)} website (opens in a new tab)">Visit website ↗</a>` : ""}</article>`).join("") : `<p class="empty">No members match your search.</p>`;
  }

  function renderFellows() {
    const query = fellowSearch.value.trim().toLowerCase();
    const cohort = fellowStatus.value;
    const filtered = fellows.filter((fellow) => {
      const matchesQuery = !query || `${fellow.name} ${fellow.business} ${fellow.cohort}`.toLowerCase().includes(query);
      const matchesCohort = cohort === "all" || fellow.cohort === cohort;
      return matchesQuery && matchesCohort;
    });
    fellowResults.textContent = `${filtered.length} fellow${filtered.length === 1 ? "" : "s"} shown`;
    fellowGrid.innerHTML = filtered.length ? filtered.map((fellow) => `<article class="member-card"><h2>${esc(fellow.name)}</h2><p>${esc(fellow.business)} · Cohort ${esc(fellow.cohort)}</p>${fellow.website ? `<a href="${esc(fellow.website)}" target="_blank" rel="noopener" aria-label="Visit ${esc(fellow.name)} website (opens in a new tab)">Visit website ↗</a>` : ""}</article>`).join("") : `<p class="empty">No fellows match your search.</p>`;
  }

  function renderEvents() {
    eventsSummary.textContent = `${events.length} event${events.length === 1 ? "" : "s"} tracked. Total recorded emissions: ${fmt(events.reduce((sum, event) => sum + Number(event.kgCO2e || 0), 0))} kgCO₂e.`;
    eventsList.innerHTML = events.length ? events.map((event) => `<li><span>${esc(event.name)}</span><strong>${fmt(event.kgCO2e)} kgCO₂e</strong></li>`).join("") : "<li>No events tracked yet.</li>";
  }

  function renderGdsView() {
    const first = gds[0];
    const current = gds[gds.length - 1];
    const change = current && first ? current.score - first.score : 0;
    $("gdsCurrentYear").textContent = current?.year || "";
    $("gdsCurrentScore").textContent = `${current?.score ?? 0}%`;
    $("gdsStartYear").textContent = first?.year || "";
    $("gdsChange").textContent = `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`;
    $("gdsRegionalRank").textContent = `${D.regionalRanking?.rank || "-"}th`;
    $("gdsCutoff").textContent = `${D.regionalRanking?.top40Cutoff ?? "-"}%`;
    const gdsTable = $("gdsTable");
    gdsTable.innerHTML = gds.length ? `<table><caption>GDS-Index score by year</caption><thead><tr><th scope="col">Year</th><th scope="col">Score</th></tr></thead><tbody>${gds.map((point) => `<tr><th scope="row">${esc(point.year)}</th><td>${esc(point.score)}%</td></tr>`).join("")}</tbody></table>` : `<p class="empty">No score data available.</p>`;
    const progressLists = {
      environmentalMetrics: D.sustainabilityProgress?.environmental,
      socialMetrics: D.sustainabilityProgress?.social,
      supplierMetrics: D.sustainabilityProgress?.supplier,
      destinationMetrics: D.sustainabilityProgress?.destinationManagement
    };
    Object.entries(progressLists).forEach(([id, metrics]) => {
      $(id).replaceChildren(...(metrics || []).map((metric) => {
        const item = document.createElement("li");
        item.textContent = metric;
        return item;
      }));
    });
    if (!window.Chart) return;
    const css = getComputedStyle(root);
    const accent = css.getPropertyValue("--accent").trim();
    const muted = css.getPropertyValue("--muted").trim();
    const border = css.getPropertyValue("--border").trim();
    if (detailChart) detailChart.destroy();
    $("gdsDetailChart").setAttribute("role", "img");
    $("gdsDetailChart").setAttribute("aria-label", gds.length ? `Line chart showing GDS-Index scores from ${gds[0].year} to ${gds[gds.length - 1].year}` : "No GDS-Index score data available");
    detailChart = new Chart($("gdsDetailChart"), {
      type: "line",
      data: { labels: gds.map((point) => point.year), datasets: [{ label: "GDS-Index score", data: gds.map((point) => point.score), borderColor: accent, backgroundColor: accent, tension: 0.3, pointRadius: 4 }] },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { min: 20, max: 70, ticks: { color: muted }, grid: { color: border } }, x: { ticks: { color: muted }, grid: { display: false } } } }
    });
  }

  function showView(view) {
    const showingMembers = view === "members";
    const showingFellows = view === "fellows";
    const showingGds = view === "gds";
    const showingEvents = view === "events";
    dashboardView.hidden = showingMembers || showingFellows || showingGds || showingEvents;
    membersView.hidden = !showingMembers;
    $("fellowsView").hidden = !showingFellows;
    gdsView.hidden = !showingGds;
    eventsView.hidden = !showingEvents;
    document.title = showingMembers ? "Sustainability District Members" : showingFellows ? "DEI Business Fellows" : showingGds ? "Global Destination Sustainability Index" : showingEvents ? "Net Zero Carbon Events" : "DDC Sustainability District Dashboard";
    if (showingMembers) renderMembers();
    if (showingFellows) renderFellows();
    if (showingGds) renderGdsView();
    if (showingEvents) renderEvents();
    if (showingMembers) $("members-view-title").focus();
    if (showingFellows) $("fellows-view-title").focus();
    if (showingGds) $("gds-view-title").focus();
    if (showingEvents) $("events-view-title").focus();
  }

  $("districtLink").addEventListener("click", (event) => { event.preventDefault(); history.pushState(null, "", "#members"); showView("members"); });
  $("membersLink").addEventListener("click", (event) => { event.preventDefault(); history.pushState(null, "", "#members"); showView("members"); });
  function openFellowsView(event) {
    event.preventDefault();
    history.pushState(null, "", "#fellows");
    showView("fellows");
  }
  $("fellowsLink").addEventListener("click", openFellowsView);
  function openGdsView(event) {
    event.preventDefault();
    history.pushState(null, "", "#gds");
    showView("gds");
  }
  function openEventsView(event) {
    event.preventDefault();
    history.pushState(null, "", "#events");
    showView("events");
  }
  function openView(event, view) {
    event.preventDefault();
    history.pushState(null, "", `#${view}`);
    showView(view);
  }
  $("gdsPanel").addEventListener("click", openGdsView);
  [["gdsStat", "gds"], ["membersStat", "members"], ["eventsStat", "events"], ["fellowsStat", "fellows"]].forEach(([id, view]) => $(id).addEventListener("click", (event) => openView(event, view)));
  $("homeLink").addEventListener("click", (event) => { event.preventDefault(); history.pushState(null, "", "#dashboard"); showView("dashboard"); });
  $("dashboardLink").addEventListener("click", (event) => { event.preventDefault(); history.pushState(null, "", "#dashboard"); showView("dashboard"); });
  $("fellowsDashboardLink").addEventListener("click", (event) => { event.preventDefault(); history.pushState(null, "", "#dashboard"); showView("dashboard"); });
  $("gdsDashboardLink").addEventListener("click", (event) => { event.preventDefault(); history.pushState(null, "", "#dashboard"); showView("dashboard"); });
  $("eventsDashboardLink").addEventListener("click", (event) => { event.preventDefault(); history.pushState(null, "", "#dashboard"); showView("dashboard"); });
  memberSearch.addEventListener("input", renderMembers);
  memberCategory.addEventListener("change", renderMembers);
  fellowSearch.addEventListener("input", renderFellows);
  fellowStatus.addEventListener("change", renderFellows);
  const viewFromHash = () => window.location.hash === "#members" ? "members" : window.location.hash === "#fellows" ? "fellows" : window.location.hash === "#gds" ? "gds" : window.location.hash === "#events" ? "events" : "dashboard";
  window.addEventListener("popstate", () => showView(viewFromHash()));
  showView(viewFromHash());

  function drawChart() {
    if (!window.Chart) return;
    const css = getComputedStyle(root);
    const accent = css.getPropertyValue("--accent").trim();
    const muted = css.getPropertyValue("--muted").trim();
    const border = css.getPropertyValue("--border").trim();
    if (chart) chart.destroy();
    $("gdsChart").setAttribute("role", "img");
    $("gdsChart").setAttribute("aria-label", gds.length ? `Line chart showing GDS-Index scores from ${gds[0].year} to ${gds[gds.length - 1].year}` : "No GDS-Index score data available");
    chart = new Chart($("gdsChart"), {
      type: "line",
      data: { labels: gds.map((g) => g.year), datasets: [{ label: "GDS-Index score", data: gds.map((g) => g.score), borderColor: accent, backgroundColor: accent, tension: 0.3, pointRadius: 4 }] },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { min: 20, max: 70, ticks: { color: muted }, grid: { color: border } }, x: { ticks: { color: muted }, grid: { display: false } } } }
    });
  }
  drawChart();

  $("targetsTitle").textContent = D.growthTargetsTitle || "Growth Targets";
  $("targets").innerHTML = (D.growthTargets || []).map((t) => {
    const pct = t.target ? Math.min(100, Math.round((t.current / t.target) * 100)) : 0;
    const labelId = `target-label-${t.label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
    return `<div><div class="target-row"><span id="${labelId}">${esc(t.label)}</span><span>${fmt(t.current)} / ${fmt(t.target)}</span></div><div class="bar" role="progressbar" aria-labelledby="${labelId}" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-valuetext="${pct}% complete, ${fmt(t.current)} of ${fmt(t.target)}"><div style="width:${pct}%"></div></div></div>`;
  }).join("") || `<p class="empty">No targets set yet. Add them in data.js.</p>`;

  [["membersLink", D.membersLink], ["fellowsLink", D.fellowsLink]].forEach(([id, url]) => {
    if (url) $(id).href = url; else $(id).hidden = true;
  });

  const state = {
    members: { items: members, filter: "all", i: 0, filters: [["all", "All"]], slide: "memberSlide", chips: "memberFilters", match: () => true, render: (m) => `<div class="name">${esc(m.name)}</div><div class="meta">${esc(m.category)}</div>${m.website ? `<a href="${esc(m.website)}" target="_blank" rel="noopener">Visit website</a>` : ""}`, empty: "No members found in this category" },
    fellows: { items: fellows, filter: "all", i: 0, filters: [["all", "All"], ["2026", "2026 Cohort"]], slide: "fellowSlide", chips: "fellowFilters", match: (f, key) => key === "all" || f.cohort === key, render: (f) => `<div class="name">${esc(f.name)}</div><div class="meta">${esc(f.business)}</div><div class="meta">Cohort ${esc(f.cohort)}</div>${f.website ? `<a href="${esc(f.website)}" target="_blank" rel="noopener">Visit website</a>` : ""}`, empty: "No fellows found in this category" }
  };

  function update(key) {
    const s = state[key];
    const list = s.items.filter((x) => s.match(x, s.filter));
    s.i = Math.max(0, Math.min(s.i, list.length - 1));
    $(s.chips).innerHTML = s.filters.map(([k, label]) => {
      const n = s.items.filter((x) => s.match(x, k)).length;
      return `<button class="chip ${k === s.filter ? "active" : ""}" type="button" aria-pressed="${k === s.filter}" data-key="${key}" data-filter="${k}">${label} (${n})</button>`;
    }).join("");
    $(s.slide).innerHTML = list.length ? s.render(list[s.i]) + `<div class="count">${s.i + 1} of ${list.length}</div>` : `<p class="empty">${s.empty}</p>`;
    document.querySelectorAll(`.nav[data-target="${key}"]`).forEach((b) => { b.disabled = list.length < 2; });
    s.length = list.length;
  }

  document.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (chip) { const s = state[chip.dataset.key]; s.filter = chip.dataset.filter; s.i = 0; update(chip.dataset.key); return; }
    const nav = e.target.closest(".nav");
    if (nav) { const s = state[nav.dataset.target]; if (!s.length) return; s.i = (s.i + Number(nav.dataset.dir) + s.length) % s.length; update(nav.dataset.target); }
  });

  update("members");
  update("fellows");

  renderEvents();
})();