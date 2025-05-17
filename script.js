// script.js

// Aliases
const { Engine, Render, World, Bodies, Runner, Body, Query, Events, Composite } = Matter;

const CIRCLE_RADIUS = 80;
const TARGET_SIZE = 160;
const TEXTURE_PATH = 'circle-textures/';

function preloadImages(textureList) {
  return Promise.all(textureList.map(texture => {
    return new Promise(resolve => {
      const img = new window.Image();
      img.onload = function() {
        resolve({
          src: TEXTURE_PATH + texture,
          width: img.naturalWidth,
          height: img.naturalHeight
        });
      };
      img.src = TEXTURE_PATH + texture;
    });
  }));
}

function spawnCircle(image, render, world, radius = CIRCLE_RADIUS, targetSize = TARGET_SIZE) {
  const { width, height } = render.options;
  const xScale = targetSize / image.width;
  const yScale = targetSize / image.height;
  const circle = Bodies.circle(
    Math.random() * width,
    Math.random() * height,
    radius,
    {
      restitution: 0.9,
      friction: 0,
      render: {
        sprite: {
          texture: image.src,
          xScale: xScale,
          yScale: yScale
        }
      }
    }
  );
  Body.setVelocity(circle, {
    x: (Math.random() - 0.5) * 2,
    y: (Math.random() - 0.5) * 2
  });
  World.add(world, circle);
  return circle;
}

function createBounds(render) {
  const w = render.options.width;
  const h = render.options.height;
  return [
    Bodies.rectangle(w/2, -25, w, 40,  { isStatic: true, render: { visible: false } }),
    Bodies.rectangle(-25, h/2, 50, h,  { isStatic: true, render: { visible: false } }),
    Bodies.rectangle(w+50, h/2, 75, h, { isStatic: true, render: { visible: false } }),
    Bodies.rectangle(w/2, h+50, w, 100, { isStatic: true, render: { visible: false } })
  ];
}

export async function initPhysicsSimulation(canvasId = 'physics-canvas') {
  const engine = Engine.create({ gravity: { x: 0, y: 0 } });
  const world = engine.world;
  const canvas = document.getElementById(canvasId);
  const render = Render.create({
    canvas,
    engine,
    options: {
      width: canvas.clientWidth,
      height: canvas.clientHeight,
      wireframes: false,
      background: 'transparent'
    }
  });
  Render.run(render);
  Runner.run(Runner.create(), engine);

  // Create and add bounds
  let bounds = createBounds(render);
  World.add(world, bounds);

  // Handle resize
  window.addEventListener('resize', () => {
    render.canvas.width = canvas.clientWidth;
    render.canvas.height = canvas.clientHeight;
    World.remove(world, bounds);
    bounds = createBounds(render);
    World.add(world, bounds);
  });

  // Mouse bump
  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const range = { min: { x: mx - 50, y: my - 50 }, max: { x: mx + 50, y: my + 50 } };
    const nearby = Query.region(world.bodies, range);
    nearby.forEach(body => {
      if (!body.isStatic) {
        const force = 0.00002 * body.mass;
        const dx = body.position.x - mx;
        const dy = body.position.y - my;
        Body.applyForce(body, body.position, { x: dx * force, y: dy * force });
      }
    });
  });

  // Load textures and spawn circles
  const response = await fetch(TEXTURE_PATH + 'manifest.json');
  const textures = await response.json();
  const images = await preloadImages(textures);
  const spawnedCircles = images.map(img => spawnCircle(img, render, world));

  // Assign a random angular velocity (direction and speed) to each circle
  const circleAngularVelocities = spawnedCircles.map(() => {
    // Random speed between 0.0015 and 0.0025, random direction
    const speed = 0.0015 + Math.random() * 0.001;
    return Math.random() < 0.5 ? speed : -speed;
  });

  // Add very slow, random rotation to each circle
  Events.on(engine, 'beforeUpdate', function() {
    for (let i = 0; i < spawnedCircles.length; i++) {
      Body.setAngularVelocity(spawnedCircles[i], circleAngularVelocities[i]);
    }
  });
} 