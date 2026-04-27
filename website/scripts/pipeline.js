// Ingestion Pipeline SVG Flow Particles Animation
// Dynamically moves glowing data packets along SVG paths using vector interpolation

(function() {
  const svg = document.getElementById("pipeline-svg");
  if (!svg) return;
  const particlesContainer = document.getElementById("particles-container");
  
  // Paths definition mapping
  const sourcePaths = [
    "path-gpt-ingest",
    "path-github-ingest",
    "path-notion-ingest",
    "path-yt-ingest"
  ];
  
  const midPaths = [
    "path-ingest-extract",
    "path-extract-cluster",
    "path-cluster-agent"
  ];

  const stageGroups = {
    "ingestion": document.getElementById("stage-ingestion"),
    "extraction": document.getElementById("stage-extraction"),
    "clustering": document.getElementById("stage-clustering"),
    "agent": document.getElementById("group-agent")
  };

  // Pulse stage boxes when a particle enters
  function pulseStage(stageName) {
    const group = stageGroups[stageName];
    if (!group) return;
    
    const rect = group.querySelector("rect") || group.querySelector("circle");
    if (!rect) return;

    rect.style.transition = "transform 0.15s ease, stroke 0.15s ease, filter 0.15s ease";
    rect.style.transformOrigin = "center";
    
    // Different highlight colors based on stage
    const highlightColor = stageName === "clustering" ? "#8a85f4" : "#ffffff";
    const normalColor = stageName === "clustering" ? "#6f6bd9" : "#262626";

    rect.style.transform = "scale(1.05)";
    rect.style.stroke = highlightColor;
    if (rect.style.filter !== undefined) {
      rect.style.filter = "drop-shadow(0 0 4px " + highlightColor + ")";
    }

    setTimeout(() => {
      rect.style.transform = "scale(1)";
      rect.style.stroke = normalColor;
      rect.style.filter = "none";
    }, 250);
  }

  // Animates a single particle along a path
  function animateParticle(pathId, duration, onComplete) {
    const path = document.getElementById(pathId);
    if (!path) return;

    const length = path.getTotalLength();
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    
    // Styling particle
    circle.setAttribute("r", "3.5");
    circle.setAttribute("class", "particle");
    circle.style.fill = "#8a85f4";
    circle.style.filter = "url(#svgGlow)";
    
    particlesContainer.appendChild(circle);

    let startTime = null;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Get coordinates along the path
      const point = path.getPointAtLength(progress * length);
      circle.setAttribute("cx", point.x);
      circle.setAttribute("cy", point.y);

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        circle.remove();
        if (onComplete) onComplete();
      }
    }

    requestAnimationFrame(step);
  }

  // Pipeline flow loop controller
  function runFlowSequence() {
    // 1. Pick a random source path
    const randomSourcePath = sourcePaths[Math.floor(Math.random() * sourcePaths.length)];
    
    // 2. Animate from source to Ingestion Box (1.2 seconds)
    animateParticle(randomSourcePath, 1200, () => {
      pulseStage("ingestion");
      
      // 3. Animate Ingest to Extract Box (0.6 seconds)
      setTimeout(() => {
        animateParticle("path-ingest-extract", 600, () => {
          pulseStage("extraction");
          
          // 4. Animate Extract to Cluster Box (0.6 seconds)
          setTimeout(() => {
            animateParticle("path-extract-cluster", 600, () => {
              pulseStage("clustering");
              
              // 5. Animate Cluster to Agent (0.6 seconds)
              setTimeout(() => {
                animateParticle("path-cluster-agent", 600, () => {
                  pulseStage("agent");
                });
              }, 150);
            });
          }, 150);
        });
      }, 150);
    });
  }

  // Periodic loop: spawn a particle sequence every 2.4 seconds
  let flowInterval = setInterval(runFlowSequence, 2400);

  // Trigger one immediately
  setTimeout(runFlowSequence, 500);

  // Expose safety clear method
  window.stopPipelineAnimation = function() {
    clearInterval(flowInterval);
  };

})();
