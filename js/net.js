// Multi-browser support polyfill for requestAnimationFrame
// Falls back to using a setTimeout at 60 fps
window.requestAnimFrame =
  window.requestAnimationFrame ||
  window.webkitRequestAnimationFrame ||
  window.mozRequestAnimationFrame ||
  window.oRequestAnimationFrame ||
  window.msRequestAnimationFrame ||
  function (callback) {
    window.setTimeout(callback, 1000 / 60);
  }

// Settings to control net animation
let accuracy = 100;
let gravity = 1000;
let netY = 8;
let netX = 6;
let spacing = 50;
let friction = 0.95;

// Get the canvas element
let canvas = document.getElementById('canvas');
let context = canvas.getContext('2d');

// Set the canvas to fill the entire screen
canvas.width = 1100;
canvas.height = 1100;

// Define the net color
context.strokeStyle = '#fff';

let mouse = {
  influence: 100,   // Controls the size of the click area
  down: true,    // If the mouse is currently pressed
  x: 0,             // Current position
  y: 0,
  px: 0,            // Previous position
  py: 0
};

// Class to define points in the net
class Point {
  constructor (x, y) {
    this.x = x;
    this.y = y;
    this.px = x;
    this.py = y;
    this.vx = 0;
    this.vy = 0;

    // By default this point is not pinned
    this.pinX = null;
    this.pinY = null;

    // By default a point starts without any constraints
    this.constraints = [];
  }

  // Update function for each individual point
  update (delta) {
    // If the point is pinned, don't move
    if (this.pinX && this.pinY) return this;

    // If the user is clicking
    if (mouse.down) {
      // Determine the distance between this point and the mouse
      let dx = this.x - mouse.x;
      let dy = this.y - mouse.y;
      let dist = Math.sqrt(dx * dx + dy * dy);

      // If the point is within the influence of the mouse
      if (dist < mouse.influence) {
        // Overwrite the previous position of the point to move towards the mouse
        this.px = this.x - (mouse.x - mouse.px);
        this.py = this.y - (mouse.y - mouse.py);
      }
    }

    // Apply the force of gravity to the position of the point
    this.addForce(0, gravity);

    // New X and Y positions are calculated based on:
    // - the difference between the previous position and the current position multiplied by friction
    // - plus the velocity of the point multiplied by the update delta
    let nx = this.x + (this.x - this.px) * friction + this.vx * delta;
    let ny = this.y + (this.y - this.py) * friction + this.vy * delta;

    // Previous X and Y positions are now set to what the current X and Y position are
    this.px = this.x;
    this.py = this.y;

    // Update X and Y to the newly calculated position
    this.x = nx;
    this.y = ny;

    // Set X and Y velocity to 0. Reset between updates
    this.vy = this.vx = 0;

    return this;
  }

  draw () {
    // Loop through all of the constraints on this point and call the draw function on each
    let i = this.constraints.length;
    while (i--) this.constraints[i].draw();
  }

  resolve () {
    // If this point is pinned, don't move it
    if (this.pinX && this.pinY) {
      this.x = this.pinX;
      this.y = this.pinY;
      return;
    }

    // Loop through all of the constraints on this point and call the resolve function on each
    this.constraints.forEach((constraint) => constraint.resolve());
  }

  // Helper function to add a new constraint
  attach (point) {
    this.constraints.push(new Constraint(this, point));
  }

  // Helper function to remove a constraint
  free (constraint) {
    this.constraints.splice(this.constraints.indexOf(constraint), 1);
  }

  // Change the velocity of a point (used to simulate gravity)
  addForce (x, y) {
    this.vx += x;
    this.vy += y;
  }

  // Pin this point to specific coordinates
  pin () {
    this.pinX = this.x;
    this.pinY = this.y;
  }
}

// Class to define a constraint between two points
class Constraint {
  constructor (p1, p2) {
    this.p1 = p1;
    this.p2 = p2;
    this.length = spacing;
  }

  // Determine where the points should move based on their distance to each other
  resolve () {
    // Calculate the distance between the two points in the constraint
    let dx = this.p1.x - this.p2.x;
    let dy = this.p1.y - this.p2.y;
    let distance = Math.sqrt(dx * dx + dy * dy);

    // If the distance between points is less than the length of the line, the points don't need to move
    if (distance < this.length) return;

    // Otherwise, if the distance between the two points is longer than the line should be
    // Determine the distance each point should move to become closer together
    let diff = (this.length - distance) / distance;
    let mul = diff * 0.5 * (1 - this.length / distance);

    let px = dx * mul;
    let py = dy * mul;

    // Only change the position of points if they are not pinned
    !this.p1.pinX && (this.p1.x += px);
    !this.p1.pinY && (this.p1.y += py);
    !this.p2.pinX && (this.p2.x -= px);
    !this.p2.pinY && (this.p2.y -= py);

  }

  // Draw lines between points
  draw () {
    context.moveTo(this.p1.x, this.p1.y)
    context.lineTo(this.p2.x, this.p2.y)
  }
}

// Class to define the net, creates points and constraints
class Net {
  constructor () {
    // An array of every point in the net
    this.points = [];

    // Start the net in the middle of the canvas on the x axis
    let startX = canvas.width / 2 - netX * spacing / 2;

    //Start the net in the middle of the canvas on the y axis
    let startY = canvas.height / 2 - netY * spacing / 2;

    // Loop to create all points in the net
    for (let y = 0; y <= netY; y++) {
      for (let x = 0; x <= netX; x++) {
        // Create a new point at the desired location
        let point = new Point(startX + x * spacing, startY + y * spacing);

        // Pin all points in the first row of the net
        if(y == 0) {
          point.pin();
        }

        // Attach points to each other horizontally
        if(x !== 0 && y > 2) {
          point.attach(this.points[this.points.length - 1]);
        }

        // Attach points to each other vertically
        if(y !== 0) {
          point.attach(this.points[x + (y - 1) * (netX + 1)]);
        }

        // Add this new point to the array of all points
        this.points.push(point);
      }
    }
  }

  // Update function for the entire net
  update (delta) {
    // Accuracy determines how many times constraints should be resolved before rendering
    let i = accuracy;

    while (i--) {
      this.points.forEach((point) => {
        point.resolve();
      })
    }

    // Start drawing lines
    context.beginPath();

    // Loop through each point in the net, update its position, then draw it
    this.points.forEach((point) => {
      point.update(delta * delta).draw();
    })

    // Define the width of the lines in the net
    context.lineWidth = 4;
    context.stroke();
  }
}

// Canvas event handlers
function onballmove(event) {
  let rect = canvas.getBoundingClientRect();
  mouse.px = mouse.x;
  mouse.py = mouse.y;
  mouse.x = event.detail.ballX - rect.left;
  mouse.y = event.detail.ballY - rect.top;
}
canvas.addEventListener("ballmove", onballmove);
canvas.oncontextmenu = function(event) {
  event.preventDefault();
}

// Initialize the net object
let net = new Net();

// A recursive update function which calls itself
(function update () {
  // Clear the canvas
  context.clearRect(0, 0, canvas.width, canvas.height);

  // Redraw the net
  net.update(0.02);

  // Prevent the browser from locking up by waiting for the next animation frame
  window.requestAnimFrame(update);
})()