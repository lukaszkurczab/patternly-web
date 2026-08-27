import { useEffect, useRef } from "react";

const nodePositions = [
  [-0.54, 0.05],
  [-0.22, -0.26],
  [0.06, 0.02],
  [0.38, 0.24],
  [0.74, 0.7],
  [0.74, -0.72],
  [-0.64, 0.66],
  [-0.78, -0.78],
];

const tracePaths = [
  [[-0.88, -0.12], [-0.54, 0.05], [-0.22, -0.26], [0.06, 0.02], [0.38, 0.24], [0.92, 0.02]],
  [[-0.64, 0.66], [-0.34, 0.38], [-0.22, -0.26], [0.12, -0.62], [0.74, -0.72]],
  [[-0.78, -0.78], [-0.34, -0.48], [-0.22, -0.26], [0.12, 0.1], [0.74, 0.7]],
  [[-0.02, 0.9], [0.02, 0.42], [0.06, 0.02], [0.46, -0.22], [0.9, -0.34]],
];

function drawPath(context, path, width, height, offset = 0) {
  context.beginPath();
  path.forEach(([x, y], index) => {
    const pointX = width * (x * 0.5 + 0.5);
    const pointY = height * (y * -0.5 + 0.5) + offset;
    if (index === 0) context.moveTo(pointX, pointY);
    else context.lineTo(pointX, pointY);
  });
  context.stroke();
}

export function DecisionField() {
  const fieldRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const field = fieldRef.current;
    const canvas = canvasRef.current;
    if (!field || !canvas) return undefined;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const context = canvas.getContext("2d");
    if (!context) {
      field.dataset.renderState = "fallback";
      return undefined;
    }

    let animationFrame = 0;
    let fieldVisible = true;
    let pageVisible = document.visibilityState === "visible";
    let width = 0;
    let height = 0;

    const resize = () => {
      const bounds = field.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      canvas.width = Math.floor(width * pixelRatio);
      canvas.height = Math.floor(height * pixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    const render = (time) => {
      animationFrame = 0;
      if (!fieldVisible || !pageVisible) return;

      const seconds = time * 0.001;
      context.clearRect(0, 0, width, height);

      const background = context.createRadialGradient(width * 0.72, height * 0.42, 0, width * 0.72, height * 0.42, Math.max(width, height) * 0.82);
      background.addColorStop(0, "rgba(28, 104, 116, 0.42)");
      background.addColorStop(0.44, "rgba(12, 52, 76, 0.24)");
      background.addColorStop(1, "rgba(8, 19, 40, 0)");
      context.fillStyle = background;
      context.fillRect(0, 0, width, height);

      context.lineWidth = 1;
      tracePaths.forEach((path, index) => {
        context.strokeStyle = index === 0 ? "rgba(94, 234, 212, 0.46)" : "rgba(94, 234, 212, 0.22)";
        context.globalAlpha = 0.72;
        drawPath(context, path, width, height, Math.sin(seconds * 0.2 + index) * height * 0.012);
      });

      nodePositions.forEach(([x, y], index) => {
        const pointX = width * (x * 0.5 + 0.5);
        const pointY = height * (y * -0.5 + 0.5);
        const isCenter = index === 2;
        const pulse = isCenter ? 1 + Math.sin(seconds * 2.4) * 0.18 : 1;
        context.globalAlpha = isCenter ? 0.95 : 0.72;
        context.fillStyle = isCenter ? "#20c997" : "#5eead4";
        context.beginPath();
        context.arc(pointX, pointY, (isCenter ? 5 : 3) * pulse, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = isCenter ? "rgba(32, 201, 151, 0.24)" : "rgba(94, 234, 212, 0.18)";
        context.lineWidth = 1;
        context.beginPath();
        context.arc(pointX, pointY, (isCenter ? 18 : 10) * pulse, 0, Math.PI * 2);
        context.stroke();
      });

      context.globalAlpha = 1;
      if (!reducedMotion) animationFrame = requestAnimationFrame(render);
    };

    const startRendering = () => {
      if (!animationFrame && fieldVisible && pageVisible && !reducedMotion) {
        animationFrame = requestAnimationFrame(render);
      }
    };
    const handleVisibility = () => {
      pageVisible = document.visibilityState === "visible";
      if (pageVisible) startRendering();
    };
    const resizeObserver = "ResizeObserver" in window ? new ResizeObserver(resize) : null;
    const intersectionObserver = "IntersectionObserver" in window
      ? new IntersectionObserver(([entry]) => {
          fieldVisible = Boolean(entry?.isIntersecting);
          if (fieldVisible) startRendering();
        }, { threshold: 0.01 })
      : null;

    resize();
    field.dataset.renderState = reducedMotion ? "reduced-motion" : "live";
    field.classList.toggle("is-live", !reducedMotion);
    resizeObserver?.observe(field);
    intersectionObserver?.observe(field);
    document.addEventListener("visibilitychange", handleVisibility);
    render(0);

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return (
    <div ref={fieldRef} className="hero-field" aria-hidden="true">
      <canvas ref={canvasRef} className="decision-canvas" />
    </div>
  );
}
