document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "http://127.0.0.1:8000";

  // Mobile Navigation Menu Toggle
  const mobileMenuToggle = document.getElementById("mobile-menu-toggle");
  const navMenu = document.getElementById("nav-menu");
  const headerNav = document.getElementById("header-nav");

  if (mobileMenuToggle && navMenu && headerNav) {
    mobileMenuToggle.addEventListener("click", () => {
      navMenu.classList.toggle("open");
      headerNav.classList.toggle("menu-active");
    });

    // Close mobile menu when clicking nav links
    const navLinks = navMenu.querySelectorAll(".nav-link");
    navLinks.forEach(link => {
      link.addEventListener("click", () => {
        navMenu.classList.remove("open");
        headerNav.classList.remove("menu-active");
      });
    });
  }

  // FAQ Accordion Toggle Logic
  const faqItems = document.querySelectorAll(".faq-item");
  faqItems.forEach(item => {
    const trigger = item.querySelector(".faq-trigger");
    const answer = item.querySelector(".faq-answer");

    if (trigger && answer) {
      trigger.addEventListener("click", () => {
        const isExpanded = trigger.getAttribute("aria-expanded") === "true";
        
        // Close all other items first
        faqItems.forEach(otherItem => {
          if (otherItem !== item) {
            otherItem.classList.remove("active");
            const otherTrigger = otherItem.querySelector(".faq-trigger");
            const otherAnswer = otherItem.querySelector(".faq-answer");
            if (otherTrigger && otherAnswer) {
              otherTrigger.setAttribute("aria-expanded", "false");
              otherAnswer.style.maxHeight = null;
              otherAnswer.setAttribute("hidden", "");
            }
          }
        });

        // Toggle current item
        if (isExpanded) {
          trigger.setAttribute("aria-expanded", "false");
          answer.style.maxHeight = null;
          item.classList.remove("active");
          setTimeout(() => {
            answer.setAttribute("hidden", "");
          }, 200); // Wait for transition before hiding
        } else {
          answer.removeAttribute("hidden");
          trigger.setAttribute("aria-expanded", "true");
          item.classList.add("active");
          // Calculate height
          answer.style.maxHeight = answer.scrollHeight + "px";
        }
      });
    }
  });

  // Full-screen sandbox workspace
  const sandboxOverlay = document.getElementById("sandbox-app-overlay");
  const sandboxCloseButton = document.getElementById("sandbox-close-button");
  const sandboxAskForm = document.getElementById("sandbox-ask-form");
  const sandboxAskInput = document.getElementById("sandbox-ask-input");
  const sandboxThreadSelect = document.getElementById("sandbox-thread-select");
  const sandboxSelectedContext = document.getElementById("sandbox-selected-context");
  const sandboxSearchInput = document.getElementById("sandbox-global-search");
  const sandboxRecentGrid = document.getElementById("sandbox-recent-grid");
  const sandboxThreadList = document.getElementById("sandbox-thread-list");
  const sandboxStats = document.getElementById("sandbox-sidebar-stats");
  const sandboxResponse = document.getElementById("sandbox-response-strip");
  const sandboxResponseText = document.getElementById("sandbox-response-text");
  const sandboxResponseCitations = document.getElementById("sandbox-response-citations");
  const graphToggle = document.getElementById("sandbox-graph-toggle");
  const graphDrawer = document.getElementById("sandbox-graph-drawer");
  const graphClose = document.getElementById("sandbox-graph-close");
  const graphList = document.getElementById("sandbox-graph-list");
  const networkCanvas = document.getElementById("sandbox-network-canvas");

  let cachedGraph = null;
  let selectedThreadId = "";
  let networkNodes = [];
  let networkLinks = [];
  let networkAnimationFrame = null;
  let networkCtx = networkCanvas ? networkCanvas.getContext("2d") : null;
  let networkDragNode = null;
  let networkDragged = false;
  let networkPointer = { x: 0, y: 0, tx: 0, ty: 0, active: false };
  let networkRotation = { x: 0, y: 0, z: 0 };

  function formatThreadTitle(title) {
    return title.replace(/[_-]/g, " ").replace(/\b\w/g, char => char.toUpperCase());
  }

  function openSandboxApp() {
    if (!sandboxOverlay) return;
    sandboxOverlay.classList.add("open");
    sandboxOverlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("sandbox-app-open");
    window.history.replaceState(null, "", "#sandbox");
    hydrateSandboxWorkspace();
    startSandboxNetwork();
    window.setTimeout(() => {
      if (sandboxAskInput) sandboxAskInput.focus({ preventScroll: true });
    }, 260);
  }

  function closeSandboxApp() {
    if (!sandboxOverlay) return;
    sandboxOverlay.classList.remove("open");
    sandboxOverlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("sandbox-app-open");
    if (graphDrawer) graphDrawer.classList.remove("open");
    stopSandboxNetwork();
  }

  async function fetchVaultGraph() {
    if (cachedGraph) return cachedGraph;
    const response = await fetch(`${API_BASE}/api/v1/vault/graph`);
    if (!response.ok) throw new Error("Vault graph offline");
    cachedGraph = await response.json();
    return cachedGraph;
  }

  async function hydrateSandboxWorkspace() {
    try {
      const graph = await fetchVaultGraph();
      const statsResponse = await fetch(`${API_BASE}/api/v1/vault/stats`);
      const stats = statsResponse.ok ? await statsResponse.json() : null;
      const threads = graph.nodes.filter(node => node.kind === "thread").slice(-8).reverse();
      const events = graph.nodes.filter(node => node.kind === "event");
      const entities = graph.nodes.filter(node => node.kind === "entity");

      if (sandboxStats) {
        sandboxStats.innerHTML = `
          <div><strong>${stats?.threads ?? threads.length}</strong><span>threads</span></div>
          <div><strong>${events.length}</strong><span>events</span></div>
          <div><strong>${stats?.concepts ?? entities.length}</strong><span>concepts</span></div>
        `;
      }

      renderThreadList(threads);
      renderRecentCards(threads);
      renderGraphList(threads, entities);
      renderThreadSelect(threads);
      initSandboxNetwork(graph);
    } catch (err) {
      if (sandboxResponse && sandboxResponseText) {
        sandboxResponse.classList.remove("hidden");
        sandboxResponseText.textContent = "The sandbox interface is ready, but the backend graph endpoint is not responding yet.";
      }
    }
  }

  function renderThreadList(threads) {
    if (!sandboxThreadList || !threads.length) return;
    sandboxThreadList.innerHTML = threads.slice(0, 6).map((thread, index) => `
      <button class="sandbox-thread-item ${index === 0 ? "active" : ""}" type="button" data-thread-title="${thread.id}">
        <span>${formatThreadTitle(thread.label || thread.id)}</span>
        <small>vault</small>
      </button>
    `).join("");
  }

  function renderThreadSelect(threads) {
    if (!sandboxThreadSelect) return;
    const currentValue = selectedThreadId || sandboxThreadSelect.value;
    sandboxThreadSelect.innerHTML = `<option value="">Auto select</option>` + threads.map(thread => `
      <option value="${thread.id}">${formatThreadTitle(thread.label || thread.id)}</option>
    `).join("");
    sandboxThreadSelect.value = currentValue;
  }

  function renderRecentCards(threads) {
    if (!sandboxRecentGrid || !threads.length) return;
    sandboxRecentGrid.innerHTML = threads.slice(0, 3).map(thread => `
      <article class="sandbox-thread-card" data-thread-title="${thread.id}">
        <h3>${formatThreadTitle(thread.label || thread.id)}</h3>
        <p>${thread.desc || "Captured thread from the local Obsidian vault."}</p>
        <div><span>thread</span><small>vault</small></div>
      </article>
    `).join("");
  }

  function renderGraphList(threads, entities) {
    if (!graphList) return;
    const items = [
      ...threads.slice(0, 3).map(thread => `Thread: ${formatThreadTitle(thread.label || thread.id)}`),
      ...entities.slice(0, 4).map(entity => `Concept: ${entity.label}`)
    ];
    graphList.innerHTML = items.map(item => `<div>${item}</div>`).join("");
  }

  async function runSandboxQuery(query) {
    if (!query.trim() || !sandboxResponse || !sandboxResponseText || !sandboxResponseCitations) return;
    sandboxResponse.classList.remove("hidden");
    sandboxResponseText.textContent = "Searching your vault...";
    sandboxResponseCitations.innerHTML = "";

    try {
      const response = await fetch(`${API_BASE}/api/v1/vault/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, thread_id: selectedThreadId || null, limit: 5 })
      });
      if (!response.ok) throw new Error("Vault ask offline");
      const result = await response.json();
      const matches = result.matches || [];

      if (!matches.length) {
        sandboxResponseText.textContent = result.answer || "No matching vault thread found yet. Capture related context first, then ask again.";
        return;
      }

      sandboxResponseText.textContent = result.answer;
      sandboxResponseCitations.innerHTML = (result.citations || matches.map(match => match.title)).slice(0, 6).map(citation => `<span>#${citation}</span>`).join("");
      if (result.selected_thread) selectSandboxThread(result.selected_thread);
      renderSearchCards(matches);
    } catch (err) {
      sandboxResponseText.textContent = "The local backend is not responding. Start the FastAPI server on port 8000 and try again.";
    }
  }

  function renderSearchCards(matches) {
    if (!sandboxRecentGrid) return;
    sandboxRecentGrid.innerHTML = matches.slice(0, 3).map(match => `
      <article class="sandbox-thread-card" data-thread-title="${match.title}">
        <h3>${formatThreadTitle(match.title)}</h3>
        <p>${match.preview}</p>
        <div><span>${match.folder}</span><small>score ${match.relevance_score}</small></div>
      </article>
    `).join("");
  }

  function selectSandboxThread(threadId) {
    selectedThreadId = threadId || "";
    if (sandboxThreadSelect) sandboxThreadSelect.value = selectedThreadId;

    document.querySelectorAll(".sandbox-thread-item").forEach(item => {
      item.classList.toggle("active", item.dataset.threadTitle === selectedThreadId);
    });
    document.querySelectorAll(".sandbox-thread-card").forEach(card => {
      card.classList.toggle("active", card.dataset.threadTitle === selectedThreadId);
    });

    const selectedNode = networkNodes.find(node => node.id === selectedThreadId);
    if (sandboxSelectedContext) {
      sandboxSelectedContext.textContent = selectedNode
        ? `Grounded on ${formatThreadTitle(selectedNode.label || selectedNode.id)}`
        : "No thread selected · click any graph node";
    }
    if (sandboxAskInput) {
      sandboxAskInput.placeholder = selectedNode
        ? `Ask about ${formatThreadTitle(selectedNode.label || selectedNode.id)}...`
        : "Ask conthExT anything about your work...";
    }
  }

  function initSandboxNetwork(graph) {
    if (!networkCanvas || !networkCtx || !graph?.nodes?.length) return;
    const rect = networkCanvas.getBoundingClientRect();
    const width = Math.max(320, rect.width);
    const height = Math.max(320, rect.height);
    const threads = graph.nodes.filter(node => node.kind === "thread").slice(-14);
    const eventIds = new Set(graph.links.filter(link => threads.some(thread => thread.id === link.source)).map(link => link.target));
    const events = graph.nodes.filter(node => eventIds.has(node.id)).slice(0, 42);
    const entityIds = new Set(graph.links.filter(link => eventIds.has(link.source)).map(link => link.target));
    const entities = graph.nodes.filter(node => entityIds.has(node.id)).slice(0, 38);
    const selectedIds = new Set([...threads, ...events, ...entities].map(node => node.id));

    networkNodes = [...threads, ...events, ...entities].map((node, index, all) => {
      const angle = (Math.PI * 2 * index) / Math.max(1, all.length);
      const radius = node.kind === "thread" ? Math.min(width, height) * 0.23 : Math.min(width, height) * (0.22 + Math.random() * 0.34);
      return {
        ...node,
        x: width / 2 + Math.cos(angle) * radius + (Math.random() - 0.5) * 90,
        y: height / 2 + Math.sin(angle) * radius + (Math.random() - 0.5) * 90,
        z: (Math.random() - 0.5) * 260,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        vz: (Math.random() - 0.5) * 0.16,
        phase: Math.random() * Math.PI * 2,
        pinned: false
      };
    });
    networkLinks = graph.links.filter(link => selectedIds.has(link.source) && selectedIds.has(link.target));
  }

  function resizeNetworkCanvas() {
    if (!networkCanvas || !networkCtx) return;
    const rect = networkCanvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    networkCanvas.width = Math.floor(rect.width * dpr);
    networkCanvas.height = Math.floor(rect.height * dpr);
    networkCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function startSandboxNetwork() {
    if (!networkCanvas || !networkCtx) return;
    resizeNetworkCanvas();
    if (!networkAnimationFrame) drawSandboxNetwork();
  }

  function stopSandboxNetwork() {
    if (networkAnimationFrame) cancelAnimationFrame(networkAnimationFrame);
    networkAnimationFrame = null;
  }

  function drawSandboxNetwork() {
    if (!networkCanvas || !networkCtx) return;
    const rect = networkCanvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    networkCtx.clearRect(0, 0, width, height);
    networkPointer.x += (networkPointer.tx - networkPointer.x) * 0.075;
    networkPointer.y += (networkPointer.ty - networkPointer.y) * 0.075;
    networkRotation.y += (networkPointer.x * 0.42 - networkRotation.y) * 0.055;
    networkRotation.x += (-networkPointer.y * 0.32 - networkRotation.x) * 0.055;
    networkRotation.z += (networkPointer.x * 0.045 - networkRotation.z) * 0.035;

    const nodeMap = new Map(networkNodes.map(node => [node.id, node]));
    for (const node of networkNodes) {
      if (node.pinned) continue;
      node.phase += 0.012;
      node.x += node.vx + Math.cos(node.phase) * 0.08;
      node.y += node.vy + Math.sin(node.phase) * 0.08;
      node.z += node.vz + Math.sin(node.phase * 0.7) * 0.05;
      if (node.x < 30 || node.x > width - 30) node.vx *= -1;
      if (node.y < 30 || node.y > height - 30) node.vy *= -1;
      if (node.z < -180 || node.z > 180) node.vz *= -1;
      node.x = Math.max(24, Math.min(width - 24, node.x));
      node.y = Math.max(24, Math.min(height - 24, node.y));
    }

    const projected = new Map(networkNodes.map(node => [node.id, projectNetworkNode(node, width, height)]));

    for (const link of networkLinks) {
      const source = nodeMap.get(link.source);
      const target = nodeMap.get(link.target);
      if (!source || !target) continue;
      const sourcePoint = projected.get(source.id);
      const targetPoint = projected.get(target.id);
      const highlighted = source.id === selectedThreadId || target.id === selectedThreadId;
      networkCtx.beginPath();
      networkCtx.moveTo(sourcePoint.x, sourcePoint.y);
      networkCtx.lineTo(targetPoint.x, targetPoint.y);
      const depthAlpha = Math.max(0.08, Math.min(0.28, (sourcePoint.scale + targetPoint.scale) * 0.08));
      networkCtx.strokeStyle = highlighted ? "rgba(192, 184, 255, 0.74)" : `rgba(165, 170, 205, ${depthAlpha})`;
      networkCtx.lineWidth = highlighted ? 1.9 : 0.75 * ((sourcePoint.scale + targetPoint.scale) / 2);
      networkCtx.stroke();
    }

    for (const node of networkNodes) {
      const isSelected = node.id === selectedThreadId;
      const point = projected.get(node.id);
      const radius = node.kind === "thread" ? 8.5 : node.kind === "entity" ? 5.4 : 3.4;
      networkCtx.beginPath();
      networkCtx.arc(point.x, point.y, (isSelected ? radius + 4 : radius) * point.scale, 0, Math.PI * 2);
      networkCtx.fillStyle = node.kind === "thread"
        ? (isSelected ? "rgba(178, 166, 255, 1)" : "rgba(135, 126, 255, 0.88)")
        : node.kind === "entity"
          ? "rgba(45, 220, 162, 0.76)"
          : `rgba(220, 224, 246, ${0.30 + point.scale * 0.18})`;
      networkCtx.shadowBlur = isSelected ? 34 : node.kind === "thread" ? 18 : 4;
      networkCtx.shadowColor = "rgba(139, 125, 255, 0.75)";
      networkCtx.fill();
      networkCtx.shadowBlur = 0;

      if (node.kind === "thread" || isSelected) {
        networkCtx.font = `${isSelected ? 750 : 560} ${isSelected ? 12 : 10}px Inter, sans-serif`;
        networkCtx.fillStyle = isSelected ? "rgba(255,255,255,0.96)" : "rgba(226,228,244,0.62)";
        networkCtx.fillText(formatThreadTitle(node.label || node.id).slice(0, 32), point.x + radius + 8, point.y + 3);
      }
    }

    networkAnimationFrame = requestAnimationFrame(drawSandboxNetwork);
  }

  function projectNetworkNode(node, width, height) {
    const cx = width / 2;
    const cy = height / 2;
    const x = node.x - cx;
    const y = node.y - cy;
    const z = node.z || 0;
    const cosY = Math.cos(networkRotation.y);
    const sinY = Math.sin(networkRotation.y);
    const cosX = Math.cos(networkRotation.x);
    const sinX = Math.sin(networkRotation.x);
    const cosZ = Math.cos(networkRotation.z);
    const sinZ = Math.sin(networkRotation.z);

    const x1 = x * cosY + z * sinY;
    const z1 = -x * sinY + z * cosY;
    const y1 = y * cosX - z1 * sinX;
    const z2 = y * sinX + z1 * cosX;
    const x2 = x1 * cosZ - y1 * sinZ;
    const y2 = x1 * sinZ + y1 * cosZ;
    const perspective = 760;
    const scale = Math.max(0.55, Math.min(1.36, perspective / (perspective - z2)));
    return {
      x: cx + x2 * scale,
      y: cy + y2 * scale,
      scale,
    };
  }

  function findNetworkNode(clientX, clientY) {
    if (!networkCanvas) return null;
    const rect = networkCanvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    let closest = null;
    let closestDistance = 22;
    for (const node of networkNodes) {
      const point = projectNetworkNode(node, rect.width, rect.height);
      const distance = Math.hypot(point.x - x, point.y - y);
      if (distance < closestDistance) {
        closest = node;
        closestDistance = distance;
      }
    }
    return closest;
  }

  if (sandboxCloseButton) sandboxCloseButton.addEventListener("click", closeSandboxApp);
  if (sandboxOverlay) {
    sandboxOverlay.addEventListener("click", event => {
      if (event.target === sandboxOverlay) closeSandboxApp();
    });
  }
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && sandboxOverlay?.classList.contains("open")) closeSandboxApp();
  });
  if (sandboxAskForm) {
    sandboxAskForm.addEventListener("submit", event => {
      event.preventDefault();
      const selected = selectedThreadId ? `${sandboxAskInput.value} ${selectedThreadId}` : sandboxAskInput.value;
      runSandboxQuery(selected);
    });
  }
  if (sandboxThreadSelect) {
    sandboxThreadSelect.addEventListener("change", () => selectSandboxThread(sandboxThreadSelect.value));
  }
  if (sandboxThreadList) {
    sandboxThreadList.addEventListener("click", event => {
      const item = event.target.closest(".sandbox-thread-item");
      if (item) selectSandboxThread(item.dataset.threadTitle);
    });
  }
  if (sandboxRecentGrid) {
    sandboxRecentGrid.addEventListener("click", event => {
      const card = event.target.closest(".sandbox-thread-card");
      if (card) selectSandboxThread(card.dataset.threadTitle);
    });
  }
  if (networkCanvas) {
    networkCanvas.addEventListener("mousedown", event => {
      const node = findNetworkNode(event.clientX, event.clientY);
      if (!node) return;
      networkDragNode = node;
      networkDragged = false;
      node.pinned = true;
      networkCanvas.style.cursor = "grabbing";
    });
    networkCanvas.addEventListener("mousemove", event => {
      const rect = networkCanvas.getBoundingClientRect();
      networkPointer.tx = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      networkPointer.ty = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
      networkPointer.active = true;
      if (networkDragNode) {
        networkDragNode.x = event.clientX - rect.left;
        networkDragNode.y = event.clientY - rect.top;
        networkDragged = true;
        networkCanvas.style.cursor = "grabbing";
        return;
      }
      networkCanvas.style.cursor = findNetworkNode(event.clientX, event.clientY) ? "pointer" : "grab";
    });
    window.addEventListener("mouseup", () => {
      if (!networkDragNode) return;
      const node = networkDragNode;
      networkDragNode = null;
      networkCanvas.style.cursor = "grab";
      if (networkDragged) return;
      if (node.kind === "thread") {
        selectSandboxThread(node.id);
      } else {
        const eventLink = networkLinks.find(link => link.target === node.id || link.source === node.id);
        const eventId = eventLink ? (eventLink.source === node.id ? eventLink.target : eventLink.source) : "";
        const threadLink = networkLinks.find(link => link.target === eventId || link.source === eventId);
        const threadNode = threadLink
          ? networkNodes.find(candidate => candidate.kind === "thread" && (candidate.id === threadLink.source || candidate.id === threadLink.target))
          : null;
        if (threadNode) selectSandboxThread(threadNode.id);
      }
    });
  }
  window.addEventListener("resize", () => {
    resizeNetworkCanvas();
    if (cachedGraph) initSandboxNetwork(cachedGraph);
  });
  if (sandboxSearchInput) {
    sandboxSearchInput.addEventListener("keydown", event => {
      if (event.key === "Enter") runSandboxQuery(sandboxSearchInput.value);
    });
  }
  if (graphToggle && graphDrawer) {
    graphToggle.addEventListener("click", () => {
      graphDrawer.classList.add("open");
      graphDrawer.setAttribute("aria-hidden", "false");
      hydrateSandboxWorkspace();
    });
  }
  if (graphClose && graphDrawer) {
    graphClose.addEventListener("click", () => {
      graphDrawer.classList.remove("open");
      graphDrawer.setAttribute("aria-hidden", "true");
    });
  }

  // Smooth scroll offsets for anchor links
  function openSandboxExperience(targetElement) {
    if (!targetElement || targetElement.id !== "sandbox") return;
    openSandboxApp();
  }

  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener("click", function(e) {
      const targetId = this.getAttribute("href");
      if (targetId === "#") return;
      
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        e.preventDefault();
        if (targetId === "#sandbox") {
          openSandboxExperience(targetElement);
          return;
        }
        const headerOffset = 72; // Header Nav height
        const elementPosition = targetElement.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
          top: offsetPosition,
          behavior: "smooth"
        });

        openSandboxExperience(targetElement);
      }
    });
  });

  if (window.location.hash === "#sandbox") {
    const sandbox = document.getElementById("sandbox");
    if (sandbox) {
      setTimeout(() => openSandboxExperience(sandbox), 250);
    }
  }

  // Simple scroll fade-in animator
  const fadeElements = document.querySelectorAll(".feature-card, .comparison-table, .pipeline-diagram-card, .faq-item");
  
  const fadeObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = 1;
        entry.target.style.transform = "translateY(0)";
        fadeObserver.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: "0px 0px -50px 0px"
  });

  fadeElements.forEach(el => {
    el.style.opacity = 0;
    el.style.transform = "translateY(15px)";
    el.style.transition = "opacity 0.6s ease-out, transform 0.6s ease-out";
    fadeObserver.observe(el);
  });
});
