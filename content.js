// SpeedGrader Student Search
// Injects a search box into Canvas SpeedGrader. Type a name, hit Enter, jump to that student.
// Shortcut: Ctrl+Shift+F (Cmd+Shift+F on Mac) or press "/" when not typing elsewhere.

(function () {
  "use strict";

  // ---- Parse course / assignment from the URL --------------------------------
  const pathMatch = location.pathname.match(/\/courses\/(\d+)\/gradebook\/speed_grader/);
  if (!pathMatch) return;
  const courseId = pathMatch[1];
  const params = new URLSearchParams(location.search);
  const assignmentId = params.get("assignment_id");
  if (!assignmentId) return;

  let students = [];        // [{ id, name, graded }]
  let loaded = false;
  let loadError = null;
  let activeIndex = -1;

  // ---- Canvas API helpers ----------------------------------------------------
  async function fetchAllPages(url) {
    const results = [];
    let next = url;
    while (next) {
      const res = await fetch(next, {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Canvas API returned " + res.status);
      let text = await res.text();
      // Canvas sometimes prefixes JSON with "while(1);"
      text = text.replace(/^while\(1\);/, "");
      results.push(...JSON.parse(text));
      const link = res.headers.get("Link") || "";
      const m = link.match(/<([^>]+)>;\s*rel="next"/);
      next = m ? m[1] : null;
    }
    return results;
  }

  async function loadStudents() {
    try {
      // Names + IDs of everyone gradeable on this assignment
      const roster = await fetchAllPages(
        `/api/v1/courses/${courseId}/assignments/${assignmentId}/gradeable_students?per_page=100`
      );

      // Graded status (best effort — ignore failure, e.g. for TAs without permission)
      const gradedIds = new Set();
      try {
        const subs = await fetchAllPages(
          `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions?per_page=100`
        );
        for (const s of subs) {
          if (s.workflow_state === "graded" || s.grade != null) gradedIds.add(String(s.user_id));
        }
      } catch (_) { /* graded badges just won't show */ }

      students = roster
        .map((s) => ({
          id: String(s.id),
          name: s.display_name || s.sortable_name || "(no name)",
          graded: gradedIds.has(String(s.id)),
        }))
        .filter((s) => s.name !== "Test Student")
        .sort((a, b) => a.name.localeCompare(b.name));
      loaded = true;
    } catch (err) {
      loadError = err.message;
      // Fallback: scrape the student dropdown links if they exist in the DOM
      const links = document.querySelectorAll('a[data-testid^="student-option-"]');
      if (links.length) {
        students = Array.from(links).map((a) => {
          const u = new URLSearchParams(a.getAttribute("href").split("?")[1] || "");
          return {
            id: u.get("student_id"),
            name: (a.textContent || "").trim(),
            graded: !!a.parentElement.querySelector('[data-testid="graded-icon"]'),
          };
        }).filter((s) => s.id && s.name && s.name !== "Test Student");
        loaded = students.length > 0;
        if (loaded) loadError = null;
      }
    }
    render();
  }

  // ---- Navigation ------------------------------------------------------------
  function goToStudent(id) {
    const url = new URL(location.href);
    url.searchParams.set("student_id", id);
    url.searchParams.delete("anonymous_id"); // Canvas re-resolves this itself
    location.href = url.toString();
  }

  // ---- UI --------------------------------------------------------------------
  const box = document.createElement("div");
  box.id = "sgs-box";
  box.innerHTML = `
    <div id="sgs-header">
      <span id="sgs-title">Find student</span>
      <label id="sgs-ungraded-wrap"><input type="checkbox" id="sgs-ungraded"> ungraded only</label>
      <button id="sgs-close" title="Hide (Ctrl+Shift+F to reopen)">×</button>
    </div>
    <input id="sgs-input" type="text" placeholder="Type a name…" autocomplete="off" spellcheck="false">
    <ul id="sgs-results"></ul>
    <div id="sgs-status"></div>
  `;
  document.body.appendChild(box);

  const input = box.querySelector("#sgs-input");
  const list = box.querySelector("#sgs-results");
  const status = box.querySelector("#sgs-status");
  const ungradedOnly = box.querySelector("#sgs-ungraded");

  function currentMatches() {
    const q = input.value.trim().toLowerCase();
    let pool = students;
    if (ungradedOnly.checked) pool = pool.filter((s) => !s.graded);
    if (!q) return pool.slice(0, 12);
    const words = q.split(/\s+/);
    return pool
      .filter((s) => {
        const n = s.name.toLowerCase();
        return words.every((w) => n.includes(w));
      })
      .slice(0, 12);
  }

  function render() {
    if (!loaded && !loadError) {
      status.textContent = "Loading students…";
      list.innerHTML = "";
      return;
    }
    if (!loaded && loadError) {
      status.textContent = "Couldn't load list (" + loadError + "). Open the student dropdown once, then reopen this box.";
      list.innerHTML = "";
      return;
    }
    const matches = currentMatches();
    const total = ungradedOnly.checked ? students.filter((s) => !s.graded).length : students.length;
    status.textContent = matches.length
      ? matches.length + " shown · " + total + " total"
      : "No match";
    if (activeIndex >= matches.length) activeIndex = matches.length - 1;
    if (activeIndex < 0 && matches.length) activeIndex = 0;

    list.innerHTML = "";
    matches.forEach((s, i) => {
      const li = document.createElement("li");
      li.className = i === activeIndex ? "sgs-active" : "";
      li.innerHTML =
        `<span class="sgs-name"></span>` +
        (s.graded ? `<span class="sgs-check" title="Graded">✓</span>` : "");
      li.querySelector(".sgs-name").textContent = s.name;
      li.addEventListener("mousedown", (e) => { e.preventDefault(); goToStudent(s.id); });
      li.addEventListener("mousemove", () => { activeIndex = i; highlight(); });
      list.appendChild(li);
    });
  }

  function highlight() {
    Array.from(list.children).forEach((li, i) =>
      li.classList.toggle("sgs-active", i === activeIndex)
    );
  }

  input.addEventListener("input", () => { activeIndex = 0; render(); });
  ungradedOnly.addEventListener("change", () => { activeIndex = 0; render(); });

  input.addEventListener("keydown", (e) => {
    const matches = currentMatches();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, matches.length - 1);
      highlight();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      highlight();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (matches[activeIndex]) goToStudent(matches[activeIndex].id);
    } else if (e.key === "Escape") {
      toggle(false);
    }
  });

  box.querySelector("#sgs-close").addEventListener("click", () => toggle(false));

  function toggle(show) {
    const visible = show !== undefined ? show : box.style.display === "none";
    box.style.display = visible ? "block" : "none";
    if (visible) { input.focus(); input.select(); render(); }
  }

  document.addEventListener("keydown", (e) => {
    const tag = (document.activeElement && document.activeElement.tagName) || "";
    const typing = tag === "INPUT" || tag === "TEXTAREA" ||
      (document.activeElement && document.activeElement.isContentEditable);
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "f") {
      e.preventDefault();
      toggle();
    } else if (e.key === "/" && !typing) {
      e.preventDefault();
      toggle(true);
    }
  });

  loadStudents();
  render();
  input.focus();
})();
