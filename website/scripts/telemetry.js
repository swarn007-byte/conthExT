// conthExT sandbox console: capture context, search vault, and focus graph threads.

(function() {
  const API_BASE = "http://127.0.0.1:8000";
  const terminal = document.getElementById("terminal-feed");
  const responseCard = document.getElementById("terminal-response-card");
  const responseMode = document.getElementById("terminal-response-mode");
  const responseBody = document.getElementById("terminal-response-body");
  const responseCitations = document.getElementById("terminal-response-citations");
  const queryButtons = document.querySelectorAll(".btn-query-preset");
  const captureForm = document.getElementById("capture-form");
  const sessionInput = document.getElementById("session-id-input");
  const speakerSelect = document.getElementById("speaker-select");
  const captureContent = document.getElementById("capture-content");

  let isRunning = false;

  const queryData = {
    "jwt-bug": "What was the JWT auth bug?",
    "react-state": "Explain the React controlled inputs issue",
    "startup-pitch": "What is inside frontend-2026-06-27?"
  };

  function getLogTime() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return pad(now.getHours()) + ":" + pad(now.getMinutes()) + ":" + pad(now.getSeconds());
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function resetConsole(commandText) {
    terminal.innerHTML = "";
    responseCard.classList.add("hidden");
    responseCitations.innerHTML = "";

    const promptLine = document.createElement("div");
    promptLine.className = "terminal-prompt-line";
    promptLine.innerHTML = `<span class="prompt-symbol">$</span> <span class="typing-target"></span>`;
    terminal.appendChild(promptLine);
    typeText(promptLine.querySelector(".typing-target"), commandText, 10);
  }

  function typeText(targetElement, text, speed, onComplete) {
    targetElement.textContent = "";
    let i = 0;

    function tick() {
      if (i < text.length) {
        targetElement.textContent += text.charAt(i);
        i++;
        setTimeout(tick, speed);
      } else if (onComplete) {
        onComplete();
      }
    }

    tick();
  }

  function printLogLine(source, text) {
    const line = document.createElement("div");
    line.className = "log-line";
    line.innerHTML = `<span class="log-time">[${getLogTime()}]</span><span class="log-source log-tag-${source}">[${source}]</span><span class="log-text">${text}</span>`;
    terminal.appendChild(line);
    terminal.parentNode.scrollTop = terminal.parentNode.scrollHeight;
  }

  function setQueryButtonsDisabled(disabled) {
    queryButtons.forEach(btn => {
      btn.disabled = disabled;
    });
  }

  async function postJson(path, payload) {
    const response = await fetch(API_BASE + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`${path} failed with ${response.status}`);
    }

    return response.json();
  }

  async function captureToVault(event) {
    event.preventDefault();
    if (isRunning) return;

    const sessionId = sessionInput.value.trim();
    const content = captureContent.value.trim();
    const speaker = speakerSelect.value;

    if (!sessionId || !content) {
      resetConsole("capture --missing required fields");
      printLogLine("pipeline", "Add a thread id and some content before capturing.");
      return;
    }

    isRunning = true;
    setQueryButtonsDisabled(true);
    resetConsole(`POST /api/v1/context/capture --session ${sessionId}`);

    try {
      await sleep(220);
      printLogLine("ingest", `normalizing ${speaker} message for thread "${sessionId}"`);
      await postJson("/api/v1/context/capture", {
        session_id: sessionId,
        speaker,
        content,
        timestamp: new Date().toISOString()
      });
      await sleep(300);
      printLogLine("vault", `queued append into Obsidian thread: ${sessionId}.md`);
      await sleep(260);
      printLogLine("subgraph", "refreshing graph from Threads and Concepts folders");

      showResponseCard({
        mode: "Captured",
        body: "Context captured successfully. The backend queued it for the Obsidian vault, and the graph can now focus on this thread.",
        citations: [sessionId, speaker]
      }, sessionId);

      captureContent.value = "";
      if (window.reloadVaultGraph) {
        window.reloadVaultGraph(sessionId);
      } else if (window.highlightSubgraph) {
        window.highlightSubgraph(sessionId);
      }
    } catch (err) {
      printLogLine("pipeline", err.message);
      showResponseCard({
        mode: "Backend Offline",
        body: "The UI is ready, but the local backend is not responding yet. Start the FastAPI server on port 8000 and try again.",
        citations: ["http://127.0.0.1:8000", "context-engine"]
      }, null);
    } finally {
      isRunning = false;
      setQueryButtonsDisabled(false);
    }
  }

  async function runVaultQuery(queryId) {
    if (isRunning) return;
    isRunning = true;
    setQueryButtonsDisabled(true);

    queryButtons.forEach(btn => btn.classList.toggle("active", btn.dataset.queryId === queryId));
    const query = queryData[queryId] || queryData["jwt-bug"];
    resetConsole(`POST /api/v1/vault/search --query "${query}"`);

    try {
      await sleep(240);
      printLogLine("query", "searching markdown files in Threads and Concepts");
      const matches = await postJson("/api/v1/vault/search", { query, limit: 5 });

      if (!matches.length) {
        printLogLine("vault", "no matching notes found");
        showResponseCard({
          mode: "No Vault Match",
          body: "No matching markdown note was found for that question. Capture a related event first, then query again.",
          citations: ["Threads", "Concepts"]
        }, null);
        return;
      }

      const topMatch = matches[0];
      await sleep(300);
      printLogLine("vault", `top match: ${topMatch.folder}/${topMatch.title}.md (score ${topMatch.relevance_score})`);
      await sleep(260);
      printLogLine("subgraph", `loading thread note "${topMatch.title}"`);

      let threadData = null;
      try {
        threadData = await postJson("/api/v1/vault/thread", { thread_title: topMatch.title });
      } catch (err) {
        printLogLine("subgraph", "thread detail unavailable, using search preview");
      }

      const wikilinks = threadData?.metadata?.wikilinks || [];
      const eventCount = threadData?.metadata?.event_count || 0;
      const body = buildAnswer(query, topMatch, eventCount, wikilinks);

      await sleep(260);
      printLogLine("agent", `compiled grounded response from ${topMatch.title}.md`);
      showResponseCard({
        mode: "Vault Answer",
        body,
        citations: [topMatch.title, ...wikilinks.slice(0, 4)]
      }, topMatch.title);

      if (window.highlightSubgraph) {
        window.highlightSubgraph(topMatch.title);
      }
    } catch (err) {
      printLogLine("pipeline", err.message);
      showResponseCard({
        mode: "Backend Offline",
        body: "The sandbox could not reach the local backend. Start the conthExT FastAPI server and this panel will switch from demo mode to live vault mode.",
        citations: ["FastAPI", "Obsidian vault"]
      }, null);
    } finally {
      isRunning = false;
      setQueryButtonsDisabled(false);
    }
  }

  function buildAnswer(query, match, eventCount, wikilinks) {
    const linksText = wikilinks.length
      ? ` It links to ${wikilinks.slice(0, 4).join(", ")}.`
      : "";
    const eventsText = eventCount
      ? ` I found ${eventCount} captured event${eventCount === 1 ? "" : "s"} in that thread.`
      : "";

    return `For "${query}", the strongest vault match is ${match.folder}/${match.title}.md.${eventsText}${linksText} Preview: ${match.preview}`;
  }

  function showResponseCard(res, threadId) {
    responseMode.textContent = res.mode;
    responseBody.textContent = "";
    responseCitations.innerHTML = "";
    responseCard.classList.remove("hidden");

    typeText(responseBody, res.body, 5, () => {
      res.citations.filter(Boolean).forEach(cit => {
        const chip = document.createElement("span");
        chip.className = "citation-chip font-mono";
        chip.textContent = `#${cit}`;
        chip.addEventListener("click", () => {
          if (window.highlightSubgraph) window.highlightSubgraph(cit);
        });
        responseCitations.appendChild(chip);
      });

      if (threadId && window.highlightSubgraph) {
        window.highlightSubgraph(threadId);
      }
    });
  }

  if (captureForm) {
    captureForm.addEventListener("submit", captureToVault);
  }

  queryButtons.forEach(btn => {
    btn.addEventListener("click", () => runVaultQuery(btn.dataset.queryId));
  });
})();
