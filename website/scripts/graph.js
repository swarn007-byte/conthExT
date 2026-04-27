// conthExT Memory Graph Visualization
// Fully interactive Canvas-based force-directed simulation

(function() {
  const canvas = document.getElementById("graph-canvas");
  if (!canvas) return;
  const container = document.getElementById("graph-canvas-wrapper");
  const ctx = canvas.getContext("2d");
  const tooltip = document.getElementById("canvas-tooltip");
  const detailOverlay = document.getElementById("graph-detail-overlay");
  const detailClose = document.getElementById("btn-close-detail");
  const detailContent = document.getElementById("detail-content");

  // Simulation State
  let nodes = [];
  let links = [];
  let nodeIndex = new Map();
  let transform = { x: 0, y: 0, k: 1 };
  let selectedNode = null;
  let hoveredNode = null;
  let activeHighlightThreadId = null; // Filtered to specific query thread
  let isDragging = false;
  let isPanning = false;
  let panStart = { x: 0, y: 0 };
  let dragOffset = { x: 0, y: 0 };

  // Physics tuning
  let alpha = 1;
  const alphaMin = 0.005;
  const alphaDecay = 0.015;
  let animationFrame = null;

  // --- Seed Data used only when the local vault graph API is offline ---
  const seedData = {
    nodes: [
      // Threads
      { id: "t1", label: "JWT Auth Flow", kind: "thread", desc: "Investigation into JSON Web Token access token limits and refresh mechanism flow.", source: "youtube", size: 22 },
      { id: "t2", label: "Knowledge Graph Design", kind: "thread", desc: "Architecting a semantic event-entity network using SQLite for temporal user memory.", source: "chatgpt", size: 22 },
      { id: "t3", label: "React Controlled States", kind: "thread", desc: "Debugging un-editable input fields caused by state management bugs in React components.", source: "youtube", size: 22 },
      { id: "t4", label: "YC Pitch Deck Prep", kind: "thread", desc: "Designing a slide sequence and revenue calculation matrix for seed investors in AI Agent tech.", source: "notion", size: 22 },

      // Entities
      { id: "e-jwt", label: "jwt", kind: "entity", desc: "JSON Web Token for stateless server authorization.", size: 13 },
      { id: "e-auth", label: "auth", kind: "entity", desc: "Authentication and authorization protocols.", size: 13 },
      { id: "e-refresh", label: "refresh-token", kind: "entity", desc: "Long-lived credentials used to request fresh access tokens securely.", size: 13 },
      { id: "e-graph", label: "knowledge-graph", kind: "entity", desc: "Graph node network representing structured relationships.", size: 13 },
      { id: "e-sqlite", label: "sqlite", kind: "entity", desc: "Lightweight relational database file format.", size: 13 },
      { id: "e-react", label: "react-state", kind: "entity", desc: "Component state rendering cycles inside React virtual DOM.", size: 13 },
      { id: "e-input", label: "controlled-input", kind: "entity", desc: "Form input elements bound strictly to component properties.", size: 13 },
      { id: "e-pitch", label: "pitch-deck", kind: "entity", desc: "Visual deck summarizing startup business models, metrics, and team profiles.", size: 13 },
      { id: "e-yc", label: "y-combinator", kind: "entity", desc: "Early-stage startup accelerator and investment handbook.", size: 13 },
      { id: "e-rev", label: "revenue-model", kind: "entity", desc: "Financial sheets mapping unit economics and sales forecast models.", size: 13 },

      // Events (YouTube videos, ChatGPT queries, Notion notes)
      { id: "ev1", label: "Video: JWT Auth Overview", kind: "event", source: "youtube", desc: "Watched 'JWT Authentication Explained' access token & refresh mechanics video.", size: 9, time: "2026-05-02 09:00" },
      { id: "ev2", label: "Chat: JWT Refresh Flow", kind: "event", source: "chatgpt", desc: "Queried: 'How does JWT refresh token work in a backend service?'", size: 9, time: "2026-05-02 09:08" },
      { id: "ev3", label: "Chat: Access Token Expiry", kind: "event", source: "chatgpt", desc: "Queried: 'Why is my access token expiring immediately after login?'", size: 9, time: "2026-05-02 09:18" },
      { id: "ev4", label: "Chat: Graph Design", kind: "event", source: "chatgpt", desc: "Queried: 'How to design a knowledge graph for user activity tracking?'", size: 9, time: "2026-05-02 11:00" },
      { id: "ev5", label: "Video: Graph Databases", kind: "event", source: "youtube", desc: "Watched 'Graph Databases Explained: nodes, edges, Neo4j basics'.", size: 9, time: "2026-05-02 11:08" },
      { id: "ev6", label: "Chat: Event Clustering", kind: "event", source: "chatgpt", desc: "Queried: 'How to cluster events into meaningful threads?'", size: 9, time: "2026-05-02 11:20" },
      { id: "ev7", label: "Chat: React Input Bug", kind: "event", source: "chatgpt", desc: "Queried: 'Why is my input box not updating in React?'", size: 9, time: "2026-05-02 13:00" },
      { id: "ev8", label: "Video: React States", kind: "event", source: "youtube", desc: "Watched 'React state and controlled components explained'.", size: 9, time: "2026-05-02 13:08" },
      { id: "ev9", label: "Chat: Input Bug Fix", kind: "event", source: "chatgpt", desc: "Queried: 'How to fix input field not editable bug in React?'", size: 9, time: "2026-05-02 13:18" },
      { id: "ev10", label: "Chat: AI Pitch investor", kind: "event", source: "chatgpt", desc: "Queried: 'How AI infrastructure startups pitch investors in the agent era?'", size: 9, time: "2026-05-02 15:00" },
      { id: "ev11", label: "Video: YC Pitch Guide", kind: "event", source: "youtube", desc: "Watched 'Y Combinator pitch playbook for early stage founders'.", size: 9, time: "2026-05-02 15:10" },
      { id: "ev12", label: "Note: Notion Pitch Deck", kind: "event", source: "notion", desc: "Edited Notion Page: 'Pitch deck outline with revenue model for an infrastructure startup'.", size: 9, time: "2026-05-02 15:25" }
    ],
    links: [
      // Thread 1 links
      { source: "t1", target: "ev1", kind: "thread_event" },
      { source: "t1", target: "ev2", kind: "thread_event" },
      { source: "t1", target: "ev3", kind: "thread_event" },
      { source: "ev1", target: "e-jwt", kind: "event_entity" },
      { source: "ev1", target: "e-auth", kind: "event_entity" },
      { source: "ev2", target: "e-jwt", kind: "event_entity" },
      { source: "ev2", target: "e-refresh", kind: "event_entity" },
      { source: "ev3", target: "e-jwt", kind: "event_entity" },
      { source: "ev3", target: "e-refresh", kind: "event_entity" },

      // Thread 2 links
      { source: "t2", target: "ev4", kind: "thread_event" },
      { source: "t2", target: "ev5", kind: "thread_event" },
      { source: "t2", target: "ev6", kind: "thread_event" },
      { source: "ev4", target: "e-graph", kind: "event_entity" },
      { source: "ev5", target: "e-graph", kind: "event_entity" },
      { source: "ev5", target: "e-sqlite", kind: "event_entity" },
      { source: "ev6", target: "e-graph", kind: "event_entity" },

      // Thread 3 links
      { source: "t3", target: "ev7", kind: "thread_event" },
      { source: "t3", target: "ev8", kind: "thread_event" },
      { source: "t3", target: "ev9", kind: "thread_event" },
      { source: "ev7", target: "e-react", kind: "event_entity" },
      { source: "ev8", target: "e-react", kind: "event_entity" },
      { source: "ev8", target: "e-input", kind: "event_entity" },
      { source: "ev9", target: "e-react", kind: "event_entity" },
      { source: "ev9", target: "e-input", kind: "event_entity" },

      // Thread 4 links
      { source: "t4", target: "ev10", kind: "thread_event" },
      { source: "t4", target: "ev11", kind: "thread_event" },
      { source: "t4", target: "ev12", kind: "thread_event" },
      { source: "ev10", target: "e-pitch", kind: "event_entity" },
      { source: "ev10", target: "e-yc", kind: "event_entity" },
      { source: "ev11", target: "e-pitch", kind: "event_entity" },
      { source: "ev11", target: "e-yc", kind: "event_entity" },
      { source: "ev12", target: "e-pitch", kind: "event_entity" },
      { source: "ev12", target: "e-rev", kind: "event_entity" }
    ]
  };

  // Set initial dimensions and DPI handling
  function resize() {
    const bounds = container.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(bounds.width * dpr);
    canvas.height = Math.floor(bounds.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Scatter nodes evenly on load using fallback mock data
  function loadMockData() {
    const cx = canvas.width / (2 * (window.devicePixelRatio || 1));
    const cy = canvas.height / (2 * (window.devicePixelRatio || 1));
    const spread = Math.min(cx, cy) * 0.7;

    nodes = seedData.nodes.map(n => {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * spread;
      return {
        ...n,
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        vx: 0,
        vy: 0,
        fx: null,
        fy: null
      };
    });

    links = seedData.links.map(l => ({ ...l }));
    nodeIndex = new Map(nodes.map(n => [n.id, n]));

    transform = { x: 0, y: 0, k: 1 };
    reheat();
  }

  async function initSimulation() {
    resize();
    try {
      const response = await fetch("http://127.0.0.1:8000/api/v1/vault/graph");
      if (!response.ok) throw new Error("API graph offline");
      const data = await response.json();
      
      const cx = canvas.width / (2 * (window.devicePixelRatio || 1));
      const cy = canvas.height / (2 * (window.devicePixelRatio || 1));
      const spread = Math.min(cx, cy) * 0.7;

      nodes = data.nodes.map(n => {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * spread;
        return {
          ...n,
          x: cx + Math.cos(angle) * r,
          y: cy + Math.sin(angle) * r,
          vx: 0,
          vy: 0,
          fx: null,
          fy: null
        };
      });

      links = data.links.map(l => ({ ...l }));
      nodeIndex = new Map(nodes.map(n => [n.id, n]));
      
      transform = { x: 0, y: 0, k: 1 };
      reheat();
      console.log("Successfully connected to conthExT graph API with", nodes.length, "nodes");
    } catch (err) {
      console.warn("Failed to load dynamic backend graph, using static seed data", err);
      loadMockData();
    }
  }

  // Force-Directed Physics Iteration
  function stepPhysics() {
    if (alpha < alphaMin) return;

    const cx = canvas.width / (2 * (window.devicePixelRatio || 1));
    const cy = canvas.height / (2 * (window.devicePixelRatio || 1));

    // 1. Repulsion (Charge) O(n^2)
    for (let i = 0; i < nodes.length; i++) {
      const ni = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const nj = nodes[j];
        const dx = nj.x - ni.x;
        const dy = nj.y - ni.y;
        const distSq = dx * dx + dy * dy + 0.1;
        const dist = Math.sqrt(distSq);
        
        // Multiplier based on sizes to prevent overlap
        const minDistance = (ni.size + nj.size) * 1.5;
        const chargeStrength = ni.kind === "thread" || nj.kind === "thread" ? 1800 : 700;
        
        if (dist < minDistance) {
          const strength = (chargeStrength * 1.5 * alpha) / distSq;
          const fx = (dx / dist) * strength;
          const fy = (dy / dist) * strength;
          if (ni.fx === null) { ni.vx -= fx; ni.vy -= fy; }
          if (nj.fx === null) { nj.vx += fx; nj.vy += fy; }
        } else {
          const strength = (chargeStrength * alpha) / distSq;
          const fx = (dx / dist) * strength;
          const fy = (dy / dist) * strength;
          if (ni.fx === null) { ni.vx -= fx; ni.vy -= fy; }
          if (nj.fx === null) { nj.vx += fx; nj.vy += fy; }
        }
      }
    }

    // 2. Spring Attraction (along Links)
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      const source = nodeIndex.get(link.source);
      const target = nodeIndex.get(link.target);
      if (!source || !target) continue;

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) + 0.01;
      
      const restLen = link.kind === "thread_event" ? 95 : 65;
      const k = 0.06 * alpha; // spring constant
      const force = (dist - restLen) * k;
      
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      if (source.fx === null) { source.vx += fx; source.vy += fy; }
      if (target.fx === null) { target.vx -= fx; target.vy -= fy; }
    }

    // 3. Gravity (pull toward center)
    const gravity = 0.016 * alpha;
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (node.fx !== null) continue;
      node.vx += (cx - node.x) * gravity;
      node.vy += (cy - node.y) * gravity;
    }

    // 4. Update coordinates with friction & boundaries
    const friction = 0.65;
    const inset = 30;
    const widthLimit = canvas.width / (window.devicePixelRatio || 1);
    const heightLimit = canvas.height / (window.devicePixelRatio || 1);

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (node.fx !== null) {
        node.x = node.fx;
        node.y = node.fy;
        node.vx = 0;
        node.vy = 0;
      } else {
        node.vx *= friction;
        node.vy *= friction;
        node.x += node.vx;
        node.y += node.vy;
        
        // Clamping to container space
        node.x = Math.max(inset, Math.min(widthLimit - inset, node.x));
        node.y = Math.max(inset, Math.min(heightLimit - inset, node.y));
      }
    }

    alpha += (alphaMin - alpha) * alphaDecay;
  }

  // --- Drawing logic ---

  function getNodeColor(node) {
    if (activeHighlightThreadId) {
      const isInSubgraph = checkIfNodeInSubgraph(node, activeHighlightThreadId);
      if (!isInSubgraph) return "rgba(60, 60, 65, 0.25)";
    }

    if (node === hoveredNode) return "#ffffff";

    if (node.kind === "thread") {
      switch (node.source) {
        case "youtube": return "#8a85f4";
        case "chatgpt": return "#8a85f4";
        case "notion": return "#8a85f4";
        default: return "#6f6bd9";
      }
    }
    if (node.kind === "entity") return "#a1a1aa";
    return "#52525b"; // events
  }

  function getStrokeColor(node) {
    if (activeHighlightThreadId) {
      const isInSubgraph = checkIfNodeInSubgraph(node, activeHighlightThreadId);
      if (!isInSubgraph) return "rgba(40, 40, 45, 0.1)";
    }
    if (node === hoveredNode) return "rgba(255, 255, 255, 0.8)";
    if (node.kind === "thread") return "rgba(111, 107, 217, 0.4)";
    if (node.kind === "entity") return "rgba(161, 161, 170, 0.2)";
    return "rgba(82, 82, 91, 0.2)";
  }

  function checkIfNodeInSubgraph(node, threadId) {
    if (node.id === threadId) return true;
    
    // Check if it's an event linked to this thread
    if (node.kind === "event") {
      const isLinkedToThread = links.some(l => 
        l.source === threadId && l.target === node.id && l.kind === "thread_event"
      );
      if (isLinkedToThread) return true;
    }

    // Check if it's an entity linked to events of this thread
    if (node.kind === "entity") {
      // Find all events for this thread
      const eventIds = links
        .filter(l => l.source === threadId && l.kind === "thread_event")
        .map(l => l.target);
      
      const isLinkedToEvent = links.some(l => 
        eventIds.includes(l.source) && l.target === node.id && l.kind === "event_entity"
      );
      if (isLinkedToEvent) return true;
    }

    return false;
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.k, transform.k);

    // 1. Draw Links
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      const source = nodeIndex.get(link.source);
      const target = nodeIndex.get(link.target);
      if (!source || !target) continue;

      let isHighlightedLink = false;
      let opacity = 0.12;

      if (activeHighlightThreadId) {
        const sourceInSub = checkIfNodeInSubgraph(source, activeHighlightThreadId);
        const targetInSub = checkIfNodeInSubgraph(target, activeHighlightThreadId);
        
        if (sourceInSub && targetInSub) {
          isHighlightedLink = true;
          opacity = 0.6;
        } else {
          opacity = 0.03;
        }
      }

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      
      if (isHighlightedLink) {
        ctx.strokeStyle = "rgba(138, 133, 244, " + opacity + ")";
        ctx.lineWidth = 1.8;
      } else {
        ctx.strokeStyle = "rgba(255, 255, 255, " + opacity + ")";
        ctx.lineWidth = 1.0;
      }
      ctx.stroke();
    }

    // 2. Draw Nodes
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const radius = node.size * 0.6;
      const isDimmed = activeHighlightThreadId && !checkIfNodeInSubgraph(node, activeHighlightThreadId);

      // Node shadow/glow
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = getNodeColor(node);

      if (node.kind === "thread" && !isDimmed) {
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = "rgba(111, 107, 217, 0.4)";
        ctx.arc(node.x, node.y, radius * 1.5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(111, 107, 217, 0.08)";
        ctx.fill();
        ctx.restore();
      }

      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = getNodeColor(node);
      ctx.fill();
      ctx.strokeStyle = getStrokeColor(node);
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Labels: show names for threads, and hover items
      if (node.kind === "thread" || node.kind === "entity" || node === hoveredNode) {
        ctx.save();
        
        let fontColor = "rgba(161, 161, 170, 0.7)";
        let fontWeight = "400";
        let fontSize = "9px";

        if (node.kind === "thread") {
          fontColor = "rgba(250, 250, 250, 0.9)";
          fontWeight = "600";
          fontSize = "10px";
        }
        if (node === hoveredNode) {
          fontColor = "#ffffff";
          fontWeight = "700";
        }
        if (isDimmed) {
          fontColor = "rgba(82, 82, 91, 0.15)";
        }

        ctx.font = fontWeight + " " + fontSize + " " + varFontName(node.kind);
        ctx.fillStyle = fontColor;
        ctx.textAlign = "left";
        
        // Truncate labels if too long
        let text = node.label;
        if (node.kind === "event" && text.length > 25) {
          text = text.substring(0, 23) + "...";
        }
        
        ctx.fillText(text, node.x + radius + 6, node.y + 3);
        ctx.restore();
      }
    }

    ctx.restore();
  }

  function varFontName(kind) {
    return kind === "thread" ? "Inter, sans-serif" : "JetBrains Mono, monospace";
  }

  // --- Simulation loop ---

  function tick() {
    stepPhysics();
    draw();
    animationFrame = requestAnimationFrame(tick);
  }

  function reheat() {
    alpha = 1;
  }

  // --- Interaction coordinates helpers ---

  function getScreenCoords(node) {
    const dpr = window.devicePixelRatio || 1;
    return {
      x: (node.x * transform.k + transform.x),
      y: (node.y * transform.k + transform.y)
    };
  }

  function getModelCoords(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left - transform.x) / transform.k;
    const y = (clientY - rect.top - transform.y) / transform.k;
    return { x, y };
  }

  function findNodeAt(x, y) {
    let closestNode = null;
    let minDist = 22; // click radius limit

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const dx = node.x - x;
      const dy = node.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < minDist) {
        minDist = dist;
        closestNode = node;
      }
    }
    return closestNode;
  }

  // --- Handlers & Listeners ---

  canvas.addEventListener("mousemove", (e) => {
    const coords = getModelCoords(e.clientX, e.clientY);
    
    // Check if dragging node
    if (isDragging && selectedNode) {
      selectedNode.fx = coords.x;
      selectedNode.fy = coords.y;
      reheat();
      hideTooltip();
      return;
    }

    // Check if panning background
    if (isPanning) {
      const rect = canvas.getBoundingClientRect();
      transform.x = e.clientX - rect.left - panStart.x;
      transform.y = e.clientY - rect.top - panStart.y;
      return;
    }

    // Check hover
    const match = findNodeAt(coords.x, coords.y);
    if (match !== hoveredNode) {
      hoveredNode = match;
      reheat();
      
      if (hoveredNode) {
        showTooltip(hoveredNode, e.clientX, e.clientY);
      } else {
        hideTooltip();
      }
    }
  });

  canvas.addEventListener("mousedown", (e) => {
    const coords = getModelCoords(e.clientX, e.clientY);
    const match = findNodeAt(coords.x, coords.y);

    if (match) {
      isDragging = true;
      selectedNode = match;
      selectedNode.fx = coords.x;
      selectedNode.fy = coords.y;
      hideTooltip();
    } else {
      isPanning = true;
      const rect = canvas.getBoundingClientRect();
      panStart.x = (e.clientX - rect.left) - transform.x;
      panStart.y = (e.clientY - rect.top) - transform.y;
    }
  });

  window.addEventListener("mouseup", () => {
    if (isDragging && selectedNode) {
      selectedNode.fx = null;
      selectedNode.fy = null;
      
      // If they clicked (didn't drag much), open details
      openDetailsDrawer(selectedNode);
    }
    isDragging = false;
    isPanning = false;
    selectedNode = null;
  });

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = 1.08;
    const nextK = e.deltaY < 0 ? transform.k * zoomFactor : transform.k / zoomFactor;

    // Clamp zoom scale
    const finalK = Math.max(0.4, Math.min(2.5, nextK));
    
    // Zoom toward cursor coordinates
    transform.x = mouseX - (mouseX - transform.x) * (finalK / transform.k);
    transform.y = mouseY - (mouseY - transform.y) * (finalK / transform.k);
    transform.k = finalK;
    reheat();
    hideTooltip();
  }, { passive: false });

  // Touch Support
  canvas.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const coords = getModelCoords(touch.clientX, touch.clientY);
      const match = findNodeAt(coords.x, coords.y);
      if (match) {
        isDragging = true;
        selectedNode = match;
        selectedNode.fx = coords.x;
        selectedNode.fy = coords.y;
      } else {
        isPanning = true;
        const rect = canvas.getBoundingClientRect();
        panStart.x = (touch.clientX - rect.left) - transform.x;
        panStart.y = (touch.clientY - rect.top) - transform.y;
      }
    }
  });

  canvas.addEventListener("touchmove", (e) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const coords = getModelCoords(touch.clientX, touch.clientY);
      if (isDragging && selectedNode) {
        selectedNode.fx = coords.x;
        selectedNode.fy = coords.y;
        reheat();
      } else if (isPanning) {
        const rect = canvas.getBoundingClientRect();
        transform.x = touch.clientX - rect.left - panStart.x;
        transform.y = touch.clientY - rect.top - panStart.y;
      }
    }
  });

  canvas.addEventListener("touchend", () => {
    if (selectedNode) {
      selectedNode.fx = null;
      selectedNode.fy = null;
      openDetailsDrawer(selectedNode);
    }
    isDragging = false;
    isPanning = false;
    selectedNode = null;
  });

  // --- Tooltip & Side Drawer Control ---

  function showTooltip(node, clientX, clientY) {
    const typeLabel = node.kind.toUpperCase();
    let sourceLabel = node.source || "system";
    
    // Set text contents
    document.getElementById("tooltip-source").textContent = sourceLabel;
    document.getElementById("tooltip-source").className = "tooltip-source-pill source-color-" + sourceLabel;
    document.getElementById("tooltip-type").textContent = typeLabel;
    document.getElementById("tooltip-content").textContent = node.desc || node.label;
    
    const timeEl = document.getElementById("tooltip-time");
    if (node.time) {
      timeEl.style.display = "block";
      timeEl.textContent = node.time;
    } else {
      timeEl.style.display = "none";
    }

    // Positioning tooltip near mouse pointer inside container bounds
    const rect = container.getBoundingClientRect();
    const toolWidth = 240;
    const toolHeight = 110;
    
    let x = clientX - rect.left + 15;
    let y = clientY - rect.top + 15;
    
    if (x + toolWidth > rect.width) x = clientX - rect.left - toolWidth - 15;
    if (y + toolHeight > rect.height) y = clientY - rect.top - toolHeight - 10;

    tooltip.style.left = x + "px";
    tooltip.style.top = y + "px";
    tooltip.classList.remove("hidden");
  }

  function hideTooltip() {
    tooltip.classList.add("hidden");
  }

  function openDetailsDrawer(node) {
    detailContent.innerHTML = "";
    
    let linkedElementsHtml = "";
    
    if (node.kind === "thread") {
      // Find events linked to thread
      const linkedEvents = links
        .filter(l => l.source === node.id && l.kind === "thread_event")
        .map(l => nodeIndex.get(l.target))
        .filter(Boolean);
        
      linkedElementsHtml = `
        <div class="detail-list-section">
          <span class="detail-list-title font-mono">Captured Events (${linkedEvents.length})</span>
          <ul class="detail-list">
            ${linkedEvents.map(ev => `<li>${ev.label}</li>`).join("")}
          </ul>
        </div>
      `;
    } else if (node.kind === "entity") {
      // Find threads and events linked to entity
      const linkedEvents = links
        .filter(l => l.target === node.id && l.kind === "event_entity")
        .map(l => nodeIndex.get(l.source))
        .filter(Boolean);
        
      linkedElementsHtml = `
        <div class="detail-list-section">
          <span class="detail-list-title font-mono">Associated Logs (${linkedEvents.length})</span>
          <ul class="detail-list">
            ${linkedEvents.map(ev => `<li>${ev.label}</li>`).join("")}
          </ul>
        </div>
      `;
    } else if (node.kind === "event") {
      // Find entities linked to event
      const linkedEntities = links
        .filter(l => l.source === node.id && l.kind === "event_entity")
        .map(l => nodeIndex.get(l.target))
        .filter(Boolean);
        
      linkedElementsHtml = `
        <div class="detail-list-section">
          <span class="detail-list-title font-mono">Linked Entities (${linkedEntities.length})</span>
          <ul class="detail-list">
            ${linkedEntities.map(en => `<li>#${en.label}</li>`).join("")}
          </ul>
        </div>
      `;
    }

    detailContent.innerHTML = `
      <span class="detail-label font-mono">${node.kind} selected</span>
      <h3 class="detail-title">${node.label}</h3>
      <div class="detail-meta font-mono">${node.time ? node.time + " &bull; " : ""}${node.source ? "Source: " + node.source : ""}</div>
      <div class="detail-description">${node.desc || "No description provided."}</div>
      ${linkedElementsHtml}
    `;

    detailOverlay.classList.remove("hidden");
  }

  if (detailClose) {
    detailClose.addEventListener("click", () => {
      detailOverlay.classList.add("hidden");
    });
  }

  // --- Exposed Subgraph highlighting APIs ---

  // Called from telemetry.js to filter visual focus
  window.highlightSubgraph = function(threadIdOrLabel) {
    let targetNode = nodeIndex.get(threadIdOrLabel);
    
    // Fallback: search by label similarity or preset prefix mapping if threadId is a mock ID like t1, t2, t3, t4
    if (!targetNode && threadIdOrLabel) {
      const cleanTarget = threadIdOrLabel.toLowerCase();
      targetNode = nodes.find(n => 
        n.kind === "thread" && 
        (n.id.toLowerCase().includes(cleanTarget) || 
         n.label.toLowerCase().includes(cleanTarget) ||
         (threadIdOrLabel === "t1" && n.id.toLowerCase().startsWith("jwt_thread")) ||
         (threadIdOrLabel === "t2" && n.id.toLowerCase().startsWith("design_thread")) ||
         (threadIdOrLabel === "t3" && n.id.toLowerCase().startsWith("input_thread")) ||
         (threadIdOrLabel === "t4" && n.id.toLowerCase().startsWith("infrastructure_thread")))
      );
    }
    
    const threadId = targetNode ? targetNode.id : null;
    activeHighlightThreadId = threadId;
    reheat();
    
    // Zoom focus on the thread node if found
    if (threadId && targetNode) {
      // Smoothly animate transform to center the thread node
      const cx = canvas.width / (2 * (window.devicePixelRatio || 1));
      const cy = canvas.height / (2 * (window.devicePixelRatio || 1));
      
      transform = {
        x: cx - targetNode.x * 1.2,
        y: cy - targetNode.y * 1.2,
        k: 1.2
      };
      openDetailsDrawer(targetNode);
    } else {
      // Reset details and camera
      detailOverlay.classList.add("hidden");
      const cx = canvas.width / (2 * (window.devicePixelRatio || 1));
      const cy = canvas.height / (2 * (window.devicePixelRatio || 1));
      transform = { x: 0, y: 0, k: 1 };
    }
  };

  window.reloadVaultGraph = async function(focusThreadId) {
    await initSimulation();
    if (focusThreadId && window.highlightSubgraph) {
      window.highlightSubgraph(focusThreadId);
    }
  };

  // Reheat action click
  const btnReheat = document.getElementById("btn-reheat-graph");
  if (btnReheat) {
    btnReheat.addEventListener("click", () => {
      reheat();
    });
  }

  // Zoom Fit click
  const btnZoomFit = document.getElementById("btn-zoom-fit");
  if (btnZoomFit) {
    btnZoomFit.addEventListener("click", () => {
      window.highlightSubgraph(null);
    });
  }

  // Bind resize handler
  window.addEventListener("resize", () => {
    resize();
    reheat();
  });

  // Kickoff
  initSimulation();
  tick();

})();
