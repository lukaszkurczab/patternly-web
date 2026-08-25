const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const threeModuleUrl = "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.min.js";
let decisionFieldController = null;

async function initDecisionField() {
  const field = document.querySelector("[data-decision-field]");
  const canvas = document.querySelector("[data-decision-canvas]");
  if (!field || !canvas) return;
  if (reducedMotion) {
    field.dataset.renderState = "reduced-motion";
    return;
  }

  try {
    const THREE = await import(threeModuleUrl);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, canvas, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
    camera.position.z = 1;
    const pointer = new THREE.Vector2();
    const targetPointer = new THREE.Vector2();
    decisionFieldController = { targetPointer };

    const fallbackImage = field.querySelector("img");
    const textureUrl = fallbackImage?.currentSrc || fallbackImage?.src || "assets/visuals/decision-field.png";
    const texture = await new THREE.TextureLoader().loadAsync(textureUrl);
    texture.colorSpace = THREE.SRGBColorSpace;
    const fieldMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uPointer: { value: pointer },
        uTexture: { value: texture },
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        uniform float uTime;
        void main() {
          vUv = uv;
          vec3 transformed = position;
          transformed.z += sin(position.x * 3.2 + uTime * 0.18) * 0.012;
          transformed.z += cos(position.y * 2.1 - uTime * 0.14) * 0.009;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D uTexture;
        uniform float uTime;
        uniform vec2 uPointer;
        void main() {
          vec2 uv = vUv;
          uv += vec2(sin(uTime * 0.08 + uv.y * 2.0) * 0.003, cos(uTime * 0.07 + uv.x * 1.6) * 0.002);
          uv += uPointer * vec2(0.012, 0.008);
          vec4 color = texture2D(uTexture, uv);
          float vignette = smoothstep(1.12, 0.18, distance(vUv, vec2(0.58, 0.5)));
          color.rgb *= 0.88 + vignette * 0.16;
          color.a *= 0.9;
          gl_FragColor = color;
        }
      `,
    });
    const fieldMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2, 32, 32), fieldMaterial);
    scene.add(fieldMesh);

    const traceGroup = new THREE.Group();
    const traceMaterial = new THREE.LineBasicMaterial({ color: 0x5eead4, transparent: true, opacity: 0.28 });
    const traceAccentMaterial = new THREE.LineBasicMaterial({ color: 0x20c997, transparent: true, opacity: 0.52 });
    const tracePaths = [
      [[-0.88, -0.12], [-0.54, 0.05], [-0.22, -0.26], [0.06, 0.02], [0.38, 0.24], [0.92, 0.02]],
      [[-0.64, 0.66], [-0.34, 0.38], [-0.22, -0.26], [0.12, -0.62], [0.74, -0.72]],
      [[-0.78, -0.78], [-0.34, -0.48], [-0.22, -0.26], [0.12, 0.1], [0.74, 0.7]],
      [[-0.02, 0.9], [0.02, 0.42], [0.06, 0.02], [0.46, -0.22], [0.9, -0.34]],
    ];
    tracePaths.forEach((path, index) => {
      const points = path.map(([x, y]) => new THREE.Vector3(x, y, 0.03));
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), index === 0 ? traceAccentMaterial : traceMaterial);
      traceGroup.add(line);
    });
    scene.add(traceGroup);

    const nodePositions = [[-0.54, 0.05], [-0.22, -0.26], [0.06, 0.02], [0.38, 0.24], [0.74, 0.7], [0.74, -0.72], [-0.64, 0.66], [-0.78, -0.78]];
    const nodeGeometry = new THREE.BufferGeometry();
    nodeGeometry.setAttribute("position", new THREE.Float32BufferAttribute(nodePositions.flatMap(([x, y]) => [x, y, 0.05]), 3));
    const nodeMaterial = new THREE.PointsMaterial({ color: 0x5eead4, size: 0.035, transparent: true, opacity: 0.9, sizeAttenuation: false });
    const nodes = new THREE.Points(nodeGeometry, nodeMaterial);
    scene.add(nodes);

    const resize = () => {
      const bounds = field.getBoundingClientRect();
      renderer.setSize(Math.max(1, bounds.width), Math.max(1, bounds.height), false);
    };
    resize();
    const resizeObserver = "ResizeObserver" in window ? new ResizeObserver(resize) : null;
    resizeObserver?.observe(field);
    window.addEventListener("resize", resize, { passive: true });

    let fieldVisible = true;
    let pageVisible = document.visibilityState === "visible";
    let animationFrame = 0;
    field.classList.add("is-live");

    const startRendering = () => {
      if (!animationFrame && fieldVisible && pageVisible) animationFrame = requestAnimationFrame(render);
    };
    const handlePageVisibility = () => {
      pageVisible = document.visibilityState === "visible";
      if (pageVisible) startRendering();
    };
    document.addEventListener("visibilitychange", handlePageVisibility);
    const intersectionObserver = "IntersectionObserver" in window
      ? new IntersectionObserver(([entry]) => {
        fieldVisible = entry.isIntersecting;
        if (fieldVisible) startRendering();
      }, { threshold: 0.01 })
      : null;
    intersectionObserver?.observe(field);

    const render = (time) => {
      animationFrame = 0;
      if (!fieldVisible || !pageVisible) return;
      const seconds = time * 0.001;
      pointer.lerp(targetPointer, 0.045);
      fieldMaterial.uniforms.uTime.value = seconds;
      fieldMaterial.uniforms.uPointer.value = pointer;
      traceGroup.rotation.z = Math.sin(seconds * 0.12) * 0.012;
      traceGroup.position.y = Math.sin(seconds * 0.2) * 0.012;
      nodes.rotation.z = Math.sin(seconds * 0.1) * 0.008;
      renderer.render(scene, camera);
      startRendering();
    };
    startRendering();
  } catch {
    field.dataset.renderState = "fallback";
  }
}

function wireScrollProgress() {
  const progress = document.querySelector("[data-page-progress]");
  if (!progress) return;
  let updateFrame = 0;
  const update = () => {
    if (updateFrame) return;
    updateFrame = requestAnimationFrame(() => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = scrollable > 0 ? window.scrollY / scrollable : 0;
      progress.style.transform = `scaleY(${Math.min(1, Math.max(0, ratio))})`;
      updateFrame = 0;
    });
  };
  update();
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update, { passive: true });
}

function wireHeroField() {
  const hero = document.querySelector(".hero");
  if (!hero || reducedMotion || !window.matchMedia("(pointer: fine)").matches) return;
  let pointerFrame = 0;
  let nextFieldX = "0px";
  let nextFieldY = "0px";
  const applyPointer = () => {
    pointerFrame = 0;
    hero.style.setProperty("--field-x", nextFieldX);
    hero.style.setProperty("--field-y", nextFieldY);
  };
  hero.addEventListener("pointermove", (event) => {
    const bounds = hero.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - .5;
    const y = (event.clientY - bounds.top) / bounds.height - .5;
    nextFieldX = `${x * -18}px`;
    nextFieldY = `${y * -10}px`;
    if (!pointerFrame) pointerFrame = requestAnimationFrame(applyPointer);
    decisionFieldController?.targetPointer.set(x, y);
  });
  hero.addEventListener("pointerleave", () => {
    nextFieldX = "0px";
    nextFieldY = "0px";
    if (!pointerFrame) pointerFrame = requestAnimationFrame(applyPointer);
    decisionFieldController?.targetPointer.set(0, 0);
  });
}

function revealContent() {
  const items = document.querySelectorAll("[data-reveal]");
  if (reducedMotion || !("IntersectionObserver" in window)) {
    items.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver((entries, currentObserver) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      currentObserver.unobserve(entry.target);
    });
  }, { rootMargin: "0px 0px -8%" });

  items.forEach((item) => observer.observe(item));
}

function setCardState(card, selectedAnswer) {
  const buttons = card.querySelectorAll("[data-answer]");
  const isCorrect = selectedAnswer === "b";
  card.dataset.state = isCorrect ? "resolved" : "focused";

  buttons.forEach((button) => {
    const selected = button.dataset.answer === selectedAnswer;
    button.dataset.state = selected ? "selected" : "";
    button.classList.toggle("is-correct", selected && isCorrect);
    button.setAttribute("aria-pressed", String(selected));
  });

  return isCorrect;
}

function wirePracticeCards() {
  document.querySelectorAll("[data-interactive-card]").forEach((card) => {
    card.querySelectorAll("[data-answer]").forEach((button) => {
      button.addEventListener("click", () => {
        const isCorrect = setCardState(card, button.dataset.answer);
        const feedback = card.querySelector("[data-feedback-text]");
        const nextAction = card.querySelector("[data-next-action]");
        if (feedback) {
          feedback.textContent = isCorrect
            ? "The composite index follows leftmost-prefix ordering. Filtering by customer_id first lets the query narrow both dimensions without a scan."
            : "Not yet. Inspect the index order: the leading column needs to narrow the search before the date range can help. Try another option.";
        }
        if (nextAction) {
          nextAction.textContent = isCorrect ? "Review: composite index ordering" : "Inspect: leftmost-prefix ordering";
        }
        const status = card.querySelector(".session-status");
        if (status) status.textContent = isCorrect ? "Decision resolved" : "Selection noted — inspect the reason";
      });
    });
  });
}

function wireDetailsDisclosure() {
  document.querySelectorAll(".details-button").forEach((button) => {
    button.addEventListener("click", () => {
      const copy = button.parentElement?.querySelector("[data-details-copy]");
      if (!copy) return;
      const expanded = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", String(!expanded));
      button.querySelector("span").textContent = expanded ? "＋" : "－";
      copy.hidden = expanded;
    });
  });
}

function wireNextQuestion() {
  const button = document.querySelector("[data-next-question]");
  const card = button?.closest("[data-interactive-card]");
  if (!button || !card) return;
  button.addEventListener("click", () => {
    card.dataset.state = "neutral";
    card.querySelectorAll("[data-answer]").forEach((option) => {
      option.dataset.state = "";
      option.classList.remove("is-correct");
      option.setAttribute("aria-pressed", "false");
    });
    const feedback = card.querySelector("[data-feedback-text]");
    const status = card.querySelector(".session-status");
    if (feedback) feedback.textContent = "Choose an answer to inspect the reason behind the decision.";
    if (status) status.textContent = "Ready when you are";
    const details = card.querySelector("[data-details-copy]");
    const detailsButton = card.querySelector(".details-button");
    if (details) details.hidden = true;
    if (detailsButton) {
      detailsButton.setAttribute("aria-expanded", "false");
      detailsButton.querySelector("span").textContent = "＋";
    }
    card.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
  });
}

revealContent();
wireScrollProgress();
wireHeroField();
void initDecisionField();
wirePracticeCards();
wireDetailsDisclosure();
wireNextQuestion();
