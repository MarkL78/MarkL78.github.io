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
          yScale: yScale,
          width: image.width,
          height: image.height
        }
      }
    }
  );
  circle.spriteWidth = image.width;
  circle.spriteHeight = image.height;
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

  // Click to lock/unlock circles
  canvas.addEventListener('click', e => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    // Find the topmost circle under the mouse
    const clicked = Query.point(world.bodies, { x: mx, y: my })
      .find(body => body.circleRadius);
    if (clicked) {
      if (clicked.isStatic) {
        // Unlock: make dynamic
        Body.setStatic(clicked, false);
        // Give a little nudge so it doesn't just sit there
        Body.setVelocity(clicked, {
          x: (Math.random() - 0.5) * 2,
          y: (Math.random() - 0.5) * 2
        });
      } else {
        // Lock: make static
        Body.setVelocity(clicked, { x: 0, y: 0 });
        Body.setAngularVelocity(clicked, 0);
        Body.setStatic(clicked, true);
      }
    }
  });

  // Load textures and spawn circles
  const response = await fetch(TEXTURE_PATH + 'manifest.json');
  const textures = await response.json();
  const images = await preloadImages(textures);
  const spawnedCircles = images.map(img => spawnCircle(img, render, world));

  // Assign a random angular velocity (direction and speed) to each circle
  const circleAngularVelocities = spawnedCircles.map(() => {
    const speed = 0.0015 + Math.random() * 0.001;
    return Math.random() < 0.5 ? speed : -speed;
  });

  // Add very slow, random rotation to each circle
  Events.on(engine, 'beforeUpdate', function() {
    for (let i = 0; i < spawnedCircles.length; i++) {
      Body.setAngularVelocity(spawnedCircles[i], circleAngularVelocities[i]);
    }
  });

  // Circle growth/shrink on collision
  const MIN_RADIUS = 24;
  const MAX_RADIUS = 160;
  Events.on(engine, 'collisionStart', function(event) {
    for (const pair of event.pairs) {
      const a = pair.bodyA;
      const b = pair.bodyB;
      // Only handle circle-circle collisions
      if (a.circleRadius && b.circleRadius) {
        // Randomly pick which grows and which shrinks
        const grower = Math.random() < 0.5 ? a : b;
        const shrinker = grower === a ? b : a;
        // Amount to change (small, e.g., 2-6 px)
        const delta = 2 + Math.random() * 4;
        // Only apply if both will stay in bounds
        if (
          grower.circleRadius + delta <= MAX_RADIUS &&
          shrinker.circleRadius - delta >= MIN_RADIUS
        ) {
          // Update radii
          grower.circleRadius += delta;
          shrinker.circleRadius -= delta;
          // Update render scaling (sprite)
          if (grower.render.sprite) {
            const w = grower.spriteWidth || 96;
            const h = grower.spriteHeight || 96;
            grower.render.sprite.xScale = (grower.circleRadius * 2) / w;
            grower.render.sprite.yScale = (grower.circleRadius * 2) / h;
          }
          if (shrinker.render.sprite) {
            const w = shrinker.spriteWidth || 96;
            const h = shrinker.spriteHeight || 96;
            shrinker.render.sprite.xScale = (shrinker.circleRadius * 2) / w;
            shrinker.render.sprite.yScale = (shrinker.circleRadius * 2) / h;
          }
        }
      }
    }
  });
} 