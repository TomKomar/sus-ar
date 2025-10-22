// views.js — camera UI + collapse + position/orbit views, separate file

document.addEventListener("DOMContentLoaded", () => {
  (async () => {
    const mv = document.querySelector("model-viewer");
    if (!mv) { console.error("[views] <model-viewer> not found"); return; }
    mv.setAttribute("min-camera-orbit", "auto auto 0m"); // allow tiny radii

    // ---------- minimal CSS for fullscreen/collapsed mode ----------
    const style = document.createElement("style");
    style.textContent = `
      .viewer-full, .viewer-full body { margin:0 !important; }
      .viewer-full .wrap { max-width:none !important; margin:0 !important; padding:0 !important; }
      .viewer-full .wrap > :not(model-viewer):not(.collapse-toggle) { display:none !important; }
      .viewer-full model-viewer { width:100vw !important; height:100vh !important; display:block !important; }
      .viewer-full .ui-panel { display:none !important; }
      .collapse-toggle {
        position: fixed; top: 10px; right: 10px; z-index: 2147483647;
        padding: 8px 12px; border: 1px solid #ddd; border-radius: 10px;
        background: rgba(255,255,255,0.95);
        font: 500 14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
        cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,.12);
      }
    `;
    document.head.appendChild(style);

    // ---------- math / format ----------
    const RAD2DEG = 180 / Math.PI;
    const DEG2RAD = Math.PI / 180;
    const wrapDeg = d => ((d % 360) + 360) % 360;
    const fmtDeg = n => `${wrapDeg(n).toFixed(3)}deg`;
    const fmtM   = n => `${Number(n).toFixed(6)}m`;

    const orbitToString = o =>
      `${fmtDeg(o.theta * RAD2DEG)} ${fmtDeg(o.phi * RAD2DEG)} ${fmtM(o.radius)}`;

    const sphericalOffsetMeters = (theta, phi, r) => {
      const s = Math.sin(phi);
      return { x: r * Math.cos(theta) * s, y: r * Math.cos(phi), z: r * Math.sin(theta) * s };
    };
    const add = (a,b) => ({ x:a.x+b.x, y:a.y+b.y, z:a.z+b.z });
    const sub = (a,b) => ({ x:a.x-b.x, y:a.y-b.y, z:a.z-b.z });

    // ---------- orbit parsing ----------
    const splitOrbit = (str) => {
      const [th, ph, r] = String(str).trim().split(/\s+/);
      if (!th || !ph || !r) throw new Error("orbit must be 'theta phi radius'");
      return { th, ph, r };
    };
    const parseOrbitFlexible = (input) => {
      if (typeof input === "string") return splitOrbit(input);
      if (Array.isArray(input)) return splitOrbit(input.join(" "));
      if (input && typeof input === "object") {
        if ("thetaDeg" in input && "phiDeg" in input && "radiusM" in input) {
          return { th: `${input.thetaDeg}deg`, ph: `${input.phiDeg}deg`, r: `${input.radiusM}m` };
        }
        if ("theta" in input && "phi" in input && "radius" in input) {
          return {
            th: `${(input.theta * RAD2DEG).toFixed(6)}deg`,
            ph: `${(input.phi   * RAD2DEG).toFixed(6)}deg`,
            r:  `${Number(input.radius).toFixed(6)}m`
          };
        }
      }
      throw new Error("Invalid orbit format");
    };

    // ---------- UI panel ----------
    const wrapEl = document.querySelector(".wrap") || document.body;

    const ui = document.createElement("div");
    ui.className = "ui-panel";
    ui.style.margin = "12px 0";
    ui.style.display = "grid";
    ui.style.gridTemplateColumns = "120px 1fr auto";
    ui.style.gap = "8px";
    ui.style.alignItems = "center";
    ui.innerHTML = `
      <div style="grid-column: 1 / -1; font-weight: 600;">Camera</div>

      <label>Orbit</label>
      <input id="orbitInput" style="font-family:monospace; width:100%" />
      <button id="applyOrbitBtn">Apply</button>

      <label>FOV</label>
      <input id="fovInput" style="font-family:monospace; width:100%" />
      <button id="applyFovBtn">Apply</button>

      <label>Target (XYZ)</label>
      <div style="display:flex; gap:6px;">
        <input id="targetX" type="number" step="0.0001" placeholder="x" style="width:100%;">
        <input id="targetY" type="number" step="0.0001" placeholder="y" style="width:100%;">
        <input id="targetZ" type="number" step="0.0001" placeholder="z" style="width:100%;">
      </div>
      <button id="applyTargetBtn">Apply</button>

      <label>Camera (XYZ)</label>
      <div style="display:flex; gap:6px;">
        <input id="camX" type="number" step="0.0001" placeholder="x" style="width:100%;">
        <input id="camY" type="number" step="0.0001" placeholder="y" style="width:100%;">
        <input id="camZ" type="number" step="0.0001" placeholder="z" style="width:100%;">
      </div>
      <button id="applyCameraBtn">Apply</button>

      <div style="grid-column: 1 / -1; display:flex; gap:8px; flex-wrap:wrap;">
        <button id="copyBtn">Copy current as JSON view</button>
        <button id="downloadBtn">Download views.json</button>
        <label style="display:inline-flex; align-items:center; gap:6px;">
          <input type="checkbox" id="instantChk" checked /> Instant apply
        </label>
      </div>

      <div style="grid-column: 1 / -1; margin-top:8px;">
        <label for="viewSelect">Views:</label>
        <select id="viewSelect"></select>
        <button id="goBtn">Go</button>
      </div>
    `;
    wrapEl.insertBefore(ui, wrapEl.children[1]);

    // Collapse / Expand toggle
    const collapseBtn = document.createElement("button");
    collapseBtn.className = "collapse-toggle";
    collapseBtn.textContent = "Collapse";
    (wrapEl || document.body).appendChild(collapseBtn);

    let collapsed = false;
    async function enterCollapsed() {
      document.documentElement.classList.add("viewer-full");
      collapsed = true;
      collapseBtn.textContent = "Expand";
      if (wrapEl.requestFullscreen) { try { await wrapEl.requestFullscreen(); } catch {} }
    }
    async function exitCollapsed() {
      document.documentElement.classList.remove("viewer-full");
      collapsed = false;
      collapseBtn.textContent = "Collapse";
      if (document.fullscreenElement) { try { await document.exitFullscreen(); } catch {} }
    }
    collapseBtn.addEventListener("click", () => (collapsed ? exitCollapsed() : enterCollapsed()));
    document.addEventListener("fullscreenchange", () => {
      if (!document.fullscreenElement && collapsed) exitCollapsed();
    });

    // ---------- refs ----------
    const orbitInput = ui.querySelector("#orbitInput");
    const fovInput   = ui.querySelector("#fovInput");
    const targetX    = ui.querySelector("#targetX");
    const targetY    = ui.querySelector("#targetY");
    const targetZ    = ui.querySelector("#targetZ");
    const camX       = ui.querySelector("#camX");
    const camY       = ui.querySelector("#camY");
    const camZ       = ui.querySelector("#camZ");
    const instantChk = ui.querySelector("#instantChk");
    const viewSelect = ui.querySelector("#viewSelect");
    const goBtn      = ui.querySelector("#goBtn");

    // ---------- live readouts ----------
    const getOrbitObj = () => mv.getCameraOrbit();
    const getTargetObj = () => mv.getCameraTarget();
    const getFovStr = () => mv.fieldOfView || mv.getAttribute("field-of-view") || "auto";

    const currentCameraPosition = () => {
      const o = getOrbitObj(), t = getTargetObj();
      return add(t, sphericalOffsetMeters(o.theta, o.phi, o.radius));
    };

    const setTargetInputs = (t) => {
      targetX.value = Number(t.x).toFixed(6);
      targetY.value = Number(t.y).toFixed(6);
      targetZ.value = Number(t.z).toFixed(6);
    };
    const setCameraInputs = (p) => {
      camX.value = Number(p.x).toFixed(6);
      camY.value = Number(p.y).toFixed(6);
      camZ.value = Number(p.z).toFixed(6);
    };

    function refreshOutputs() {
      const o = getOrbitObj(), t = getTargetObj(), p = currentCameraPosition();
      orbitInput.value = orbitToString(o);
      fovInput.value   = typeof getFovStr() === "string" ? getFovStr() : `${getFovStr()}deg`;
      setTargetInputs(t);
      setCameraInputs(p);
    }

    mv.addEventListener("camera-change", refreshOutputs);
    mv.addEventListener("load", refreshOutputs);
    if (mv.loaded) refreshOutputs();

    // ---- Apply Orbit / FOV ----
    ui.querySelector("#applyOrbitBtn").addEventListener("click", async () => {
      mv.setAttribute("camera-orbit", orbitInput.value.trim());
      if (instantChk.checked) mv.jumpCameraToGoal();
      await mv.updateComplete;
      refreshOutputs();
    });
    ui.querySelector("#applyFovBtn").addEventListener("click", async () => {
      mv.setAttribute("field-of-view", fovInput.value.trim());
      if (instantChk.checked) mv.jumpCameraToGoal();
      await mv.updateComplete;
      refreshOutputs();
    });

    // ---- Apply Target (from inputs) ----
    ui.querySelector("#applyTargetBtn").addEventListener("click", async () => {
      const tx = Number(targetX.value), ty = Number(targetY.value), tz = Number(targetZ.value);
      mv.setAttribute("camera-target", `${fmtM(tx)} ${fmtM(ty)} ${fmtM(tz)}`);
      if (instantChk.checked) mv.jumpCameraToGoal();
      await mv.updateComplete;
      refreshOutputs();
    });

    // ---- Apply Camera (from inputs) ----
    ui.querySelector("#applyCameraBtn").addEventListener("click", async () => {
      const px = Number(camX.value), py = Number(camY.value), pz = Number(camZ.value);
      await mv.updateComplete; // resolve % radius
      const o = getOrbitObj();
      const off = sphericalOffsetMeters(o.theta, o.phi, o.radius);
      const tgt = sub({x: px, y: py, z: pz}, off);
      mv.setAttribute("camera-target", `${fmtM(tgt.x)} ${fmtM(tgt.y)} ${fmtM(tgt.z)}`);
      if (instantChk.checked) mv.jumpCameraToGoal();
      await mv.updateComplete;
      refreshOutputs();
    });

    // ---------- views.json (position + orbit + fov; no target) ----------
    let views = [];
    async function loadViews() {
      try {
        const res = await fetch("views.json", { cache: "no-cache" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!Array.isArray(data.views)) throw new Error("Missing 'views' array");

        views = data.views.map(v => ({
          id: v.id,
          label: v.label || v.id,
          position: Array.isArray(v.position) ? v.position.map(Number) : null,
          orbit: parseOrbitFlexible(v.orbit),
          fov: v.fov ? (typeof v.fov === "string" ? v.fov : `${v.fov}deg`) : undefined
        }));

        viewSelect.innerHTML = "";
        for (const v of views) {
          const opt = document.createElement("option");
          opt.value = v.id;
          opt.textContent = v.label;
          viewSelect.appendChild(opt);
        }
        if (views[0]) viewSelect.value = views[0].id;
      } catch (e) {
        console.error("[views] Failed to load views.json:", e);
        views = [];
      }
    }
    await loadViews();

    // Two-phase apply: set orbit to resolve % → compute target from desired camera pos → apply
    async function applyView(v, instant) {
      const { th, ph, r } = v.orbit;

      mv.setAttribute("camera-orbit", `${th} ${ph} ${r}`);
      if (instant) mv.jumpCameraToGoal();
      await mv.updateComplete;
      await new Promise(rf => requestAnimationFrame(rf));

      const o = mv.getCameraOrbit(); // numeric
      if (v.position && v.position.length === 3) {
        const desired = { x: v.position[0], y: v.position[1], z: v.position[2] };
        const off = sphericalOffsetMeters(o.theta, o.phi, o.radius);
        const tgt = sub(desired, off);
        mv.setAttribute("camera-target", `${fmtM(tgt.x)} ${fmtM(tgt.y)} ${fmtM(tgt.z)}`);
        if (instant) mv.jumpCameraToGoal();
        await mv.updateComplete;
      }
      if (v.fov) {
        mv.setAttribute("field-of-view", v.fov);
        if (instant) mv.jumpCameraToGoal();
        await mv.updateComplete;
      }
      refreshOutputs();
    }

    goBtn.addEventListener("click", async () => {
      const v = views.find(x => x.id === viewSelect.value);
      if (!v) return;
      goBtn.disabled = true;
      try { await applyView(v, instantChk.checked); }
      finally { goBtn.disabled = false; }
    });

    // Copy current as a JSON view
    ui.querySelector("#copyBtn").addEventListener("click", async () => {
      const id = prompt("View id:", "new-view");
      if (!id) return;
      const label = prompt("Label (optional):", id) || id;

      const o = mv.getCameraOrbit();
      const t = mv.getCameraTarget();
      const p = add(t, sphericalOffsetMeters(o.theta, o.phi, o.radius));

      const view = {
        id,
        label,
        position: [Number(p.x.toFixed(6)), Number(p.y.toFixed(6)), Number(p.z.toFixed(6))],
        orbit: orbitToString(o),
        fov: (typeof getFovStr() === "string" ? getFovStr() : `${getFovStr()}deg`)
      };

      const jsonFrag = JSON.stringify(view, null, 2);
      try { await navigator.clipboard.writeText(jsonFrag); alert("Copied view JSON to clipboard."); }
      catch { prompt("Copy this JSON:", jsonFrag); }
    });

    // Download views.json (merge existing + current)
    ui.querySelector("#downloadBtn").addEventListener("click", () => {
      const o = mv.getCameraOrbit();
      const t = mv.getCameraTarget();
      const p = add(t, sphericalOffsetMeters(o.theta, o.phi, o.radius));
      const current = {
        id: "current",
        label: "Current",
        position: [Number(p.x.toFixed(6)), Number(p.y.toFixed(6)), Number(p.z.toFixed(6))],
        orbit: orbitToString(o),
        fov: (typeof getFovStr() === "string" ? getFovStr() : `${getFovStr()}deg`)
      };

      const byId = new Map(views.map(v => [v.id, v]));
      byId.set(current.id, current);

      const payload = {
        schemaVersion: 4,
        coordSpace: "position+orbit",
        units: "meters",
        views: Array.from(byId.values()).map(v => ({
          id: v.id,
          label: v.label || v.id,
          position: v.position,
          orbit: typeof v.orbit === "string" ? v.orbit : `${v.orbit.th} ${v.orbit.ph} ${v.orbit.r}`,
          fov: v.fov
        }))
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), { href: url, download: "views.json" });
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    });

    // Keyboard: ←/→ cycle views; C copy
    window.addEventListener("keydown", async (e) => {
      if (!views.length) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const idx = views.findIndex(v => v.id === viewSelect.value);
        const next = e.key === "ArrowRight" ? (idx + 1) % views.length : (idx - 1 + views.length) % views.length;
        viewSelect.value = views[next].id;
        goBtn.click();
      } else if (e.key.toLowerCase() === "c") {
        ui.querySelector("#copyBtn").click();
      }
    });
  })();
});
