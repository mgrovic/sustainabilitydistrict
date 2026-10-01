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
  const fellowGrid = $("fellowGrid");
  const fellowSearch = $("fellowSearch");
  const fellowStatus = $("fellowStatus");
  const gdsView = $("gdsView");

  const root = document.documentElement;
  $("themeToggle").addEventListener("click", () => {
    root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
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
    memberGrid.innerHTML = filtered.length ? filtered.map((member) => `<article class="member-card"><h2>${esc(member.name)}</h2><p>${esc(member.category)}</p>${member.website ? `<a href="${esc(member.website)}" target="_blank" rel="noopener">Visit website ↗</a>` : ""}</article>`).join("") : `<p class="empty">No members match your search.</p>`;
  }

  function renderFellows() {
    const query = fellowSearch.value.trim().toLowerCase();
    const status = fellowStatus.value;
    const filtered = fellows.filter((fellow) => {
      const matchesQuery = !query || `${fellow.name} ${fellow.business} ${fellow.cohort}`.toLowerCase().includes(query);
      const matchesStatus = status === "all" || fellow.status === status;
      return matchesQuery && matchesStatus;
    });
    fellowGrid.innerHTML = filtered.length ? filtered.map((fellow) => `<article class="member-card"><h2>${esc(fellow.name)}</h2><p>${esc(fellow.business)} · Cohort ${esc(fellow.cohort)}</p>${fellow.website ? `<a href="${esc(fellow.website)}" target="_blank" rel="noopener">Visit website ↗</a>` : ""}</article>`).join("") : `<p class="empty">No fellows match your search.</p>`;
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
    dashboardView.hidden = showingMembers || showingFellows || showingGds;
    membersView.hidden = !showingMembers;
    $("fellowsView").hidden = !showingFellows;
    gdsView.hidden = !showingGds;
    document.title = showingMembers ? "Sustainability District Members" : showingFellows ? "DEI Business Fellows" : showingGds ? "Global Destination Sustainability Index" : "DDC Sustainability District Dashboard";
    if (showingMembers) renderMembers();
    if (showingFellows) renderFellows();
    if (showingGds) renderGdsView();
  }

  $("districtLink").addEventListener("click", (event) => { event.preventDefault(); history.pushState(null, "", "#members"); showView("members"); });
  $("membersLink").addEventListener("click", (event) => { event.preventDefault(); history.pushState(null, "", "#members"); showView("members"); });
  function openFellowsView(event) {
    event.preventDefault();
    history.pushState(null, "", "#fellows");
    showView("fellows");
  }
  $("fellowsLink").addEventListener("click", openFellowsView);
  function openMembersFromPanel(event) {
    if (event.target.closest("a, button, input, select")) return;
    history.pushState(null, "", "#members");
    showView("members");
  }
  $("membersPanel").addEventListener("click", openMembersFromPanel);
  $("membersPanel").addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openMembersFromPanel(event);
    }
  });
  function openFellowsFromPanel(event) {
    if (event.target.closest("a, button, input, select")) return;
    openFellowsView(event);
  }
  $("fellowsPanel").addEventListener("click", openFellowsFromPanel);
  $("fellowsPanel").addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openFellowsFromPanel(event);
    }
  });
  function openGdsView(event) {
    event.preventDefault();
    history.pushState(null, "", "#gds");
    showView("gds");
  }
  function openView(event, view) {
    event.preventDefault();
    history.pushState(null, "", `#${view}`);
    showView(view);
  }
  $("gdsPanel").addEventListener("click", openGdsView);
  $("gdsPanel").addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") openGdsView(event);
  });
  [["gdsStat", "gds"], ["membersStat", "members"], ["fellowsStat", "fellows"]].forEach(([id, view]) => {
    $(id).addEventListener("click", (event) => openView(event, view));
    $(id).addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") openView(event, view);
    });
  });
  $("homeLink").addEventListener("click", (event) => { event.preventDefault(); history.pushState(null, "", "#dashboard"); showView("dashboard"); });
  $("dashboardLink").addEventListener("click", (event) => { event.preventDefault(); history.pushState(null, "", "#dashboard"); showView("dashboard"); });
  $("fellowsDashboardLink").addEventListener("click", (event) => { event.preventDefault(); history.pushState(null, "", "#dashboard"); showView("dashboard"); });
  $("gdsDashboardLink").addEventListener("click", (event) => { event.preventDefault(); history.pushState(null, "", "#dashboard"); showView("dashboard"); });
  memberSearch.addEventListener("input", renderMembers);
  memberCategory.addEventListener("change", renderMembers);
  fellowSearch.addEventListener("input", renderFellows);
  fellowStatus.addEventListener("change", renderFellows);
  window.addEventListener("popstate", () => showView(window.location.hash === "#members" ? "members" : window.location.hash === "#fellows" ? "fellows" : window.location.hash === "#gds" ? "gds" : "dashboard"));
  showView(window.location.hash === "#members" ? "members" : window.location.hash === "#fellows" ? "fellows" : window.location.hash === "#gds" ? "gds" : "dashboard");

  let chart;
  let detailChart;
  function drawChart() {
    if (!window.Chart) return;
    const css = getComputedStyle(root);
    const accent = css.getPropertyValue("--accent").trim();
    const muted = css.getPropertyValue("--muted").trim();
    const border = css.getPropertyValue("--border").trim();
    if (chart) chart.destroy();
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
    return `<div><div class="target-row"><span>${esc(t.label)}</span><span>${fmt(t.current)} / ${fmt(t.target)}</span></div><div class="bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><div style="width:${pct}%"></div></div></div>`;
  }).join("") || `<p class="empty">No targets set yet. Add them in data.js.</p>`;

  [["membersLink", D.membersLink], ["fellowsLink", D.fellowsLink]].forEach(([id, url]) => {
    if (url) $(id).href = url; else $(id).hidden = true;
  });

  const state = {
    members: { items: members, filter: "all", i: 0, filters: [["all", "All"]], slide: "memberSlide", chips: "memberFilters", match: () => true, render: (m) => `<div class="name">${esc(m.name)}</div><div class="meta">${esc(m.category)}</div>${m.website ? `<a href="${esc(m.website)}" target="_blank" rel="noopener">Visit website</a>` : ""}`, empty: "No members found in this category" },
    fellows: { items: fellows, filter: "all", i: 0, filters: [["all", "All"], ["current", "Current"], ["alumni", "Alumni"]], slide: "fellowSlide", chips: "fellowFilters", match: (f, key) => key === "all" || f.status === key, render: (f) => `<div class="name">${esc(f.name)}</div><div class="meta">${esc(f.business)}</div><div class="meta">Cohort ${esc(f.cohort)}</div>${f.website ? `<a href="${esc(f.website)}" target="_blank" rel="noopener">Visit website</a>` : ""}`, empty: "No fellows found in this category" }
  };

  function update(key) {
    const s = state[key];
    const list = s.items.filter((x) => s.match(x, s.filter));
    s.i = Math.max(0, Math.min(s.i, list.length - 1));
    $(s.chips).innerHTML = s.filters.map(([k, label]) => {
      const n = s.items.filter((x) => s.match(x, k)).length;
      return `<button class="chip ${k === s.filter ? "active" : ""}" data-key="${key}" data-filter="${k}">${label} (${n})</button>`;
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
})();